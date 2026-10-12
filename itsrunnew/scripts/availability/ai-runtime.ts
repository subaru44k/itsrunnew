import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import schema from './ai-schema.json';

export const AI_MODEL = 'gpt-5.6-luna';
export const AI_VERSION = 'luna-none-v2-production-1';
const AI_MODEL_6 = 'gpt-6-luna';
// Reviewed against the existing 5.6 readings; see research/availability/luna-feasibility/gpt6-effort-and-routing-2026-09-24.md.
const lowFacilities = new Set(['chita', 'hiratsuka', 'ogino']);
const mediumFacilities = new Set(['todoroki', 'ishin']);
export function aiReadingConfig(key: string) {
  if (lowFacilities.has(key))
    return {
      model: AI_MODEL_6,
      effort: 'low' as const,
      version: 'luna-low-v3-production-1',
      collector: `luna-low-${key}`,
    };
  if (mediumFacilities.has(key))
    return {
      model: AI_MODEL_6,
      effort: 'medium' as const,
      version: 'luna-medium-v3-production-1',
      collector: `luna-medium-${key}`,
    };
  return {
    model: AI_MODEL,
    effort: 'none' as const,
    version: AI_VERSION,
    collector: `luna-none-${key}`,
  };
}
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
  facilityKey?: string,
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
      (facilityKey !== undefined && row.id !== `${facilityKey}-${date}`) ||
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
  const reading = aiReadingConfig(packet.key);
  const instructions =
    options.instructions ??
    (await readFile(new URL('./ai-instructions.txt', import.meta.url), 'utf8'));
  // Hash semantic input, not acquisition time or volatile HTML markup. Full calendar months keep the key stable across daily horizons.
  const key = digest(
    JSON.stringify({
      version: reading.version,
      model: reading.model,
      reasoning: reading.effort,
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
  let rows = new Map<string, AiRow>();
  let usage: unknown = null;
  try {
    const cached = JSON.parse(await readFile(filename, 'utf8'));
    if (cached.key === key && cached.version === reading.version) {
      rows = validateRows(cached.result, packet.dates, packet.key);
      if (rows.size === packet.dates.length)
        return { rows, cacheHit: true, key, usage: null };
      console.warn(
        `AI availability ${packet.key}: incomplete cache; missing or invalid dates=${packet.dates.filter((date) => !rows.has(date)).join(',')}`,
      );
    }
  } catch {
    /* A missing/corrupt cache is never a source of availability. */
  }
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (rows.size) return { rows, cacheHit: true, key, usage: null };
    throw new Error('AI API key unavailable');
  }
  const requestReading = async (dates: string[]) => {
    const content: Record<string, unknown>[] = [
      {
        type: 'input_text',
        text: `${packet.name}\n対象日:${JSON.stringify(dates.map((date) => ({ id: `${packet.key}-${date}`, date })))}\n保存された公式資料だけを参照。資料にある年月と対象施設を確認する。`,
      },
    ];
    for (const source of packet.sources) {
      content.push({
        type: 'input_text',
        text: `資料ファイル: ${source.name}`,
      });
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
          model: reading.model,
          reasoning: { effort: reading.effort },
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
      body.model !== reading.model ||
      body.reasoning?.effort !== reading.effort
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
    usage = body.usage;
    return validateRows(result, dates, packet.key);
  };
  // Retry only missing/invalid records once. Explicit unknowns are valid answers.
  // Preserve validated dates, but never persist a partial reading.
  for (
    let attempt = 0;
    attempt < 2 && rows.size < packet.dates.length;
    attempt++
  ) {
    const missing = packet.dates.filter((date) => !rows.has(date));
    try {
      const received = await requestReading(missing);
      for (const [date, row] of received) rows.set(date, row);
    } catch (error) {
      if (!rows.size) throw error;
      console.warn(
        `AI availability ${packet.key}: repair request failed; retaining validated dates`,
      );
      break;
    }
    if (rows.size < packet.dates.length)
      console.warn(
        `AI availability ${packet.key}: missing or invalid dates=${packet.dates.filter((date) => !rows.has(date)).join(',')}`,
      );
  }
  if (!rows.size) throw new Error('AI output has no valid requested dates');
  if (rows.size < packet.dates.length)
    return { rows, cacheHit: false, key, usage };
  const result = { records: packet.dates.map((date) => rows.get(date)!) };
  await mkdir(directory, { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify({
      key,
      version: reading.version,
      model: reading.model,
      createdAt: new Date().toISOString(),
      result,
      usage,
    }),
    { mode: 0o600 },
  );
  await rename(temporary, filename);
  return { rows, cacheHit: false, key, usage };
}
