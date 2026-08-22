import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import vuetify from './plugins/vuetify';
import './styles.css';

createApp(App).use(createPinia()).use(i18n).use(vuetify).use(router).mount('#app');
