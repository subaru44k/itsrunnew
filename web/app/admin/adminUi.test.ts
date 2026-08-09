import { describe, expect, it } from 'vitest'
import { editorAction, editorMessageKey, slotCellId, slotTimeRanges, statusLabels } from './adminUi'

describe('admin display contract', () => {
  it('maps every editor failure state to a safe localized key', () => {
    expect(editorMessageKey('loadFailure')).toBe('loadError'); expect(editorMessageKey('saveFailure')).toBe('saveError'); expect(editorMessageKey('forbidden')).toBe('forbidden'); expect(editorMessageKey('comparisonFailure')).toBe('comparisonError'); expect(editorMessageKey('ready')).toBeNull()
    const errors = ['notFound', 'conflict', 'unsupported', 'rateLimited', 'server', 'network', 'invalid'] as const
    for (const error of errors) {
      expect(editorMessageKey('loadFailure', error)).toBe('loadError')
      expect(editorAction('loadFailure', error)).toBe('retryLoad')
      expect(editorMessageKey('saveFailure', error)).toBe('saveError')
      expect(editorAction('saveFailure', error)).toBe('retrySave')
    }
    expect(editorMessageKey('loadFailure', 'unauthorized')).toBe('authError'); expect(editorAction('loadFailure', 'unauthorized')).toBe('login')
    expect(editorMessageKey('saveFailure', 'unauthorized')).toBe('authError'); expect(editorAction('saveFailure', 'unauthorized')).toBe('login')
    expect(editorMessageKey('forbidden', 'forbidden')).toBe('forbidden'); expect(editorAction('forbidden', 'forbidden')).toBeNull()
    expect(editorMessageKey('comparisonFailure', 'network')).toBe('comparisonError'); expect(editorAction('comparisonFailure', 'network')).toBe('retryComparison')
    expect(editorAction('conflict', 'conflict')).toBe('retryComparison')
  })
  it('uses the core Unknown/Available/Unavailable and time-slot contracts', () => {
    expect(statusLabels('ja')).toEqual(['未公開', '利用可能', '利用不可']); expect(statusLabels('en')).toEqual(['Unknown', 'Available', 'Unavailable']); expect(slotTimeRanges('oda')).toEqual(['09:00-12:00', '13:00-16:00', '17:00-20:00'])
    expect([0, 1, 2].map((slot) => slotCellId('2026-08-09', slot))).toEqual(['2026-08-09-0', '2026-08-09-1', '2026-08-09-2'])
  })
})
