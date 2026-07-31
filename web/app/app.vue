<script setup lang="ts">
const route = useRoute()
const { locale } = useI18n()

const seoPaths = computed(() => {
  const pathname = route.path.startsWith('/en/') ? route.path.slice(3) : route.path === '/en' ? '/' : route.path
  return {
    ja: pathname || '/',
    en: pathname === '/' ? '/en/' : `/en${pathname}`,
  }
})

useHead(() => ({
  htmlAttrs: { lang: locale.value === 'ja' ? 'ja-JP' : 'en-US' },
  link: [
    { rel: 'canonical', href: locale.value === 'ja' ? seoPaths.value.ja : seoPaths.value.en },
    { rel: 'alternate', hreflang: 'ja', href: seoPaths.value.ja },
    { rel: 'alternate', hreflang: 'en', href: seoPaths.value.en },
    { rel: 'alternate', hreflang: 'x-default', href: seoPaths.value.ja },
  ],
}))
</script>

<template>
  <div class="site-shell">
    <AppHeader />
    <main id="main-content" class="site-main"><NuxtPage /></main>
    <AppFooter />
  </div>
</template>
