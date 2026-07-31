export type StadiumSlug = 'oda' | 'yumenoshima' | 'komazawa' | 'todoroki'
export type AvailabilityStatus = 0 | 1 | 2
export type IsoDate = `${number}-${number}-${number}`
export type YearMonth = `${number}-${number}`

export interface ScheduleMonth {
  schemaVersion: 1
  stadium: StadiumSlug
  yearMonth: YearMonth
  updatedAt: string
  days: Record<IsoDate, [AvailabilityStatus, AvailabilityStatus, AvailabilityStatus]>
}

export type SchedulePath = `data/v1/stadiums/${StadiumSlug}/availability/${YearMonth}.json`
