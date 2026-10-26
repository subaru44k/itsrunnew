import {
  decodeEntities,
  htmlText,
  images,
  links,
  officialFetch,
  sourceInputs,
} from './ai-source-utils';
import { digest, type AiPacket, type AiSource } from './ai-runtime';
export const aiFacilities = [
  {
    key: 'todoroki',
    trackId: 'todoroki-athletic-stadium',
    name: 'Uvanceとどろきスタジアム by Fujitsu（主競技場、補助は対象外）',
    landing: 'https://kawasaki-todoroki-park.co.jp/guide/track-and-field/',
    hosts: ['kawasaki-todoroki-park.co.jp'],
  },
  {
    key: 'chita',
    trackId: 'b-food-science-1969-chita-stadium',
    name: 'Bフードサイエンス1969知多スタジアム（陸上競技場）',
    landing: 'https://www.chita-sports.com/info/105/',
    hosts: ['www.chita-sports.com', 'chita-sports.com'],
  },
  {
    key: 'hiratsuka',
    trackId: 'lemon-gas-stadium-hiratsuka-track',
    name: 'レモンガススタジアム平塚',
    landing: 'https://www.city.hiratsuka.kanagawa.jp/koen/page-c_00824.html',
    hosts: ['www.city.hiratsuka.kanagawa.jp'],
  },
  {
    key: 'hiroshima',
    trackId: 'hiroshima-koiki-park-auxiliary-stadium',
    name: '広島広域公園補助競技場',
    landing: 'https://www.sports-or.city.hiroshima.jp/facilities/kouiki',
    hosts: ['www.sports-or.city.hiroshima.jp'],
  },
  {
    key: 'ishin',
    trackId: 'ishin-centennial-park-auxiliary-stadium',
    name: '維新百年記念公園補助陸上競技場（主競技場は対象外）',
    landing: 'https://www.ishin100.com/main/',
    hosts: ['www.ishin100.com'],
  },
  {
    key: 'hakata',
    trackId: 'hakata-no-mori-auxiliary-athletic-stadium',
    name: '博多の森補助競技場（メインは対象外）',
    landing: 'https://www.midorimachi.jp/higashihirao/',
    hosts: ['www.midorimachi.jp', 'midorimachi.jp'],
  },
  {
    key: 'setagaya',
    trackId: 'setagaya-general-sports-track',
    name: '世田谷区立総合運動場 陸上競技場',
    landing: 'https://www.se-sports.or.jp/facility/sougou/',
    hosts: ['www.se-sports.or.jp'],
  },
  {
    key: 'ogino',
    trackId: 'ogino-sports-park-track',
    name: '荻野運動公園競技場',
    landing: 'https://www.ogino-park.jp/?p=1007',
    hosts: ['www.ogino-park.jp', 'ogino-park.jp'],
  },
] as const;
export type AiFacility = (typeof aiFacilities)[number];
export function fullMonths(dates: string[]) {
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  return months.flatMap((month) => {
    const [y, m] = month.split('-').map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
    );
  });
}
export async function buildAiPacket(
  config: AiFacility,
  dates: string[],
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<AiPacket> {
  const sources: AiSource[] = [];
  const seen = new Set<string>();
  let assetCount = 0;
  const load = async (url: string, include = true) => {
    const r = await officialFetch(url, [...config.hosts], fetchImpl);
    if (include && !seen.has(r.url)) {
      seen.add(r.url);
      sources.push(
        ...(await sourceInputs(
          `${config.key}-${sources.length + 1}`,
          r.url,
          r.data,
        )),
      );
    }
    return { url: r.url, html: r.data.toString('utf8') };
  };
  const asset = async (url: string) => {
    if (seen.has(url)) return;
    if (++assetCount > 8) throw new Error('Too many schedule documents');
    await load(url);
  };
  const page = await load(
    config.landing,
    !['ishin', 'hiroshima', 'setagaya'].includes(config.key),
  );
  const anchors = links(page.html, page.url);
  const wantedMonths = [...new Set(dates.map((d) => Number(d.slice(5, 7))))];
  const relevant = (label: string) =>
    wantedMonths.some((m) =>
      new RegExp(`(?:^|[^0-9])0?${m}月`).test(label.normalize('NFKC')),
    );
  if (config.key === 'todoroki') {
    const matches = anchors.filter(
      (a) =>
        /\.pdf(?:\?|$)/i.test(a.url) &&
        /個人利用開放日/.test(a.label) &&
        (relevant(a.label) || /今月分|来月分/.test(a.label)),
    );
    if (!matches.length) throw new Error('Track monthly PDF link not found');
    for (const a of matches) await asset(a.url);
  } else if (config.key === 'chita') {
    const matches = anchors.filter(
      (a) =>
        /\.pdf(?:\?|$)/i.test(a.url) &&
        relevant(a.label) &&
        /一般開放/.test(a.label) &&
        dates.some(date => new RegExp(`${date.slice(0, 4)}年\\s*0?${Number(date.slice(5, 7))}月`).test(a.label.normalize('NFKC'))),
    );
    if (!matches.length) throw new Error('Chita opening PDFs not found');
    for (const a of matches) await asset(a.url);
  } else if (config.key === 'hiratsuka') {
    if (!/共用利用予定表/.test(htmlText(page.html)))
      throw new Error('Hiratsuka personal schedule changed');
  } else if (config.key === 'hiroshima') {
    await load(
      'https://www.sports-or.city.hiroshima.jp/facilities/kouiki/use/senyo-2',
    );
    for (const a of anchors.filter(
      (a) =>
        /kouiki\d{6}\.pdf/i.test(a.url) &&
        dates.some((d) => a.url.includes(d.slice(0, 7).replace('-', ''))),
    ))
      await asset(a.url);
    const personalNotices = (items: typeof anchors) => items.filter(
      (a) =>
        /補助競技場.*個人利用/.test(a.label) &&
        /\/info\//.test(a.url) &&
        relevant(a.label),
    );
    let notices = personalNotices(anchors);
    let listingHtml = page.html;
    let listingUrl = page.url;
    if (!notices.length) {
      // The homepage only keeps recent posts; discover older current-month notices
      // through its official index link without adding the index to AI/cache input.
      const indexLink = anchors.find((a) =>
        new URL(a.url).pathname.replace(/\/$/, '') === '/facilities/kouiki/info',
      );
      if (indexLink) {
        const index = await load(indexLink.url, false);
        notices = personalNotices(links(index.html, index.url));
        listingHtml = index.html;
        listingUrl = index.url;
      }
    }
    notices = notices.filter((notice, index) => notices.findIndex((item) => item.url === notice.url) === index);
    if (!notices.length)
      throw new Error('Auxiliary personal-use notice not found');
    for (const a of notices.slice(0, 3)) {
      const notice = await load(a.url);
      const body = notice.html.match(
        /<section[^>]*class="contents editor"[^>]*>([\s\S]*?)<\/section>/,
      )?.[1];
      if (!body) throw new Error('Hiroshima notice layout changed');
      const scheduleBody = body.split(/<h[1-6][^>]*>[^<]*個人利用の日程は/)[0];
      const found = [
        ...links(scheduleBody, notice.url),
        ...images(scheduleBody, notice.url),
      ].filter(
        (i) =>
          /\/application\/files\//.test(i.url) &&
          /\.(png|jpe?g|pdf)(?:\?|$)/i.test(i.url),
      );
      for (const i of found) await asset(i.url);
    }
    // Preserve the selected notice's visible publication date: the calendar image
    // omits its year. Do not use the site's placeholder datetime=2016-00-00 or
    // include unrelated news, which would invalidate the cache every update.
    const publicationEvidence = notices.slice(0, 3).flatMap((notice) => {
      const item = [...listingHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .find((match) => links(match[1], listingUrl).some((link) => link.url === notice.url));
      const published = item?.[1].match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1];
      const date = published ? htmlText(published).normalize('NFKC') : '';
      return /^\d{4}年\s*\d{1,2}月\s*\d{1,2}日$/.test(date)
        ? [`${date} ${notice.label} ${notice.url}`]
        : [];
    });
    if (publicationEvidence.length) {
      const text = `公式告知一覧に表示された掲載日・告知名:\n${publicationEvidence.join('\n')}`;
      sources.push({ name: 'hiroshima-notice-publication.txt', url: listingUrl, kind: 'text', content: text, hash: digest(text) });
    }
  } else if (config.key === 'ishin') {
    const matchesNotice = (a: { label: string; url: string }) =>
      /補助陸上競技場.*利用予定/.test(a.label) && /info_.*kojin/.test(a.url);
    let notice = anchors.find(matchesNotice);
    let noticeLinks = anchors;
    if (!notice) {
      const listing = anchors.find(a => new URL(a.url).pathname === '/main/category/notice/');
      if (listing) {
        const index = await load(listing.url, false);
        noticeLinks = links(index.html, index.url);
        notice = noticeLinks.find(matchesNotice);
      }
    }
    /* The restored homepage only lists recent news. Follow its official notice
       index once; never guess a historical schedule URL. */
    const repairNotices = [...new Map([...anchors, ...noticeLinks].filter(
      (a) =>
        /補助陸上競技場.*修繕工事/.test(a.label) && /info_hojyo_track_syuzzen_kouji_/.test(a.url),
    ).map(a => [a.url, a])).values()];
    if (repairNotices.length > 2) throw new Error('Too many Ishin repair notices');
    if (!notice) throw new Error('Ishin auxiliary notice not found');
    const schedule = await load(notice.url);
    const found = [
      ...links(schedule.html, schedule.url),
      ...images(schedule.html, schedule.url),
    ].filter((a) => {
      const month = /info_ho[kjz]yoriku_(?:class_)?(\d{6})_/.exec(new URL(a.url).pathname)?.[1];
      return month && dates.some((d) => month === d.slice(0, 7).replace('-', ''));
    });
    if (!found.length) throw new Error('Ishin auxiliary images not found');
    for (const i of found) await asset(i.url);
    for (const repair of repairNotices) {
      const page = await load(repair.url);
      const figures = images(page.html, page.url).filter(a =>
        /\/info_hojyo_track_syuzzen_kouji_\d+(?:-content)?\.png$/.test(new URL(a.url).pathname));
      if (!figures.length) throw new Error('Ishin repair conditions not found');
      for (const figure of figures) await asset(figure.url);
    }
  } else if (config.key === 'hakata') {
    const guides = await load(
      'https://www.midorimachi.jp/higashihirao/guides/',
    );
    const rules = links(guides.html, guides.url).filter(
      (a) =>
        /\.pdf(?:\?|$)/i.test(a.url) &&
        /利用上の注意事項および制限/.test(a.label),
    );
    if (!rules.length) throw new Error('Hakata usage rules not found');
    for (const rule of rules.slice(0, 1)) await asset(rule.url);
    const found = anchors.filter(
      (a) =>
        /\.pdf(?:\?|$)/i.test(a.url) &&
        /競技場.*利用予定|利用予定表|予定表／駐車場/.test(a.label),
    );
    if (!found.length) throw new Error('Hakata monthly schedule not found');
    for (const i of found.slice(0, 3)) await asset(i.url);
  } else if (config.key === 'setagaya') {
    const daily = anchors.find(
      (a) =>
        /総合運動場.*本日.*個人開放/.test(a.label) &&
        /\/news\//.test(a.url) &&
        !/10334/.test(a.url),
    );
    if (!daily) throw new Error('Setagaya daily notice not found');
    await load(daily.url);
    await load(
      'https://www.se-sports.or.jp/facilityinfo/sougou-athletics-stadium/',
    );
    await load('https://www.se-sports.or.jp/news/10334/');
  } else if (config.key === 'ogino') {
    const found = anchors.filter(
      (a) =>
        /\.pdf(?:\?|$)/i.test(a.url) &&
        /競技場予定/.test(decodeURIComponent(a.url) + a.label),
    );
    if (!found.length) throw new Error('Ogino track schedule PDF not found');
    for (const i of found.slice(0, 2)) await asset(i.url);
  }
  if (sources.length > 16) throw new Error('Too many source pages');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  if (config.key === 'setagaya') {
    const text = `当日資料の取得日: ${today} JST。資料の日付が一致する場合だけ当日利用を判定。`;
    sources.push({
      name: 'acquisition-context.txt',
      url: config.landing,
      kind: 'text',
      content: text,
      hash: digest(text),
    });
  }
  return {
    key: config.key,
    trackId: config.trackId,
    name: config.name,
    landingPageUrl: config.landing,
    sources,
    dates: config.key === 'setagaya' ? [today] : fullMonths(dates),
  };
}
