<script setup lang="ts">
import type { StadiumSlug } from '@itsrun/core'
import { STADIUMS } from '@itsrun/core'
const props = defineProps<{ slug: StadiumSlug }>()
const { t: $t } = useI18n()
const stadium = computed(() => STADIUMS[props.slug])
useSeoMeta({ title: () => $t(stadium.value.nameKey) })
</script>
<template><article class="content" v-if="stadium"><p class="eyebrow">{{ $t('siteName') }}</p><h1>{{ $t(stadium.nameKey) }}</h1><p>{{ $t('homeDescription') }}</p><h2>{{ $t('scheduleTitle') }}</h2><p class="notice">{{ $t('scheduleComingSoon') }}</p></article></template>
