import Vue from 'vue';
import Router from 'vue-router';
import OdaField from './views/OdaField.vue';
import Yumenoshima from './views/Yumenoshima.vue';
import Komazawa from './views/Komazawa.vue';
import Todoroki from './views/Todoroki.vue';
import i18n from './i18n';

Vue.use(Router);

const router = new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'oda',
      component: OdaField,
      meta: {
        title: 'いつラン - 織田フィールドを個人利用する人のための利用時間確認ページ',
        description: '織田フィールド(代々木公園陸上競技場)等の陸上競技場を個人利用したい際に、このサイトにて開放日・利用可能時間が確認できます。',
      },
    },
    {
      path: '/index.html',
      redirect: '/',
    },
    {
      path: '/yumenoshima',
      name: 'yumenoshima',
      component: Yumenoshima,
      meta: {
        title: 'いつラン - 夢の島陸上競技場を個人利用する人のための利用時間確認ページ',
        description: '夢の島陸上競技場等の陸上競技場を個人利用したい際に、このサイトにて開放日・利用可能時間が確認できます。',
      },
    },
    {
      path: '/komazawa',
      name: 'komazawa',
      component: Komazawa,
      meta: {
        title: 'いつラン - 駒沢オリンピック公園陸上競技場を個人利用する人のための利用時間確認ページ',
        description: '駒沢オリンピック公園陸上競技場等の陸上競技場を個人利用したい際に、このサイトにて開放日・利用可能時間が確認できます。',
      },
    },
    {
      path: '/komazawa_olympic',
      redirect: '/komazawa',
    },
    {
      path: '/todoroki',
      name: 'todoroki',
      component: Todoroki,
      meta: {
        title: 'いつラン - 等々力陸上競技場を個人利用する人のための利用時間確認ページ',
        description: '等々力陸上競技場等の陸上競技場を個人利用したい際に、このサイトにて開放日・利用可能時間が確認できます。',
      },
    },
    {
      path: '/manage',
      name: 'manage',
      meta: {
        title: 'いつラン - 管理画面',
        description: '管理画面',
      },
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "manage" */ './views/Manage.vue'),
    },
    {
      path: '/pace/marathon',
      name: 'marathon',
      meta: {
        title: 'いつラン - マラソンのペース表。5kmごとのラップタイム表記。',
        description: 'マラソンの5kmごとのラップタイムがひと目で分かります。サブスリー、サブフォー、サブファイブ、2時間の世界記録まで。スマートフォン対応。',
      },
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "laptime" */ './views/LapTime.vue'),
    },
    {
      path: '/:lang/',
      component: OdaField,
      meta: {
        title: 'It\'s Run - For runners using Yoyogi Park Athletic Track to check stadium\'s availability',
        description: 'The available dates and times at Yoyogi Park Athletic Stadium (Oda Field) can be checked in this web page.',
      },
    },
    {
      path: '/:lang/yumenoshima',
      component: Yumenoshima,
      meta: {
        title: 'It\'s Run - For runners using Yumenoshima Athletics Stadium to check stadium\'s availability',
        description: 'The available dates and times at Yumenoshima Athletics Stadium can be checked in this web page.',
      },
    },
    {
      path: '/:lang/komazawa',
      component: Komazawa,
      meta: {
        title: 'It\'s Run - For runners using Komazawa Olympic Park Athletic Stadium to check stadium\'s availability',
        description: 'The available dates and times at Komazawa Olympic Park Athletic Stadium can be checked in this web page.',
      },
    },
    {
      path: '/:lang/todoroki',
      component: Todoroki,
      meta: {
        title: 'It\'s Run - For runners using Kawasaki Todoroki Stadium to check stadium\'s availability',
        description: 'The available dates and times at Kawasaki Todoroki Stadium can be checked in this web page.',
      },
    },
    {
      path: '/:lang/pace/marathon',
      meta: {
        title: 'It\'s Run - The pace list for the marathon. The lap times are described in each 5km.',
        description: 'The lap times for the marathon. Support variety of paces from 2 hours(World record) to 6.5 hours.',
      },
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "laptime" */ './views/LapTime.vue'),
    },
  ],
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title;
  let desc = document.head.querySelector('meta[name=description]');
  if (desc !== null) {
    desc.setAttribute('content', to.meta.description);
  }
  if (to.params.lang !== undefined) {
    i18n.locale = to.params.lang;
  } else {
    i18n.locale = 'ja';
  }
  next();
});

export default router;