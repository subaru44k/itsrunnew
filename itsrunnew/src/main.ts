import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import vuetify from './plugins/vuetify';
import './styles.css';
import { trackPageView, updateAnalyticsConsent } from './services/analytics';
import { analyticsConsent } from './services/privacy-consent';
import { initializeAdvertising } from './services/advertising';

createApp(App).use(createPinia()).use(i18n).use(vuetify).use(router).mount('#app');

watch(analyticsConsent, value => {
  updateAnalyticsConsent(value === 'granted');
  if (value === 'granted') trackPageView(router.currentRoute.value.path, document.title);
  // Keep the analytics prompt and Google CMP from competing for attention.
  // Advertising may initialize after either analytics choice; it never depends on consent being granted.
  if (value !== null) initializeAdvertising();
}, { immediate: true });
router.afterEach((to) => {
  requestAnimationFrame(() => trackPageView(to.path, document.title));
});
