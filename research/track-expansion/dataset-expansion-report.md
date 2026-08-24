# Track Dataset 33施設拡張レポート

調査・検証日: 2026-08-24（Asia/Tokyo）

normalized dataset: [`itsrunnew/src/data/tracks.json`](../../itsrunnew/src/data/tracks.json)
availability research: [`availability-sources.json`](../availability/availability-sources.json)

## 結論

既存12施設のstable IDとデータを維持したまま、東京23区、東京都近隣部、埼玉県南部を中心に21施設を追加し、合計33施設とした。すべての追加施設は実在位置、施設identity、自治体・施設・指定管理者の公式sourceを確認した。学校・大学・企業の専用track、競馬・自転車・motor track、一般利用の根拠が極めて弱い候補は採用していない。

OSMは施設候補と位置の発見、JAAFは公認競技場候補の発見に限定した。個人利用、料金、利用時間、spike等は公式施設情報で確認し、確認できない属性は `null` とした。JAAF PDFに掲載されていても掲載公認期間が調査日時点で終了していた3施設は、公認継続を推測せず `jaafCertified: null` とした。

## Dataset coverage

| 指標 | 件数 | 割合 |
|---|---:|---:|
| 総施設 | 33 | 100.0% |
| 今回追加 | 21 | 63.6% |
| JAAF公認確認済み | 18 | 54.5% |
| 非公認確認済み | 12 | 36.4% |
| 公認状態unknown | 3 | 9.1% |
| 個人利用available | 33 | 100.0% |
| 個人利用unavailable | 0 | 0.0% |
| 個人利用unknown | 0 | 0.0% |
| 400m | 27 | 81.8% |
| 400m以外 | 6 | 18.2% |
| 全天候 | 23 | 69.7% |
| 土・clay確認済み | 4 | 12.1% |
| spike可確認済み | 3 | 9.1% |
| spike不可確認済み | 1 | 3.0% |
| spike不明 | 29 | 87.9% |
| 個人利用可能な非公認track | 12 | 36.4% |

地域内訳は東京23区18、東京都その他7、埼玉8。行政境界より実用的coverageを優先し、多摩地域と上尾も含めた。

## Discovery source

外部IDとcandidate logに基づく主な発見経路は次のとおり。JAAFまたはOSMのいずれを使った場合も、採用判断は公式施設sourceで行った。

| 発見経路 | 件数 | 割合 |
|---|---:|---:|
| JAAFのみ | 2 | 6.1% |
| OSMのみ | 11 | 33.3% |
| JAAF + OSM | 19 | 57.6% |
| その他の公式施設情報 | 1 | 3.0% |

追加範囲のOSM evidenceは [`data/osm/expansion-candidates.json`](../../data/osm/expansion-candidates.json) に保存した。1 objectを1施設とみなさず、競技場polygon、track way、施設label、補助設備を `role` 付きで同一施設へclusterした。

## 追加した21施設

| 地域 | 施設 | 仕様 | JAAF | availability主方式 |
|---|---|---|---|---|
| 江東区 | 江東区夢の島競技場 | 400m / 全天候 | 第2種 | `reservation_system` |
| 世田谷区 | 駒沢オリンピック公園総合運動場 陸上競技場 | 400m / 全天候 | unknown | `calendar_html` |
| 世田谷区 | 世田谷区立総合運動場 陸上競技場 | 400m / 全天候 | 第3種 | `structured_html` |
| 品川区 | 大井スポーツセンター 陸上競技場 | 400m / 全天候 | 第3種 | `fixed_schedule` |
| 足立区 | 舎人公園 陸上競技場 | 400m / 全天候 | 第3種 | `weekly_notice` |
| 江戸川区 | スピアーズえどりくフィールド | 400m / 全天候 | 第3種 | `calendar_html` |
| 葛飾区 | 奥戸総合スポーツセンター 陸上競技場 | 400m / 全天候 | 第4種L | `fixed_schedule` |
| 板橋区 | 新河岸陸上競技場 | 250m / 全天候 | 第4種L | `reservation_system` |
| 板橋区 | 荒川戸田橋陸上競技場 | 400m | 非公認 | `reservation_system` |
| 府中市 | 府中市民陸上競技場 | 300m / 全天候 | 第4種L | `pdf` |
| 杉並区 | 和田堀公園 第一競技場 | 300m / 土 | 非公認 | `pdf` |
| 杉並区 | 和田堀公園 第二競技場（済美山運動場） | 400m | 非公認 | `pdf` |
| 川口市 | 青木町公園総合運動場 陸上競技場 | 400m | 第3種 | `reservation_system` |
| 三郷市 | セナリオハウスフィールド三郷 | 400m / 全天候 | 第3種 | `pdf` |
| 越谷市 | しらこばと運動公園競技場 | 400m / 全天候 | 第3種 | `structured_html` |
| さいたま市 | 駒場運動公園競技場 | 400m / 全天候 | 第4種L | `phone_only` |
| 上尾市 | 上尾運動公園 陸上競技場 | 400m / 全天候 | unknown | `pdf` |
| 八王子市 | 上柚木公園陸上競技場 | 400m / 全天候 | 第2種 | `calendar_html` |
| 八王子市 | 東京フットボールセンター八王子富士森競技場 | 400m / 全天候 | 第4種L | `pdf` |
| あきる野市 | 秋留台公園 陸上競技場 | 400m / 全天候 | 第3種 | `weekly_notice` |
| 東大和市 | 東大和南公園 運動広場トラック | 400m | 非公認 | `no_schedule_found` |

