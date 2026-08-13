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
  oda: { slug: 'oda', legacyId: 'nVfuSmsj9cULg3712chv', nameKey: 'stadium.oda', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/', contentKey: 'oda', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873' },
  yumenoshima: { slug: 'yumenoshima', legacyId: 'VFurPbbeejEbtu1JNTzF', nameKey: 'stadium.yumenoshima', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/yumenoshima', contentKey: 'yumenoshima', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.198853620734!2d139.82042951502805!3d35.6474720394305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188830ec82b0eb%3A0x38e551d88d939e11!2z44CSMTM2LTAwODEg5p2x5Lqs6YO95rGf5p2x5Yy65aSi44Gu5bO277yR5LiB55uu77yR4oiS77yS!5e0!3m2!1sja!2sjp!4v1527175702727' },
  komazawa: { slug: 'komazawa', legacyId: 'WrrQXe67xvIkGfMtJ51E', nameKey: 'stadium.komazawa', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/komazawa', contentKey: 'komazawa', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339' },
  todoroki: { slug: 'todoroki', legacyId: '67c7uxgRWDkxr1S4gPaR', nameKey: 'stadium.todoroki', timeRanges: ['09:00-12:00', '13:00-16:00', '17:00-20:00'], route: '/todoroki', contentKey: 'todoroki', mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004' },
}

export function stadiumForSlug(slug: string): StadiumConfig | undefined {
  return Object.values(STADIUMS).find((stadium) => stadium.slug === slug)
}
