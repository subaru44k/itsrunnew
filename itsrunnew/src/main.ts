import Vue from 'vue';
import './plugins/vuetify'
import App from './App.vue';
import i18n from './i18n'
import router from './router';
import store from './store';
import './registerServiceWorker';
import Ads from 'vue-google-adsense';

Vue.config.productionTip = false

/* アドセンスの使用宣言 */
Vue.use(require('vue-script2'))
Vue.use(Ads.Adsense)

new Vue({
  router,
  store,
  i18n,
  render: (h) => h(App)
}).$mount('#app');
