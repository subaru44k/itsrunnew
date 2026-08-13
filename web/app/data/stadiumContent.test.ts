import { describe, expect, it } from 'vitest'
import ja from '../../i18n/locales/ja.json'
import en from '../../i18n/locales/en.json'

const expected = {
  ja: {
    titles: ['織田フィールド 開放日', '夢の島陸上競技場 開放日', '駒沢オリンピック公園陸上競技場 開放日', '等々力陸上競技場 開放日'],
    introductions: ['織田フィールドの個人利用可能時間は以下の通りです。', '夢の島陸上競技場の個人利用可能時間は以下の通りです。', '駒沢オリンピック公園陸上競技場の個人利用可能時間は以下の通りです。', '等々力陸上競技場の個人利用可能時間は以下の通りです。'],
    officials: ['代々木公園陸上競技場(織田フィールド)', '夢の島陸上競技場', '駒沢オリンピック公園陸上競技場', '川崎市等々力陸上競技場'],
    access: [['千代田線代々木公園駅徒歩6分', '山手線原宿駅徒歩15分'], ['りんかい線新木場駅徒歩7分'], ['東京メトロ半蔵門線　駒沢大学駅徒歩15分'], ['南武線武蔵中原駅徒歩15分']],
    opinionCounts: [4, 3, 0, 2]
  },
  en: {
    titles: ["Yoyogi Park Athletic Track's Availability", "Yumenoshima Athletics Stadium's Availability", "Komazawa Olympic Park Athletic Stadium's Availability", "Todoroki Stadium's Availability"],
    introductions: ["The following is the Yoyogi Park Athletic Track's open schedule.", "The following is the Yumenoshima Athletics Stadium's open schedule.", "The following is the Komazawa Olympic Park Athletic Stadium's open schedule.", "The following is the Todoroki Stadium's open schedule."],
    officials: ['Yoyogi Park Atheletic Stadium (Oda Field)', 'Yumenoshima Athletics Stadium', 'Komazawa Olympic Stadium Athletic Stadium', 'Kawasaki Todoroki Stadium'],
    opinionCounts: [3, 3, 0, 2]
  }
} as const

describe('legacy stadium content contracts', () => {
  it('deep-equals all Japanese headings and structured content', () => {
    expect(Object.values(ja.stadiumOpenTitles)).toEqual(expected.ja.titles)
    expect(Object.values(ja.stadiumAvailability)).toEqual(expected.ja.introductions)
    expect(Object.values(ja.stadiumContent).map((v) => v.official)).toEqual(expected.ja.officials)
    expect(Object.values(ja.stadiumContent).map((v) => v.access)).toEqual(expected.ja.access)
    expect(Object.values(ja.stadiumContent).map((v) => v.paragraphs.length)).toEqual(expected.ja.opinionCounts)
  })

  it('deep-equals all English headings/content shape and preserves absent Komazawa opinions', () => {
    expect(Object.values(en.stadiumOpenTitles)).toEqual(expected.en.titles)
    expect(Object.values(en.stadiumAvailability)).toEqual(expected.en.introductions)
    expect(Object.values(en.stadiumContent).map((v) => v.official)).toEqual(expected.en.officials)
    expect(Object.values(en.stadiumContent).map((v) => v.paragraphs.length)).toEqual(expected.en.opinionCounts)
    expect(ja.stadiumContent.komazawa.paragraphs).toEqual([])
    expect(en.stadiumContent.komazawa.paragraphs).toEqual([])
  })
})
