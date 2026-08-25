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
import { isPublicProductionRuntime, PUBLIC_SITE_ORIGIN } from './services/deployment';

const SITE_ORIGIN = PUBLIC_SITE_ORIGIN;
const SOCIAL_IMAGE = `${SITE_ORIGIN}/img/itsrun-og.jpg`;

const pages = {
  oda: {
    path: 'oda-field', component: OdaField,
    jaTitle: 'いつラン - 織田フィールドを個人利用する人のための利用時間確認ページ',
    enTitle: "It's Run - Check the availability of the Yoyogi Park Athletic Track",
    jaDescription: '織田フィールド(代々木公園陸上競技場)等の陸上競技場を個人利用したい際に、このサイトにて開放日・利用可能時間が確認できます。',
    enDescription: "The available dates and times at Yoyogi Park Athletic Stadium (Oda Field) can be checked on this page.",
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
    jaDescription: '田中希実選手の出場大会の結果をまとめた記録集。',
    enDescription: 'Race results of Japanese runner Nozomi Tanaka.',
  },
  tracks: {
    path: '', component: () => import('./views/TrackSearch.vue'),
    jaTitle: 'いつラン - 日付から探せる陸上競技場・トラック検索',
    enTitle: "It's Run - Find a track for your workout date",
    jaDescription: '利用日を選び、個人利用できそうな陸上競技場・ランニングトラックを地図と一覧から探せます。',
    enDescription: 'Choose a date and find verified athletic and running tracks that may be available for your workout.',
  },
  about: {
    path: 'about', component: About,
    jaTitle: 'いつランについて - 掲載情報と利用状況の見方',
    enTitle: 'About ItsRun - Track data and availability statuses',
    jaDescription: 'いつランの掲載範囲、公式情報の扱い、利用可能・要確認などの表示について説明します。',
    enDescription: 'Learn what ItsRun covers, how official sources are used, and what each availability status means.',
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
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.hash) {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          const target = document.getElementById(decodeURIComponent(to.hash.slice(1)));
          resolve(target ? { el: target, top: 64 } : { top: 0 });
        });
      });
    }
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const locale = to.meta.locale === 'en' ? 'en' : 'ja';
  i18n.global.locale.value = locale;
  useAppStore().setLocale(locale);
  document.documentElement.lang = locale;
  const title = String(to.meta.title ?? 'いつラン');
  const description = String(to.meta.description ?? 'いつラン');
  const canonicalPath = String(to.meta.canonicalPath ?? (locale === 'en' ? '/en/' : '/'));
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
  document.querySelector('link[rel="alternate"][hreflang="ja"]')?.setAttribute('href', `${SITE_ORIGIN}${String(to.meta.alternateJa ?? '/')}`);
  document.querySelector('link[rel="alternate"][hreflang="en"]')?.setAttribute('href', `${SITE_ORIGIN}${String(to.meta.alternateEn ?? '/en/')}`);
  document.querySelector('link[rel="alternate"][hreflang="x-default"]')?.setAttribute('href', `${SITE_ORIGIN}${String(to.meta.alternateJa ?? '/')}`);
});

export default router;
