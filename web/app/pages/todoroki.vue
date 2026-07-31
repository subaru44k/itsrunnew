<script setup lang="ts">
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nav.todoroki') })
</script>
<template><section class="content"><h1>{{ $t('nav.todoroki') }}</h1><p>{{ $t('homeDescription') }}</p></section></template>
