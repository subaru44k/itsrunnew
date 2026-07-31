import { parseScheduleMonth, schedulePaths, weekDates } from '@itsrun/core'
import type { IsoDate, ScheduleMonth, StadiumSlug } from '@itsrun/core'

export type WeekSchedule = { dates: IsoDate[]; months: ScheduleMonth[] }

export class ScheduleRepositoryError extends Error {
  override readonly cause?: unknown
  constructor(message: string, cause?: unknown) { super(message); this.cause = cause }
}

export class HttpScheduleRepository {
  constructor(private readonly basePath = '/data/v1', private readonly request: typeof fetch = fetch) {}

  async getMonth(stadium: StadiumSlug, yearMonth: string, signal?: AbortSignal): Promise<ScheduleMonth | null> {
    const path = `${this.basePath}/stadiums/${encodeURIComponent(stadium)}/availability/${yearMonth}.json`
    let response: Response
    // Keep the injected/native fetch function receiver-free. Browsers require
    // `window.fetch` to be called with Window as its internal receiver, while
    // the repository deliberately stores it as a callable dependency.
    const request = this.request
    try { response = await request(path, { signal }) } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ScheduleRepositoryError('Unable to load schedule', error)
    }
    if (response.status === 404) return null
    if (!response.ok) throw new ScheduleRepositoryError(`Schedule request failed (${response.status})`)
    try { return parseScheduleMonth(await response.json(), { stadium, yearMonth }) } catch (error) { throw new ScheduleRepositoryError('Schedule data is invalid', error) }
  }

  async getWeek(stadium: StadiumSlug, start: IsoDate, signal?: AbortSignal): Promise<WeekSchedule> {
    const dates = weekDates(start)
    const months = await Promise.all(schedulePaths(stadium, dates).map((path) => {
      const yearMonth = /([0-9]{4}-[0-9]{2})\.json$/.exec(path)?.[1]
      if (!yearMonth) throw new ScheduleRepositoryError('Invalid schedule path')
      return this.getMonth(stadium, yearMonth, signal)
    }))
    return { dates, months: months.filter((month): month is ScheduleMonth => month !== null) }
  }
}
