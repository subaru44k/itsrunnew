import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import i18n from './i18n';
import { useAppStore } from './store';
import Yumenoshima from './views/Yumenoshima.vue';
import Komazawa from './views/Komazawa.vue';
import Todoroki from './views/Todoroki.vue';
import About from './views/About.vue';
import Privacy from './views/Privacy.vue';
import NotFound from './views/NotFound.vue';
import TrackDetail from './views/TrackDetail.vue';
import TrackGuide from './views/TrackGuide.vue';
import { ODA_TRACK_ID, trackById } from './model/tracks';
import { isPublicProductionRuntime, PUBLIC_SITE_ORIGIN } from './services/deployment';
import pageMetadata from './data/page-metadata.json';

const SITE_ORIGIN = PUBLIC_SITE_ORIGIN;
const SOCIAL_IMAGE = `${SITE_ORIGIN}/img/itsrun-og.jpg`;

const pageComponents = {
  Yumenoshima,
  Komazawa,
  Todoroki,
  LapTime: () => import('./views/LapTime.vue'),
  NozomiAntena: () => import('./views/NozomiAntena.vue'),
  RyujiMiura: () => import('./views/RyujiMiura.vue'),
  TrackSearch: () => import('./views/TrackSearch.vue'),
  About,
  TrackGuide,
  Privacy,
} as const;

const pages = Object.entries(pageMetadata).map(([key, page]) => ({
  key,
  ...page,
  component: pageComponents[page.component as keyof typeof pageComponents],
}));

const routes: RouteRecordRaw[] = [];
for (const page of pages) {
  const jaPath = page.path ? `/${page.path}` : '/';
  const enPath = page.path ? `/en/${page.path}` : '/en/';
  routes.push(
    { path: jaPath, name: `${page.key}-ja`, component: page.component, meta: { locale: 'ja', title: page.jaTitle, description: page.jaDescription, canonicalPath: jaPath, alternateJa: jaPath, alternateEn: enPath } },
    { path: enPath, name: `${page.key}-en`, component: page.component, meta: { locale: 'en', title: page.enTitle, description: page.enDescription, canonicalPath: enPath, alternateJa: jaPath, alternateEn: enPath } },
  );
}
routes.push(
  { path: '/tracks/:trackId', name: 'track-detail-ja', component: TrackDetail, meta: { locale: 'ja' } },
  { path: '/en/tracks/:trackId', name: 'track-detail-en', component: TrackDetail, meta: { locale: 'en' } },
  { path: '/oda-field', redirect: to => ({ path: `/tracks/${ODA_TRACK_ID}`, query: to.query, hash: to.hash }) },
  { path: '/en/oda-field', redirect: to => ({ path: `/en/tracks/${ODA_TRACK_ID}`, query: to.query, hash: to.hash }) },
  { path: '/tracks', redirect: to => ({ path: '/', query: to.query, hash: to.hash }) },
  { path: '/en/tracks', redirect: to => ({ path: '/en/', query: to.query, hash: to.hash }) },
  { path: '/index.html', redirect: '/' },
  { path: '/komazawa_olympic', redirect: '/komazawa' },
  { path: '/manage', redirect: '/' },
  { path: '/en/:pathMatch(.*)*', component: NotFound, meta: { locale: 'en', title: 'Page not found - ItsRun', description: 'The requested page could not be found.', canonicalPath: '/en/', alternateJa: '/', alternateEn: '/en/', noindex: true } },
  { path: '/:pathMatch(.*)*', component: NotFound, meta: { locale: 'ja', title: 'ページが見つかりません - いつラン', description: 'お探しのページは見つかりませんでした。', canonicalPath: '/', alternateJa: '/', alternateEn: '/en/', noindex: true } },
);

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          const target = document.getElementById(decodeURIComponent(to.hash.slice(1)));
          resolve(target ? { el: target, top: 64 } : { top: 0 });
        });
      });
    }
    // Query parameters hold the selected date, facility and search origin.
    // Preserve the current position so the initiating component can focus the
    // relevant UI without racing a router-level jump back to the page top.
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const locale = to.meta.locale === 'en' ? 'en' : 'ja';
  i18n.global.locale.value = locale;
  useAppStore().setLocale(locale);
  document.documentElement.lang = locale;
  const detailTrack = trackById(to.params.trackId);
  if (to.params.trackId && !detailTrack) return locale === 'en' ? '/en/' : '/';
  const isOda = detailTrack?.id === ODA_TRACK_ID;
  const title = detailTrack
    ? isOda
      ? (locale === 'en' ? 'Oda Field (Yoyogi Park Athletic Track) closure and nearby tracks - ItsRun' : '織田フィールド（代々木公園陸上競技場）の利用情報｜利用停止と周辺トラック - いつラン')
      : (locale === 'en' ? `${detailTrack.name.en} availability and nearby tracks - ItsRun` : `${detailTrack.name.ja}の利用予定・周辺トラック - いつラン`)
    : String(to.meta.title ?? 'いつラン');
  const description = detailTrack
    ? isOda
      ? (locale === 'en' ? 'Oda Field is scheduled to remain closed through November 30, 2026. Check the selected date and compare nearby tracks before your workout.' : '織田フィールド（代々木公園陸上競技場）は2026年11月30日まで利用停止予定です。指定日の状況と周辺の代替トラックを確認できます。')
      : (locale === 'en' ? `Check ${detailTrack.name.en}'s date-specific availability and find useful nearby alternatives ranked by availability and distance.` : `${detailTrack.name.ja}の指定日ごとの利用状況を確認し、利用状況と距離を考慮した周辺の代替トラックを探せます。`)
    : String(to.meta.description ?? 'いつラン');
  const canonicalPath = detailTrack ? `${locale === 'en' ? '/en' : ''}/tracks/${detailTrack.id}` : String(to.meta.canonicalPath ?? (locale === 'en' ? '/en/' : '/'));
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  const publicProduction = isPublicProductionRuntime();
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[name="robots"]')?.setAttribute('content', !publicProduction || to.meta.noindex ? 'noindex,nofollow' : 'index,follow');
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', locale === 'en' ? 'en_US' : 'ja_JP');
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content', SOCIAL_IMAGE);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', SOCIAL_IMAGE);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
  const alternateJa = detailTrack ? `/tracks/${detailTrack.id}` : String(to.meta.alternateJa ?? '/');
  const alternateEn = detailTrack ? `/en/tracks/${detailTrack.id}` : String(to.meta.alternateEn ?? '/en/');
  document.querySelector('link[rel="alternate"][hreflang="ja"]')?.setAttribute('href', `${SITE_ORIGIN}${alternateJa}`);
  document.querySelector('link[rel="alternate"][hreflang="en"]')?.setAttribute('href', `${SITE_ORIGIN}${alternateEn}`);
  document.querySelector('link[rel="alternate"][hreflang="x-default"]')?.setAttribute('href', `${SITE_ORIGIN}${alternateJa}`);
  const structuredData = document.getElementById('track-structured-data') as HTMLScriptElement | null;
  if (detailTrack) {
    const script = structuredData ?? Object.assign(document.createElement('script'), { id: 'track-structured-data', type: 'application/ld+json' });
    if (!structuredData) document.head.appendChild(script);
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SportsActivityLocation',
      name: detailTrack.name[locale],
      description,
      address: detailTrack.location.address,
      geo: { '@type': 'GeoCoordinates', latitude: detailTrack.location.latitude, longitude: detailTrack.location.longitude },
      url: canonicalUrl,
      sameAs: detailTrack.urls.official,
    });
  } else {
    structuredData?.remove();
  }
});

export default router;
