<script setup lang="ts">
import { onMounted } from 'vue'
const session = useAdminSession()
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
onMounted(() => { void session.callback() })
</script>
<template><main aria-labelledby="callback-title"><h1 id="callback-title">{{ $t('admin.loading') }}</h1><p role="status" aria-live="polite">{{ $t('admin.loading') }}</p></main></template>
