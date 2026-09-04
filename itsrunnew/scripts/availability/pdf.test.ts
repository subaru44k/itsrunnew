import { describe, expect, it, vi } from 'vitest';
import {
  createPdfCollector,
  extractPdf,
  parseAgeoPdf,
  parseBingoSportsParkPdf,
  parseFuchuPdf,
  parseFujimoriPdf,
  parseIchikawaKohnodaiPdf,
  parseKamiyugiPdf,
  parseKanagawaSportsCenterPdf,
  parseExpo70Pdf,
  parseMisatoPdf,
  parseNerimaPdf,
  parseTodaPdf,
  parseWadaboriPdf,
  pdfSourceConfigs,
  type ExtractedPdf,
  type PdfTextItem,
} from './pdf';

const item = (text: string, x: number, y: number, page = 1): PdfTextItem => ({ text, x, y, width: text.length * 8, page });
const document = (anchors: string[], items: PdfTextItem[]): ExtractedPdf => ({
  pageCount: 1,
  items,
  text: [...anchors, ...items.map(value => value.text)].join('\n'),
});

const nerima = document(
  ['練馬総合運動場公園陸上競技場の開放状況', '1枠目', '2枠目', '3枠目', '陸上トラック優先利用時間', '人工芝 優先利用時間', '2026/8/21更新'],
  [
    item('8/23', 50, 600), item('8/24', 50, 580), item('8/25', 50, 560),
    item('陸上トラック優先利用時間', 100, 580),
    item('人工芝 優先利用時間 ※陸上競技の練習不可', 250, 580),
  ],
);

const toda = document(
  ['戸田市スポーツセンター行事予定表', '令和8年 8月', '陸上競技場', '17:00~18:00'],
  [
    item('24', 40, 620), item('29', 40, 600), item('30', 40, 580), item('31', 40, 560),
    item('陸上競技場', 366, 580), item('9:00~17:00', 464, 580), item('○', 537, 580),
  ],
);

const wada = (facility: 'first' | 'second') => document(
  [facility === 'first' ? '第1競技場(和田堀公園)' : '第2競技場(済美山運動公園)', '2026年', '8月', '午前(9:00~12:00)', '午後(13:00~17:00)', '一般開放', '貸切', '整備日'],
  [item('23', 40, 600), item('24', 40, 580), item('25', 40, 560), item(facility === 'first' ? '貸切' : '整備日', 500, 580), ...(facility === 'second' ? [item('整備日', 200, 580)] : [])],
);

const misato = document(
  ['陸上競技場 8月分スケジュール', '専用利用日', '共用利用日', '空欄:予約可能日', '共用利用は13時まで', '共用利用は18時まで'],
  [
    item('23', 67, 600), item('24', 67, 580), item('25', 67, 560),
    item('専用利用', 160, 580), item('専用利用', 300, 580), item('共用利用', 450, 580),
  ],
);

const ageo = document(
  ['上尾陸上競技場', '個人利用日予定表', '令和8年 8月', '利用時間', '利用時間は1回4時間まで'],
  [item('27日', 53, 580), item('9:00~18:00', 180, 580)],
);

const fujimori = document(
  ['東京フットボールセンター八王子富士森競技場', '一般開放状況', '○印の区分は一般開放します', '8月', '地域開放', '8月19日更新'],
  [
    item('8月', 196.8, 760), item('23', 86.8, 600), item('24', 86.8, 580), item('25', 86.8, 560),
    item('○', 176, 580), item('○', 216, 580), item('○', 260, 580), item('○', 303, 580),
  ],
);

const kamiyugi = document(
  ['八王子市上柚木公園陸上競技場一般開放状況', '〇印の区分は一般開放します', '8月', '8:45', '12:45', '16:45', '【8/19更新】'],
  [
    item('8月', 191.8, 760),
    item('24', 98.3, 220), item('○', 174.3, 220.4), item('○', 231.8, 220.4), item('○', 289.4, 220.4),
    item('27', 98.3, 160.6), item('整備', 168.4, 161), item('整備', 225.9, 161), item('ー', 289.4, 161),
  ],
);

