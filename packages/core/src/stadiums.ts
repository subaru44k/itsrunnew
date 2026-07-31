import type { StadiumSlug } from './types'

export interface StadiumConfig {
  slug: StadiumSlug
  legacyId: string
  nameKey: string
  timeRanges: readonly [string, string, string]
  route: `/${string}`
}

export const STADIUMS: Readonly<Record<StadiumSlug, StadiumConfig>> = {
  oda: { slug: 'oda', legacyId: 'nVfuSmsj9cULg3712chv', nameKey: 'stadium.oda', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/' },
  yumenoshima: { slug: 'yumenoshima', legacyId: 'VFurPbbeejEbtu1JNTzF', nameKey: 'stadium.yumenoshima', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/yumenoshima' },
  komazawa: { slug: 'komazawa', legacyId: 'WrrQXe67xvIkGfMtJ51E', nameKey: 'stadium.komazawa', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/komazawa' },
  todoroki: { slug: 'todoroki', legacyId: '67c7uxgRWDkxr1S4gPaR', nameKey: 'stadium.todoroki', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/todoroki' },
}

export function stadiumForSlug(slug: string): StadiumConfig | undefined {
  return Object.values(STADIUMS).find((stadium) => stadium.slug === slug)
}
