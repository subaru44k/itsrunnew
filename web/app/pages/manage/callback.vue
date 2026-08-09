<script setup lang="ts">
const session = useAdminSession()
if (import.meta.client) await session.callback()
</script>
<template><main aria-labelledby="callback-title"><h1 id="callback-title">{{ $t('admin.loading') }}</h1><p role="status" aria-live="polite">{{ $t('admin.loading') }}</p></main></template>
