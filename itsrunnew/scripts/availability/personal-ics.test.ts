import { describe, expect, it } from 'vitest';
import { parsePersonalIcs } from './personal-ics';

function event(properties: string[]) {
  return ['BEGIN:VEVENT', ...properties, 'END:VEVENT'].join('\r\n');
}

function calendar(...events: string[]) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
}

describe('parsePersonalIcs', () => {
  it('maps the current Kobe AM, PM, and night labels to the official slots', () => {
    const ics = calendar(
      event([
        'DTSTART;VALUE=DATE:20260901',
        'DTEND;VALUE=DATE:20260902',
        'STATUS:CONFIRMED',
        'SUMMARY:〇AM　個人利用',
      ]),
      event([
        'DTSTART;VALUE=DATE:20260901',
        'DTEND;VALUE=DATE:20260902',
        'STATUS:CONFIRMED',
        'SUMMARY:〇PM　個人利用',
      ]),
      event([
        'DTSTART;VALUE=DATE:20260901',
        'DTEND;VALUE=DATE:20260902',
        'STATUS:CONFIRMED',
        'SUMMARY:〇夜間　個人利用',
      ]),
    );

    const result = parsePersonalIcs(ics, '2026-09-01', 'kobe');

    expect(result.status).toBe('partially_available');
    expect(result.periods.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: '09:00', to: '12:00' },
      { from: '13:00', to: '17:00' },
      { from: '17:00', to: '19:00' },
    ]);
    expect(result.periods[0].conditions).toContain('利用時間終了30分前までに発券・受付');
    expect(result.periods[2].conditions).toContain('夜間は4〜10月の日曜・祝日以外のみ、17:15までに発券・受付');
    expect(result.warnings).toEqual([]);
    const sunday = calendar(event(['DTSTART;VALUE=DATE:20260906', 'DTEND;VALUE=DATE:20260907', 'SUMMARY:〇夜間 個人利用']));
    expect(parsePersonalIcs(sunday, '2026-09-06', 'kobe').status).toBe('unknown');
  });

  it('parses Ichihara fullwidth ranges and merges adjacent current calendar examples', () => {
    const ics = calendar(
      event([
        'DTSTART;VALUE=DATE:20260930',
        'DTEND;VALUE=DATE:20261001',
        'STATUS:CONFIRMED',
        'SUMMARY:午前　〇',
        'DESCRIPTION:０９：００～１３：００',
      ]),
      event([
        'DTSTART;VALUE=DATE:20260930',
        'DTEND;VALUE=DATE:20261001',
        'STATUS:CONFIRMED',
        'SUMMARY:午後　〇',
        'DESCRIPTION:１３：００～１７：００',
      ]),
    );

    const result = parsePersonalIcs(ics, '2026-09-30', 'ichihara');

    expect(result.status).toBe('partially_available');
    expect(result.periods).toMatchObject([{ from: '09:00', to: '17:00', status: 'available' }]);
    expect(result.periods).toHaveLength(1);
  });

  it('uses VALUE=DATE DTEND as an exclusive end and preserves the event year', () => {
    const ics = calendar(event([
      'DTSTART;VALUE=DATE:20250901',
      'DTEND;VALUE=DATE:20250902',
      'SUMMARY:〇AM　個人利用',
    ]));

    expect(parsePersonalIcs(ics, '2025-09-01', 'kobe').status).toBe('partially_available');
    expect(parsePersonalIcs(ics, '2025-09-02', 'kobe').status).toBe('unknown');
    expect(parsePersonalIcs(ics, '2026-09-01', 'kobe').status).toBe('unknown');
  });

  it('does not infer closure for an unlisted date and never treats canceled use as positive', () => {
    const ics = calendar(
      event([
        'DTSTART;VALUE=DATE:20260922',
        'DTEND;VALUE=DATE:20260923',
        'SUMMARY:✕【個人利用】',
      ]),
      event([
        'DTSTART;VALUE=DATE:20260923',
        'DTEND;VALUE=DATE:20260924',
        'STATUS:CANCELLED',
        'SUMMARY:〇AM　個人利用',
      ]),
    );

    expect(parsePersonalIcs(ics, '2026-09-22', 'kobe').status).toBe('unknown');
    expect(parsePersonalIcs(ics, '2026-09-23', 'kobe').status).toBe('unknown');
    expect(parsePersonalIcs(ics, '2026-09-24', 'kobe').status).toBe('unknown');
    expect(parsePersonalIcs(ics, '2026-09-23', 'kobe').warnings.join('\n')).toContain('CANCELLED');
  });

  it('skips unsupported recurrence while accepting an independent dated event', () => {
    const ics = calendar(
      event([
        'DTSTART;VALUE=DATE:20260901',
        'DTEND;VALUE=DATE:20260902',
        'RRULE:FREQ=DAILY',
        'SUMMARY:〇AM　個人利用',
      ]),
      event([
        'DTSTART;VALUE=DATE:20260901',
        'DTEND;VALUE=DATE:20260902',
        'SUMMARY:〇PM　個人利用',
      ]),
    );

    const result = parsePersonalIcs(ics, '2026-09-01', 'kobe');
    expect(result.status).toBe('partially_available');
    expect(result.periods).toMatchObject([{ from: '13:00', to: '17:00' }]);
    expect(result.warnings).toContain('繰り返しイベントは未対応です。');

    const recurrenceOnly = parsePersonalIcs(ics.replace(/\r\nBEGIN:VEVENT[\s\S]*?\r\nEND:VEVENT(?=\r\nEND:VCALENDAR)/, ''), '2026-09-01', 'kobe');
    expect(recurrenceOnly.status).toBe('unknown');
  });

  it('resolves UTC and Asia/Tokyo timed events, while rejecting an unknown timezone', () => {
    const utc = calendar(event([
      'DTSTART:20260901T150000Z',
      'DTEND:20260901T160000Z',
      'SUMMARY:午前　〇',
      'DESCRIPTION:09:00~12:00',
    ]));
    expect(parsePersonalIcs(utc, '2026-09-02', 'ichihara').status).toBe('partially_available');
    expect(parsePersonalIcs(utc, '2026-09-01', 'ichihara').status).toBe('unknown');

    const tokyo = calendar(event([
      'DTSTART;TZID=Asia/Tokyo:20260902T090000',
      'DTEND;TZID=Asia/Tokyo:20260902T100000',
      'SUMMARY:午前　〇',
      'DESCRIPTION:09:00~12:00',
    ]));
    expect(parsePersonalIcs(tokyo, '2026-09-02', 'ichihara').status).toBe('partially_available');

    const unknownTimezone = calendar(event([
      'DTSTART;TZID=Europe/London:20260902T090000',
      'DTEND;TZID=Europe/London:20260902T100000',
      'SUMMARY:午前　〇',
      'DESCRIPTION:09:00~12:00',
    ]));
    const result = parsePersonalIcs(unknownTimezone, '2026-09-02', 'ichihara');
    expect(result.status).toBe('unknown');
    expect(result.warnings.join('\n')).toContain('タイムゾーン');
  });

  it('unfolds folded lines and rejects invalid explicit times and dates', () => {
    const folded = calendar(event([
      'DTSTART;VALUE=DATE:20260901',
      'DTEND;VALUE=DATE:20260902',
      'SUMMARY:〇AM　個人',
      ' 利用',
    ]));
    expect(parsePersonalIcs(folded, '2026-09-01', 'kobe').status).toBe('partially_available');

    const invalidTime = calendar(event([
      'DTSTART;VALUE=DATE:20260901',
      'DTEND;VALUE=DATE:20260902',
      'SUMMARY:午前　〇',
      'DESCRIPTION:２５：００～１７：００',
    ]));
    const invalidTimeResult = parsePersonalIcs(invalidTime, '2026-09-01', 'ichihara');
    expect(invalidTimeResult.status).toBe('unknown');
    expect(invalidTimeResult.warnings).toContain('DESCRIPTIONの時間帯が不正です。');

    expect(parsePersonalIcs(calendar(event([
      'DTSTART;VALUE=DATE:20260931',
      'DTEND;VALUE=DATE:20261001',
      'SUMMARY:〇AM　個人利用',
    ])), '2026-09-30', 'kobe').status).toBe('unknown');
    expect(parsePersonalIcs(calendar(event([
      'DTSTART;VALUE=DATE:20260110',
      'DTEND;VALUE=DATE:20260111',
      'SUMMARY:〇夜間　個人利用',
    ])), '2026-01-10', 'kobe').status).toBe('unknown');
    expect(parsePersonalIcs('x'.repeat(4_000_001), '2026-09-01', 'kobe').status).toBe('unknown');
  });
});