const kanagawa = document(
  ['県立スポーツセンター', '令和8年9月分', '個人・団体利用可能予定日時', '（「〇」が利用可能予定の日時です）', '陸上競技場'],
  [
    item('3', 113, 689), item('木', 156, 689), item('〇', 323, 689), item('〇', 603, 689),
    item('7', 113, 601), item('月', 156, 601),
    item('9★', 108, 557), item('水', 156, 557), item('〇', 323, 557), item('×', 603, 557),
  ],
);

const expo70 = document(
  ['9 月度', '個人利用予定表', '個人利用では、陸上競技の練習目的以外でのご利用はできません。', '2026年8月20日現在の予定です。日程変更の可能性があります！'],
  [
    item('9', 104, 783),
    item('1', 50, 594), item('火', 89, 594), item('9時～17時', 134, 594), item('〇', 216, 594),
    item('4', 50, 523), item('金', 89, 523), item('×', 153, 524),
    item('16', 331, 594), item('水', 373, 594), item('×', 437, 595),
  ],
);

const ichikawa = document(
  ['■9月【September】', '陸上競技場使用予定表【track and field schedule】', '利用時間', '使用時間', '使用予定内容', '※大会・イベント中の個人利用はできません'],
  [
    item('1', 78, 700), item('火', 96, 700), item('9~21', 125, 700),
    item('4', 78, 650), item('金', 96, 650), item('9~21', 125, 650), item('9~12', 171, 645), item('市民スポーツ教室', 223, 645),
    item('5', 78, 600), item('土', 96, 600), item('9~21', 125, 600),
    item('12~14', 171, 595), item('講習会', 223, 595), item('14~17', 171, 585), item('大会', 223, 585),
    item('6', 78, 550), item('日', 96, 550), item('9~21', 125, 550),
    item('28', 78, 500), item('月', 96, 500), item('―', 125, 500), item('―', 171, 495), item('☆休場日', 223, 495),
    item('29', 78, 450), item('火', 96, 450), item('9~21', 125, 450),
  ],
);

const bingo = document(
  ['びんご運動公園', '陸上競技場', '個人利用可能日時 案内カレンダー', '2026', '.9月', 'トラック第1レーンは保護のため、現在個人使用を禁止しております'],
  [
    item('1', 174, 461), item('2', 278, 461), item('3', 383, 461), item('4', 487, 461), item('5', 592, 461), item('6', 696, 461),
    item('トラック', 179, 429), item('のみ', 212, 429), item('可', 235, 429),
    item('~16:00まで', 389, 437), item('トラック・投てき', 380, 422), item('可', 451, 422),
    item('14:00~', 607, 437), item('トラック', 596, 429), item('のみ', 630, 429), item('可', 652, 429),
    item('7', 70, 397), item('8', 174, 397), item('9', 278, 397), item('10', 379, 397), item('11', 484, 397), item('12', 588, 397), item('13', 692, 397),
    item('14', 66, 335), item('15', 170, 335), item('16', 275, 335), item('17', 379, 335), item('18', 484, 335), item('19', 588, 335), item('20', 692, 335),
    item('終日', 611, 302), item('×', 640, 302),
    item('21', 66, 270), item('22', 170, 270), item('23', 275, 270), item('24', 379, 270), item('25', 484, 270), item('26', 588, 270), item('27', 692, 270),
  ],
);

