<template>
  <section v-if="showPrompt" class="privacy-consent" role="dialog" aria-labelledby="privacy-consent-title" aria-live="polite">
    <div class="privacy-consent-inner">
      <div>
        <strong id="privacy-consent-title">{{ copy.title }}</strong>
        <p>{{ copy.message }} <router-link :to="privacyPath">{{ copy.details }}</router-link></p>
      </div>
      <div class="privacy-consent-actions">
        <v-btn color="indigo" variant="flat" @click="choose('granted')">{{ copy.accept }}</v-btn>
        <v-btn color="indigo" variant="outlined" @click="choose('denied')">{{ copy.decline }}</v-btn>
        <v-btn v-if="analyticsConsent !== null" variant="text" @click="closePrivacySettings">{{ copy.close }}</v-btn>
      </div>
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
  message: 'Choose whether ItsRun may use Google Analytics to improve the track finder. Advertising and cookie choices are managed separately by Google’s consent message.',
  details: 'Privacy details', accept: 'Allow analytics', decline: 'Decline', close: 'Close',
} : {
  title: 'アクセス解析の設定',
  message: 'トラック検索の改善にGoogle Analyticsを利用してよいか選択してください。広告・Cookieの選択は、Googleの同意メッセージで別に管理します。',
  details: 'プライバシー詳細', accept: '解析に同意する', decline: '同意しない', close: '閉じる',
});

function choose(value: 'granted' | 'denied') {
  saveAnalyticsConsent(value);
}
</script>

<style scoped>
.privacy-consent { width: 100%; color: #212121; border-bottom: 1px solid #c5cae9; background: #f7f8ff; box-shadow: 0 3px 12px rgba(20, 30, 70, .1); }
.privacy-consent-inner { display: flex; width: min(100%, 1185px); padding: 12px 24px; margin-inline: auto; align-items: center; justify-content: space-between; gap: 16px; }
.privacy-consent p { margin: 4px 0 0; }
.privacy-consent-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 8px; }
@media (max-width: 699px) {
  .privacy-consent-inner { padding: 12px 10px; align-items: stretch; flex-direction: column; }
  .privacy-consent-actions .v-btn { flex: 1 1 auto; min-height: 44px; }
}
</style>
