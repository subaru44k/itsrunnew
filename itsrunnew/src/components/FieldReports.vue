<template>
  <section data-testid="field-reports" class="field-reports" :aria-labelledby="headingId">
    <h2 :id="headingId">{{ copy.heading }}</h2>
    <p class="field-reports-intro">{{ copy.intro }}</p>
    <p class="field-reports-privacy-note">{{ copy.privacyNote }} <router-link :to="privacyPath">{{ copy.privacyLink }}</router-link></p>

    <div class="field-reports-date">
      <strong>{{ copy.targetDate }}</strong>
      <time :datetime="selectedDate">{{ targetDateLabel }}</time>
      <span class="field-reports-timezone">{{ copy.japanTime }}</span>
    </div>

    <p v-if="!apiEnabled" class="field-reports-state" role="status">{{ copy.unavailable }}</p>

    <template v-else>
      <div v-if="!isToday" class="field-reports-browse-only">
        <p>{{ copy.browseOnly }}</p>
        <button type="button" class="field-reports-button field-reports-button--secondary" @click="selectToday">
          {{ copy.switchToToday }}
        </button>
      </div>

      <form v-else ref="reportForm" data-testid="field-report-form" class="field-report-form" @focusin="startInteraction" @pointerdown="startInteraction" @submit.prevent="submitReport">
        <fieldset :disabled="submitting">
          <legend>{{ copy.outcomeQuestion }}</legend>
          <label v-for="option in outcomeOptions" :key="option.value" class="field-report-option">
            <input v-model="selectedOutcome" :data-testid="`field-report-outcome-${option.value}`" type="radio" name="field-report-outcome" :value="option.value" />
            <span>{{ option.label }}</span>
          </label>
        </fieldset>

        <label class="field-report-comment-label">
          <span>{{ copy.commentLabel }}</span>
          <textarea v-model="comment" maxlength="200" rows="4" :placeholder="copy.commentPlaceholder" :disabled="submitting" />
        </label>
        <p class="field-report-comment-help">{{ copy.commentHelp }} <span>{{ comment.length }}/200</span></p>

        <p v-if="submitFeedback" :class="['field-reports-feedback', `field-reports-feedback--${submitFeedback.kind}`]" :role="submitFeedback.kind === 'success' ? 'status' : 'alert'" aria-live="polite">
          {{ submitFeedback.kind === 'success' ? copy.success : errorMessage(submitFeedback.code ?? 'unavailable') }}
          <button v-if="submitFeedback.code === 'date_changed'" type="button" class="field-reports-link-button" @click="selectToday">{{ copy.switchToToday }}</button>
        </p>

        <button data-testid="field-report-submit" type="submit" class="field-reports-button" :disabled="!selectedOutcome || submitting">
          {{ submitting ? copy.submitting : copy.submit }}
        </button>
      </form>

      <h3 class="field-report-list-heading">{{ copy.recentReports }}</h3>
      <p v-if="reportsLoading" class="field-reports-state" role="status" aria-live="polite">{{ copy.loading }}</p>
      <div v-else-if="reportsErrorCode" class="field-reports-error" role="alert">
        <p>{{ errorMessage(reportsErrorCode) }}</p>
        <button type="button" class="field-reports-link-button" @click="loadReports">{{ copy.retry }}</button>
      </div>
      <template v-else>
        <p v-if="reports.length === 0" class="field-reports-empty">{{ copy.empty }}</p>
        <ol v-else data-testid="field-report-list" class="field-report-list">
          <li v-for="report in reports" :key="report.id" class="field-report-item">
            <div class="field-report-item-heading">
              <strong>{{ outcomeLabel(report.outcome) }}</strong>
              <time :datetime="report.createdAt">{{ copy.submittedAt }}: {{ createdAtLabel(report.createdAt) }} {{ copy.japanTime }}</time>
            </div>
            <p v-if="report.comment" class="field-report-comment">{{ report.comment }}</p>
          </li>
        </ol>
        <p class="field-report-count">{{ reportCountLabel }}</p>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  createFieldReport,
  fetchFieldReports,
  FieldReportsError,
  getFieldReportsClientId,
  isFieldReportsEnabled,
  type FieldReport,
  type FieldReportErrorCode,
  type FieldReportOutcome,
} from '../services/field-reports';
import { trackProductEvent } from '../services/analytics';

const props = withDefaults(defineProps<{
  trackId: string;
  selectedDate: string;
  locale?: 'ja' | 'en';
}>(), { locale: undefined });

const emit = defineEmits<{
  (event: 'select-today', date: string): void;
}>();

