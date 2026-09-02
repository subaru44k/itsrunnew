import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import i18n from './i18n';
import { useAppStore } from './store';
import OdaField from './views/OdaField.vue';
import Yumenoshima from './views/Yumenoshima.vue';
import Komazawa from './views/Komazawa.vue';
import Todoroki from './views/Todoroki.vue';
import About from './views/About.vue';
import Privacy from './views/Privacy.vue';
import NotFound from './views/NotFound.vue';
import TrackDetail from './views/TrackDetail.vue';
import TrackGuide from './views/TrackGuide.vue';
import { trackById } from './model/tracks';
import { isPublicProductionRuntime, PUBLIC_SITE_ORIGIN } from './services/deployment';

const SITE_ORIGIN = PUBLIC_SITE_ORIGIN;
const SOCIAL_IMAGE = `${SITE_ORIGIN}/img/itsrun-og.jpg`;

const pages = {
  oda: {
    path: 'oda-field', component: OdaField,
    jaTitle: '織田フィールドの利用情報｜周辺の個人利用トラック - いつラン',
    enTitle: 'Oda Field closure and nearby running tracks - ItsRun',
    jaDescription: '織田フィールドは2026年11月30日まで利用停止予定です。周辺の個人利用できそうな陸上トラックを、選択日の利用状況と距離から比較して代わりの練習場所を探せます。',
    enDescription: 'Oda Field is scheduled to remain closed through November 30, 2026. Compare nearby tracks by date-specific availability and distance.',
  },
  yumenoshima: {
    path: 'yumenoshima', component: Yumenoshima,
    jaTitle: 'いつラン - 夢の島陸上競技場を個人利用する人のための利用時間確認ページ',
    enTitle: "It's Run - Check the availability of Yumenoshima Athletics Stadium",
    jaDescription: '夢の島陸上競技場の開放日・利用可能時間を確認できます。',
    enDescription: 'The available dates and times at Yumenoshima Athletics Stadium can be checked on this page.',
  },
  komazawa: {
    path: 'komazawa', component: Komazawa,
    jaTitle: 'いつラン - 駒沢オリンピック公園陸上競技場を個人利用する人のための利用時間確認ページ',
    enTitle: "It's Run - Check the availability of Komazawa Olympic Park Athletic Stadium",
    jaDescription: '駒沢オリンピック公園陸上競技場の開放日・利用可能時間を確認できます。',
    enDescription: 'The available dates and times at Komazawa Olympic Park Athletic Stadium can be checked on this page.',
  },
  todoroki: {
    path: 'todoroki', component: Todoroki,
    jaTitle: 'いつラン - 等々力陸上競技場を個人利用する人のための利用時間確認ページ',
    enTitle: "It's Run - Check the availability of Kawasaki Todoroki Stadium",
    jaDescription: '等々力陸上競技場の開放日・利用可能時間を確認できます。',
    enDescription: 'The available dates and times at Kawasaki Todoroki Stadium can be checked on this page.',
  },
  marathon: {
    path: 'pace/marathon', component: () => import('./views/LapTime.vue'),
    jaTitle: 'いつラン - マラソンのペース表。5kmごとのラップタイム表記。',
    enTitle: "It's Run - Marathon pace and lap-time table",
    jaDescription: 'マラソンの5kmごとのラップタイムがひと目で分かります。',
    enDescription: 'Marathon lap times at each 5 km from two to six and a half hours.',
  },
  nozomi: {
    path: 'nozomiantena/index', component: () => import('./views/NozomiAntena.vue'),
    jaTitle: '陸上 田中希実選手の記録集 - 大会出場日、種目、タイム等の結果まとめ',
    enTitle: 'Race results of Nozomi Tanaka',
    jaDescription: '田中希実選手の2020年以降の出走を、世界大会、地方大会、記録会、駅伝、ペースメーカーまで時系列でまとめた非公式記録集。',
    enDescription: 'An unofficial race archive of Japanese runner Nozomi Tanaka from 2020, including local meetings, relays and pacing appearances.',
  },
  ryuji: {
    path: 'ryuji-miura/index', component: () => import('./views/RyujiMiura.vue'),
    jaTitle: '陸上 三浦龍司選手の記録集 - 2020年以降の大会出場日、種目、タイム等の結果まとめ',
    enTitle: 'Race results of Ryuji Miura',
    jaDescription: '三浦龍司選手の2020年以降の出走を、世界大会、国内の大学競技会、記録会、クロスカントリー、ロードまで時系列でまとめた非公式記録集。',
    enDescription: 'An unofficial race archive of Japanese steeplechaser Ryuji Miura from 2020, including local meetings, university competitions and road races.',
  },
  tracks: {
    path: '', component: () => import('./views/TrackSearch.vue'),
    jaTitle: '個人利用できる陸上競技場・トラック検索｜日付・現在地から探す - いつラン',
    enTitle: 'Find tracks for individual use by date and location - ItsRun',
    jaDescription: 'いつもの競技場が使えない日や、転居・合宿先での練習場所探しに。個人利用できそうな陸上競技場やトラックを、利用日と現在地・任意地点から検索し、距離・利用状況・設備を比較できます。',
    enDescription: 'When your usual venue is closed or you are training somewhere new, compare tracks for individual use by date, location, availability and facilities.',
  },
  about: {
    path: 'about', component: About,
    jaTitle: 'いつランについて - サイトのコンテンツと運営方針',
    enTitle: 'About ItsRun - Content and editorial policy',
    jaDescription: 'いつランのトラック検索、競技場情報、ラップタイム、記録集と運営方針を説明します。',
    enDescription: 'Learn about ItsRun’s track finder, venue guides, pace tools, records, and editorial policy.',
  },
  trackGuide: {
    path: 'tracks/guide', component: TrackGuide,
    jaTitle: 'トラック検索の使い方 - 利用状況・距離・施設情報の見方',
    enTitle: 'How to use Track Finder - Availability, distance and facility details',
    jaDescription: '日付、検索の基準地点、利用可能・要確認などの表示とトラック条件の見方を説明します。',
    enDescription: 'How to select a date and search origin, read availability, and compare track facilities.',
  },
  privacy: {
    path: 'privacy', component: Privacy,
    jaTitle: 'プライバシーポリシー - いつラン',
    enTitle: 'Privacy policy - ItsRun',
    jaDescription: 'いつランにおけるGoogle Analytics、現在地情報、外部サービス等の取扱いを説明します。',
    enDescription: 'How ItsRun handles Google Analytics, browser geolocation, and external services.',
  },
} as const;

