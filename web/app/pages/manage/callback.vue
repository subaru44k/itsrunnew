<script setup lang="ts">
import { onMounted } from 'vue'
const callbackUrl = import.meta.client ? window.location.href : null
const session = useAdminSession({ initialize: false })
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
onMounted(() => { if (callbackUrl !== null) void session.callback(callbackUrl) })
</script>
<template><main aria-labelledby="callback-title"><h1 id="callback-title">{{ $t('admin.loading') }}</h1><p role="status" aria-live="polite">{{ $t('admin.loading') }}</p></main></template>