const { locale: i18nLocale } = useI18n();
const activeLocale = computed<'ja' | 'en'>(() => props.locale ?? (i18nLocale.value === 'en' ? 'en' : 'ja'));
const isEnglish = computed(() => activeLocale.value === 'en');
const apiEnabled = isFieldReportsEnabled();
const headingId = `field-reports-heading-${Math.random().toString(36).slice(2, 10)}`;
const reportForm = ref<HTMLElement | null>(null);
const reports = ref<FieldReport[]>([]);
const reportCount = ref(0);
const reportsLoading = ref(false);
const reportsErrorCode = ref<FieldReportErrorCode | null>(null);
const selectedOutcome = ref<FieldReportOutcome | ''>('');
const comment = ref('');
const submitting = ref(false);
const submitFeedback = ref<{ kind: 'success' | 'error'; code?: FieldReportErrorCode } | null>(null);
const currentToday = ref(todayInJapan());
const outcomeOptions = computed(() => isEnglish.value
  ? [
      { value: 'available' as const, label: 'I could use it' },
      { value: 'partial' as const, label: 'I could use part of it' },
      { value: 'unavailable' as const, label: 'I could not use it' },
    ]
  : [
      { value: 'available' as const, label: '利用できた' },
      { value: 'partial' as const, label: '一部利用できた' },
      { value: 'unavailable' as const, label: '利用できなかった' },
    ]);
const isToday = computed(() => props.selectedDate === currentToday.value);
const copy = computed(() => isEnglish.value ? {
  heading: 'Field reports',
  intro: 'These are unverified field reports from visitors. They may differ from the official schedule and do not guarantee current availability.',
  targetDate: 'Target date:',
  japanTime: '(Japan time)',
  submittedAt: 'Submission time',
  privacyNote: 'No login is required. Comments are public. Do not include personal information.',
  privacyLink: 'Privacy',
  unavailable: 'Field reports are currently unavailable.',
  loading: 'Loading field reports…',
  retry: 'Retry',
  empty: 'No field reports have been submitted for this date.',
  recentReports: 'Recent field reports',
  browseOnly: 'Past and future dates are for browsing only. Switch to today in Japan time to submit a report.',
  switchToToday: 'Switch to today',
  outcomeQuestion: 'Were you able to use this track today?',
  commentLabel: 'Comment (optional)',
  commentPlaceholder: 'Share a short observation',
  commentHelp: 'Please do not include URLs or contact information.',
  submit: 'Submit field report',
  submitting: 'Submitting…',
  success: 'Thanks for helping improve the information. This is shown as an unverified field observation.',
} : {
  heading: '現地レポート',
  intro: '利用者からの未確認の現地報告です。公式予定とは異なり、現在の利用可否を保証しません。',
  targetDate: '対象日：',
  japanTime: '（日本時間）',
  submittedAt: '投稿時刻',
  privacyNote: 'ログイン不要です。コメントは公開されます。個人情報は記入しないでください。',
  privacyLink: 'プライバシー',
  unavailable: '現地レポートは現在利用できません。',
  loading: '現地レポートを読み込んでいます…',
  retry: '再試行',
  empty: 'この日の現地レポートはまだありません。',
  recentReports: '最近の現地レポート',
  browseOnly: '過去・将来の日付は閲覧のみです。投稿するには今日（日本時間）へ切り替えてください。',
  switchToToday: '今日に切り替える',
  outcomeQuestion: '今日この競技場を利用しましたか？',
  commentLabel: 'コメント（任意）',
  commentPlaceholder: '短い現地情報を入力してください',
  commentHelp: 'URLや連絡先は書かないでください。',
  submit: '現地レポートを送信',
  submitting: '送信中…',
  success: '情報の改善にご協力ありがとうございます。未確認の現地情報として掲載されます。',
});
const targetDateLabel = computed(() => formatDateOnly(props.selectedDate));
const privacyPath = computed(() => isEnglish.value ? '/en/privacy' : '/privacy');
const reportCountLabel = computed(() => {
  if (reportCount.value <= reports.value.length) return isEnglish.value ? `${reportCount.value} report${reportCount.value === 1 ? '' : 's'}` : `全${reportCount.value}件`;
  return isEnglish.value
    ? `Showing the latest ${reports.value.length} of ${reportCount.value} reports`
    : `全${reportCount.value}件（最新${reports.value.length}件を表示）`;
});

let viewVersion = 0;
let reportsController: AbortController | undefined;
let submitController: AbortController | undefined;
let todayTimer: number | undefined;
let formObserver: IntersectionObserver | undefined;
let hasStarted = false;
let hasViewed = false;

function eventParameters() {
  return {
    locale: activeLocale.value,
    track_id: props.trackId,
    selected_date: props.selectedDate,
  };
}

function startInteraction() {
  if (hasStarted || !apiEnabled) return;
  hasStarted = true;
  trackProductEvent('field_report_start', eventParameters());
}

