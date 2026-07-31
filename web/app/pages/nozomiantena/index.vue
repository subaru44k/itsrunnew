<script setup lang="ts">
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nozomiTitle') })
const records = [{ event: '1500m', result: '4:04.08' }, { event: '5000m', result: '14:29.18' }]
</script>
<template><section class="content"><h1>{{ $t('nozomiTitle') }}</h1><p>{{ $t('nozomiDescription') }}</p><table><thead><tr><th>{{ $t('event') }}</th><th>{{ $t('result') }}</th></tr></thead><tbody><tr v-for="record in records" :key="record.event"><td>{{ record.event }}</td><td>{{ record.result }}</td></tr></tbody></table></section></template>