describe('PDF availability parsers', () => {
  it('parses Japanese dates, multiple slots, and partial availability', () => {
    const result = parseNerimaPdf(nerima, '2026-08-24');
    expect(result.status).toBe('partially_available');
    expect(result.periods.map(value => value.status)).toEqual(['available', 'unavailable', 'unknown']);
    expect(result.publishedAt).toBe('2026-08-21');
  });

  it('does not infer an empty event row as available', () => {
    expect(parseTodaPdf(toda, '2026-08-24')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
    const result = parseTodaPdf(toda, '2026-08-30');
    expect(result.status).toBe('partially_available');
    expect(result.periods).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: '09:00', to: '17:00', status: 'unavailable' }),
      expect.objectContaining({ from: '17:00', to: '18:00', status: 'available' }),
    ]));
  });

  it('shares one Wada parser while applying each facility legend', () => {
    expect(parseWadaboriPdf(wada('first'), '2026-08-24', 'first').status).toBe('partially_available');
    expect(parseWadaboriPdf(wada('second'), '2026-08-24', 'second').status).toBe('unavailable');
  });

  it('maps shared use but never maps a reservable blank to individual use', () => {
    const result = parseMisatoPdf(misato, '2026-08-24');
    expect(result.status).toBe('partially_available');
    expect(result.periods.map(value => value.status)).toEqual(['unavailable', 'unavailable', 'available']);
  });

  it('requires an explicit Ageo individual-use listing', () => {
    expect(parseAgeoPdf(ageo, '2026-08-27').status).toBe('available');
    expect(parseAgeoPdf(ageo, '2026-08-24')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
  });

  it('combines the explicit Fujimori matrix with its daily regional-opening rule', () => {
    const result = parseFujimoriPdf(fujimori, '2026-08-24');
    expect(result.status).toBe('available');
    expect(result.periods).toHaveLength(5);
  });

  it('parses the current Kamiyugi multi-month matrix without guessing dash cells', () => {
    const open = parseKamiyugiPdf(kamiyugi, '2026-08-24');
    expect(open.status).toBe('available');
    expect(open.periods).toHaveLength(3);
    const maintenance = parseKamiyugiPdf(kamiyugi, '2026-08-27');
    expect(maintenance.status).toBe('unknown');
    expect(maintenance.periods.map(period => period.status)).toEqual(['unavailable', 'unavailable', 'unknown']);
  });

  it('guards Fuchu graphical symbols instead of guessing their meaning', () => {
    const pdf = document(['令和8年度', '市民陸上競技場', '8月', '×印は休場日', '〇印は一般公開日', '◇印は17時以降を一般公開'], []);
    expect(parseFuchuPdf(pdf, '2026-08-24')).toMatchObject({ status: 'unknown', unknownReason: 'unsupported_pdf_graphics' });
  });

  it('parses Kanagawa Sports Center explicit morning and afternoon symbols', () => {
    expect(parseKanagawaSportsCenterPdf(kanagawa, '2026-09-03')).toMatchObject({
      status: 'available',
      periods: [
        { from: '09:00', to: '12:00', status: 'available' },
        { from: '13:00', to: '18:00', status: 'available' },
      ],
    });
    expect(parseKanagawaSportsCenterPdf(kanagawa, '2026-09-09').status).toBe('partially_available');
    expect(parseKanagawaSportsCenterPdf(kanagawa, '2026-09-07')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
  });

  it('parses both halves of the Expo 70 individual-use schedule without treating other cells as availability', () => {
    expect(parseExpo70Pdf(expo70, '2026-09-01')).toMatchObject({
      status: 'available', periods: [{ from: '09:00', to: '17:00', status: 'available' }],
    });
    expect(parseExpo70Pdf(expo70, '2026-09-04').status).toBe('unavailable');
    expect(parseExpo70Pdf(expo70, '2026-09-16').status).toBe('unavailable');
  });

  it('subtracts Ichikawa Kohnodai event hours from explicit operating hours', () => {
    expect(parseIchikawaKohnodaiPdf(ichikawa, '2026-09-01')).toMatchObject({
      status: 'available', periods: [{ from: '09:00', to: '21:00', status: 'available' }],
    });
    expect(parseIchikawaKohnodaiPdf(ichikawa, '2026-09-04')).toMatchObject({
      status: 'partially_available',
      periods: [
        { from: '09:00', to: '12:00', status: 'unavailable' },
        { from: '12:00', to: '21:00', status: 'available' },
      ],
    });
    expect(parseIchikawaKohnodaiPdf(ichikawa, '2026-09-05').periods).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: '12:00', to: '17:00', status: 'unavailable' }),
    ]));
    expect(parseIchikawaKohnodaiPdf(ichikawa, '2026-09-28').status).toBe('unavailable');
    const ambiguous = document(ichikawa.text.split('\n'), [...ichikawa.items, item('時間未定イベント', 223, 695)]);
    expect(parseIchikawaKohnodaiPdf(ambiguous, '2026-09-01')).toMatchObject({ status: 'unknown', unknownReason: 'insufficient_information' });
  });

  it('parses Bingo explicit track availability, partial boundaries, and full-day closure', () => {
    expect(parseBingoSportsParkPdf(bingo, '2026-09-01').status).toBe('available');
    expect(parseBingoSportsParkPdf(bingo, '2026-09-03')).toMatchObject({
      status: 'partially_available', periods: [{ from: null, to: '16:00', status: 'available' }],
    });
    expect(parseBingoSportsParkPdf(bingo, '2026-09-05')).toMatchObject({
      status: 'partially_available', periods: [{ from: '14:00', to: null, status: 'available' }],
    });
    expect(parseBingoSportsParkPdf(bingo, '2026-09-19').status).toBe('unavailable');
  });

  it('fails closed when anchors, legends, or rows change', () => {
    expect(() => parseNerimaPdf({ ...nerima, text: 'unexpected layout' }, '2026-08-24')).toThrow(/anchor/);
    const malformed = document(['上尾陸上競技場', '個人利用日予定表', '令和8年 8月', '利用時間', '利用時間は1回4時間まで'], [item('27日', 53, 580)]);
    expect(() => parseAgeoPdf(malformed, '2026-08-27')).toThrow(/time range/);
  });
});

