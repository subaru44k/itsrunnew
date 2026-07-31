export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n', '@nuxt/eslint'],
  i18n: {
    locales: [
      { code: 'ja', language: 'ja-JP', file: 'ja.json', name: '日本語' },
      { code: 'en', language: 'en-US', file: 'en.json', name: 'English' },
    ],
    defaultLocale: 'ja',
    strategy: 'prefix_except_default',
    langDir: 'locales',
  },
  app: {
    head: {
      titleTemplate: '%s | いつラン',
      meta: [{ name: 'description', content: 'ランニング施設の利用状況とペースを確認できます。' }],
    },
  },
})
