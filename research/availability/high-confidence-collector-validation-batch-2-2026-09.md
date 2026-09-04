# 高確度collector追加検証 batch 2（2026-09-04）

## 結論

2026-09-04（Asia/Tokyo）に、公式sourceの対象日・時間・利用可否を、掲載された明示情報だけで判定できる6施設を追加検証した。安全な自動判定対象は27施設から33施設となり、Track Dataset 133施設に対するcoverageは **33/133（24.8%）** である。

今回のcoverageは施設の掲載数ではなく、collectorが指定日について根拠付きrecordを生成できる施設数である。取得失敗、対象期間外、未掲載、空欄、形式変更、意味の矛盾は `unavailable` にせず、理由付き `unknown` とする。

## 実装形式別の内訳

内訳は調査用 `availabilitySource.type` ではなく、現行collectorがrecordへ保存する `publicationFormat` を正本にした。したがって、西京極・柳島のWordPress月次noticeは、実装上の `structured_html` として数える。

| publicationFormat | 施設数 | 対応施設 |
|---|---:|---|
| `structured_html` | 7 | 光が丘、武蔵野、越谷、日産スタジアム、日産フィールド小机、西京極補助競技場、柳島 |
| `calendar_html` | 3 | 東京体育館、駒沢、江戸川 |
| `calendar_json` | 1 | 町田GIONスタジアム |
| `fixed_schedule` | 9 | 大泉、赤塚、井の頭、朝霞、代々木、大井、舎人、奥戸、秋留台 |
| `weekly_notice` | 1 | 山城総合運動公園 |
| `pdf` | 12 | 練馬、戸田、和田堀第一、和田堀第二、三郷、上尾、富士森、上柚木、神奈川県立スポーツセンター、万博記念、国府台、びんご |
| **合計** | **33** | |

調査JSONではMachidaを `calendar_html`、西京極を `calendar_html`、柳島を `weekly_notice` と分類している。これはsourceの発見方式を表す分類であり、上表の実装形式との二重計上を避けるため、coverage集計では使用していない。

## 追加6施設のsourceと判定境界

