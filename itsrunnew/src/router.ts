import Vue from 'vue';
import Router from 'vue-router';
import Home from './views/Home.vue';
import i18n from './i18n';

Vue.use(Router);

const router = new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: {
        title: 'いつラン',
      },
    },
    {
      path: '/about',
      name: 'about',
      meta: {
        title: 'Home',
      },
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import(/* webpackChunkName: "about" */ './views/About.vue'),
    },
    {
      path: '/:lang/',
      component: Home,
      meta: {
        title: 'いつラン',
      },
    },
    {
      path: '/:lang/about',
      meta: {
        title: 'Home',
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
  if (to.params.lang !== undefined) {
    i18n.locale = to.params.lang;
  } else {
    i18n.locale = 'ja';
  }
  next();
});

export default router;