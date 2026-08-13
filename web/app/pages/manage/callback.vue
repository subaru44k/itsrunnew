<script setup lang="ts">
import { onMounted } from 'vue'
import { captureCallbackUrl } from '../../admin/callbackUrl'
const callbackUrl = import.meta.client ? captureCallbackUrl(window.location.origin, '/manage/callback', window.location.href) : undefined
const session = useAdminSession({ initialize: false })
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
onMounted(() => { void session.callback(callbackUrl) })
</script>
<template><main aria-labelledby="callback-title"><h1 id="callback-title">{{ $t('admin.loading') }}</h1><p role="status" aria-live="polite">{{ $t('admin.loading') }}</p></main></template>