describe('PDF source discovery and failures', () => {
  const config = pdfSourceConfigs.find(value => value.trackId === 'ageo-athletic-stadium')!;

  it('selects the requested month and records source provenance', async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === config.landingPageUrl) return new Response('<a href="/aug.pdf">8月「個人利用日」予定表</a><a href="/sep.pdf">9月「個人利用日」予定表</a>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
      return new Response(new TextEncoder().encode('%PDF-synthetic'), { headers: { 'content-type': 'application/pdf' } });
    }) as typeof fetch;
    const september = { ...ageo, text: ageo.text.replaceAll('8月', '9月') };
    const collector = createPdfCollector(fetchImpl, async () => september);
    const result = await collector.collect(config, '2026-09-27', new Date('2026-09-01T00:00:00Z'));
    expect(result.pdfUrl).toBe('https://www.parks.or.jp/sep.pdf');
    expect(result.documentId).toBe('sep.pdf');
    expect(result.sourceHash).toMatch(/^sha256:/);
    expect(result.parserVersion).toBe('1.0.0');
  });

  it('discovers current Kanagawa and Expo 70 monthly PDFs from stable official pages', async () => {
    const cases = [
      {
        trackId: 'kanagawa-prefectural-sports-center-track',
        link: '<a href="/documents/65520/sep.pdf">予定表（令和8年9月分)（PDF）</a>',
        pdfUrl: 'https://www.pref.kanagawa.jp/documents/65520/sep.pdf',
        extracted: kanagawa,
        date: '2026-09-03',
      },
      {
        trackId: 'expo70-commemorative-stadium',
        link: '<a href="/sys/wp-content/uploads/kyogijyo_kojinriyou_yoteihyou_202609.pdf">競技場9月個人利用予定表</a>',
        pdfUrl: 'https://www.expo70-park.jp/sys/wp-content/uploads/kyogijyo_kojinriyou_yoteihyou_202609.pdf',
        extracted: expo70,
        date: '2026-09-01',
      },
      {
        trackId: 'ichikawa-kohnodai-athletic-stadium',
        link: '<p>更新日：2026年8月22日</p><p>「使用時間」以外を一般開放いたします。</p><a href="/uploaded/attachment/sep.pdf">9月使用予定表 [PDF]</a>',
        pdfUrl: 'https://www.city.ichikawa.lg.jp/uploaded/attachment/sep.pdf',
        extracted: ichikawa,
        date: '2026-09-01',
      },
      {
        trackId: 'bingo-sports-park-athletic-stadium',
        link: '<h1>陸上競技場 2026.9月 個人利用可能日時案内カレンダー</h1><a href="/images/topics/1566461033/sep.pdf">2026.9月 陸上競技場個人利用可能日時案内カレンダー</a>',
        pdfUrl: 'https://www.bingo-sportspark.com/images/topics/1566461033/sep.pdf',
        extracted: bingo,
        date: '2026-09-01',
      },
    ];
    for (const testCase of cases) {
      const sourceConfig = pdfSourceConfigs.find(value => value.trackId === testCase.trackId)!;
      const fetchImpl = (async (input: string | URL | Request) => String(input) === sourceConfig.landingPageUrl
        ? new Response(testCase.link, { headers: { 'content-type': 'text/html; charset=utf-8' } })
        : new Response(new TextEncoder().encode('%PDF-synthetic'), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch;
      const result = await createPdfCollector(fetchImpl, async () => testCase.extracted).collect(sourceConfig, testCase.date, new Date('2026-09-01T00:00:00Z'));
      expect(result.pdfUrl).toBe(testCase.pdfUrl);
      expect(result.status).toBe('available');
    }
  });

  it('reuses one extracted monthly PDF for multiple requested dates', async () => {
    const fetchImpl = (async (input: string | URL | Request) => String(input) === config.landingPageUrl
      ? new Response('<a href="/aug.pdf">8月「個人利用日」予定表</a>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
      : new Response(new TextEncoder().encode('%PDF-synthetic'), { headers: { 'content-type': 'application/pdf' } })) as typeof fetch;
    const extractImpl = vi.fn(async () => ageo);
    const collector = createPdfCollector(fetchImpl, extractImpl);
    await collector.collect(config, '2026-08-27', new Date('2026-08-24T00:00:00Z'));
    await collector.collect(config, '2026-08-28', new Date('2026-08-24T00:00:00Z'));
    expect(extractImpl).toHaveBeenCalledTimes(1);
  });

  it('uses schedule_not_published for a missing target month', async () => {
    const collector = createPdfCollector((async () => new Response('<a href="/aug.pdf">8月「個人利用日」予定表</a>')) as typeof fetch, async () => ageo);
    await expect(collector.collect(config, '2026-09-27', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
  });

  it('requires Ichikawa general-opening semantics before using event complements', async () => {
    const sourceConfig = pdfSourceConfigs.find(value => value.trackId === 'ichikawa-kohnodai-athletic-stadium')!;
    const collector = createPdfCollector((async () => new Response('<p>更新日：2026年8月22日</p><a href="/sep.pdf">9月使用予定表 [PDF]</a>')) as typeof fetch, async () => ichikawa);
    await expect(collector.collect(sourceConfig, '2026-09-01', new Date())).rejects.toMatchObject({ reason: 'schedule_not_published' });
  });

  it('distinguishes fetch and invalid-content failures', async () => {
    const failed = createPdfCollector((async () => { throw new TypeError('network failed'); }) as typeof fetch, async () => ageo);
    await expect(failed.collect(config, '2026-08-27', new Date())).rejects.toMatchObject({ reason: 'fetch_failed' });

    const invalid = createPdfCollector((async (input: string | URL | Request) => String(input) === config.landingPageUrl
      ? new Response('<a href="/aug.pdf">8月「個人利用日」予定表</a>')
      : new Response('<html>not a PDF</html>', { headers: { 'content-type': 'text/html' } })) as typeof fetch, async () => ageo);
    await expect(invalid.collect(config, '2026-08-27', new Date())).rejects.toMatchObject({ reason: 'invalid_content_type' });
  });

  it('treats corrupt or empty PDF extraction as unknown-capable extraction failure', async () => {
    await expect(extractPdf(new TextEncoder().encode('%PDF-corrupt'))).rejects.toMatchObject({ reason: 'extraction_failed' });
  });
});