| 施設 | 公式source | collectorが肯定できる範囲 |
|---|---|---|
| 町田GIONスタジアム（町田市立陸上競技場） | [町田市案内](https://www.city.machida.tokyo.jp/bunka/sport/sport/gion-stadium/sport06.html)、[公式カレンダー](https://www.nozuta-park.com/calender.html)、[Event Organiser JSON](https://www.nozuta-park.com/wp-admin/admin-ajax.php?action=eventorganiser-fullcal) | 対象月のstart/endが一致するJSONについて、完全一致の `個人利用日` / `personal` と、説明文の個人利用可能・明示時間だけを `partially_available` とする。`専用利用日` / `rikujyou` と `休場日` / `break` の明示範囲だけを `unavailable` とする |
| 国府台陸上競技場 | [市川市施設案内](https://www.city.ichikawa.lg.jp/page/4184.html)、[月次使用予定表](https://www.city.ichikawa.lg.jp/page/4185.html) | 月次表に記載された対象日の「利用時間」から、大会・教室等の「使用時間」を差し引く。予定表ページが明示する「使用時間以外を一般開放」の規則も必須anchorとし、時刻なしイベント、年月不一致、構造変更はunknown |
| 柳島スポーツ公園総合競技場 | [茅ヶ崎市案内](https://www.city.chigasaki.kanagawa.jp/shisetsu_info/s_sports/1028429.html)、[個人利用案内](https://www.ys-park.jp/user-guide/athletics/)、[2026年9月記事](https://www.ys-park.jp/2026/09/01/17617/) | WordPress検索結果の年・月・完全一致titleを確認し、記事内の明示日時を `partially_available`、同じ記事内の施設休館・開放なしを `unavailable` とする。記事内非掲載日はunknown |
| 東寺ハウジングフィールド西京極（西京極補助競技場） | [施設案内](https://www.kyoto-sports.or.jp/facilities/detail.php?id=4)、[月次topic一覧](https://www.kyoto-sports.or.jp/category/cat_topics/) | 本文の補助競技場名、対象年月、一般開放日、時間が揃った枠だけを `partially_available` とする。主競技場の予定や非掲載日を補助競技場へ流用しない |
| 京都府立山城総合運動公園陸上競技場 | [個人利用申込案内](https://www.kyoto-park.jp/application/)、[固定URLの個人利用告知](https://www.kyoto-park.jp/2022/03/31/%E9%99%B8%E4%B8%8A%E7%AB%B6%E6%8A%80%E5%A0%B4%E5%80%8B%E4%BA%BA%E5%88%A9%E7%94%A8%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B/) | 固定URLを上書きする記事のtitle、公開年、対象日、明示時間を検証する。時間付き告知は `partially_available`、明示された利用不可は `unavailable`、短期掲載範囲外はunknown |
| 広島県立びんご運動公園陸上競技場 | [利用案内](https://bingo-sportspark.com/guide.html)、[月次PDF掲載記事](https://www.bingo-sportspark.com/news.php?c=topics_view&pk=1566461033) | 月次PDFの年月・凡例・トラック可否が揃った枠だけを判定する。トラック利用可、明示された開始・終了境界、終日×をそれぞれavailable・partial・unavailableとし、空欄・混在記号はunknown |

国府台の差し引きは、予定表ページが「『使用時間』以外を一般開放」と明示し、対象日の「利用時間」とイベントの「使用時間」を同じ月次表で確認できる場合に限る。Machida、柳島、西京極、山城、びんごでは、非掲載や空欄から開放・休場を推測しない。

## 代表的なlive例

2026年9月の公式応答・資料を取得し、fixtureと目視比較した代表例である。予定は変更されるため、recordには公式確認のwarningを残す。

- MachidaのJSONでは、`個人利用日` / `personal` の9月1日9:00–18:00が個人利用枠として掲載され、9月3日開始・9月7日終了のend-exclusiveイベントは9月6日までを対象にする。9月7日以降は別イベントがなければunknownである。
- 国府台の月次表では、9月1日が9:00–21:00、9月4日は9:00–12:00の市民スポーツ教室を差し引いて12:00–21:00がavailable、9月28日は休場表示でunavailableとなる。
- 柳島の記事では、9月4日14:30–22:00が個人利用枠、9月14日の施設休館と9月21日の開放なしが明示され、記事にない9月3日はunknownとなる。
- 西京極の記事では、9月1日と7〜9日の7:00–21:00が一般開放枠として掲載され、他の日はunknownとなる。主競技場の予定は対象外である。
- 山城のrolling noticeでは、9月4日9:00–21:00が個人利用枠、9月6日が利用不可、短期告知にない9月7日がunknownとなる。
- びんごの月次PDFでは、9月1日がトラック利用可、9月3日が16:00まで、9月5日が14:00以降、9月19日が終日×として掲載される。

## 失敗時とcache

JSONの月境界、PDFの年月・タイトル・凡例、WordPress記事のtitle・公開年・施設名、rolling noticeの公開年を検証する。ISO日時・イベントのend-exclusive範囲、PDFのcontent typeと抽出結果、時間境界の整合性も確認する。anchor変更、年月不一致、時刻欠落、空欄、非掲載、重複、意味が矛盾するイベントは `unknown` に降格する。

range collectorは同一method・URL・request bodyをcacheする。町田のEvent Organiser JSONは対象月の `start=YYYY-MM-01` と翌月の `end` を付け、31日分でも月ごとに1回だけ取得する。月次PDFは安定したlanding pageと同じPDF bytesを再利用し、WordPress月次noticeと山城の固定URLも日ごとに再取得しない。PDFはOCRを導入せず、座標付きtext extractionで意味を確定できる資料だけを判定する。

## 保留した候補

今回の6施設とは別に、公式情報は見つかっても、誤判定リスクまたは運用コストに対して追加coverageの費用対効果が低い候補は保留した。

| 候補 | 保留理由 |
|---|---|
| [マルヤス岡崎龍北スタジアム](https://www.ryuhoku-sf.jp/calender/) | 週間予定が画像中心で、OCRや画像差分が必要。文字anchorだけで個人利用枠を安全に固定できない |
| [相模原ギオンスタジアム](https://asamizo-stadium.jpn.org/) | 主・補助・大会・専用枠を含む複雑な予定matrixで、現行sourceも403を返すため、施設間・例外の誤結合を避ける調査が先 |
| [たまゆら陸上競技場（枚方市立陸上競技場）](https://shisetsu.mizuno.jp/mss-7292/guide) | 個人供用時間に専用利用・大会の例外overlayを安全に結合できず、固定時間だけでavailableとするのは危険 |
| [ゼットエーオリプリスタジアム](https://vonds.net/access/) | 現指定管理者の公式ページに埋め込まれた有効なGoogle ICSは確認できるが、外部calendar依存を新たな正本にせず、運用確認まで保留 |
| [寝屋川公園陸上競技場](https://neyagawa.osaka-park.or.jp/?N=A) | 当日のコンディション表示に限られ、future rangeを生成できないtoday-only source。非掲載をunavailableにしないため自動化を見送る |

これらは施設datasetから除外する判断ではなく、availability collectorの対象外として理由付き `unknown` を維持する判断である。
