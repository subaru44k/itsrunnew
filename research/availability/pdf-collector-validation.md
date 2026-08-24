# PDF availability collector 実装・live検証

検証日: 2026-08-24（Asia/Tokyo）
対象日: 2026-08-24、未来日 2026-08-27

## 結論

主方式がPDFの8施設を再取得した。HTTP 200・PDF content type・文字抽出を全8施設で確認し、scan-onlyは0、OCR対象は0だった。ただし府中は日別statusの○・◇・×がPDFの文字ではなくベクター図形であり、通常のtext extractionでは安全に読めない。よって7施設をdate-specific collector対応、府中1施設を構造検証付き `unsupported_pdf_graphics` / `unknown` とした。

安全に自動判定可能なcoverageは既存8施設から15/33（45.5%）へ増えた。未対応の小規模HTML/calendar/fixed/weekly拡張9施設を加えた到達見込みは24/33（72.7%）である。25/33としないのは、府中を誤って対応済みに数えないためである。

> 追補（2026-08-24）: 後続のHTML/calendar再検証で、上柚木公園の現行sourceは施設ページから発見するtext-based複数月PDFと確認した。`kamiyugi-multi-month-matrix` を追加し、現行分類はPDF 9施設・安全対応8施設、全collector coverageは23/33（69.7%）である。以下の8施設表と15/33は、最初のPDFフェーズ時点の検証記録として残す。

## 対象・URL discovery・format

