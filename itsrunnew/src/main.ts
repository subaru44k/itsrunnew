import Vue from 'vue';
import './plugins/vuetify'
import App from './App.vue';
import i18n from './i18n'
import router from './router';
import store from './store';
import './registerServiceWorker';

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  i18n,
  render: (h) => h(App)
}).$mount('#app');