function observeForm(element: HTMLElement | null) {
  formObserver?.disconnect();
  formObserver = undefined;
  if (!element || typeof IntersectionObserver === 'undefined') return;
  formObserver = new IntersectionObserver(entries => {
    if (hasViewed || !entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0)) return;
    hasViewed = true;
    trackProductEvent('field_report_ui_view', eventParameters());
    formObserver?.disconnect();
  }, { threshold: 0.01 });
  formObserver.observe(element);
}

function todayInJapan() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function updateToday() {
  currentToday.value = todayInJapan();
}

function formatDateOnly(date: string) {
  const parsed = new Date(`${date}T12:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(parsed);
}

function createdAtLabel(createdAt: string) {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return createdAt;
  return new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function outcomeLabel(outcome: FieldReportOutcome) {
  return outcomeOptions.value.find(option => option.value === outcome)?.label ?? outcome;
}

function errorCode(error: unknown): FieldReportErrorCode {
  return error instanceof FieldReportsError ? error.code : 'unavailable';
}

function errorMessage(code: FieldReportErrorCode) {
  const messages: Record<FieldReportErrorCode, [string, string]> = {
    invalid_input: ['入力内容を確認してください。', 'Please check your entries.'],
    spam: ['URL、メールアドレス、HTML、同じ内容の繰り返しは送信できません。', 'Links, email addresses, HTML, and repeated content are not accepted.'],
    date_changed: ['日付が変わりました。今日（日本時間）に切り替えてから送信してください。', 'The date changed. Switch to today in Japan time before submitting.'],
    rate_limited: ['送信回数の上限に達しました。30分以上あけて再度お試しください。当日の上限に達した場合は翌日までお待ちください。', 'You have reached the submission limit. Please wait at least 30 minutes before trying again. If you reached today\'s limit, please wait until tomorrow.'],
    unavailable: ['現地レポートを現在利用できません。', 'Field reports are currently unavailable.'],
  };
  return messages[code][isEnglish.value ? 1 : 0];
}

async function loadReports() {
  if (!apiEnabled) return;
  const requestVersion = viewVersion;
  reportsController?.abort();
  const controller = new AbortController();
  reportsController = controller;
  reportsLoading.value = true;
  reportsErrorCode.value = null;
  try {
    const response = await fetchFieldReports(props.trackId, props.selectedDate, controller.signal);
    if (requestVersion !== viewVersion || reportsController !== controller) return;
    reports.value = response.reports.slice(0, 20);
    reportCount.value = response.count;
  } catch (error) {
    if (requestVersion !== viewVersion || reportsController !== controller || isAbortError(error)) return;
    reportsErrorCode.value = errorCode(error);
    reports.value = [];
    reportCount.value = 0;
  } finally {
    if (requestVersion === viewVersion && reportsController === controller) {
      reportsController = undefined;
      reportsLoading.value = false;
    }
  }
}

function isAbortError(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function selectToday() {
  updateToday();
  emit('select-today', currentToday.value);
}

async function submitReport() {
  if (submitting.value || !selectedOutcome.value) return;
  updateToday();
  submitFeedback.value = null;
  if (!isToday.value) {
    submitFeedback.value = { kind: 'error', code: 'date_changed' };
    emit('select-today', currentToday.value);
    return;
  }
  if (comment.value.length > 200) {
    submitFeedback.value = { kind: 'error', code: 'invalid_input' };
    return;
  }

  const requestVersion = viewVersion;
  submitController?.abort();
  const controller = new AbortController();
  submitController = controller;
  submitting.value = true;
  try {
    await createFieldReport({
      trackId: props.trackId,
      date: props.selectedDate,
      outcome: selectedOutcome.value,
      comment: comment.value,
      clientId: getFieldReportsClientId(),
      website: '',
    }, controller.signal);
    if (requestVersion !== viewVersion || submitController !== controller) return;
    trackProductEvent('field_report_complete', eventParameters());
    selectedOutcome.value = '';
    comment.value = '';
    submitFeedback.value = { kind: 'success' };
    void loadReports();
  } catch (error) {
    if (requestVersion !== viewVersion || isAbortError(error)) return;
    submitFeedback.value = { kind: 'error', code: errorCode(error) };
  } finally {
    if (requestVersion === viewVersion && submitController === controller) {
      submitController = undefined;
      submitting.value = false;
    }
  }
}

watch([() => props.trackId, () => props.selectedDate], () => {
  viewVersion += 1;
  reportsController?.abort();
  submitController?.abort();
  reportsController = undefined;
  submitController = undefined;
  submitting.value = false;
  reports.value = [];
  reportCount.value = 0;
  reportsErrorCode.value = null;
  reportsLoading.value = false;
  selectedOutcome.value = '';
  comment.value = '';
  submitFeedback.value = null;
  hasStarted = false;
  hasViewed = false;
  void nextTick(() => observeForm(reportForm.value));
  void loadReports();
}, { immediate: true });

watch(reportForm, element => observeForm(element), { flush: 'post' });

onMounted(() => {
  updateToday();
  window.addEventListener('focus', updateToday);
  document.addEventListener('visibilitychange', updateToday);
  todayTimer = window.setInterval(updateToday, 60_000);
});

onBeforeUnmount(() => {
  viewVersion += 1;
  reportsController?.abort();
  submitController?.abort();
  formObserver?.disconnect();
  if (todayTimer !== undefined) window.clearInterval(todayTimer);
  window.removeEventListener('focus', updateToday);
  document.removeEventListener('visibilitychange', updateToday);
});
</script>

<style scoped>
.field-reports { padding: 20px; margin-bottom: 16px; border: 1px solid #d9dce8; border-radius: 12px; background: white; }
.field-reports h2 { margin: 0 0 8px; color: #283593; font-size: 22px; }
.field-reports-intro { margin: 0 0 14px; color: #4e5668; line-height: 1.6; }
.field-reports-privacy-note { margin: -5px 0 14px; color: #646a78; font-size: 12px; line-height: 1.5; }
.field-reports-date { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; padding: 10px 12px; margin-bottom: 14px; border-radius: 7px; background: #f2f4f9; }
.field-reports-date time { font-weight: 700; }
.field-reports-timezone { color: #5f6572; font-size: 13px; }
.field-reports-state,.field-reports-empty { padding: 12px; margin: 0 0 14px; border-radius: 6px; background: #f4f5f8; color: #4e5668; }
.field-reports-error,.field-reports-feedback { padding: 12px; margin: 0 0 14px; border-radius: 6px; }
.field-reports-error { color: #8e1717; background: #ffebee; }
.field-reports-error p,.field-reports-feedback { margin: 0 0 8px; }
.field-reports-feedback--success { color: #00695c; background: #e0f2f1; }
.field-reports-feedback--error { color: #8e1717; background: #ffebee; }
.field-report-list { display: grid; gap: 0; padding: 0; margin: 0; list-style: none; }
.field-report-item { padding: 12px 0; border-bottom: 1px solid #e2e5ee; }
.field-report-item:first-child { padding-top: 0; }
.field-report-item-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.field-report-item-heading strong { color: #283593; }
.field-report-item-heading time { color: #646a78; font-size: 12px; white-space: nowrap; }
.field-report-comment { margin: 7px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.field-report-count { margin: 10px 0 14px; color: #646a78; font-size: 12px; }
.field-report-list-heading { margin: 20px 0 10px; color: #283593; font-size: 18px; }
.field-reports-browse-only { padding: 12px; margin-top: 14px; border: 1px solid #d9dce8; border-radius: 7px; background: #fafbfe; }
.field-reports-browse-only p { margin: 0 0 10px; color: #4e5668; line-height: 1.5; }
.field-report-form { padding-top: 4px; }
.field-report-form fieldset { display: grid; gap: 8px; padding: 0; margin: 0 0 14px; border: 0; }
.field-report-form legend { margin-bottom: 4px; font-weight: 700; }
.field-report-option { display: flex; min-height: 44px; align-items: center; gap: 9px; padding: 7px 10px; border: 1px solid #c8ccda; border-radius: 6px; cursor: pointer; }
.field-report-option:has(input:checked) { border-color: #3f51b5; background: #eef0ff; }
.field-report-option input { width: 18px; height: 18px; accent-color: #3f51b5; }
.field-report-comment-label { display: grid; gap: 5px; font-weight: 700; }
.field-report-comment-label textarea { width: 100%; box-sizing: border-box; padding: 9px; border: 1px solid #9da3b4; border-radius: 5px; color: #222; font: inherit; line-height: 1.5; resize: vertical; }
.field-report-comment-label textarea:focus-visible,.field-report-option:has(input:focus-visible) { border-color: #3f51b5; outline: 3px solid rgba(63,81,181,.22); outline-offset: 1px; }
.field-report-comment-help { display: flex; justify-content: space-between; gap: 8px; margin: 5px 0 14px; color: #646a78; font-size: 12px; }
.field-reports-button { min-height: 44px; padding: 9px 16px; border: 1px solid #283593; border-radius: 6px; color: white; background: #283593; font: inherit; font-weight: 700; cursor: pointer; }
.field-reports-button:hover:not(:disabled) { background: #1a237e; }
.field-reports-button:disabled { cursor: not-allowed; opacity: .58; }
.field-reports-button--secondary { color: #283593; background: white; }
.field-reports-button--secondary:hover { background: #eef0ff; }
.field-reports-link-button { padding: 0; border: 0; color: inherit; background: transparent; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
@media (max-width: 600px) {
  .field-reports { padding: 16px; }
  .field-report-item-heading { align-items: flex-start; flex-direction: column; gap: 3px; }
}
</style>
