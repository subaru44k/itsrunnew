import { stadiumForSlug } from './stadiums.ts'
import { isAvailabilityStatus } from './status.ts'
import { isValidIsoDate, isValidYearMonth } from './dates.ts'
import type { ScheduleMonth, StadiumSlug } from './types.ts'

const topLevel = new Set(['schemaVersion', 'stadium', 'yearMonth', 'updatedAt', 'days'])
const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function parseScheduleMonth(value: unknown, expected?: { stadium?: StadiumSlug; yearMonth?: string }): ScheduleMonth {
  if (!isRecord(value) || Object.keys(value).some((key) => !topLevel.has(key))) throw new Error('Invalid schedule object')
  if (value.schemaVersion !== 1 || typeof value.stadium !== 'string' || !stadiumForSlug(value.stadium)) throw new Error('Invalid schedule identity')
  if (expected?.stadium && value.stadium !== expected.stadium) throw new Error('Stadium does not match path')
  if (typeof value.yearMonth !== 'string' || !isValidYearMonth(value.yearMonth) || (expected?.yearMonth && value.yearMonth !== expected.yearMonth)) throw new Error('Invalid yearMonth')
  if (typeof value.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.updatedAt) || Number.isNaN(Date.parse(value.updatedAt))) throw new Error('Invalid updatedAt')
  if (!isRecord(value.days) || Object.keys(value.days).length > 31) throw new Error('Invalid days')
  for (const [date, statuses] of Object.entries(value.days)) {
    if (!isValidIsoDate(date) || date.slice(0, 7) !== value.yearMonth || !Array.isArray(statuses) || statuses.length !== 3 || !Array.from({ length: 3 }, (_, index) => Object.prototype.hasOwnProperty.call(statuses, index)).every(Boolean) || statuses.some((status) => !isAvailabilityStatus(status))) throw new Error(`Invalid day: ${date}`)
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 32 * 1024) throw new Error('Schedule exceeds 32 KiB')
  return value as unknown as ScheduleMonth
}

export function statusForDate(schedule: ScheduleMonth, date: string, slot: number) {
  const statuses = schedule.days[date as keyof typeof schedule.days]
  return statuses?.[slot] ?? null
}
