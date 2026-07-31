import type { AvailabilityStatus } from './types'

export const STATUS_LABELS = {
  0: { ja: '未公開', en: 'Unknown' },
  1: { ja: '利用可能', en: 'Available' },
  2: { ja: '不可', en: 'Unavailable' },
} as const satisfies Record<AvailabilityStatus, { ja: string; en: string }>

export function isAvailabilityStatus(value: unknown): value is AvailabilityStatus {
  return value === 0 || value === 1 || value === 2
}

export function statusLabel(status: AvailabilityStatus, locale: 'ja' | 'en' = 'ja'): string {
  return STATUS_LABELS[status][locale]
}