| track ID | 施設 | 安定した公式ページ | 2026-08 PDF | discovery | format / parser |
|---|---|---|---|---|---|
| `nerima-general-sports-park` | 練馬総合運動場公園 | [施設ページ](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html) | [直近1週間](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20260821souun_kaihoujoukyou.pdf) | latest | A / `nerima-weekly-slots` |
| `toda-sports-center-track` | 戸田市スポーツセンター | [行事予定](https://toda-zaidan.org/sportscenter/shisetsu_sc/yoyaku_sc/) | [8月](https://toda-zaidan.org/wp-content/uploads/2026.080-1.pdf) | monthly | B / `toda-monthly-events` |
| `fuchu-citizen-athletic-track` | 府中市民陸上競技場 | [施設ページ](https://www.city.fuchu.tokyo.jp/shisetu/supotu/kyogi/shimin.html) | [年度カレンダー](https://www.city.fuchu.tokyo.jp/shisetu/supotu/kyogi/shimin.files/reiwa8nennkarennda.pdf) | annual | C / `fuchu-vector-calendar-guard` |
| `wadabori-park-first-track` | 和田堀公園 第一競技場 | [news index](https://www.tokyo-park.or.jp/park/wadabori/news/index.html) | indexから対象月記事・第一PDFを発見 | monthly two-step | D / `wadabori-half-day-first` |
| `wadabori-park-seibiyama-track` | 和田堀公園 第二競技場 | [news index](https://www.tokyo-park.or.jp/park/wadabori/news/index.html) | indexから対象月記事・第二PDFを発見 | monthly two-step | D / `wadabori-half-day-second` |
| `misato-senario-house-field` | セナリオハウスフィールド三郷 | [予約状況](https://www.misato-hall.com/module/3299.htm) | [8月](https://www.misato-hall.com/secure/4855/88-22.pdf) | monthly | E / `misato-three-slot-reservation` |
| `ageo-athletic-stadium` | 上尾運動公園 | [個人利用案内](https://www.parks.or.jp/saitamasuijo/guide/006/006231.html) | ページ内8月個人利用日PDF | monthly | F / `ageo-individual-use-list` |
| `hachioji-fujimori-athletic-stadium` | 八王子富士森競技場 | [施設ページ](https://www.city.hachioji.tokyo.jp/life/010/002/003/004/p012068.html) | ページ内複数月一般開放PDF | latest multi-month | G / `fujimori-multi-month-matrix` |

formatは7種類で、和田堀2施設だけ共通の座標・表構造を使い、空欄の意味を施設設定で分ける。8施設を無理に1つの万能表parserへ統合していない。

## semantic mapping

- A 練馬: `陸上トラック優先利用時間`だけavailable。`人工芝 優先利用時間 ※陸上競技の練習不可`はunavailable。空欄はunknown。
- B 戸田: 陸上競技場と同じ行の専用行事時間をunavailable、夏季17:00–18:00欄の○をavailable。空欄・他施設の予定はunknown。
- C 府中: 凡例の意味は確認できるが日別記号を文字抽出できないため、全日 `unknown / unsupported_pdf_graphics`。図形を推測しない。
- D 和田堀: PDF凡例が空欄を開放と明示しているため空欄と一般開放をavailable、貸切・整備をunavailable。第一はtrack+field、第二はtrackのみという凡例差を保持する。
- E 三郷: `共用利用`だけavailable、`専用利用`はunavailable。空欄は「予約可能日」であって個人利用可ではないためunknown。
- F 上尾: `個人利用日予定表`に掲載された日・時間だけavailable。掲載なしや占有予備日はunknown。
- G 富士森: ○・地域開放をavailable、貸切・地域開放休止をunavailable。空欄・未知の記号はunknown。公式施設ページの毎日6:00–9:00地域開放規則に、PDFの短縮・休止を優先する。

全formatで対象月、title、header、凡例等のanchorを検証する。blankの意味を公式凡例で確認できないformatではavailableにしない。

## live結果とsource目視比較

### 2026-08-24

| 施設 | source上の内容 | parser result | 一致 |
|---|---|---|---|
| 練馬 | 9–12トラック優先、他枠空欄 | `partially_available` 9–12 | yes |
| 戸田 | 当日行に陸上専用行事・夏季○なし | `unknown` | yes（空欄をavailableにしない） |
| 府中 | 凡例は文字、日別○等は図形 | `unknown / unsupported_pdf_graphics` | yes（guard） |
| 和田堀第一 | 午前空欄、午後貸切 | `partially_available` 9–12、13–17 unavailable | yes |
| 和田堀第二 | 午前・午後整備 | `unavailable` | yes |
| 三郷 | 午前・午後専用、夜間共用 | `partially_available` 18–21 | yes |
| 上尾 | 8/24は個人利用日一覧に掲載なし | `unknown` | yes |
| 富士森 | 早朝地域開放、4区分○ | `available` 6–21 | yes |

内訳はavailable 1、partially_available 3、unavailable 1、unknown 3。

### 未来日 2026-08-27

公開済みPDF範囲で再実行した。上尾は9–18 available、富士森は6–21 available、和田堀第二は午前・午後available、和田堀第一と三郷はpartial、練馬・戸田は明示的available根拠がなくunknown、府中はgraphics guardでunknownとなった。内訳はavailable 3、partially_available 2、unknown 3、unavailable 0。生成物はUI用の当日2026-08-24へ戻した。

## failure policyとprovenance

HTTP/timeoutは `fetch_failed`、PDFでないresponseは `invalid_content_type`、壊れたPDF・空抽出は `extraction_failed`、anchor/凡例/layout変更は `source_changed` または `parse_failed`、対象月未公開は `schedule_not_published`、対象範囲外は `outside_published_period` とする。いずれもstatusは必ずunknownで、以前のavailableを再利用しない。

各成功recordにはlanding page URL、実PDF URL、PDF filename、PDF bytesのSHA-256、`fetchedAt`、`parsedAt`、`checkedAt`、requested date、`publishedAt`（取得可能時）、parser名・versionを保存する。同一URL差替えもhashで検知できる。

## 残るリスクと次の優先順位

PDF layout・凡例変更、対象月の公開遅延、同一URL差替え、予定作成後の当日変更が残る。source hashは変更検出材料であり、意味の自動保証ではない。府中を対応するならOCRではなくPDF drawing operatorの限定解析とfixture比較を別タスクで評価する。

後続フェーズでHTML/calendar/fixed候補9施設のうち8施設を追加し、23/33（69.7%）へ到達した。次は任意の日付検索を追加する。予約システムは「空き＝個人利用可」ではないため後回しとし、spike情報品質向上、地域拡大の順で検討する。
