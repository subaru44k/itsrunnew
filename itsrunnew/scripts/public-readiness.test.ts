import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import tracks from '../src/data/tracks.json';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../index.html');
const robots = read('../public/robots.txt');
const sitemap = read('../public/sitemap.xml');
const analytics = read('../src/services/analytics.ts');
const advertising = read('../src/services/advertising.ts');
const main = read('../src/main.ts');
const deployment = read('../src/services/deployment.ts');
const ads = read('../src/components/AdsDisplay.vue');
const odaField = read('../src/views/OdaField.vue');
const router = read('../src/router.ts');
const privacy = read('../src/views/Privacy.vue');
const serviceWorker = read('../public/service-worker.js');

describe('public launch readiness', () => {
  it('publishes canonical, multilingual, and social metadata without Universal Analytics', () => {
    expect(index).toContain('<link rel="canonical" href="https://itsrun.info/">');
    expect(index).toContain('hreflang="ja"');
    expect(index).toContain('hreflang="en"');
    expect(index).toContain('hreflang="x-default"');
    expect(index).toContain('https://itsrun.info/img/itsrun-og.jpg');
    expect(index).toContain('summary_large_image');
    expect(index).not.toMatch(/UA-\d/);
    expect(index).toContain('個人利用できる陸上競技場・トラック検索｜日付・現在地から探す - いつラン');
    expect(router).toContain('織田フィールドの利用情報｜周辺の個人利用トラック - いつラン');
  });

  it('exposes an absolute sitemap without alias or date-query duplication', () => {
    expect(robots).toContain('Sitemap: https://itsrun.info/sitemap.xml');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    expect(locations).toHaveLength(22 + tracks.length * 2);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations).toContain('https://itsrun.info/');
    expect(locations).toContain('https://itsrun.info/en/privacy');
    expect(locations).toContain('https://itsrun.info/ryuji-miura/index');
    expect(locations).toContain('https://itsrun.info/en/ryuji-miura/index');
    expect(locations).toContain(`https://itsrun.info/tracks/${tracks[0].id}`);
    expect(locations).toContain(`https://itsrun.info/en/tracks/${tracks[0].id}`);
    expect(locations).not.toContain('https://itsrun.info/tracks');
    expect(locations.every(location => !location.includes('?'))).toBe(true);

    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap).not.toContain('xmlns:xhtml=');
    expect(sitemap).not.toContain('<xhtml:link');
    const entries = [...sitemap.matchAll(/<url>(.*?)<\/url>/gs)].map(match => match[1]);
    expect(entries.every(entry => {
      const loc = entry.indexOf('<loc>');
      const changefreq = entry.indexOf('<changefreq>');
      return loc !== -1 && (changefreq === -1 || loc < changefreq);
    })).toBe(true);
  });

  it('loads GA4 only after consent and gates advertising behind the build flag', () => {
    expect(analytics).toContain("const MEASUREMENT_ID = 'G-YNLS7KQXYW'");
    expect(analytics).toContain('isPublicProductionRuntime()');
    expect(deployment).toContain("VITE_DEPLOY_TARGET !== 'preview'");
    expect(deployment).toContain('window.location.origin === PUBLIC_SITE_ORIGIN');
    expect(analytics).toContain("analytics_storage: 'granted'");
    expect(analytics).toContain("ad_storage: 'denied'");
    expect(advertising).toContain("import.meta.env.VITE_ADSENSE_ENABLED === 'true'");
    expect(advertising).toContain('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
    expect(advertising).toContain('googlefc.callbackQueue.push');
    expect(main).toContain('if (value !== null) initializeAdvertising()');
    expect(ads).toContain('advertisingReady');
    expect(odaField).not.toContain('AdsDisplay');
    expect(privacy).toContain('いつランではGoogle AdSenseを利用します。');
    expect(privacy).toContain('Googleの同意管理プラットフォーム（CMP）');
  });

  it('canonicalizes Track Search aliases and marks unknown routes noindex', () => {
    expect(router).toContain("path: '/tracks', redirect:");
    expect(router).toContain("path: '/en/tracks', redirect:");
    expect(router).toContain("noindex: true");
    expect(router).toContain('isPublicProductionRuntime()');
  });

  it('retires the legacy Firebase service worker and cached application', () => {
    expect(serviceWorker).toContain('caches.keys()');
    expect(serviceWorker).toContain('self.registration.unregister()');
    expect(serviceWorker).toContain('client.navigate(client.url)');
    expect(serviceWorker).not.toContain('cache.addAll');
  });
});
