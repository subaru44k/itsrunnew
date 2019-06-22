import Vue from 'vue';
import './plugins/vuetify'
import App from './App.vue';
import i18n from './i18n'
import router from './router';
import store from './store';
import './registerServiceWorker';
import Adsense from 'vue-google-adsense/dist/Adsense.min.js'

Vue.config.productionTip = false

/* アドセンスの使用宣言 */
Vue.use(require('vue-script2'))
Vue.use(Adsense)

new Vue({
  router,
  store,
  i18n,
  render: (h) => h(App)
}).$mount('#app');
