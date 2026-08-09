<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StadiumSlug, YearMonth } from '@itsrun/core'
import { AdminApiRepository, createEditor, type UpdateScheduleMonthRequest } from '../admin/adminApi'
import { useAdminSession } from '../composables/useAdminSession.client'

const { t } = useI18n(); const session = useAdminSession(); const config = useRuntimeConfig().public
const stadium = ref<StadiumSlug>('oda'); const month = ref<YearMonth>('2026-08'); const draft = ref<UpdateScheduleMonthRequest | null>(null)
const editor = createEditor(new AdminApiRepository(config.apiBasePath, () => session.getAccessToken()))
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const labels = computed(() => Array.from({ length: 3 }, (_, i) => t(`admin.status${i}`)))
const days = computed(() => Object.keys(draft.value?.days ?? {}).sort() as Array<keyof NonNullable<typeof draft.value>['days']>)
const state = ref(editor.state)
editor.subscribe((next) => { state.value = next; if ('draft' in next) draft.value = next.draft })
const errorText = computed(() => state.value.kind === 'error' ? t(`admin.${state.value.error === 'unauthorized' ? 'authError' : 'error'}`) : state.value.kind === 'comparisonError' ? t('admin.comparisonError') : '')
async function load() { await editor.load(stadium.value, month.value) }
function update(date: string, slot: number, value: string) { if (!draft.value) return; const next = structuredClone(draft.value); const days = next.days as Record<string, [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]>; const row = days[date] ?? [0, 0, 0]; row[slot] = Number(value) as 0 | 1 | 2; days[date] = row; editor.updateDraft(next) }
function statusAt(date: string, slot: number) { return (draft.value?.days as Record<string, [number, number, number]> | undefined)?.[date]?.[slot] ?? 0 }
function eventValue(event: Event) { return (event.target as HTMLSelectElement).value }
function discard() { if (draft.value && !confirm(t('admin.discardConfirm'))) return; void load() }
watch(() => session.state.value, (next) => { if (next === 'signedIn') void load() }, { immediate: true })
</script>

<template>
  <main class="admin-page" aria-labelledby="admin-title">
    <h1 id="admin-title">{{ t('admin.title') }}</h1>
    <p v-if="session.state.value === 'unconfigured'" role="alert">{{ t('admin.configError') }}</p>
    <p v-else-if="session.state.value === 'sanitizedError'" role="alert">{{ t('admin.authError') }} <button type="button" @click="session.initialize">{{ t('admin.retry') }}</button></p>
    <template v-else-if="session.state.value !== 'signedIn'">
      <p role="status" aria-live="polite">{{ ['redirecting', 'processingCallback'].includes(session.state.value) ? t('admin.loading') : '' }}</p>
      <button v-if="session.state.value === 'signedOut'" type="button" @click="session.login('/manage')">{{ t('admin.login') }}</button>
    </template>
    <template v-else>
      <button type="button" @click="session.logout">{{ t('admin.logout') }}</button>
      <form class="admin-filters" @submit.prevent="load">
        <label>{{ t('admin.stadium') }} <select v-model="stadium"><option value="oda">{{ t('stadium.oda') }}</option><option value="yumenoshima">{{ t('stadium.yumenoshima') }}</option><option value="komazawa">{{ t('stadium.komazawa') }}</option><option value="todoroki">{{ t('stadium.todoroki') }}</option></select></label>
        <label>{{ t('admin.month') }} <input v-model="month" type="month" required></label>
        <button type="submit">{{ t('admin.retry') }}</button>
      </form>
      <p v-if="state.kind === 'loading'" role="status" aria-live="polite">{{ t('admin.loading') }}</p>
      <p v-if="state.kind === 'missing'" role="status">{{ t('admin.missing') }}</p>
      <p v-if="errorText" role="alert">{{ errorText }}</p>
      <p v-if="state.kind === 'conflict'" role="alert">{{ t('admin.conflict') }}</p>
      <p v-if="state.kind === 'saved'" role="status" aria-live="polite">{{ t('admin.saved') }}</p>
      <table v-if="draft" class="admin-table"><caption>{{ t('admin.title') }}</caption><thead><tr><th scope="col">{{ t('admin.date') }}</th><th v-for="slot in 3" :key="slot" scope="col">{{ t('admin.slot') }} {{ slot }}</th></tr></thead><tbody><tr v-for="date in days" :key="date"><th scope="row">{{ date }}</th><td v-for="slot in 3" :key="slot"><label class="sr-only" :for="`${date}-${slot}`">{{ date }} {{ t('admin.slot') }} {{ slot + 1 }}</label><select :id="`${date}-${slot}`" :value="statusAt(date, slot)" @change="update(date, slot, eventValue($event))"><option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option></select></td></tr></tbody></table>
      <div v-if="draft" class="admin-actions"><button type="button" :disabled="state.kind === 'saving'" @click="editor.save">{{ state.kind === 'saving' ? t('admin.saving') : t('admin.save') }}</button><button type="button" @click="discard">{{ t('admin.discard') }}</button></div>
    </template>
  </main>
</template>
