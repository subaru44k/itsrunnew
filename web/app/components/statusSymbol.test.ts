import { describe, expect, it } from 'vitest'
import { statusSymbol } from './statusSymbol'

describe('schedule status symbols', () => {
  it('maps every loaded status and not-loaded/unpublished state deterministically', () => {
    expect(statusSymbol(null)).toBe('?')
    expect(statusSymbol(0)).toBe('?')
    expect(statusSymbol(1)).toBe('○')
    expect(statusSymbol(2)).toBe('×')
  })
})
