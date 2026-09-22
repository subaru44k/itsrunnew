import type { AvailabilityDataset } from '../../src/model/availability';

const hardReasons = new Set(['fetch_failed', 'parse_failed', 'extraction_failed', 'invalid_content_type', 'source_changed', 'source_stale']);
export interface Finding {
  causes: string[];
  affectedDates: string[];
  severity: 'warning' | 'error';
  since: string;
}
export interface FacilityHealth {
  name: string;
  sourceUrls: string[];
  lastHealthyAt: string | null;
  knownDates: string[];
  statuses: Record<string, string>;
  reasons: Record<string, number>;
  sourceHashes: string[];
  pendingSince: string | null;
  active: Finding | null;
}
export interface HealthState {
  schemaVersion: 1;
  generatedAt: string;
  facilities: Record<string, FacilityHealth>;
  pipeline: Finding | null;
}
export interface HealthEvent {
  kind: 'opened' | 'changed' | 'recovered' | 'removed';
  trackId: string;
  name: string;
  finding: Finding | null;
  lastHealthyAt: string | null;
  sourceUrls: string[];
}
export const tokyoDay = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value));
const sorted = (values: string[]) => [...new Set(values)].sort();
const signature = (finding: Finding | null) => finding ? `${finding.severity}:${finding.causes.join(',')}` : '';

// State is private monitoring evidence, never an availability input to the site.
export function validateHealthState(value: unknown): asserts value is HealthState {
  const state = value as HealthState;
  if (!state || state.schemaVersion !== 1 || !Number.isFinite(Date.parse(state.generatedAt)) || !state.facilities || typeof state.facilities !== 'object' || Array.isArray(state.facilities)) throw new Error('Invalid monitor state');
  const checkFinding = (finding: Finding | null) => {
    if (finding === null) return;
    if (!finding || !Array.isArray(finding.causes) || !finding.causes.every(x => typeof x === 'string') || !Array.isArray(finding.affectedDates) || !finding.affectedDates.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) || !['warning', 'error'].includes(finding.severity) || !Number.isFinite(Date.parse(finding.since))) throw new Error('Invalid monitor finding');
  };
  checkFinding(state.pipeline);
  for (const facility of Object.values(state.facilities)) {
    if (typeof facility.name !== 'string' || !Array.isArray(facility.sourceUrls) || !facility.sourceUrls.every(x => typeof x === 'string') || !Array.isArray(facility.knownDates) || !facility.knownDates.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) || !facility.statuses || !Object.values(facility.statuses).every(x => ['available', 'partially_available', 'unavailable', 'unknown'].includes(x)) || !facility.reasons || !Object.values(facility.reasons).every(x => Number.isInteger(x) && x >= 0) || !Array.isArray(facility.sourceHashes) || !facility.sourceHashes.every(x => typeof x === 'string') || (facility.pendingSince !== null && !Number.isFinite(Date.parse(facility.pendingSince))) || (facility.lastHealthyAt !== null && !Number.isFinite(Date.parse(facility.lastHealthyAt)))) throw new Error('Invalid facility monitor state');
    checkFinding(facility.active);
  }
}

