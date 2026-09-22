import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import schema from './ai-schema.json';

export const AI_MODEL = 'gpt-5.6-luna';
export const AI_VERSION = 'luna-none-v2-production-1';
export interface AiSource {
  name: string;
  url: string;
  kind: 'text' | 'image';
  content: string;
  mime?: string;
  hash: string;
}
export interface AiPacket {
  key: string;
  trackId: string;
  name: string;
  landingPageUrl: string;
  sources: AiSource[];
  dates: string[];
}
export interface AiRow {
  id: string;
  date: string;
  status: 'available' | 'partially_available' | 'unavailable' | 'unknown';
  periods: {
    start: string | null;
    end: string | null;
    scope: string;
    last_entry: string | null;
  }[];
  conditions: string[];
  evidence: { source: string; location: string; quote_or_symbol: string }[];
  unknown_reason: string | null;
}
export const digest = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const validTime = (value: unknown) =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validateRows(
  value: unknown,
  dates: string[],
): Map<string, AiRow> {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as { records?: unknown }).records)
  )
    throw new Error('AI output schema invalid');
  const rows = (value as { records: unknown[] }).records;
  const result = new Map<string, AiRow>();
  for (const date of dates) {
    const matches = rows.filter(
      (r) => r && typeof r === 'object' && (r as AiRow).date === date,
    );
    if (matches.length !== 1) continue;
    const row = matches[0] as AiRow;
    if (
      !validDate(date) ||
      typeof row.id !== 'string' ||
      !['available', 'partially_available', 'unavailable', 'unknown'].includes(
        row.status,
      ) ||
      !Array.isArray(row.conditions) ||
      !row.conditions.every((c) => typeof c === 'string' && c.length <= 2000) ||
      !Array.isArray(row.evidence) ||
      !row.evidence.every(
        (e) =>
          e &&
          ['source', 'location', 'quote_or_symbol'].every(
            (k) => typeof e[k as keyof typeof e] === 'string',
          ),
      ) ||
      !(
        row.unknown_reason === null || typeof row.unknown_reason === 'string'
      ) ||
      !Array.isArray(row.periods) ||
      row.periods.length > 24
    )
      continue;
    const positive = ['available', 'partially_available'].includes(row.status);
    if (positive && (!row.periods.length || !row.evidence.length)) continue;
    if (
      row.periods.some(
        (p) =>
          !p ||
          !validTime(p.start) ||
          !(validTime(p.end) || p.end === '24:00') ||
          p.start! >= p.end! ||
          typeof p.scope !== 'string' ||
          !(p.last_entry === null || validTime(p.last_entry)),
      )
    )
      continue;
    if (!positive && row.periods.length) continue;
    result.set(date, row);
  }
  return result;
}

export async function readWithLuna(
  packet: AiPacket,
  options: {
    apiKey?: string;
    fetchImpl?: typeof fetch;
    cacheDirectory?: string;
    instructions?: string;
  } = {},
) {
  const instructions =
    options.instructions ??
    (await readFile(new URL('./ai-instructions.txt', import.meta.url), 'utf8'));
  // Hash semantic input, not acquisition time or volatile HTML markup. Full calendar months keep the key stable across daily horizons.
  const key = digest(
    JSON.stringify({
      version: AI_VERSION,
      model: AI_MODEL,
      reasoning: 'none',
      instructions,
      schema,
      packet,
    }),
  );
  const directory = resolve(
    options.cacheDirectory ??
      process.env.ITSRUN_AI_CACHE_DIR ??
      '.cache/availability-ai',
  );
  const filename = resolve(directory, `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(filename, 'utf8'));
    if (cached.key === key && cached.version === AI_VERSION) {
      const rows = validateRows(cached.result, packet.dates);
      if (rows.size) return { rows, cacheHit: true, key, usage: null };
    }
  } catch {
    /* A missing/corrupt cache is never a source of availability. */
  }
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('AI API key unavailable');
  const content: Record<string, unknown>[] = [
    {
      type: 'input_text',
      text: `${packet.name}\n対象日:${JSON.stringify(packet.dates.map((date) => ({ id: `${packet.key}-${date}`, date })))}\n保存された公式資料だけを参照。資料にある年月と対象施設を確認する。`,
    },
  ];
  for (const source of packet.sources) {
    content.push({ type: 'input_text', text: `資料ファイル: ${source.name}` });
    content.push(
      source.kind === 'text'
        ? { type: 'input_text', text: source.content }
        : {
            type: 'input_image',
            image_url: `data:${source.mime ?? 'image/png'};base64,${source.content}`,
            detail: 'high',
          },
    );
  }
  const response = await (options.fetchImpl ?? fetch)(
    'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      signal: AbortSignal.timeout(180000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        reasoning: { effort: 'none' },
        instructions,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'availability',
            strict: true,
            schema,
          },
        },
        max_output_tokens: 32000,
        store: false,
      }),
    },
  );
  // Never publish/log response bodies or thrown request headers (credentials).
  if (!response.ok)
    throw new Error(`AI request failed (HTTP ${response.status})`);
  const body = await response.json();
  if (
    body.status !== 'completed' ||
    body.model !== AI_MODEL ||
    body.reasoning?.effort !== 'none'
  )
    throw new Error('AI response incomplete or model mismatch');
  const text = (body.output ?? [])
    .flatMap(
      (o: { content?: { type: string; text?: string }[] }) => o.content ?? [],
    )
    .filter((c: { type: string }) => c.type === 'output_text')
    .map((c: { text: string }) => c.text)
    .join('');
  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error('AI output JSON invalid');
  }
  const rows = validateRows(result, packet.dates);
  if (!rows.size) throw new Error('AI output has no valid requested dates');
  await mkdir(directory, { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify({
      key,
      version: AI_VERSION,
      model: AI_MODEL,
      createdAt: new Date().toISOString(),
      result,
      usage: body.usage,
    }),
    { mode: 0o600 },
  );
  await rename(temporary, filename);
  return { rows, cacheHit: false, key, usage: body.usage };
}
