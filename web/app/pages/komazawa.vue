<script setup lang="ts">
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nav.komazawa') })
</script>
<template><section class="content"><h1>{{ $t('nav.komazawa') }}</h1><p>{{ $t('homeDescription') }}</p></section></template>
