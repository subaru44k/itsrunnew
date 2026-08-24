import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import i18n from './i18n';
import { useAppStore } from './store';
import OdaField from './views/OdaField.vue';
import Yumenoshima from './views/Yumenoshima.vue';
import Komazawa from './views/Komazawa.vue';
import Todoroki from './views/Todoroki.vue';

const pages = {
  oda: {
    path: '', component: OdaField,
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
    path: 'tracks', component: () => import('./views/TrackSearch.vue'),
    jaTitle: 'いつラン - 日付から探せる陸上競技場・トラック検索',
    enTitle: "It's Run - Find a track for your workout date",
    jaDescription: '利用日を選び、個人利用できそうな陸上競技場・ランニングトラックを地図と一覧から探せます。',
    enDescription: 'Choose a date and find verified athletic and running tracks that may be available for your workout.',
  },
} as const;

const routes: RouteRecordRaw[] = [];
for (const [key, page] of Object.entries(pages)) {
  const jaPath = page.path ? `/${page.path}` : '/';
  const enPath = page.path ? `/en/${page.path}` : '/en/';
  routes.push(
    { path: jaPath, name: `${key}-ja`, component: page.component, meta: { locale: 'ja', title: page.jaTitle, description: page.jaDescription } },
    { path: enPath, name: `${key}-en`, component: page.component, meta: { locale: 'en', title: page.enTitle, description: page.enDescription } },
  );
}
routes.push(
  { path: '/index.html', redirect: '/' },
  { path: '/komazawa_olympic', redirect: '/komazawa' },
  { path: '/:pathMatch(.*)*', redirect: '/' },
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
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
});

export default router;
