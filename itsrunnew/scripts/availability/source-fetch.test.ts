import { readFile, writeFile, truncate, stat } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createCurlFetch, createSourceFetch } from './source-fetch';

const connectError = () => new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });

describe('alternate official source transport', () => {
  it('uses curl only for a GET connection timeout and leaves the response readable', async () => {
    const native = vi.fn().mockRejectedValue(connectError());
    const alternate = vi.fn().mockResolvedValue(new Response('official schedule'));
    const onDiagnostic = vi.fn();
    const client = createSourceFetch(native as typeof fetch, { curlFetch: alternate as typeof fetch, onDiagnostic });
    expect(await (await client('https://example.test/schedule')).text()).toBe('official schedule');
    expect(onDiagnostic.mock.calls.map(([d]) => d)).toEqual([
      { source: 'https://example.test/schedule', phase: 'alternate', transport: 'curl', errorCode: 'UND_ERR_CONNECT_TIMEOUT' },
      { source: 'https://example.test/schedule', phase: 'alternate_response', transport: 'curl', status: 200 },
    ]);
    expect(native).toHaveBeenCalledOnce();
    expect(alternate).toHaveBeenCalledOnce();
    expect(alternate.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('does not replace HTTP failures, TLS verification failures, or collector POSTs', async () => {
    const alternate = vi.fn();
    for (const [method, code] of [['GET', 'CERT_HAS_EXPIRED'], ['POST', 'UND_ERR_CONNECT_TIMEOUT']]) {
      const native = vi.fn().mockRejectedValue(new TypeError('fetch failed', { cause: { code } }));
      await expect(createSourceFetch(native as typeof fetch, { curlFetch: alternate as typeof fetch, retryDelayMs: 0 })(
        'https://example.test/source', { method },
      )).rejects.toBeInstanceOf(TypeError);
    }
    const native = vi.fn().mockImplementation(async () => new Response('busy', { status: 503 }));
    expect((await createSourceFetch(native as typeof fetch, { curlFetch: alternate as typeof fetch, retryDelayMs: 0 })('https://example.test/source')).status).toBe(503);
    expect(alternate).not.toHaveBeenCalled();
  });

  it('honors cancellation and keeps a failed alternate transport a fetch failure', async () => {
    const native = vi.fn().mockRejectedValue(connectError());
    const alternate = vi.fn().mockRejectedValue(new TypeError('alternate failed'));
    const client = createSourceFetch(native as typeof fetch, { curlFetch: alternate as typeof fetch, retryDelayMs: 0 });
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(client('https://example.test/source', { signal: controller.signal })).rejects.toThrow('cancelled');
    expect(native).not.toHaveBeenCalled();
    await expect(client('https://example.test/source')).rejects.toBeInstanceOf(TypeError);
    expect(alternate).toHaveBeenCalledTimes(2);
  });

  it('retains binary bytes, final headers, HTTPS restrictions and cleanup', async () => {
    let bodyFile = '';
    const bytes = Buffer.from([0, 255, 1, 128]);
    const execute = vi.fn(async (command: string, args: string[]) => {
      expect(command).toBe('curl');
      expect(args).toContain('--compressed');
      expect(args).not.toContain('--insecure');
      expect(args).toContain('--location');
      expect(args.slice(args.indexOf('--proto'), args.indexOf('--proto') + 2)).toEqual(['--proto', '=https']);
      const headerFile = args[args.indexOf('--dump-header') + 1];
      bodyFile = args[args.indexOf('--output') + 1];
      await writeFile(headerFile, 'HTTP/1.1 301 Moved\r\nLocation: /new\r\n\r\nHTTP/2 200\r\nContent-Type: application/pdf\r\nContent-Encoding: gzip\r\n\r\n');
      await writeFile(bodyFile, bytes);
      return { stdout: '200\nhttps://example.test/new', stderr: '' };
    });
    const client = createCurlFetch(execute as Parameters<typeof createCurlFetch>[0]);
    const response = await client('https://example.test/pdf', { headers: { 'User-Agent': 'ItsRun' } });
    expect(response.status).toBe(200);
    expect(response.url).toBe('https://example.test/new');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    await expect(readFile(bodyFile)).rejects.toThrow();
  });

  it('keeps manual redirects manual and rejects insecure or authenticated requests', async () => {
    const execute = vi.fn(async (_: string, args: string[]) => {
      expect(args).not.toContain('--location');
      await writeFile(args[args.indexOf('--dump-header') + 1], 'HTTP/1.1 302 Found\r\nLocation: /new\r\n\r\n');
      await writeFile(args[args.indexOf('--output') + 1], '');
      return { stdout: '302\nhttps://example.test/source', stderr: '' };
    });
    const client = createCurlFetch(execute as Parameters<typeof createCurlFetch>[0]);
    expect((await client('https://example.test/source', { redirect: 'manual' })).headers.get('location')).toBe('/new');
    await expect(client('https://example.test/source', { redirect: 'error' })).rejects.toBeInstanceOf(TypeError);
    for (const [url, init] of [
      ['http://example.test/source', {}],
      ['https://user:pass@example.test/source', {}],
      ['https://example.test/source', { headers: { Authorization: 'secret' } }],
      ['https://example.test/source', { method: 'POST' }],
    ] as Array<[string, RequestInit]>) await expect(client(url, init)).rejects.toBeInstanceOf(TypeError);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('enforces the source size cap before reading and cleans up on failure', async () => {
    let bodyFile = '';
    const execute = vi.fn(async (_: string, args: string[]) => {
      bodyFile = args[args.indexOf('--output') + 1];
      await writeFile(bodyFile, '');
      await truncate(bodyFile, 20_000_001);
      return { stdout: '200\nhttps://example.test/source', stderr: '' };
    });
    await expect(createCurlFetch(execute as Parameters<typeof createCurlFetch>[0])('https://example.test/source')).rejects.toBeInstanceOf(TypeError);
    await expect(stat(bodyFile)).rejects.toThrow();
  });
});
