import type { StadiumSlug } from './types.ts'

export interface StadiumConfig {
  slug: StadiumSlug
  legacyId: string
  nameKey: string
  timeRanges: readonly [string, string, string]
  route: `/${string}`
  mapEmbedUrl: string
  contentKey: 'oda' | 'yumenoshima' | 'komazawa' | 'todoroki'
}

export const STADIUMS: Readonly<Record<StadiumSlug, StadiumConfig>> = {
  oda: { slug: 'oda', legacyId: 'nVfuSmsj9cULg3712chv', nameKey: 'stadium.oda', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/', contentKey: 'oda', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023' },
  yumenoshima: { slug: 'yumenoshima', legacyId: 'VFurPbbeejEbtu1JNTzF', nameKey: 'stadium.yumenoshima', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/yumenoshima', contentKey: 'yumenoshima', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.198853620734!2d139.82042951502805!3d35.6474720394305' },
  komazawa: { slug: 'komazawa', legacyId: 'WrrQXe67xvIkGfMtJ51E', nameKey: 'stadium.komazawa', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/komazawa', contentKey: 'komazawa', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591' },
  todoroki: { slug: 'todoroki', legacyId: '67c7uxgRWDkxr1S4gPaR', nameKey: 'stadium.todoroki', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/todoroki', contentKey: 'todoroki', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266' },
}

export function stadiumForSlug(slug: string): StadiumConfig | undefined {
  return Object.values(STADIUMS).find((stadium) => stadium.slug === slug)
}
