# 周回コースの初期掲載（2026-11-11）

目的は、既存の競技場を使えない日や初めての地域で、周回距離を管理して走る場所を比較できるようにすること。公園をトラックと同じ練習条件と扱わず、通常の利用条件・距離・路面・公式図への導線を短く提供する。スピード練習の適性・混雑・照明の安全性を未確認のまま評価しない。

## 候補と採否

既存流入のある大泉・新座や、首都圏の既存トラックと組み合わせられる公園を初期対象とした。ユーザー例示と公式のジョギング案内から候補を発見し、以下の現行一次資料を確認して掲載した。全国の網羅調査ではない。

| 候補 | 判断 | 一周の距離 | 確認できた差分・採用理由 |
|---|---|---|---|
| 和光樹林公園 | include | 800m / 1,000m | 大泉中央公園に隣接。ゴムチップ、スピード走・集団走・スパイク不可を確認 |
| 駒沢オリンピック公園 | include | 約2,140m | 競技場とジョギングコースを区別。100m表示・平均幅2m・左回り・横断箇所を比較できる |
| 所沢航空記念公園 | include | 1,950m | 公式コース図と距離を確認。ジョギング・ウォーキングコースへの自転車進入禁止を確認 |
| 越谷公園（旧県民健康福祉村） | include | 1,830m | 公式の総延長2,080m・外側自転車2,020mから周回長を区別。路面は公式の「特殊舗装」まで |
| みさと公園 | include | 1,550m | 三郷の競技場などと比較できる公園コース。公式の自由利用・園内図・スパイク禁止を確認 |
| 新横浜公園 | hold | 未採用 | [公式ランニング案内](https://www.nissan-stadium.jp/shinyoko-park/runmap.php)に940m〜2.2km/5kmの複数ルート。現行リンクの大きいPDFは全ルート・実距離の照合を終えていない。旧版の930m/5,075mをそのまま転用せず、今回は掲載保留 |
| 小金井公園 | defer | 未採用 | 独自に設定された複数コースが見つかるが、今回の調査では公式根拠と経路を確定していない |
| 光が丘公園 | defer | 未採用 | 初期5施設の実装・確認を優先。一般記事の3.1kmを公式確認なしで採用しない |

## 属性の確認とreview

公開データは `itsrunnew/src/data/running-courses.json`。各sourceの `fields` は裏付ける属性を示す。公式本文・案内図で今回確認した値だけを採用し、JAAF認定、日別availability、スパイク可否一般論などを既存トラックからコピーしていない。各sourceのHTTP応答と本文を2026-11-11に確認した。位置は公式アクセス地図の公園代表地点で、計測したスタート地点ではない。

- 和光樹林：[施設案内](https://www.seibu-green.co.jp/wako-jurin/facility.html)が800m/1kmと自由利用を案内。[公園概要・利用ルール](https://www.seibu-green.co.jp/wako-jurin/about.html)が赤色のゴムチップ、終日開放、スピード走・集団走・スパイク不可を明示する。[公式アクセス](https://www.seibu-green.co.jp/wako-jurin/access.html)の地図を代表位置に使用。過去の改修記事だけで現況を判断していない。
- 駒沢：[運営者の公園施設案内](https://www.tef.or.jp/kopgp/park/)が約2,140m、100m刻み表示、平均幅2m・左回り、平面交差・横断歩道等を明示。[アクセス](https://www.tef.or.jp/kopgp/access.html)と既存の同公園トラックの位置を確認。本文は材質を確定しないので路面はnull。一般通路と並行するサイクリングコース2,080mを混同しない。
- 所沢航空：[公式コース図の案内](https://www.parks.or.jp/tokorozawa-kokuu/guide/009/009146.html)と[距離FAQ](https://www.parks.or.jp/tokorozawa-kokuu/faq/001/001604.html)が1,950mを明示。[アクセス・利用条件](https://www.parks.or.jp/tokorozawa-kokuu/guide/001/001581.html)が自転車通行禁止を明示し、公式地図リンクも提供。一般記事のゴム舗装・夜間照明等は今回は採用しない。
- 越谷：[公園エリア](https://www.parks.or.jp/koshigaya/guide/001/001182.html)の仕様欄は一周1,830m・特殊舗装。20名以上の事前申請・協議と土日祝の団体利用原則不可を確認。[現行トップ](https://www.parks.or.jp/koshigaya/)は現在の越谷公園/たかもとヘルスパークという名称と公園部分の常時開放を案内。旧 `fukushimura` トップはここへ転送される。旧健康福祉村の名称は発見しやすさの補助として保持。屋内施設は営業終了と案内されているため、更衣室・シャワーを現行サービスとして掲載しない。[アクセス](https://www.parks.or.jp/koshigaya/guide/001/001183.html)から代表位置を確認。特殊舗装を木製チップやタータンへ置き換えない。
- みさと：[施設案内・園内図](https://www.seibu-la.co.jp/misato-yoshikawa/facility/misato.html)が1,550mと自由利用を案内。[公園概要・ルール](https://www.seibu-la.co.jp/misato-yoshikawa/about/misato.html)が終日開放・スパイク不可と現在の愛称OGISHIみさとパークを案内。[アクセス](https://www.seibu-la.co.jp/misato-yoshikawa/access/misato.html)の公園地図を代表位置に使用。路面材質・距離表示間隔はnull。

未確認の距離表示・横断箇所・開園時間はnullのまま、詳細で確認できた項目だけを表示する。路面は候補選択への影響が大きいため、nullでも「路面未確認」と明示する。「コースがある／通常開放」から指定日の利用可を作らない。工事・行事・臨時規制は公式のお知らせへの確認導線を提供し、今回の日次自動取得対象にはしない。

## 実装範囲

- Track Dataset 133施設、availabilityの施設ID/partition、現地レポートAPIのallowlistは維持。コース5施設は別の静的データで管理する。
- ホームはすべて／陸上トラック／周回コースと一周距離で絞り込み、既存の地図・直線距離順一覧を共用。紫の四角markerで、トラックの日別4statusと区別する。
- 和光樹林のスピード走制限は一覧・選択カード・コース詳細・初期HTMLにも残す。紹介文を増やす代わりに、条件と公式図への導線を中心にする。
- 既存トラック詳細の近隣候補に15km以内のコースを最大3施設追加。トラックの予定順rankingには混ぜない。コース詳細からも周辺3トラックに進める。
- 日英コースURL、canonical/hreflang、初期HTML、JSON-LD、sitemapを提供。既存Production route functionの更新定義を用意したが、公開操作は別。
- 同意済み計測だけでコース選択・詳細・公式図/経路・filterを観測する。座標は計測へ送らない。

## 更新の範囲と残る制約

週次の静的トラック再確認automationには接続していない。コースの追加・訂正時には公式本文・規制・位置を再確認し、読めたsourceだけ確認日を進める。未知値を埋めることを目的にしない。路面変更や臨時規制の自動検知、混雑評価、走行体験の現地確認、入口の現地測量は未実施。通常の公園開放時間も特定日の規制や夜間の走行環境を保証しない。

## 検証

`codex/training-courses` を取得済み `origin/master`（`ede005a`）から作成。2026-11-11に以下を確認した。最終変更は周回コースbadgeのスマホgrid配置で、最終buildの同じdistをfixture/featureの隔離copyに使った。生成した日英shellとsitemapは296 URL。

- `npm run build`：成功（型検査込み、Production設定・広告無効・mockレポートURL）。
- `npm test -- --maxWorkers=2 --testTimeout=60000`：70ファイル409件成功。初回の既定5秒では既存の `recovery-20261102` PDF原本照合がtimeoutしたため、CLIの時間上限と並列数を調整した。テスト本体・判定・fixtureは変更していない。最終差分のうちunit後に変えたアプリ部分はスマホgridのCSSだけで、その後buildと下記browserを再確認した。
- `ITSRUN_BROWSER_WORKERS=1 ITSRUN_PREBUILT_DIST="$PWD/dist" npm run test:features`：pace/archives/reports/scheduleが日英PC・スマホで成功。APIはmock、実投稿・通知なし。
- 同じ環境変数で `npm run test:daily:fixtures`：mixed全smokeと全unknown専用が成功。コースの種類・複数周回長filter、地図marker、利用制限、詳細と近隣トラック/コースの遷移、日付/言語/基準地点の維持、canonical、横幅と行内の重なりを確認した。app file hash不変と既存133施設の日付別データの一致も確認。live再収集はしていない。
- `npm run test:monitor:email`：5件成功。`npm run test:reverification`：9件成功。いずれもmockで外部送信・API呼び出しなし。
- `npm run validate:track-batches`：既存4台帳の整合成功。`git diff --check` と変更文書のローカルlink解決も成功。
- Playwright画像 `/tmp/itsrun-running-courses/` の日英PC/スマホ一覧・コース詳細を目視。スマホでbadgeが名称と重なる問題と塗りつぶしbuttonの文字色を修正し、重なりはbrowser回帰へ追加した。旧版の広告無効baseline serverがないため `test:visual` の旧新版比較は未実行。
- [みさとの公式SVG園内図](https://www.seibu-la.co.jp/parks/misato-yoshikawa/images/facility_m_map_v3.svg)と[所沢航空の公式コース図](https://www.parks.or.jp/tokorozawa-kokuu/guide/files/9146/009146/att_0000006.jpg)も画像で照合し、周回路と他の園路を区別した。

本番公開・masterへのmerge・CI実行・新しいcollector・外部管理画面操作は行っていない。ローカル5173はこのfeature branchを配信し、availabilityだけ既存公開サイトの静的JSONをproxyする（ローカル広告・解析・現地投稿は無効）。
