import { STATUS_LABELS, STADIUMS, type StadiumSlug } from '@itsrun/core'
import type { EditorError } from './adminEditor'

export const EDITOR_DISPLAY_STATES = ['idle', 'loading', 'missing', 'ready', 'saving', 'saved', 'loadFailure', 'saveFailure', 'forbidden', 'conflict', 'comparisonFailure'] as const
export type EditorDisplayState = typeof EDITOR_DISPLAY_STATES[number]
export type EditorAction = 'retryLoad' | 'retrySave' | 'retryComparison' | 'login' | null
export function editorMessageKey(state: EditorDisplayState, error?: EditorError): 'loadError' | 'saveError' | 'comparisonError' | 'forbidden' | 'authError' | null {
  if (error === 'unauthorized') return 'authError'
  if (error === 'forbidden' || state === 'forbidden') return 'forbidden'
  if (state === 'loadFailure') return 'loadError'
  if (state === 'saveFailure') return 'saveError'
  if (state === 'comparisonFailure') return 'comparisonError'
  return null
}
export function editorAction(state: EditorDisplayState, error?: EditorError): EditorAction {
  if (error === 'unauthorized') return 'login'
  if (state === 'loadFailure') return 'retryLoad'
  if (state === 'saveFailure') return 'retrySave'
  if (state === 'comparisonFailure' || state === 'conflict') return 'retryComparison'
  return null
}
export function statusLabels(locale: 'ja' | 'en'): readonly [string, string, string] { return [STATUS_LABELS[0][locale], STATUS_LABELS[1][locale], STATUS_LABELS[2][locale]] }
export function slotTimeRanges(stadium: StadiumSlug): readonly [string, string, string] { return STADIUMS[stadium].timeRanges }
export function slotCellId(date: string, slot: number): string { return `${date}-${slot}` }
