import Vue from 'vue';
import Router from 'vue-router';
import OdaField from './views/OdaField.vue';
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
      path: '/pace/marathon',
      name: 'marathon',
      meta: {
        title: 'いつラン - マラソンのペース表。5kmごとのラップタイム表記。',
        description: 'マラソンの5kmごとのラップタイムがひと目で分かります。サブスリー、サブフォー、サブファイブ、2時間の世界記録まで。スマートフォン対応。',
      },
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "about" */ './views/LapTime.vue'),
    },
    {
      path: '/:lang/',
      component: OdaField,
      meta: {
        title: 'ItsRun - For runners using Yoyogi Park Athletic Track to check stadium\'s availability',
        description: 'The available dates and times at Yoyogi Park Athletic Stadium (Oda Field) can be checked in this web page.',
      },
    },
    {
      path: '/:lang/about',
      meta: {
        title: 'Home',
        description: 'いつラン eng about',
      },
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "about" */ './views/About.vue'),
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