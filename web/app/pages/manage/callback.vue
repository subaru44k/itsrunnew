<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
const session = useAdminSession()
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
onMounted(async () => {
  await nextTick()
  await session.callback(window.location.href)
  if (window.location.pathname !== '/manage') await navigateTo('/manage', { replace: true })
})
</script>
<template><main aria-labelledby="callback-title"><h1 id="callback-title">{{ $t('admin.loading') }}</h1><p role="status" aria-live="polite">{{ $t('admin.loading') }}</p></main></template>
