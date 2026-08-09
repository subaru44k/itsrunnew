import { describe, expect, it } from 'vitest'
import { editorMessageKey, slotTimeRanges, statusLabels } from './adminUi'

describe('admin display contract', () => {
  it('maps every editor failure state to a safe localized key', () => {
    expect(editorMessageKey('loadFailure')).toBe('loadError'); expect(editorMessageKey('saveFailure')).toBe('saveError'); expect(editorMessageKey('forbidden')).toBe('forbidden'); expect(editorMessageKey('comparisonFailure')).toBe('comparisonError'); expect(editorMessageKey('ready')).toBeNull()
  })
  it('uses the core Unknown/Available/Unavailable and time-slot contracts', () => {
    expect(statusLabels('ja')).toEqual(['未公開', '利用可能', '利用不可']); expect(statusLabels('en')).toEqual(['Unknown', 'Available', 'Unavailable']); expect(slotTimeRanges('oda')).toEqual(['09:00-12:00', '13:00-16:00', '17:00-20:00'])
  })
})
