import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createMonitorFetch, type MonitorFetchOptions, type MonitorFetchDiagnostic } from './monitor-fetch';

const executeCurl = promisify(execFile);
const MAX_BYTES = 20_000_000;

/** HTTPS-only alternate transport for public GET/HEAD requests. TLS validation stays enabled. */
export function createCurlFetch(execute: typeof executeCurl = executeCurl): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const redirect = init?.redirect ?? (input instanceof Request ? input.redirect : 'follow');
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.protocol !== 'https:' || url.username || url.password || !['GET', 'HEAD'].includes(method)
      || [...headers.keys()].some(name => !['user-agent', 'accept', 'accept-language'].includes(name))) {
      throw new TypeError('Unsupported alternate source request');
    }
    const directory = await mkdtemp(join(tmpdir(), 'itsrun-source-'));
    try {
      const headerFile = join(directory, 'headers');
      const bodyFile = join(directory, 'body');
      const args = ['--silent', '--show-error', '--compressed', '--proto', '=https', '--proto-redir', '=https',
        '--connect-timeout', '10', '--max-time', '20', '--max-redirs', '5', '--max-filesize', String(MAX_BYTES),
        '--dump-header', headerFile, '--output', bodyFile, '--write-out', '%{http_code}\n%{url_effective}'];
      if (redirect !== 'manual' && redirect !== 'error') args.push('--location');
      if (method === 'HEAD') args.push('--head');
      for (const [name, value] of headers) args.push('--header', `${name}: ${value}`);
      args.push('--url', url.href);
      const { stdout } = await execute('curl', args, { timeout: 21_000, maxBuffer: 32_768, signal: signal ?? undefined });
      const [statusText, effectiveUrl] = String(stdout).trim().split('\n');
      const status = Number(statusText);
      if (redirect === 'error' && [301, 302, 303, 307, 308].includes(status)) throw new TypeError('Alternate source redirect rejected');
      if (!Number.isInteger(status) || status < 200 || status > 599) throw new TypeError('Invalid alternate source response');
      if ((await stat(bodyFile)).size > MAX_BYTES) throw new TypeError('Alternate source too large');
      const blocks = (await readFile(headerFile, 'utf8')).trim().split(/\r?\n\r?\n/);
      const final = blocks.filter(block => /^HTTP\//.test(block)).at(-1);
      if (!final) throw new TypeError('Missing alternate source headers');
      const responseHeaders = new Headers();
      for (const line of final.split(/\r?\n/).slice(1)) {
        const separator = line.indexOf(':');
        if (separator > 0) responseHeaders.append(line.slice(0, separator), line.slice(separator + 1).trim());
      }
      // curl --compressed already decoded the bytes.
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('content-length');
      const body = method === 'HEAD' || [204, 205, 304].includes(status) ? null : new Uint8Array(await readFile(bodyFile));
      const response = new Response(body, { status, headers: responseHeaders });
      Object.defineProperty(response, 'url', { value: effectiveUrl || url.href });
      return response;
    } catch (error) {
      throw new TypeError('Alternate source fetch failed', { cause: error });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

/** The fallback is only for Undici connection timeouts, never HTTP errors or invalid TLS certificates. */
export function createSourceFetch(
  fetchImpl: typeof fetch = fetch,
  options: MonitorFetchOptions & { curlFetch?: typeof fetch } = {},
): typeof fetch {
  const alternate = options.curlFetch ?? createCurlFetch();
  const report = (diagnostic: MonitorFetchDiagnostic) => {
    if (options.onDiagnostic) options.onDiagnostic(diagnostic);
    else console.warn(`Availability transport: ${JSON.stringify(diagnostic)}`);
  };
  return createMonitorFetch(async (input, init) => {
    try { return await fetchImpl(input, init); }
    catch (error) {
      const code = error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause ? error.cause.code : undefined;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (code !== 'UND_ERR_CONNECT_TIMEOUT' || !['GET', 'HEAD'].includes(method)) throw error;
      const url = new URL(input instanceof Request ? input.url : String(input));
      const source = `${url.origin}${url.pathname}`;
      report({ source, phase: 'alternate', transport: 'curl', errorCode: code });
      const response = await alternate(input, init);
      report({ source, phase: 'alternate_response', transport: 'curl', status: response.status });
      return response;
    }
  }, options);
}
