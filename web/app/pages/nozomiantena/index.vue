<script setup lang="ts">
const { t: $t } = useI18n()
const { locale } = useI18n()
const { expandedNozomiRecords } = await import('~/data/nozomiRecords')
const records = computed(() => expandedNozomiRecords(locale.value))
const years = [2021, 2020]
useSeoMeta({ title: () => $t('nozomiTitle') })
</script>
<template><section class="content parity-card records-page"><h1>{{ $t('nozomiTitle') }}</h1><p class="lead">{{ $t('nozomiDescription') }}</p><nav :aria-label="$t('nozomiYears')"><a v-for="year in years" :key="year" :href="`#${year}`">{{ year }}{{ $t('yearSuffix') }}</a></nav><section v-for="year in years" :id="String(year)" :key="year" class="records-year"><h2>{{ year }}{{ $t('yearSuffix') }}</h2><div class="table-wrap"><table class="parity-table"><caption class="sr-only">{{ year }}{{ $t('yearSuffix') }}</caption><thead><tr><th>{{ $t('recordDate') }}</th><th>{{ $t('recordMeet') }}</th><th>{{ $t('event') }}</th><th>{{ $t('result') }}</th></tr></thead><tbody><tr v-for="(record, index) in records.filter((item) => item.year === year)" :key="`${record.year}-${record.date}-${index}`"><td>{{ record.date }}</td><td>{{ record.meet }}</td><td>{{ record.event }}</td><td>{{ record.result }}</td></tr></tbody></table></div></section></section></template>
