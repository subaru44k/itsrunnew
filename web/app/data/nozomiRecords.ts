export interface NozomiRecord {
  year: number
  dateJa: string
  dateEn: string
  meetJa: string
  meetEn: string
  event: string
  result: string
}

type JapaneseTuple = [year: number, dateJa: string, meetJa: string, event: string, result: string]

// Exact transcript of every legacy <tbody><tr>, in displayed year/row order.
export const NOZOMI_JA_TUPLES: readonly JapaneseTuple[] = [
  [2021,'12/10(金)','エディオンディスタンスチャレンジ in 京都2021','5000m','15\'04"10'],[2021,'12/4(土)','日体大長距離競技会','5000m','15\'04"83'],[2021,'11/20(土)','第5回 静岡県長距離強化記録会','3000m','9\'18"29'],[2021,'11/20(土)','第5回 静岡県長距離強化記録会','3000m','8\'51"77'],
  [2021,'10/31(日)','TWOLAPS ミドルディスタンスサーキット','1000m','2\'39"59'],[2021,'10/17(日)','北九州カーニバル','800m','2\'06"78'],[2021,'10/9(土)','ナイタートライアルin屋島','1500m','4\'08"81'],[2021,'10/9(土)','ナイタートライアルin屋島','3000m','8\'50"47'],[2021,'10/9(土)','ナイタートライアルin屋島','5000m','15\'55"99'],
  [2021,'10/2(土)','日体大長距離競技会','5000m','15\'00"90'],[2021,'9/23(木)','TWOLAPS ミドルディスタンスサーキット','800m','2\'06"76'],[2021,'9/20(月)','日体大長距離競技会','800m','2\'02"36'],[2021,'8/20(金)','TWOLAPS ミドルディスタンスサーキット','1000m','2\'37"72'],
  [2021,'8/6(金)','東京オリンピック','1500m','3\'59"95'],[2021,'8/4(水)','東京オリンピック','1500m','3\'59"19 PB'],[2021,'8/2(月)','東京オリンピック','1500m','4\'02"33'],[2021,'7/30(金)','東京オリンピック','5000m','14\'59"93'],
  [2021,'7/17(土)','ホクレンディスタンスチャレンジ 千歳大会','1500m','4\'04"08'],[2021,'7/14(水)','ホクレンディスタンスチャレンジ 北見大会','5000m','15\'17"93'],[2021,'7/10(土)','ホクレンディスタンスチャレンジ 網走大会','3000m','8\'40"84 PB'],
  [2021,'6/27(日)','日本陸上競技選手権大会','800m','2\'04"47'],[2021,'6/27(日)','日本陸上競技選手権大会','5000m','15\'18"25'],[2021,'6/26(土)','日本陸上競技選手権大会','800m','2\'07"23'],[2021,'6/25(金)','日本陸上競技選手権大会','1500m','4\'08"39'],
  [2021,'6/6(日)','Denka Athletics Challenge Cup 2021','1500m','4\'09"06'],[2021,'6/1(火)','木南道孝記念陸上競技大会','1500m','4\'10"06'],[2021,'5/15(土)','中部実業団対抗陸上競技大会','3000m','8\'58"54'],[2021,'5/9(日)','READY STEADY TOKYO','1500m','4\'09"10'],[2021,'5/3(月)','静岡国際陸上競技大会','800m','2\'03"19'],[2021,'4/29(木)','織田幹雄記念国際陸上競技大会','5000m','15\'11"82'],[2021,'4/25(日)','兵庫リレーカーニバル','1500m','4\'10"14'],
  [2021,'4/18(日)','兵庫陸上競技春季記録会','800m','2\'06"60'],[2021,'4/18(日)','兵庫陸上競技春季記録会','3000m','9\'11"39'],[2021,'4/10(土)','金栗記念選抜陸上中長距離大会','1500m','4\'09"31'],[2021,'4/4(日)','ミドルディスタンス・チャレンジ','1500m','4\'13"09'],[2021,'4/3(土)','ミドルディスタンス・チャレンジ','3000m','8\'57"27'],[2021,'3/29(月)','明石市春季陸上競技大会','3000m','9\'09"57'],[2021,'3/21(日)','屋外高松UD記録会','800m','2\'09"10'],[2021,'3/21(日)','屋外高松UD記録会','1500m','4\'15"18'],[2021,'2/27(土)','日本選手権クロスカントリー競走','8km','26\'22"'],[2021,'1/17(水)','京都女子駅伝 中長距離競技会','10000m','31\'59"89'],
  [2020,'12/27(日)','川内杯栗橋関所マラソン','10km','32\'07"'],[2020,'12/12(土)','神戸市長距離記録会','3000m','9\'25"38'],[2020,'12/4(金)','日本選手権','5000m','15\'05"65'],[2020,'11/15(日)','静岡県長距離強化記録会','3000m','9\'09"65'],[2020,'11/15(日)','静岡県長距離強化記録会','3000m','9\'00"84'],[2020,'11/3(火)','Denka Athletics Challenge Cup 2020','5000m','15\'22"39'],[2020,'10/27(火)','ミドルディスタンス・チャレンジ','1500m','4\'10"41'],[2020,'10/24(土)','木南道孝記念陸上競技大会','800m','2\'06"72'],[2020,'10/11(日)','ナイタートライアルin屋島','5000m','15\'15"76'],[2020,'10/3(土)','日本陸上競技選手権大会','800m','2\'04"76'],[2020,'10/2(金)','日本陸上競技選手権大会','1500m','4\'10"21'],[2020,'9/15(火)','神戸市長距離記録会','1500m','4\'12"81'],[2020,'9/15(火)','神戸市長距離記録会','3000m','8\'56"18'],[2020,'8/23(日)','セイコーゴールデングランプリ陸上2020東京','1500m','4\'05"27'],[2020,'7/18(土)','ホクレンディスタンスチャレンジ 千歳大会','3000m','8\'51"49'],[2020,'7/15(水)','ホクレンディスタンスチャレンジ 網走大会','5000m','15\'02"62'],[2020,'7/12(日)','兵庫選手権','800m','2\'04"66'],[2020,'7/8(水)','ホクレンディスタンスチャレンジ 深川大会','3000m','8\'41"35'],[2020,'7/4(土)','ホクレンディスタンスチャレンジ 士別大会','1500m','4\'08"68'],
]

