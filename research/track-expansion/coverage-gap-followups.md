# Track coverage gap follow-ups

## 目的

この台帳は、完了済みの施設拡張batchで `include`、`hold`、`exclude` のいずれにも記録されなかった未掲載施設を、正式な再調査batchへ引き継ぐためのものである。公開Track Datasetへ直接追加する根拠にはせず、playbookどおりのevidence worksheetとreviewを終えるまでfollow-up候補として扱う。

構造化された正本は [`coverage-gap-followups.json`](coverage-gap-followups.json) とする。新しい事例は、当時のdataset revision、関連batch、発見できなかった段階、外部データの状態、一次情報、未確認事項とともに追加する。複数事例を比較するまで候補発見方法の変更は確定しない。

## 2026年8月28日の解決結果

3件は [`2026-08-coverage-gap-followup`](batches/2026-08-coverage-gap-followup.json) で正式に再審査した。

- 古市場陸上競技場: `include`。施設・400mクレートラック・有料区分は公式確認済みだが、一般個人の受付条件は推測せず `individualUse.status = unknown` として追加した。
- Balcom BMW 広島総合グランド: `include`。400mメインと300m補助を独立した2施設として追加した。
- 猪名川運動場 陸上競技場: `exclude`。施設は存在するが、公式案内で確認できるのは団体登録・全面利用であり、一般個人または共同利用の根拠がない。

このfollow-upを含め、過去に対象とした地域を横断再調査し、追加24、保留3、除外6を候補台帳へ記録した。公開Track Datasetは109施設から133施設になった。

## 発生した事例

### 古市場陸上競技場

2026年8月28日時点の109施設には未掲載で、関東completeness auditにも採否記録がない。公開上限20件に対して追加は19件だったため、上限による見送りではない。

関東batchの主なdiscoveryは2026年JAAF一覧と `leisure=track` / `sport=athletics` のOverpass queryだった。古市場はJAAF一覧に載らず、OSMの名称付き [`way/160024699`](https://www.openstreetmap.org/way/160024699) も `highway=service` であるため、両方の発見経路を通過しない。これは施設価値や個人利用可否の判定ではなく、queryのfalse negativeである。

川崎市の[施設案内](https://www.city.kawasaki.jp/shisei/category/288-6-10-0-0-0-0-0-0-0.html)で400mクレートラック、[現行施設一覧](https://www.city.kawasaki.jp/530/page/0000020718.html)で有料施設であることを確認して追加した。一般個人の受付方法と料金区分は一次情報だけでは確定できないため `unknown` のまま残し、利用可能とは断定しない。

分類: `discovery-query-false-negative`

### Balcom BMW 広島総合グランド（広島県総合グランド）

2026年8月28日時点の109施設には未掲載で、中国・愛知・福岡batchにも採否記録がない。ただし古市場と違い、発見元データには明確に存在する。

- 2026年JAAF一覧には、メインスタジアムが第2種・400m、補助競技場が第4種L・300mとして掲載されている。
- OSMには施設全体の [`way/481619502`](https://www.openstreetmap.org/way/481619502) に加え、メインの外周 [`relation/1847199`](https://www.openstreetmap.org/relation/1847199) と内周 [`way/137071403`](https://www.openstreetmap.org/way/137071403) がある。両者は別trackではない。北側の補助競技場は [`relation/1776392`](https://www.openstreetmap.org/relation/1776392) のinfield周囲にあり、OSMではtrack自体が独立tag化されていない。
- 直近batchは公開上限20施設に到達し、広島・山口・愛知・福岡から各5施設を追加した。一方、本施設を後続候補へ送った記録や、優先順位で外した理由は残っていない。

このため、queryの取りこぼしではなく、発見済み候補を公開上限へ絞る段階で台帳から落ちた `unrecorded-shortlist-omission` と判断する。

掲載適格性の予備根拠は強い。[広島県](https://www.pref.hiroshima.lg.jp/soshiki/257/nr-sogoground20211001.html)が正式名称、命名権名称と所在地を示し、[指定管理者の施設案内](https://shisetsu.mizuno.jp/m-7103/gallery)がメインを400m・8レーン・全天候舗装と明記している。[利用案内](https://shisetsu.mizuno.jp/m-7103/guide)では、専用利用のない時間帯にメイン、補助、運動場を予約なしで当日個人利用できる。さらに[月別予定のlanding page](https://shisetsu.mizuno.jp/m-7103/news/page/25592)が行事予定表と個人利用予定表を分けて掲載している。

公式配置とgeometryを照合し、400mメインと300m補助を別施設として追加した。月別PDFの自動判定、料金の代表区分、スパイク可否は引き続き未確定であり、表示上は推測していない。

分類: `unrecorded-shortlist-omission`

### 猪名川運動場 陸上競技場

2026年8月28日時点の109施設には未掲載で、関西batchにも採否記録がない。施設の存在自体は、池田市の[現行施設案内](https://www.city.ikeda.osaka.jp/shisei_info/kokyo/supoutsu_shisetsu/21263.html)が「陸上競技場1面」と明記しているため確認できる。一方、現時点の公式根拠では一般個人利用できる施設とは判断できない。

- 市の料金表は陸上競技場を「2時間1面」2,000円としており、個人料金や共用利用料金を示していない。
- 市が申請先として案内する[池田市OPASガイド](https://www.opas.jp/ikeda/pdf/ikd_guide.pdf)は、猪名川運動場を団体登録で利用できる施設に分類し、個人登録で利用できる施設を夫婦池公園テニスコートだけとしている。
- 2026年JAAF公認陸上競技場一覧には「猪名川」「池田」の掲載がなく、Nominatimの施設名検索でも対象施設を特定できなかった。

したがって、古市場やBalcom BMW 広島総合グランドのような掲載候補の取りこぼしとは区別し、正式batchで `exclude` とした。今後、一般個人または共同利用制度を示す公式案内が確認できた場合だけ再審査する。

分類: `unrecorded-exclusion-candidate`

## 横断調査で確認した原因

現時点で、少なくとも3種類のcoverage gapが確認できた。

1. 候補sourceのqueryを通過しない施設
2. 発見可能だが、公開上限やshortlist作成後に採否・繰越記録が残らない施設
3. 施設は存在するが一般個人利用の根拠がなく、明示的な除外記録が残らない施設

この分類を使って過去対象地域を横断再調査し、JAAF全候補の消込、自治体・指定管理者施設一覧、名称付きOSM geometry、主・補助競技場を照合した。結果はfollow-up batchへ集約し、playbookとvalidatorへ反映した。

## 確定した再発防止策

広い候補発見方法は今後の事例を集めてから見直すが、公開目標数の外側で候補が消える問題は待たずに防止する。playbookでは10〜20施設を候補上限ではなくreview・公開目標と明確化し、公開目標へ達した後も宣言済みsourceを最後まで走査することにした。

facility cluster化後の候補には `existing | include | hold | exclude | defer` のいずれかを必須とする。JAAF・自治体一覧の全row消込と、cluster総数とdisposition合計の一致をbatch完了条件にする。公開目標や時間の都合で今回reviewしない有力候補は `defer` として次batchへ送り、candidate配列から省略しない。

`npm run validate:track-batches` は全batchのID重複、decision、review件数、公開datasetとのinclude/exclude整合を検証する。新規batchでは `discoveryReconciliation` を必須とし、facility cluster総数と全dispositionの合計が一致しなければ失敗する。
