# HTML / calendar / fixed availability collector 検証

検証日: 2026-08-24（Asia/Tokyo）

## 結論

前回「small collector extension」とした9施設を現行の公式sourceで再確認し、8施設を既存pipelineへ追加した。世田谷区立総合運動場だけは、当日朝の公式Web・公式X確認という運用は確認できる一方、安定してrequested dateを取得できるHTML sourceを確認できなかったため、誤判定せず `unsupported_source_type` / `unknown` を維持した。

安全な自動判定対象は15/33（45.5%）から23/33（69.7%）へ増えた。24/33にしないのは世田谷を対応済みに数えないためである。

## 対象と実装mapping

| track ID | 施設 | 再確認した公式source | 現行分類 | 実装 |
|---|---|---|---|---|
| `komazawa-olympic-park-track` | 駒沢オリンピック公園 | [一般開放予定](https://www.tef.or.jp/kopgp/opening.html) | `calendar_html` | TEF共通POST calendar、対象行config |
| `setagaya-general-sports-track` | 世田谷区立総合運動場 | [個人開放案内](https://www.se-sports.or.jp/news/10334/) | `structured_html` | guarded unknown。安定した日付別sourceなし |
| `oi-central-seaside-park-track` | 大井スポーツセンター | [陸上競技場案内](https://tokyo-south-seaside-parks.com/sports-athletics/) | `fixed_schedule` | 第1・第3木曜rule config |
| `toneri-park-athletic-track` | 舎人公園 | [施設案内](https://www.tokyo-park.or.jp/park/toneri/facility/index.html#park96) | `fixed_schedule` | 水曜・第1日曜・第3土曜rule config |
| `edogawa-athletic-stadium` | スピアーズえどりくフィールド | [一週間の利用状況](https://www.edogawa-3field.jp/athletics/konzatsuguid/) | `calendar_html` | 7日・3区分table parser |
| `okudo-sports-center-track` | 奥戸総合スポーツセンター | [葛飾区施設案内](https://www2.city.katsushika.lg.jp/tourism/1002753/1030217/1003242.html) | `fixed_schedule` | 月・水・金rule config |
| `koshigaya-shirakobato-track` | 越谷しらこばと | [公式トップ](https://kouen-kyougijyou.kosi-kanri.com/) | `structured_html` | 当日日付・個人利用時間parser |
| `kamiyugi-park-athletic-stadium` | 上柚木公園 | [陸上競技場案内](https://kamiyugi-park.jp/facility/athletics-stadium/) | `pdf` | 複数月matrix parser。現行PDFへの分類修正 |
| `akirudai-park-athletic-track` | 秋留台公園 | [一般公開案内](https://www.tokyo-park.or.jp/park/akirudai/news/2024/park_info_1.html) | `fixed_schedule` | 水曜・第1日曜・第3土曜rule config |

舎人・秋留台は公式Xに追加開放情報も掲載するが、stableな公式ページに固定一般開放日が明記されている。collectorは固定日だけを肯定し、X上の追加日を取りこぼした日を `unavailable` にしない。上柚木は調査時の `calendar_html` ではなく、施設ページから発見するtext-based複数月PDFが現行sourceだったため、既存PDF architectureへ追加した。

## 共有と施設固有の境界

- 共通fetch layerがHTTP検証、SHA-256、取得時刻、parser provenance、failureのunknown正規化を担当する。
- TEF calendar parserは東京体育館・駒沢でPOST形式、日付、時間header、対象行の検証を共有する。施設configは対象行名だけを持つ。
- fixed evaluatorは曜日、第N曜日、時刻、明示的な年末年始不可をconfigで受け取る。source文言anchorが変われば `source_changed` になる。
- 江戸川、越谷、上柚木は意味と構造が固有なので小さなformat-specific parserを使う。万能HTML/PDF parserは追加していない。

## semantic rule

- `available`: 「一般開放」「一般」「個人利用できます」「○」または公式固定開放枠として明示された時間だけ。
- `unavailable`: 「専用」「貸切」「整備」「休場」等が、公式表・凡例上で個人利用不可を意味する枠だけ。
- `partially_available`: available枠が明示され、同日に未確認またはunavailableの時間が残る場合。
- `unknown`: 固定rule非該当、対象日欠落、対象期間外、見出し・凡例変更、意味が未定義の空欄・ダッシュ、fetch/parse失敗。

固定ruleに一致しない日、週次表の空欄、行事なし、予約枠の空きは `unavailable` でも `available` でもない。大井・奥戸等は大会・事業・グラウンド不良による変更可能性をwarningへ残す。

## 2026-08-24 live結果

新規対象9施設は、available 3（江戸川、上柚木、奥戸）、partially_available 1（越谷）、unavailable 1（駒沢）、unknown 4（世田谷、大井、舎人、秋留台）だった。unknownのうち大井・舎人・秋留台は固定開放日非該当であり、非掲載時間を利用不可とはしていない。

33施設全体は次の通り。

- available 7: 江戸川、八王子富士森、井の頭、上柚木、武蔵野、奥戸、東京体育館
- partially_available 4: 越谷、三郷、練馬総合、和田堀第一
- unavailable 4: 光が丘、駒沢、和田堀第二、代々木（織田フィールド）
- unknown 18: 上尾、赤塚、秋留台、荒川戸田橋、朝霞、府中、東大和南、城北中央、川口青木、夢の島、新座、大井、大泉中央、さいたま駒場、世田谷、新河岸、戸田、舎人

## future-date検証

公開済み範囲の2026-08-26でcollectorを実行した。新規対象では駒沢・上柚木・奥戸・舎人・秋留台がavailable、江戸川が9～13時available・13～21時unavailableのpartially_available、越谷がtoday-onlyのためoutside_published_period、世田谷がguarded unknown、大井が固定日非該当のunknownになった。生成物は検証後に2026-08-24へ戻した。

未来日対応は固定rule・月間/複数月資料・選択日calendarを含む26施設、today-only 4施設、source不明3施設である。公開範囲外を過去結果で補完しない。

## 目視比較

| 施設 | official表示 | generated result | 一致 |
|---|---|---|---|
| 駒沢 | 8/24 午前・午後とも整備 | unavailable（2枠） | yes |
| 世田谷 | 当日朝の公式Web/X確認を案内、stableな当日結果なし | unknown / unsupported | yes（断定回避） |
| 大井 | 第1・第3木曜9～17時 | 8/24はunknown、該当日はpartial 9～17 | yes |
| 舎人 | 水曜・第1日曜・第3土曜9～21時 | 8/24 unknown、8/26 available 9～21 | yes |
| 江戸川 | 8/24全枠一般、8/26一般・専用・専用 | available / partial | yes |
| 奥戸 | 月・水・金9～21時 | 8/24・8/26 available 9～21 | yes |
| 越谷 | 8/24 個人利用9～17時 | partial 9～17 | yes |
| 上柚木 | 8/24・8/26の3枠すべて○ | available 08:45～20:45 | yes |
| 秋留台 | 水曜・第1日曜・第3土曜一般公開 | 8/24 unknown、8/26 available | yes |

## source type別coverage

| source type | total | automated | unsupported |
|---|---:|---:|---:|
| `structured_html` | 4 | 3 | 1 |
| `calendar_html` | 3 | 3 | 0 |
| `weekly_notice` | 0 | 0 | 0 |
| `fixed_schedule` | 9 | 9 | 0 |
| `pdf` | 9 | 8 | 1 |
| `reservation_system` | 5 | 0 | 5 |
| `phone_only` | 2 | 0 | 2 |
| `no_schedule_found` | 1 | 0 | 1 |

## safe failure

fetch失敗は `fetch_failed`、必要見出し・日付・凡例の変更は `source_changed` / `parse_failed`、週・月・当日HTMLの対象外は `outside_published_period`、未公開月は `schedule_not_published`、意味を確定できない文言は `semantic_ambiguity` 相当のunknownにする。いずれも以前のavailableを再利用せず、UIでは施設を残して「本日は要確認」と公式確認導線を示す。

## 残りgapと推奨

未自動化10施設は、世田谷1、府中vector PDF 1、reservation system 5、phone only 2、Web日程なし1である。次は26施設のfuture-date sourceを活かす任意日付検索UIを優先する。予約systemは「予約枠の空き = 個人利用可能」ではないため、規約と意味の調査を先に行う。
