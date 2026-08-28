# 陸上トラックデータの調査・更新

## プロダクト価値とデータの優先順位

Track Searchの中心価値は、施設情報を網羅的に転載することではなく、ユーザーが指定日に近くで集中して走れる環境を見つけられることです。特に、日付別の個人利用可能性、距離、トラック長、路面、利用可能時間と、最終判断に使える公式情報への導線を優先します。

スパイク可否、料金、細かな利用条件は候補を決めた後に利用者が公式情報で確認できる補助情報であり、網羅率の目標にはしません。施設追加時に現行の公式情報から明確に確認できた場合は記録しますが、記載がないことから許可・禁止を推測せず `null` を維持します。変更され得る条件を古い静的値のまま断定するより、正しい `unknown` と公式確認導線を提示することを優先します。

データ調査・実装の優先順位は次のとおりです。

1. 日付別availability sourceとcollectorの鮮度・安全性
2. 個人利用可能性、利用可能時間、公式予定への確認導線
3. 正確な位置、トラック長、路面
4. レーン数
5. 料金、細かな利用条件、スパイク可否

## 役割とデータフロー

陸上トラック検索は、調査処理とWeb表示を分離した静的機能です。

```text
JAAF公開一覧（候補発見・公認種別） ─────────┐
自治体・施設公式サイト（事実確認） ─────────┼─> src/data/tracks.json ─> /tracks
data/osm/{tracks,expansion-candidates,coverage-followup-2026-08}.json（候補）┘
```

JAAF一覧は転載元データとしてではなく、公認施設候補の発見と公認種別の確認にだけ使います。個人利用、料金、時間、スパイク等の可変情報は自治体・施設公式ページを根拠にし、確認できない値は `null` にします。OSM Overpass JSONは研究用raw dataであり、Webアプリは直接読みません。

## 保存場所

- raw OSM: `../data/osm/tracks.json`（初期Overpass取得）
- 拡張候補evidence: `../data/osm/expansion-candidates.json`（広域Overpass/Nominatimから選別したobject）
- coverage gap再監査evidence: `../data/osm/coverage-followup-2026-08.json`
- 公開用normalized dataset: `src/data/tracks.json`
- 型・距離・Directions URL: `src/model/tracks.ts`
- raw/normalized検証: `scripts/validate-tracks.mjs`
- batch候補台帳の件数・採否検証: `scripts/validate-track-batches.mjs`
- 拡張coverage report: `../research/track-expansion/dataset-expansion-report.md`
- 施設別source監査台帳: `../research/track-expansion/track-source-audit.json`
- 完了済みbatchの未記録候補: `../research/track-expansion/coverage-gap-followups.json`

## schema

各施設は、外部IDに依存しない `id`、日英名称、緯度経度・住所、トラック長・レーン・路面、JAAF公認状態、個人利用状態・料金・時間・スパイク、公式・個人利用・予定URL、JAAF/OSM外部ID、複数の `sources` を持ちます。各sourceには `url`、`type`、`verifiedAt` が必須です。

`individualUse.status` は `available`、`temporarily-unavailable`、`unavailable`、`unknown` のいずれかです。料金0円と不明を区別するため、無料は `0`、不明は `null` です。JAAFの公認期間後を再確認できない場合、`jaafCertified` は推測せず `null` とします。

## 更新手順

施設追加時のsource選定、候補cluster、evidence worksheet、公開・collectorの品質ゲート、PR分割、既存施設の遡及監査は [`TRACK_EXPANSION_PLAYBOOK.md`](TRACK_EXPANSION_PLAYBOOK.md) を正本とします。以下は日常的な更新の要約です。

1. `../data/osm/tracks.json` と必要範囲のOverpass結果を候補として確認し、競馬・自転車・privateを除外する。採用候補のOSM evidenceは `expansion-candidates.json` に保存する。無名・sport未設定objectも位置と周辺施設から候補として確認する。
2. 近接するway/relation、補助走路等を施設単位にclusterし、既存のJAAF候補と重複確認する。
3. 自治体または施設公式サイトで名称、住所、仕様、個人利用条件を確認する。確認不能値は推測しない。
4. `src/data/tracks.json` を更新し、すべての根拠URLと当日の `verifiedAt` を残す。
5. `npm run validate:track-batches`、`npm run validate:tracks`、`npm test`、`npm run build`、`npm run lint`、起動済みpreviewに対する `npm run test:smoke` を実行する。

