import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../index.html');
const robots = read('../public/robots.txt');
const sitemap = read('../public/sitemap.xml');
const analytics = read('../src/services/analytics.ts');
const advertising = read('../src/services/advertising.ts');
const main = read('../src/main.ts');
const deployment = read('../src/services/deployment.ts');
const ads = read('../src/components/AdsDisplay.vue');
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
  });

  it('exposes an absolute sitemap without alias or date-query duplication', () => {
    expect(robots).toContain('Sitemap: https://itsrun.info/sitemap.xml');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    expect(locations).toHaveLength(18);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations).toContain('https://itsrun.info/');
    expect(locations).toContain('https://itsrun.info/en/privacy');
    expect(locations).not.toContain('https://itsrun.info/tracks');
    expect(locations.every(location => !location.includes('?'))).toBe(true);
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
