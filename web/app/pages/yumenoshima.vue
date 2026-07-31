<script setup lang="ts">
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nav.yumenoshima') })
</script>
<template><section class="content"><h1>{{ $t('nav.yumenoshima') }}</h1><p>{{ $t('homeDescription') }}</p></section></template>
