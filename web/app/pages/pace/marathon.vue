<script setup lang="ts">
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nav.pace') })
</script>
<template><section class="content"><h1>{{ $t('nav.pace') }}</h1><p>{{ $t('homeDescription') }}</p></section></template>
