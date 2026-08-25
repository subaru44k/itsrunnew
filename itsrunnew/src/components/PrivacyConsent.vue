<template>
  <section v-if="showPrompt" class="privacy-consent" role="dialog" aria-labelledby="privacy-consent-title" aria-live="polite">
    <div>
      <strong id="privacy-consent-title">{{ copy.title }}</strong>
      <p>{{ copy.message }} <router-link :to="privacyPath">{{ copy.details }}</router-link></p>
    </div>
    <div class="privacy-consent-actions">
      <v-btn color="indigo" variant="flat" @click="choose('granted')">{{ copy.accept }}</v-btn>
      <v-btn color="indigo" variant="outlined" @click="choose('denied')">{{ copy.decline }}</v-btn>
      <v-btn v-if="analyticsConsent !== null" variant="text" @click="closePrivacySettings">{{ copy.close }}</v-btn>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { analyticsConsent, closePrivacySettings, privacySettingsOpen, saveAnalyticsConsent } from '@/services/privacy-consent';

const { locale } = useI18n();
const isEnglish = computed(() => locale.value === 'en');
const showPrompt = computed(() => analyticsConsent.value === null || privacySettingsOpen.value);
const privacyPath = computed(() => isEnglish.value ? '/en/privacy' : '/privacy');
const copy = computed(() => isEnglish.value ? {
  title: 'Analytics preferences',
  message: 'ItsRun uses Google Analytics only with your permission to improve the track finder. Advertising is currently disabled.',
  details: 'Privacy details', accept: 'Allow analytics', decline: 'Decline', close: 'Close',
} : {
  title: 'アクセス解析の設定',
  message: 'いつランは、トラック検索の改善を目的に、同意いただいた場合のみGoogle Analyticsを使用します。広告は現在停止しています。',
  details: 'プライバシー詳細', accept: '解析に同意する', decline: '同意しない', close: '閉じる',
});

function choose(value: 'granted' | 'denied') {
  saveAnalyticsConsent(value);
}
</script>

<style scoped>
.privacy-consent { position: fixed; right: 16px; bottom: 16px; z-index: 2000; display: flex; max-width: 680px; padding: 16px; align-items: center; gap: 16px; color: #212121; border: 1px solid #c5cae9; border-radius: 10px; background: white; box-shadow: 0 8px 30px rgba(20, 30, 70, .24); }
.privacy-consent p { margin: 4px 0 0; }
.privacy-consent-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 8px; }
@media (max-width: 699px) {
  .privacy-consent { right: 8px; bottom: 8px; left: 8px; align-items: stretch; flex-direction: column; }
  .privacy-consent-actions .v-btn { flex: 1 1 auto; min-height: 44px; }
}
</style>
