import { createHash } from 'node:crypto';

// The current official month tables have no printed year. This is a finite
// review of November 2026, not a rule assigning the request year to bare dates.
const reviewedHash = '225478a5a00d22f2aeba985add74d59d0adc556d3363c5c757d8cde8213e66f4';
export function reviewedNissanTable(html: string, date: string, trackId: string) {
  if (createHash('sha256').update(html).digest('hex') !== reviewedHash) return null;
  const stadium = trackId === 'nissan-stadium-track';
  if (!stadium && trackId !== 'nissan-field-kozukue') return null;
  const listed = stadium ? ['2026-11-09', '2026-11-27'] : ['2026-11-23', '2026-11-28'];
  const known = listed.includes(date);
  const inMonth = /^2026-11-(?:0[1-9]|[12]\d|30)$/.test(date);
  return {
    known,
    unknownReason: inMonth ? 'insufficient_information' as const : 'outside_published_period' as const,
    from: stadium ? '17:00' : '13:00',
    to: stadium ? '21:00' : '16:00',
    warnings: [
      'エントリーシステムメンテナンス中は事前申し込み不要・当日受付。直接受付窓口へお越しください。',
      '受付は各部開始5分前から、終了1時間前まで。先着200名・時間入れ替え制です。',
      '短距離・中長距離のみ。芝生・1レーンは利用不可。備品の持ち込み・貸出はなく、ハードル走・走り幅跳び・三段跳びはできません。',
      stadium ? '2〜5レーンは中長距離・ジョギング・ウォーキング、6〜9レーンは短距離。' : '2〜5レーンは中長距離・ジョギング・ウォーキング、6〜8レーンは短距離。',
      'スパイクは9mm以下の平行ピンのみ。付き添い入場・チームや団体での申し込みはできません。',
      '急きょ利用中止やトラックの一部閉鎖になる場合があります。',
    ],
  };
}
