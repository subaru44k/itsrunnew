import { describe, expect, it, vi } from 'vitest';
import { aiFacilities, buildAiPacket, fullMonths } from './ai-sources';

describe('AI source dates', () => {
  it('uses whole calendar months for stable cache inputs across year and leap-day boundaries', () => {
    expect(fullMonths(['2026-12-31', '2027-01-01'])).toHaveLength(62);
    expect(fullMonths(['2028-02-28']).at(-1)).toBe('2028-02-29');
    expect(fullMonths(['2026-09-22', '2026-10-22'])).toEqual(fullMonths(['2026-09-23', '2026-10-23']));
  });
  it('discovers Chita next-year January as well as December, excluding older schedules', async () => {
    const fetchImpl = vi.fn(async (url: unknown) => new Response(String(url).endsWith('/info/105/')
      ? '<main>一般開放のご案内<a href="/dec.pdf">2026年12月の一般開放</a><a href="/jan.pdf">2027年1月の一般開放</a><a href="/old.pdf">2025年12月の一般開放</a><a href="/old-jan.pdf">2026年1月の一般開放</a></main>'
      : '公式資料の内容。掲載された対象日と時間の開放のみ。'));
    const packet = await buildAiPacket(aiFacilities.find(c => c.key === 'chita')!, ['2026-12-31', '2027-01-01'], new Date('2026-12-31T00:00:00Z'), fetchImpl as typeof fetch);
    expect(packet.sources.map(s => new URL(s.url).pathname)).toEqual(['/info/105/', '/dec.pdf', '/jan.pdf']);
  });
});
