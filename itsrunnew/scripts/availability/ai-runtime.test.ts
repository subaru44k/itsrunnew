import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import {
  AI_MODEL,
  readWithLuna,
  validateRows,
  type AiPacket,
} from './ai-runtime';
import { officialFetch, links } from './ai-source-utils';
const row = (date = '2026-09-22') => ({
  id: `sample-${date}`,
  date,
  status: 'partially_available',
  periods: [
    { start: '09:00', end: '17:00', scope: 'トラック', last_entry: '16:30' },
  ],
  conditions: ['予定変更あり'],
  evidence: [
    { source: 'schedule.txt', location: '当日', quote_or_symbol: '9-17' },
  ],
  unknown_reason: null,
});
const packet: AiPacket = {
  key: 'sample',
  trackId: 'sample-track',
  name: 'テスト競技場',
  landingPageUrl: 'https://example.test/',
  dates: ['2026-09-22', '2026-09-23'],
  sources: [
    {
      name: 'schedule.txt',
      url: 'https://example.test/',
      kind: 'text',
      content: '2026年9月22日 9-17',
      hash: 'original',
    },
  ],
};
describe('AI reading boundary', () => {
  it('keeps valid dates, ignores wrong IDs, drops missing/duplicate/outside dates without repairing', () => {
    expect(
      validateRows(
        { records: [{ ...row(), id: 'wrong-id' }, row('2026-10-01')] },
        packet.dates,
      ).size,
    ).toBe(1);
    expect(validateRows({ records: [row(), row()] }, packet.dates).size).toBe(
      0,
    );
    expect(
      validateRows(
        { records: [{ ...row(), date: 'sample-2026-09-22' }] },
        packet.dates,
      ).size,
    ).toBe(0);
  });
  it('rejects unsupported positive times and preserves entry deadlines', () => {
    for (const periods of [
      [],
      [{ start: '17:00', end: '09:00', scope: 'track', last_entry: null }],
      [{ start: null, end: '17:00', scope: 'track', last_entry: null }],
    ])
      expect(
        validateRows({ records: [{ ...row(), periods }] }, packet.dates).size,
      ).toBe(0);
    expect(
      validateRows({ records: [row()] }, packet.dates).get('2026-09-22')
        ?.periods[0].last_entry,
    ).toBe('16:30');
  });
  it('makes one none request, reuses a persistent reading, invalidates changed source or prompt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'itsrun-ai-test-'));
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      expect(request.model).toBe(AI_MODEL);
      expect(request.reasoning).toEqual({ effort: 'none' });
      expect(request.store).toBe(false);
      return Response.json({
        status: 'completed',
        model: AI_MODEL,
        reasoning: { effort: 'none' },
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ records: [row()] }),
              },
            ],
          },
        ],
        usage: { input_tokens: 10 },
      });
    });
    try {
      const options = {
        apiKey: 'test-key',
        fetchImpl: fetchImpl as typeof fetch,
        cacheDirectory: directory,
        instructions: 'fixed',
      };
      expect((await readWithLuna(packet, options)).cacheHit).toBe(false);
      expect((await readWithLuna(packet, options)).cacheHit).toBe(true);
      await readWithLuna(
        {
          ...packet,
          sources: [{ ...packet.sources[0], content: '変更', hash: 'changed' }],
        },
        options,
      );
      await readWithLuna(packet, { ...options, instructions: 'new-rule' });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('does not return incomplete model responses', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'itsrun-ai-test-'));
    try {
      await expect(
        readWithLuna(packet, {
          apiKey: 'test-key',
          cacheDirectory: directory,
          instructions: 'fixed',
          fetchImpl: (async () =>
            Response.json({ status: 'incomplete' })) as typeof fetch,
        }),
      ).rejects.toThrow('incomplete');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('blocks unapproved redirect destinations before requesting them', async () => {
    const f = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/private' },
        }),
    );
    await expect(
      officialFetch(
        'https://example.test/',
        ['example.test'],
        f as typeof fetch,
      ),
    ).rejects.toThrow('allowlist');
    expect(f).toHaveBeenCalledTimes(1);
    expect(
      links(
        '<a href="/schedule.pdf?a=1&amp;b=2">9月予定</a>',
        'https://example.test/',
      )[0],
    ).toEqual({
      url: 'https://example.test/schedule.pdf?a=1&b=2',
      label: '9月予定',
    });
  });
});