const weekdayEn: Record<string, string> = { '日': 'Sun', '月': 'Mon', '火': 'Tue', '水': 'Wed', '木': 'Thu', '金': 'Fri', '土': 'Sat' }
const englishMeet: Record<string, string> = {
  'エディオンディスタンスチャレンジ in 京都2021': 'Edion Distance Challenge in Kyoto 2021', '日体大長距離競技会': 'Nittai Long Distance Meet', '第5回 静岡県長距離強化記録会': '5th Shizuoka Long Distance Record Meet', 'TWOLAPS ミドルディスタンスサーキット': 'TWOLAPS Middle Distance Circuit', '北九州カーニバル': 'Kitakyushu Carnival', 'ナイタートライアルin屋島': 'Night Trial in Yashima', '東京オリンピック': 'Tokyo Olympics', 'ホクレンディスタンスチャレンジ 千歳大会': 'Hokuren Distance Challenge Chitose', 'ホクレンディスタンスチャレンジ 北見大会': 'Hokuren Distance Challenge Kitami', 'ホクレンディスタンスチャレンジ 網走大会': 'Hokuren Distance Challenge Abashiri', '日本陸上競技選手権大会': 'Japan National Championships', '木南道孝記念陸上競技大会': 'Kinami Michitaka Memorial', '中部実業団対抗陸上競技大会': 'Chubu Corporate Championships', '静岡国際陸上競技大会': 'Shizuoka International', '織田幹雄記念国際陸上競技大会': 'Mikio Oda Memorial', '兵庫リレーカーニバル': 'Hyogo Relay Carnival', '兵庫陸上競技春季記録会': 'Hyogo Spring Record Meet', '金栗記念選抜陸上中長距離大会': 'Kanaguri Memorial', 'ミドルディスタンス・チャレンジ': 'Middle Distance Challenge', '明石市春季陸上競技大会': 'Akashi Spring Athletics', '屋外高松UD記録会': 'Takamatsu UD Outdoor Meet', '日本選手権クロスカントリー競走': 'Japan Cross Country Championships', '京都女子駅伝 中長距離競技会': 'Kyoto Women’s Ekiden Meet', '川内杯栗橋関所マラソン': 'Kawauchi Cup Kurihashi Sekisho Marathon', '神戸市長距離記録会': 'Kobe Long Distance Record Meet', '日本選手権': 'Japan Championships', 'セイコーゴールデングランプリ陸上2020東京': 'Seiko Golden Grand Prix Tokyo', '兵庫選手権': 'Hyogo Championships', 'ホクレンディスタンスチャレンジ 深川大会': 'Hokuren Distance Challenge Fukagawa', 'ホクレンディスタンスチャレンジ 士別大会': 'Hokuren Distance Challenge Shibetsu', 'Denka Athletics Challenge Cup 2021': 'Denka Athletics Challenge Cup 2021', 'Denka Athletics Challenge Cup 2020': 'Denka Athletics Challenge Cup 2020', 'READY STEADY TOKYO': 'READY STEADY TOKYO'
}
const toEnglishDate = (date: string) => date.replace(/\((.)\)$/, (_, day: string) => `(${weekdayEn[day] ?? day})`)
export const NOZOMI_RECORDS: readonly NozomiRecord[] = NOZOMI_JA_TUPLES.map(([year, dateJa, meetJa, event, result]) => ({ year, dateJa, dateEn: toEnglishDate(dateJa), meetJa, meetEn: englishMeet[meetJa] ?? meetJa, event, result }))
export function expandedNozomiRecords(locale: string): NozomiRecord[] { return [...NOZOMI_RECORDS] }
