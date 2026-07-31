import type { IsoDate, YearMonth } from './types'

const JAPAN = 'Asia/Tokyo'
const pad = (value: number) => String(value).padStart(2, '0')

export function japanToday(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: JAPAN, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}` as IsoDate
}

export function isValidIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isValidYearMonth(value: string): value is YearMonth {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function addDays(date: IsoDate, amount: number): IsoDate {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` as IsoDate
}

export function weekDates(start: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function schedulePaths(stadium: string, dates: readonly IsoDate[]): string[] {
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))]
  return months.map((month) => `data/v1/stadiums/${encodeURIComponent(stadium)}/availability/${month}.json`)
}