## MVP調査範囲と品質上の制限

2026-08-28時点で133施設を掲載しています。内訳は東京26、埼玉12、神奈川16、千葉18、大阪8、兵庫10、京都6、広島9、山口6、愛知14、福岡8です。JAAF公認確認済み107、非公認確認済み16、公認状態unknown 10です。個人利用は128施設で公式根拠を確認し、1施設は `temporarily-unavailable`、主競技場が専用利用のみの1施設は `unavailable`、根拠を確定できない3施設は `unknown` としています。日ごとの開放を保証する意味ではありません。

126施設が400m、119施設が全天候です。非公認でも実用的な公園track、土track、250m・300m trackを含めました。学校等で一般利用根拠を確認できない候補は掲載していません。料金は代表枠だけを記す場合があり、spike可否は公式根拠を確認できた値だけを表示するため、多くの施設でunknownです。33施設時点の詳細集計は [拡張レポート](../research/track-expansion/dataset-expansion-report.md)、51候補の追加履歴は [Phase 2レポート](../research/track-expansion/phase2-expansion-report.md)、遡及監査と補正は [監査レポート](../research/track-expansion/current-51-audit.md)、関東19施設と保留判断は [関東網羅性監査report](../research/track-expansion/batches/2026-08-kanto-completeness-audit-report.md)、関西20施設と保留・除外判断は [関西batch report](../research/track-expansion/batches/2026-08-kansai-public-tracks-report.md)、中国・愛知・福岡20施設は [Step 3 batch report](../research/track-expansion/batches/2026-08-chugoku-aichi-fukuoka-public-tracks-report.md)、追加漏れの横断再監査と24施設の追補は [coverage gap follow-up report](../research/track-expansion/batches/2026-08-coverage-gap-followup-report.md) にあります。

完了済みbatchで採否記録がない未掲載施設は、公開候補と混同せず [coverage gap follow-up台帳](../research/track-expansion/coverage-gap-followups.md) に記録します。正式batchで再調査し、解決後は追加したtrack IDまたは除外理由まで同じ台帳へ記録します。

1 batchあたり10〜20施設という目安は、公式確認とreviewを小さく保つための公開目標であり、候補発見または候補台帳の上限ではありません。有限のJAAF・自治体一覧は全rowを消し込み、OSMはfacility cluster化後の全候補へ `existing | include | hold | exclude | defer` を記録します。公開目標の外にある有力候補は `defer` として次batchへ送り、無記録で省略しません。

候補抽出とvalidatorはautomatic寄りですが、同一施設へのcluster、公式page発見、個人利用条件・料金・spikeの意味確認はsemi-automaticからmanualです。全国展開時の最大のbottleneckは、公式情報の所在と「空き・貸切なし・一般開放」の意味を人が確認する工程です。

当日の貸切・開放枠はTrack Datasetへ埋め込まず、build前に生成する `src/data/availability.json` に分離しています。対応source、unknownの意味、鮮度、実行方法は [`AVAILABILITY.md`](AVAILABILITY.md) を参照してください。天候や当日変更まで利用を保証するものではありません。

## ライセンスと利用条件

- OSMのデータはODbLです。画面と文書でOpenStreetMap contributorsへのattributionを表示し、座標・OSM IDの来歴を保持します。
- 標準OSM tile serverをMVP地図に利用します。attributionを常時表示し、キャッシュ回避、大量取得、prefetch、offline downloadは行いません。アクセス規模が増えた場合は利用ポリシーに適合するtile providerまたは自前配信へ移行が必要です。
- JAAF一覧表そのものは転載しません。施設候補と公認事実の確認に限定しています。2026年度ルールブック掲載一覧は有償出版物であり、公開範囲・二次利用条件が明確でないため複製しません。
- 自治体・施設ページからは必要最小限の事実だけを正規化し、文章・写真・表は転載しません。各施設に原典へのリンクを設けます。
