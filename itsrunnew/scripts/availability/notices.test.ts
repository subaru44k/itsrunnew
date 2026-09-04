import { describe, expect, it } from 'vitest';
import { parseChigasakiNotice, parseNishikyogokuNotice, parseYamashiroNotice } from './notices';

const nishikyogoku = JSON.stringify([{
  date: '2026-08-20T08:30:34',
  link: 'https://example.test/nishikyogoku-september/',
  title: { rendered: '西京極総合運動公園　陸上トラック 一般開放日 （９月分）' },
  content: { rendered: '<table><tr><th>2026年９月</th></tr><tr><th>開放施設</th><td>東寺ハウジングフィールド西京極（西京極補助競技場）</td></tr><tr><th>開放日時等</th><td>1日(火)、7日(月)～9日(水)、14日(月)<strong>7:00 ～ 21:00</strong></td></tr></table>' },
}]);

const chigasaki = JSON.stringify([{
  date: '2026-09-01T10:32:25',
  link: 'https://example.test/2026/09/01/17617/',
  title: { rendered: '9月の陸上個人利用日のご案内' },
  content: { rendered: '<div>【9月の陸上個人利用日のご案内】<br>9月1日（火） 14:30-19:00<br>9月4日（金） 14:30-22:00</div><div>※9月14日（月）は施設休館日<br>※9月21日（月祝）、9月22日(火祝)は開放無し</div>' },
}]);

const yamashiro = '<meta name="twitter:title" content="【陸上競技場個人利用のお知らせ】"><meta name="twitter:description" content="9月 4日（金） 9：00～21：00 9月 5日（土） 9：00～17：00 9月 6日（日） 利用不可"><meta property="article:published_time" content="2026-09-04 00:00:00">';

describe('facility notice parsers', () => {
  it('expands Nishikyogoku date ranges and leaves unlisted dates unknown', () => {
    expect(parseNishikyogokuNotice(nishikyogoku, '2026-09-08', 'https://example.test/search')).toMatchObject({
      status: 'partially_available', periods: [{ from: '07:00', to: '21:00', status: 'available' }],
    });
    expect(parseNishikyogokuNotice(nishikyogoku, '2026-09-02', 'https://example.test/search')).toMatchObject({ status: 'unknown', unknownReason: 'outside_published_period' });
  });

  it('parses Chigasaki explicit individual use and closures only', () => {
    expect(parseChigasakiNotice(chigasaki, '2026-09-04', 'https://example.test/search')).toMatchObject({
      status: 'partially_available', periods: [{ from: '14:30', to: '22:00', status: 'available' }],
    });
    expect(parseChigasakiNotice(chigasaki, '2026-09-14', 'https://example.test/search').status).toBe('unavailable');
    expect(parseChigasakiNotice(chigasaki, '2026-09-21', 'https://example.test/search').status).toBe('unavailable');
    expect(parseChigasakiNotice(chigasaki, '2026-09-03', 'https://example.test/search').status).toBe('unknown');
  });

  it('parses Yamashiro rolling times and explicit unavailable days', () => {
    expect(parseYamashiroNotice(yamashiro, '2026-09-04', 'https://example.test/yamashiro')).toMatchObject({
      status: 'partially_available', periods: [{ from: '09:00', to: '21:00', status: 'available' }],
    });
    expect(parseYamashiroNotice(yamashiro, '2026-09-06', 'https://example.test/yamashiro').status).toBe('unavailable');
    expect(parseYamashiroNotice(yamashiro, '2026-09-07', 'https://example.test/yamashiro').status).toBe('unknown');
    expect(parseYamashiroNotice(yamashiro, '2025-09-04', 'https://example.test/yamashiro').status).toBe('unknown');
  });

  it('fails closed when monthly identity anchors change', () => {
    expect(() => parseNishikyogokuNotice(nishikyogoku.replace('2026年９月', '2026年10月'), '2026-09-08', 'https://example.test/search')).toThrow(/anchor/);
    expect(parseChigasakiNotice(chigasaki, '2027-09-04', 'https://example.test/search').status).toBe('unknown');
    expect(() => parseYamashiroNotice(yamashiro.replace('個人利用', '専用利用'), '2026-09-04', 'https://example.test/yamashiro')).toThrow(/anchor/);
  });
});
