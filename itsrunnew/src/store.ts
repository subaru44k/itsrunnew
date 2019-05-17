import Vue from 'vue';
import Vuex from 'vuex';
import i18n from './i18n';
import router from './router'

Vue.use(Vuex);

interface StoreType {
}
export default new Vuex.Store({
  state: {
  } as StoreType,
  mutations: {
    changelang(state) {
      changeUrl('/en', '/');
    },
    rootPage(state) {
      changeUrl('/', '/en/');
    },
    aboutPage(state) {
      changeUrl('/about', '/en/about');
    }
  },
  actions: {

  },
});

function changeUrl(jaUrl: string, enUrl: string) {
  if (i18n.locale === 'ja') {
    router.push(jaUrl);
  } else {
    router.push(enUrl);
  }
}