import { describe, expect, it } from 'vitest';
import LapTimeCalculator from './LapTimeCalculator';
import TimeContainer from './TimeContainer';
import {
  DEFAULT_PACE_SETTINGS,
  MARATHON_METRES,
  formatDuration,
  formatPace,
  goalSeconds,
  isPaceSettings,
  marathonSplits,
  parsePaceQuery,
  paceSeconds,
  readPaceSettings,
  trainingSplits,
  type PaceSettings,
} from './marathon';

describe('marathon pace model', () => {
  it('validates each mode at its inclusive boundaries and rejects non-integers', () => {
    expect(isPaceSettings({ mode: 'goal', seconds: 3600 })).toBe(true);
    expect(isPaceSettings({ mode: 'goal', seconds: 43200 })).toBe(true);
    expect(isPaceSettings({ mode: 'pace', seconds: 120 })).toBe(true);
    expect(isPaceSettings({ mode: 'pace', seconds: 1200 })).toBe(true);

    for (const value of [
      { mode: 'goal', seconds: 3599 },
      { mode: 'goal', seconds: 43201 },
      { mode: 'pace', seconds: 119 },
      { mode: 'pace', seconds: 1201 },
      { mode: 'goal', seconds: 3600.5 },
      { mode: 'goal', seconds: Number.NaN },
      { mode: 'goal', seconds: Number.POSITIVE_INFINITY },
      { mode: 'goal', seconds: '3600' },
      { mode: 'other', seconds: 3600 },
      null,
      [],
    ]) {
      expect(isPaceSettings(value)).toBe(false);
    }
  });

  it('converts between a four-hour goal and seconds per kilometre', () => {
    const goal: PaceSettings = { mode: 'goal', seconds: 4 * 3600 };
    const pace: PaceSettings = { mode: 'pace', seconds: 300 };

    expect(DEFAULT_PACE_SETTINGS).toEqual(goal);
    expect(goalSeconds(goal)).toBe(14400);
    expect(paceSeconds(goal)).toBeCloseTo(14400 / 42.195, 12);
    expect(goalSeconds(pace)).toBe(12658.5);
    expect(paceSeconds(pace)).toBe(300);
  });

  it('formats durations by flooring and paces by nearest second', () => {
    expect(formatDuration(4 * 3600 + 5 * 60 + 12.9)).toBe('4:05:12');
    expect(formatDuration(0)).toBe('0:00:00');
    expect(formatPace(299.49)).toBe('4:59');
    expect(formatPace(300.5)).toBe('5:01');
    expect(formatPace(359.5)).toBe('6:00');
  });

  it('uses direct unrounded marathon proportions, including the exact halfway split', () => {
    const settings: PaceSettings = { mode: 'goal', seconds: 4 * 3600 };
    const splits = marathonSplits(settings);

    expect(splits.map(split => split.metres)).toEqual([
      5000, 10000, 15000, 20000, 21097.5, 25000, 30000, 35000, 40000, 42195,
    ]);
    expect(splits[0].seconds).toBe(14400 * 5000 / MARATHON_METRES);
    expect(splits[4].seconds).toBe(7200);
    expect(splits.at(-1)?.seconds).toBe(14400);
    expect(splits[1].seconds).toBe(14400 * 10000 / MARATHON_METRES);
  });

  it('calculates training splits from the same pace without accumulated rounding', () => {
    const settings: PaceSettings = { mode: 'pace', seconds: 300 };
    expect(trainingSplits(settings)).toEqual([
      { metres: 400, seconds: 120 },
      { metres: 1000, seconds: 300 },
      { metres: 5000, seconds: 1500 },
      { metres: 10000, seconds: 3000 },
    ]);
    expect(marathonSplits(settings)[4].seconds).toBe(6329.25);
  });

  it('keeps the legacy comparison pace and halfway split consistent with the personal table', () => {
    const legacy = new LapTimeCalculator(new TimeContainer(4, 0, 0)).getLapTime();
    expect(legacy[1]).toBe(new TimeContainer(0, 0, 341).getTimeString());
    expect(legacy[6]).toBe(new TimeContainer(2, 0, 0).getTimeString());
  });

  it('keeps exact integer training seconds across every supported pace', () => {
    for (let seconds = 120; seconds <= 1200; seconds++) {
      const settings: PaceSettings = { mode: 'pace', seconds };
      for (const row of trainingSplits(settings)) {
        expect(formatDuration(row.seconds)).toBe(formatDuration(seconds * row.metres / 1000));
      }
      expect(formatDuration(goalSeconds(settings))).toBe(formatDuration(seconds * 42195 / 1000));
    }
    expect(trainingSplits({ mode: 'pace', seconds: 120 })[0].seconds).toBe(48);
  });

  describe('query and persisted settings parsing', () => {
    it('accepts one canonical mode key and ignores unrelated query keys', () => {
      expect(parsePaceQuery({ goal: '3600', unrelated: 'kept' })).toEqual({ mode: 'goal', seconds: 3600 });
      expect(parsePaceQuery({ pace: '1200', foo: ['ignored'] })).toEqual({ mode: 'pace', seconds: 1200 });
      expect(parsePaceQuery(Object.assign(Object.create({ goal: '3600' }), { page: '1' }))).toBeNull();
    });

    it('rejects ambiguous, malformed, array, and out-of-range query values', () => {
      for (const query of [
        {},
        { goal: '3600', pace: '300' },
        { goal: ['3600'] },
        { goal: '03600' },
        { goal: '+3600' },
        { goal: '3600.0' },
        { goal: ' 3600' },
        { goal: '0' },
        { goal: '3599' },
        { pace: '1201' },
        { pace: 'NaN' },
        ['goal', '3600'],
      ]) {
        expect(parsePaceQuery(query as Record<string, unknown>)).toBeNull();
      }
    });

    it('validates persisted JSON and catches malformed values', () => {
      expect(readPaceSettings('{"mode":"goal","seconds":43200}')).toEqual({ mode: 'goal', seconds: 43200 });
      expect(readPaceSettings('{"mode":"pace","seconds":120}')).toEqual({ mode: 'pace', seconds: 120 });

      for (const serialized of [
        null,
        '',
        '{',
        '[]',
        '{"mode":"goal","seconds":3599}',
        '{"mode":"pace","seconds":1201}',
        '{"mode":"goal","seconds":3600.5}',
        '{"mode":"goal","seconds":"3600"}',
        '{"mode":"other","seconds":3600}',
      ]) {
        expect(readPaceSettings(serialized)).toBeNull();
      }
    });
  });
});
