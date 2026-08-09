import { STATUS_LABELS, STADIUMS, type StadiumSlug } from '@itsrun/core'

export const EDITOR_DISPLAY_STATES = ['idle', 'loading', 'missing', 'ready', 'saving', 'saved', 'loadFailure', 'saveFailure', 'forbidden', 'conflict', 'comparisonFailure'] as const
export type EditorDisplayState = typeof EDITOR_DISPLAY_STATES[number]
export function editorMessageKey(state: EditorDisplayState): 'loadError' | 'saveError' | 'comparisonError' | 'forbidden' | null {
  if (state === 'loadFailure') return 'loadError'
  if (state === 'saveFailure') return 'saveError'
  if (state === 'comparisonFailure') return 'comparisonError'
  if (state === 'forbidden') return 'forbidden'
  return null
}
export function statusLabels(locale: 'ja' | 'en'): readonly [string, string, string] { return [STATUS_LABELS[0][locale], STATUS_LABELS[1][locale], STATUS_LABELS[2][locale]] }
export function slotTimeRanges(stadium: StadiumSlug): readonly [string, string, string] { return STADIUMS[stadium].timeRanges }
