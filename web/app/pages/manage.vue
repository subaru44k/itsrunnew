<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { japanToday, type StadiumSlug, type YearMonth } from '@itsrun/core'
import { AdminApiRepository, createEditor, type UpdateScheduleMonthRequest } from '../admin/adminApi'
import { EDITOR_DISPLAY_STATES, editorAction, editorMessageKey, slotCellId, slotTimeRanges, statusLabels } from '../admin/adminUi'
import { useAdminSession } from '../composables/useAdminSession.client'

const { t, locale } = useI18n(); const session = useAdminSession(); const config = useRuntimeConfig().public
const stadium = ref<StadiumSlug>('oda'); const month = ref<YearMonth>(japanToday().slice(0, 7) as YearMonth); const draft = ref<UpdateScheduleMonthRequest | null>(null)
const editor = createEditor(new AdminApiRepository(config.apiBasePath, () => session.getAccessToken()))
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => t('admin.title') })
const state = ref(editor.state)
editor.subscribe((next) => { state.value = next; if ('draft' in next) draft.value = next.draft })
const labels = computed(() => statusLabels(locale.value.startsWith('en') ? 'en' : 'ja'))
const times = computed(() => slotTimeRanges(stadium.value))
const days = computed(() => Object.keys(draft.value?.days ?? {}).sort())
const saving = computed(() => state.value.kind === 'saving')
const canEdit = computed(() => state.value.kind === 'ready' || state.value.kind === 'missing')
const canSave = computed(() => canEdit.value && 'dirty' in state.value && state.value.dirty)
const isKnownState = (kind: string): kind is typeof EDITOR_DISPLAY_STATES[number] => (EDITOR_DISPLAY_STATES as readonly string[]).includes(kind)
const stateError = computed(() => 'error' in state.value ? state.value.error : undefined)
const messageKey = computed(() => isKnownState(state.value.kind) ? editorMessageKey(state.value.kind, stateError.value) : null)
const actionKey = computed(() => isKnownState(state.value.kind) ? editorAction(state.value.kind, stateError.value) : null)
const currentSelection = () => ('stadium' in editor.state && editor.state.stadium && 'yearMonth' in editor.state && editor.state.yearMonth) ? { stadium: editor.state.stadium, yearMonth: editor.state.yearMonth } : null
function safeMessage() { return messageKey.value ? t(`admin.${messageKey.value}`) : '' }
async function load() {
  const requested = { stadium: stadium.value, month: month.value }
  await editor.load(requested.stadium, requested.month, () => typeof window !== 'undefined' && window.confirm(t('admin.discardConfirm')))
  const selected = currentSelection()
  if (selected && (selected.stadium !== requested.stadium || selected.yearMonth !== requested.month)) { stadium.value = selected.stadium; month.value = selected.yearMonth }
}
function update(date: string, slot: number, value: string) { editor.updateCell(date, slot, Number(value)) }
function statusAt(date: string, slot: number) { return draft.value?.days[date as keyof typeof draft.value.days]?.[slot] ?? 0 }
function eventValue(event: Event) { return (event.target as HTMLSelectElement).value }
function retryLoad() { void editor.retryLoad() }
function retrySave() { void editor.retrySave() }
function retryComparison() { void editor.retryComparison() }
function rebase() { editor.rebaseOnLatest() }
function replaceLatest() { editor.replaceLatest(() => typeof window !== 'undefined' && window.confirm(t('admin.replaceConfirm'))) }
function discard() { void load() }
watch(() => session.state.value, (next) => { if (next === 'signedIn' && !draft.value) void load() }, { immediate: true })
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
      <button type="button" :disabled="saving" @click="session.logout">{{ t('admin.logout') }}</button>
      <form class="admin-filters" @submit.prevent="load">
        <label>{{ t('admin.stadium') }} <select v-model="stadium" :disabled="saving"><option value="oda">{{ t('stadium.oda') }}</option><option value="yumenoshima">{{ t('stadium.yumenoshima') }}</option><option value="komazawa">{{ t('stadium.komazawa') }}</option><option value="todoroki">{{ t('stadium.todoroki') }}</option></select></label>
        <label>{{ t('admin.month') }} <input v-model="month" type="month" required :disabled="saving"></label>
        <button type="submit" :disabled="saving">{{ t('admin.load') }}</button>
      </form>
      <p v-if="state.kind === 'loading'" role="status" aria-live="polite">{{ t('admin.loading') }}</p>
      <p v-else-if="state.kind === 'missing'" role="status">{{ t('admin.missing') }}</p>
      <p v-else-if="state.kind === 'saved'" role="status" aria-live="polite">{{ t('admin.saved') }}</p>
      <p v-if="messageKey" role="alert" aria-live="assertive">{{ safeMessage() }}</p>
      <div v-if="state.kind === 'loadFailure'" class="admin-actions"><button v-if="actionKey === 'login'" type="button" @click="session.login('/manage')">{{ t('admin.login') }}</button><button v-else type="button" @click="retryLoad">{{ t('admin.retryLoad') }}</button></div>
      <div v-if="state.kind === 'saveFailure'" class="admin-actions"><button v-if="actionKey === 'login'" type="button" @click="session.login('/manage')">{{ t('admin.login') }}</button><button v-else type="button" @click="retrySave">{{ t('admin.retrySave') }}</button></div>
      <div v-if="state.kind === 'comparisonFailure'" class="admin-actions"><button type="button" @click="retryComparison">{{ t('admin.retryComparison') }}</button></div>
      <section v-if="state.kind === 'conflict' || state.kind === 'comparisonFailure'" aria-labelledby="conflict-title">
        <h2 id="conflict-title">{{ t('admin.conflict') }}</h2>
        <p v-if="state.kind === 'conflict' && state.latest">{{ t('admin.conflictInstruction') }}</p>
        <table v-if="state.kind === 'conflict' && state.latest" class="admin-table"><caption>{{ t('admin.latest') }}</caption><thead><tr><th scope="col">{{ t('admin.date') }}</th><th scope="col">{{ t('admin.slot') }}</th><th scope="col">{{ t('admin.base') }}</th><th scope="col">{{ t('admin.local') }}</th><th scope="col">{{ t('admin.latest') }}</th></tr></thead><tbody><tr v-for="diff in state.diffs" :key="`${diff.date}-${diff.slot}`"><th scope="row">{{ diff.date }}</th><td>{{ times[diff.slot] }}</td><td>{{ diff.base === null ? t('admin.none') : labels[diff.base] }}</td><td>{{ diff.local === null ? t('admin.none') : labels[diff.local] }}</td><td>{{ diff.latest === null ? t('admin.none') : labels[diff.latest] }}</td></tr></tbody></table>
        <div v-if="state.kind === 'conflict' && state.latest" class="admin-actions"><button type="button" :disabled="saving" @click="rebase">{{ t('admin.rebase') }}</button><button type="button" :disabled="saving" @click="replaceLatest">{{ t('admin.replaceLatest') }}</button></div>
        <div v-else-if="state.kind === 'conflict'" class="admin-actions"><button type="button" @click="retryComparison">{{ t('admin.retryComparison') }}</button></div>
      </section>
      <table v-if="draft && (canEdit || state.kind === 'saving' || state.kind === 'saveFailure' || state.kind === 'saved')" class="admin-table"><caption>{{ t('admin.title') }}</caption><thead><tr><th scope="col">{{ t('admin.date') }}</th><th v-for="(time, slot) in times" :key="time" scope="col">{{ time }}<span class="sr-only">{{ t('admin.slot') }} {{ slot + 1 }}</span></th></tr></thead><tbody><tr v-for="date in days" :key="date"><th scope="row">{{ date }}</th><td v-for="(time, slot) in times" :key="time"><label class="sr-only" :for="slotCellId(date, slot)">{{ date }} {{ time }}</label><select :id="slotCellId(date, slot)" :value="statusAt(date, slot)" :disabled="saving || !canEdit" @change="update(date, slot, eventValue($event))"><option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option></select></td></tr></tbody></table>
      <div v-if="draft && (canEdit || state.kind === 'saving' || state.kind === 'saveFailure')" class="admin-actions"><button type="button" :disabled="saving || !canSave" @click="editor.save">{{ saving ? t('admin.saving') : t('admin.save') }}</button><button type="button" :disabled="saving" @click="discard">{{ t('admin.discard') }}</button></div>
      <dl v-if="state.kind === 'saved'" class="admin-metadata"><dt>{{ t('admin.updatedAt') }}</dt><dd>{{ state.base.document.updatedAt }}</dd><dt>ETag</dt><dd>{{ state.base.etag }}</dd><dt>VersionId</dt><dd>{{ state.base.versionId }}</dd></dl>
    </template>
  </main>
</template>
