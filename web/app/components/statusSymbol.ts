import type { AvailabilityStatus } from '@itsrun/core'

export function statusSymbol(status: AvailabilityStatus | null): string {
  if (status === 1) return '○'
  if (status === 2) return '×'
  return '?'
}