export function evaluateHealth(datasets: AvailabilityDataset[], tracks: Array<{ id: string; name: { ja: string } }>, previous: HealthState | null = null) {
  if (!datasets.length) throw new Error('Monitor requires a fresh nonempty range');
  const now = datasets[0].generatedAt;
  if (!Number.isFinite(Date.parse(now))) throw new Error('Invalid collection timestamp');
  if (previous) {
    validateHealthState(previous);
    if (Date.parse(previous.generatedAt) >= Date.parse(now)) throw new Error('Monitor state must precede collection');
  }
  const state: HealthState = { schemaVersion: 1, generatedAt: now, facilities: {}, pipeline: previous?.pipeline ?? null };
  const events: HealthEvent[] = [];
  const dates = datasets.map(dataset => dataset.date);
  for (const track of tracks) {
    const records = datasets.map(dataset => {
      const matches = dataset.facilities.filter(record => record.trackId === track.id);
      if (matches.length !== 1 || matches[0].date !== dataset.date) throw new Error(`Incomplete monitor input: ${track.id}/${dataset.date}`);
      return matches[0];
    });
    const old = previous?.facilities[track.id];
    const known = records.filter(record => record.status !== 'unknown').map(record => record.date);
    // Retain previously known dates while they are still in the range. A failed run
    // must not become the next day's healthy baseline.
    const baseline = (old?.knownDates ?? []).filter(date => dates.includes(date));
    const lost = baseline.filter(date => !known.includes(date));
    const loss = lost.length > 0 && (lost.length === baseline.length || (lost.length >= 3 && lost.length / baseline.length >= 0.5));
    const pendingSince = loss ? old?.pendingSince ?? now : null;
    const confirmedLoss = loss && pendingSince !== null && tokyoDay(pendingSince) !== tokyoDay(now);
    const failures = records.filter(record => record.status === 'unknown' && hardReasons.has(record.unknownReason ?? ''));
    const causes = sorted(failures.map(record => record.unknownReason!));
    if (confirmedLoss) causes.push('coverage_drop');
    let active: Finding | null = causes.length ? {
      causes: sorted(causes),
      affectedDates: sorted([...failures.map(record => record.date), ...(confirmedLoss ? lost : [])]),
      severity: failures.length ? 'error' : 'warning',
      since: old?.active?.since ?? now,
    } : null;
    // A missing error message alone is not recovery: confirm the affected dates
    // have known results, or, after those dates expire, new positive evidence.
    const oldAffected = old?.active?.affectedDates.filter(date => dates.includes(date)) ?? [];
    const provenRecovery = oldAffected.length ? oldAffected.every(date => known.includes(date)) : known.length > 0;
    if (!active && old?.active && (!provenRecovery || loss)) active = old.active;
    const healthy = !active && !loss && known.length > 0;
    const reasons: Record<string, number> = {};
    for (const record of records) if (record.status === 'unknown') {
      const reason = record.unknownReason ?? 'unspecified';
      reasons[reason] = (reasons[reason] ?? 0) + 1;
    }
    const facility: FacilityHealth = {
      name: track.name.ja,
      sourceUrls: sorted(records.flatMap(record => [record.source.landingPageUrl, record.source.url].filter((url): url is string => Boolean(url)))),
      sourceHashes: sorted(records.map(record => record.evidence.sourceHash).filter((hash): hash is string => Boolean(hash))),
      lastHealthyAt: healthy ? now : old?.lastHealthyAt ?? null,
      knownDates: sorted([...baseline, ...known]),
      statuses: Object.fromEntries(records.map(record => [record.date, record.status])),
      reasons, pendingSince, active,
    };
    state.facilities[track.id] = facility;
    if (signature(old?.active ?? null) !== signature(active)) events.push({
      kind: !active ? 'recovered' : old?.active ? 'changed' : 'opened',
      trackId: track.id, name: facility.name, finding: active,
      lastHealthyAt: old?.lastHealthyAt ?? null, sourceUrls: facility.sourceUrls,
    });
  }
  for (const [id, old] of Object.entries(previous?.facilities ?? {})) if (!state.facilities[id] && old.active) events.push({
    kind: 'removed', trackId: id, name: old.name, finding: old.active, lastHealthyAt: old.lastHealthyAt, sourceUrls: old.sourceUrls,
  });
  return { state, events };
}

export function evaluatePipeline(state: HealthState, lastSuccessAt: string | null, enabled: boolean): HealthEvent[] {
  if (!enabled) return []; // Disabling deployment is not proof that an incident recovered.
  const age = lastSuccessAt ? Date.parse(state.generatedAt) - Date.parse(lastSuccessAt) : Infinity;
  if (Number.isNaN(age) || age < 0) throw new Error('Invalid deployment completion timestamp');
  const active: Finding | null = age > 30 * 3600000 ? {
    causes: ['production_update_overdue'], severity: 'error', affectedDates: [], since: state.pipeline?.since ?? state.generatedAt,
  } : null;
  const events: HealthEvent[] = signature(state.pipeline) === signature(active) ? [] : [{
    kind: active ? 'opened' : 'recovered', trackId: '_production', name: 'Production 日次更新', finding: active, lastHealthyAt: lastSuccessAt, sourceUrls: [],
  }];
  state.pipeline = active;
  return events;
}

export function renderHealthReport(state: HealthState, events: HealthEvent[], runUrl = '') {
  const clean = (value: string) => value.replace(/[\r\n|]/g, ' ').replace(/@/g, '＠');
  const lines = ['# Availability 収集監視', '', `取得時刻: ${state.generatedAt}`, `実行ログ: ${runUrl || 'local'}`, '',
    '判定不能は利用不可ではありません。この監視は公開データを書き換えません。', '', '## 今回の通知', ''];
  if (!events.length) lines.push('状態の変化なし（初回の正常施設は比較基準を記録）。');
  const labels = { opened: '異常発生', changed: '異常内容の変化', recovered: '復旧', removed: '監視対象から削除（復旧未確認）' };
  for (const event of events) lines.push(`- ${clean(event.name)}: ${labels[event.kind]}`, `  - 原因: ${event.finding?.causes.join(', ') ?? '対象日の判定が回復'}`, `  - 影響日: ${event.finding?.affectedDates.join(', ') || '—'}`, `  - 最終正常確認: ${event.lastHealthyAt ?? '未確認'}`, ...event.sourceUrls.map(url => `  - 公式資料: ${clean(url)}`));
  lines.push('', '## 施設別の状態', '', '| 施設 | 判定できた日数 | 監視状態 | unknown理由（日数） | 最終正常確認 |', '|---|---:|---|---|---|');
  for (const facility of Object.values(state.facilities)) lines.push(`| ${clean(facility.name)} | ${Object.values(facility.statuses).filter(status => status !== 'unknown').length}/${Object.keys(facility.statuses).length} | ${facility.active?.causes.join(', ') || (facility.pendingSince ? '判定日数減少・次の日次収集で再確認' : '異常検知なし')} | ${Object.entries(facility.reasons).map(([reason, count]) => `${reason}: ${count}`).join(', ')} | ${facility.lastHealthyAt ?? '未確認'} |`);
  if (state.pipeline) lines.push('', `Production更新の異常: ${state.pipeline.causes.join(', ')}`);
  return `${lines.join('\n')}\n`;
}
