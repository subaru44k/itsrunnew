# 陸上トラックデータの調査・更新

## 役割とデータフロー

陸上トラック検索は、調査処理とWeb表示を分離した静的機能です。

```text
JAAF公開一覧（候補発見・公認種別） ─────────┐
自治体・施設公式サイト（事実確認） ─────────┼─> src/data/tracks.json ─> /tracks
data/osm/{tracks,expansion-candidates}.json（候補）┘
```

JAAF一覧は転載元データとしてではなく、公認施設候補の発見と公認種別の確認にだけ使います。個人利用、料金、時間、スパイク等の可変情報は自治体・施設公式ページを根拠にし、確認できない値は `null` にします。OSM Overpass JSONは研究用raw dataであり、Webアプリは直接読みません。

## 保存場所

- raw OSM: `../data/osm/tracks.json`（初期Overpass取得）
- 拡張候補evidence: `../data/osm/expansion-candidates.json`（広域Overpass/Nominatimから選別したobject）
- 公開用normalized dataset: `src/data/tracks.json`
- 型・距離・Directions URL: `src/model/tracks.ts`
- raw/normalized検証: `scripts/validate-tracks.mjs`
- 拡張coverage report: `../research/track-expansion/dataset-expansion-report.md`

## schema

各施設は、外部IDに依存しない `id`、日英名称、緯度経度・住所、トラック長・レーン・路面、JAAF公認状態、個人利用状態・料金・時間・スパイク、公式・個人利用・予定URL、JAAF/OSM外部ID、複数の `sources` を持ちます。各sourceには `url`、`type`、`verifiedAt` が必須です。

`individualUse.status` は `available`、`temporarily-unavailable`、`unavailable`、`unknown` のいずれかです。料金0円と不明を区別するため、無料は `0`、不明は `null` です。JAAFの公認期間後を再確認できない場合、`jaafCertified` は推測せず `null` とします。

## 更新手順

1. `../data/osm/tracks.json` と必要範囲のOverpass結果を候補として確認し、競馬・自転車・privateを除外する。採用候補のOSM evidenceは `expansion-candidates.json` に保存する。無名・sport未設定objectも位置と周辺施設から候補として確認する。
2. 近接するway/relation、補助走路等を施設単位にclusterし、既存のJAAF候補と重複確認する。
3. 自治体または施設公式サイトで名称、住所、仕様、個人利用条件を確認する。確認不能値は推測しない。
4. `src/data/tracks.json` を更新し、すべての根拠URLと当日の `verifiedAt` を残す。
5. `npm run validate:tracks`、`npm test`、`npm run build`、`npm run lint`、起動済みpreviewに対する `npm run test:smoke` を実行する。

## MVP調査範囲と品質上の制限

2026-08-25時点で51施設を掲載しています。内訳は東京25、埼玉11、神奈川8、千葉7です。JAAF公認確認済み29、非公認確認済み12、公認状態unknown 10です。個人利用は47施設で公式根拠を確認し、明示的な根拠を確認できない4施設は `unknown` のまま掲載しています。日ごとの開放を保証する意味ではありません。

45施設が400m、41施設が全天候です。非公認でも実用的な公園track、土track、250m・300m trackを含めました。学校等で一般利用根拠を確認できない候補は掲載していません。料金は代表枠だけを記す場合があり、spike可否は公式根拠を確認できた値だけを表示するため、多くの施設でunknownです。33施設時点の詳細集計は [拡張レポート](../research/track-expansion/dataset-expansion-report.md)、今回追加した18施設と品質判断は [Phase 2レポート](../research/track-expansion/phase2-expansion-report.md) にあります。

候補抽出とvalidatorはautomatic寄りですが、同一施設へのcluster、公式page発見、個人利用条件・料金・spikeの意味確認はsemi-automaticからmanualです。全国展開時の最大のbottleneckは、公式情報の所在と「空き・貸切なし・一般開放」の意味を人が確認する工程です。

当日の貸切・開放枠はTrack Datasetへ埋め込まず、build前に生成する `src/data/availability.json` に分離しています。対応source、unknownの意味、鮮度、実行方法は [`AVAILABILITY.md`](AVAILABILITY.md) を参照してください。天候や当日変更まで利用を保証するものではありません。

## ライセンスと利用条件

- OSMのデータはODbLです。画面と文書でOpenStreetMap contributorsへのattributionを表示し、座標・OSM IDの来歴を保持します。
- 標準OSM tile serverをMVP地図に利用します。attributionを常時表示し、キャッシュ回避、大量取得、prefetch、offline downloadは行いません。アクセス規模が増えた場合は利用ポリシーに適合するtile providerまたは自前配信へ移行が必要です。
- JAAF一覧表そのものは転載しません。施設候補と公認事実の確認に限定しています。2026年度ルールブック掲載一覧は有償出版物であり、公開範囲・二次利用条件が明確でないため複製しません。
- 自治体・施設ページからは必要最小限の事実だけを正規化し、文章・写真・表は転載しません。各施設に原典へのリンクを設けます。
