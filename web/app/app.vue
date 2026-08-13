<script setup lang="ts">
const i18nHead = useLocaleHead({ lang: true, dir: false, seo: true })

useHead(() => ({
  htmlAttrs: i18nHead.value.htmlAttrs,
  link: i18nHead.value.link,
  meta: i18nHead.value.meta,
}))
</script>

<template>
  <div class="site-shell">
    <AppHeader />
    <main id="main-content" class="site-main"><NuxtPage /></main>
    <AppFooter />
  </div>
</template>
