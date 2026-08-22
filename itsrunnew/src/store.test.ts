import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from './store';

describe('static schedule store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00+09:00'));
  });

  it('shows seven local dates and no-data statuses without a backend', () => {
    const store = useAppStore();
    expect(store.dateList).toHaveLength(7);
    expect(store.dateList[0]).toBe('08/21(金)');
    expect(store.statusArray).toEqual(Array.from({ length: 7 }, () => [0, 0, 0]));
  });

  it('moves the schedule one week in either direction', () => {
    const store = useAppStore();
    store.nextWeek();
    expect(store.dateList[0]).toBe('08/28(金)');
    store.previousWeek();
    expect(store.dateList[0]).toBe('08/21(金)');
  });
});
