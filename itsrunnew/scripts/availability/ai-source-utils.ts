import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest, type AiSource } from './ai-runtime';
const exec = promisify(execFile);
export function decodeEntities(text: string) {
  return text
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, value: string) => {
      const n =
        value[0].toLowerCase() === 'x'
          ? parseInt(value.slice(1), 16)
          : Number(value);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}
export function htmlText(html: string) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  return decodeEntities(
    main
      .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, '\n'),
  )
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
export function links(html: string, base: string) {
  const result: { url: string; label: string }[] = [];
  for (const m of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      result.push({
        url: new URL(decodeEntities(m[1]), base).href,
        label: htmlText(m[2]),
      });
    } catch {
      /* non-URL anchor */
    }
  }
  return result;
}
export function images(html: string, base: string) {
  const result: { url: string; label: string }[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];
    if (!src) continue;
    try {
      result.push({
        url: new URL(decodeEntities(src), base).href,
        label: /\balt\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1] ?? '',
      });
    } catch {
      /* non-URL image */
    }
  }
  return result;
}
export async function officialFetch(
  url: string,
  allowedHosts: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; data: Buffer }> {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== '443') ||
      !allowedHosts.includes(parsed.hostname)
    )
      throw new Error('Official source URL outside allowlist');
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'ItsRun availability collector' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Source redirect without location');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok)
      throw new Error(`Official source HTTP ${response.status}`);
    if (Number(response.headers.get('content-length') ?? 0) > 20_000_000)
      throw new Error('Official source too large');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Official source empty body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20_000_000) {
        await reader.cancel();
        throw new Error('Official source too large');
      }
      chunks.push(value);
    }
    return { url, data: Buffer.concat(chunks) };
  }
  throw new Error('Too many official source redirects');
}
export async function sourceInputs(
  name: string,
  url: string,
  data: Buffer,
): Promise<AiSource[]> {
  if (data.subarray(0, 5).toString() === '%PDF-') {
    const directory = await mkdtemp(join(tmpdir(), 'itsrun-ai-pdf-'));
    try {
      const input = join(directory, 'source.pdf');
      await writeFile(input, data);
      const info = await exec('pdfinfo', [input], {
        timeout: 30000,
        maxBuffer: 100000,
      });
      const pages = Number(/^Pages:\s+(\d+)/m.exec(info.stdout)?.[1]);
      if (!pages || pages > 8) throw new Error('PDF page limit exceeded');
      await exec(
        'pdftoppm',
        ['-scale-to', '1800', '-png', input, join(directory, 'page')],
        { timeout: 60000, maxBuffer: 100000 },
      );
      const files = (await readdir(directory))
        .filter((f) => /^page-\d+\.png$/.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (files.length !== pages) throw new Error('PDF rendering incomplete');
      return await Promise.all(
        files.map(async (file, index) => {
          const png = await readFile(join(directory, file));
          return {
            name: `${name}-page-${index + 1}.png`,
            url,
            kind: 'image' as const,
            content: png.toString('base64'),
            mime: 'image/png',
            hash: digest(png),
          };
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  if (
    data.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])) ||
    data.subarray(0, 2).equals(Buffer.from([255, 216]))
  )
    return [
      {
        name,
        url,
        kind: 'image',
        content: data.toString('base64'),
        mime: data[0] === 137 ? 'image/png' : 'image/jpeg',
        hash: digest(data),
      },
    ];
  const charset =
    /<meta[^>]+charset=["']?([^\s"'/>]+)/i.exec(data.toString('ascii'))?.[1] ??
    'utf-8';
  const decoded = new TextDecoder(
    /shift|sjis|cp932/i.test(charset) ? 'shift_jis' : 'utf-8',
  ).decode(data);
  const text = htmlText(decoded);
  if (text.length < 20 || text.length > 150000)
    throw new Error('Official source text size invalid');
  return [{ name, url, kind: 'text', content: text, hash: digest(text) }];
}