各施設の公式URL、source、確認日はnormalized datasetに、availabilityの意味・例外・更新頻度はavailability research JSONに保持している。

## Availability coverage

33施設中30施設（90.9%）で、日別予定、固定開放規則、公開予約状況のいずれかを公式Web上で確認できた。

| 主方式 | 件数 | 割合 |
|---|---:|---:|
| `structured_html` | 4 | 12.1% |
| `calendar_html` | 3 | 9.1% |
| `weekly_notice` | 0 | 0.0% |
| `fixed_schedule` | 9 | 27.3% |
| `pdf` | 9 | 27.3% |
| `reservation_system` | 5 | 15.2% |
| `phone_only` | 2 | 6.1% |
| `no_schedule_found` | 1 | 3.0% |

| 実装距離 | 件数 | 割合 |
|---|---:|---:|
| 現collectorで対応済み（HTML/calendar/fixed拡張後） | 23 | 69.7% |
| 小規模なHTML/rule parser追加の残り | 0 | 0.0% |
| PDF collectorで安全に対応済み | 8 | 24.2% |
| PDF graphics対応が必要 | 1 | 3.0% |
| 予約system対応が必要 | 5 | 15.2% |
| 電話・Web予定なし | 3 | 9.1% |

HTML/calendar/fixed拡張後の現collectorは23/33（69.7%）。候補9施設のうち8施設を追加し、安定した日付別sourceがない世田谷はguarded unknownとした。normalized availability schema、failure handling、UIは変更せず再利用できた。未実装sourceもreason付き `unknown` を生成するためTrack Searchから消えない。

## PDF再評価

PDF主方式は現行source再検証で上柚木を加え9/33（27.3%）となった。練馬、戸田、府中、三郷、上尾、八王子富士森、上柚木の現行PDFと和田堀2施設の月間PDFはいずれもtext-basedで、scan-only 0である。

PDF collectorは上柚木を含む8施設を安全に対応し、府中だけをvector図形のためunknownとした。全collector coverageは23/33（69.7%）である。安定indexからのPDF discovery、document hash、施設別の列・凡例parserを実装し、万能table parserやOCRは導入していない。詳細は [`pdf-collector-validation.md`](../availability/pdf-collector-validation.md) と [`html-calendar-collector-validation.md`](../availability/html-calendar-collector-validation.md) を参照。

## Future date search

| 評価 | 件数 | 割合 |
|---|---:|---:|
| future dates supported | 26 | 78.8% |
| future range limited | 0 | 0.0% |
| today only | 4 | 12.1% |
| unknown | 3 | 9.1% |

limitedを含め26/33（78.8%）で将来日付候補を作れる。任意日UIを先に作ってもsource coverageが追いつかないため、PDF collectorの後に、月間資料・calendarの公開範囲を示す形で日付検索を追加するのが安全である。

## Pipeline scalability

| 工程 | 現状 | 全国展開時の評価 |
|---|---|---|
| Overpass/JAAF candidate抽出 | automatic寄り | 地域queryと公認一覧抽出は再利用可能 |
| sport除外・近接cluster・JAAF重複 | semi-automatic | relation/way、無名track、同一施設内設備の人手確認が必要 |
| 公式施設page発見 | manual寄り | 名称変更、指定管理者移管、検索性の差が大きい |
| 基本仕様・個人利用・料金確認 | manual | 「貸切がない時間」「市内者限定」等の意味確認が最大の品質要件 |
| availability分類 | semi-automatic | schemaは再利用可、source固有の凡例・例外は手動調査が必要 |
| normalized validation/build | automatic | ID、座標、source、外部ID、availability参照をCI化可能 |

最大のbottleneckはcandidate数ではなく、公式情報の発見と個人利用semanticsの人手確認である。33施設規模では静的JSONと施設別provenanceで管理可能だが、全国展開ではreview queue、source freshness監視、属性単位の根拠管理が必要になる。

## 既存データとUIへの影響

- 既存12 stable IDはすべて維持した。既存12施設の属性変更はない。
- `/tracks`、地図、現在地、距離、static filter、availability表示、公式URL、Directionsを変更せず、data-drivenに33 marker/listを扱う。
- marker clusteringは33施設では必須でない。初期地図は石神井公園周辺を維持し、距離順一覧とfilterで探索できる。
- raw research data、normalized Track Dataset、日付別availabilityは引き続き分離する。

## 推奨する次の順序

1. 26施設で利用可能な将来日付検索を追加する。
2. 府中のvector図形解析は誤判定リスクと1施設分の効果を比較して別途判断する。
3. reservation system 5施設は、規約、低頻度access、空き枠と個人利用の意味を運営者ごとに確認してから判断する。
4. spike情報を属性単位の公式provenance付きで改善する。
5. 対象地域拡大は、属性単位provenanceとreview workflowを整えてから段階的に行う。
