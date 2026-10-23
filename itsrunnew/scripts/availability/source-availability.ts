// Detect a full-page outage, not routine facility maintenance mentioned in a schedule.
export class OfficialSourceUnavailableError extends Error {
  constructor() {
    super('Official source HTTP 200 maintenance page; schedule unavailable');
    this.name = 'OfficialSourceUnavailableError';
  }
}

export function assertOfficialPageAvailable(html: string) {
  const headings = [...html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => match[2].replace(/<[^>]*>/g, '').replace(/\s/g, '').normalize('NFKC'));
  if (headings.some(text => /^(緊急メンテナンスのご案内|メンテナンスモード|ただいまメンテナンス中です)$/.test(text))) {
    throw new OfficialSourceUnavailableError();
  }
}
