<script setup lang="ts">
import { NOZOMI_RECORDS } from '~/data/nozomiRecords'
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nozomiTitle') })
</script>
<template><section class="content"><h1>{{ $t('nozomiTitle') }}</h1><p>{{ $t('nozomiDescription') }}</p><table><thead><tr><th>Year</th><th>Date</th><th>Meet</th><th>{{ $t('event') }}</th><th>{{ $t('result') }}</th></tr></thead><tbody><tr v-for="(record, index) in NOZOMI_RECORDS" :key="`${record.year}-${record.date}-${index}`"><td>{{ record.year }}</td><td>{{ record.date }}</td><td>{{ record.meet }}</td><td>{{ record.event }}</td><td>{{ record.result }}</td></tr></tbody></table></section></template>
