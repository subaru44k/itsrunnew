export const MARATHON_METRES = 42195;

export type PaceSettings = {
  mode: 'goal' | 'pace';
  seconds: number;
};

export const DEFAULT_PACE_SETTINGS: PaceSettings = {
  mode: 'goal',
  seconds: 14400,
};

const GOAL_MIN_SECONDS = 3600;
const GOAL_MAX_SECONDS = 43200;
const PACE_MIN_SECONDS = 120;
const PACE_MAX_SECONDS = 1200;

export function isPaceSettings(value: unknown): value is PaceSettings {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  const candidate = value as { mode?: unknown; seconds?: unknown };
  if (candidate.mode !== 'goal' && candidate.mode !== 'pace') return false;
  if (typeof candidate.seconds !== 'number' || !Number.isFinite(candidate.seconds) || !Number.isInteger(candidate.seconds)) {
    return false;
  }

  const [minimum, maximum] = candidate.mode === 'goal'
    ? [GOAL_MIN_SECONDS, GOAL_MAX_SECONDS]
    : [PACE_MIN_SECONDS, PACE_MAX_SECONDS];
  return candidate.seconds >= minimum && candidate.seconds <= maximum;
}

export function goalSeconds(settings: PaceSettings) {
  return settings.mode === 'goal' ? settings.seconds : settings.seconds * MARATHON_METRES / 1000;
}

export function paceSeconds(settings: PaceSettings) {
  return settings.mode === 'goal' ? settings.seconds * 1000 / MARATHON_METRES : settings.seconds;
}

export function formatDuration(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function formatPace(seconds: number) {
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

const MARATHON_SPLIT_METRES = [
  5000,
  10000,
  15000,
  20000,
  21097.5,
  25000,
  30000,
  35000,
  40000,
  MARATHON_METRES,
] as const;

const TRAINING_SPLIT_METRES = [400, 1000, 5000, 10000] as const;

function splitsAt(settings: PaceSettings, metres: readonly number[]) {
  return metres.map(distance => ({
    metres: distance,
    seconds: settings.mode === 'pace'
      ? settings.seconds * distance / 1000
      : settings.seconds * distance / MARATHON_METRES,
  }));
}

export function marathonSplits(settings: PaceSettings) {
  return splitsAt(settings, MARATHON_SPLIT_METRES);
}

export function trainingSplits(settings: PaceSettings) {
  return splitsAt(settings, TRAINING_SPLIT_METRES);
}

function hasOwnKey(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseQueryValue(mode: PaceSettings['mode'], value: unknown): PaceSettings | null {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null;

  const settings: PaceSettings = { mode, seconds: Number(value) };
  return isPaceSettings(settings) ? settings : null;
}

export function parsePaceQuery(query: Record<string, unknown>): PaceSettings | null {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) return null;

  const hasGoal = hasOwnKey(query, 'goal');
  const hasPace = hasOwnKey(query, 'pace');
  if (hasGoal === hasPace) return null;

  return hasGoal
    ? parseQueryValue('goal', query.goal)
    : parseQueryValue('pace', query.pace);
}

export function readPaceSettings(serialized: string | null): PaceSettings | null {
  if (typeof serialized !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    return isPaceSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