const routes: RouteRecordRaw[] = [];
for (const [key, page] of Object.entries(pages)) {
  const jaPath = page.path ? `/${page.path}` : '/';
  const enPath = page.path ? `/en/${page.path}` : '/en/';
  routes.push(
    { path: jaPath, name: `${key}-ja`, component: page.component, meta: { locale: 'ja', title: page.jaTitle, description: page.jaDescription, canonicalPath: jaPath, alternateJa: jaPath, alternateEn: enPath } },
    { path: enPath, name: `${key}-en`, component: page.component, meta: { locale: 'en', title: page.enTitle, description: page.enDescription, canonicalPath: enPath, alternateJa: jaPath, alternateEn: enPath } },
  );
}
routes.push(
  { path: '/tracks/:trackId', name: 'track-detail-ja', component: TrackDetail, meta: { locale: 'ja' } },
  { path: '/en/tracks/:trackId', name: 'track-detail-en', component: TrackDetail, meta: { locale: 'en' } },
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
  const title = detailTrack
    ? (locale === 'en' ? `${detailTrack.name.en} availability and track details - ItsRun` : `${detailTrack.name.ja}の利用予定・トラック情報 - いつラン`)
    : String(to.meta.title ?? 'いつラン');
  const description = detailTrack
    ? (locale === 'en' ? `Check ${detailTrack.name.en}'s date-specific availability, track details, official links and directions.` : `${detailTrack.name.ja}の指定日ごとの利用状況、トラック情報、公式案内、経路を確認できます。`)
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
});

export default router;
