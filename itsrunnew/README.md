# ItsRun

ItsRun の静的Webサイトです。Vue 3、TypeScript、Vite、Pinia、Vuetify 4で構成し、Firebaseやその他のバックエンドには接続しません。競技場スケジュールは日付をブラウザ内で生成し、各時間帯を「情報なし」として表示します。

ホーム `/`（英語版 `/en/`）では、東京23区・東京都近隣部・埼玉の検証済み33施設をOpenStreetMap上から探せます。従来の `/tracks` と `/en/tracks` も同じ検索を表示します。織田フィールドの従来ページは `/oda-field`（英語版 `/en/oda-field`）です。現在地、直線距離、今日から31日分の日付指定availability、利用不可表示switch、施設詳細、公式情報、API key不要のGoogle Maps経路リンクを提供します。通常表示は利用可能・一部利用可能・要確認を残し、選択日に明示的な利用不可だけを除外します。施設データと日付別availabilityは分離し、ブラウザからJAAF・Overpass・施設サイトへ検索リクエストは送りません。

開発者・エージェント向けの全体構造は [`../docs/SITE_STRUCTURE.md`](../docs/SITE_STRUCTURE.md) を参照してください。

## ローカル実行

Node.js 22.13.0 以上とnpmが必要です。

```sh
npm install
npm run collect:availability:range
npm run dev
```

品質確認:

```sh
npm test
npm run build
npm run lint
npm run validate:tracks
npm run test:smoke
npm run test:smoke:preview
```

`master`向けPull RequestではGitHub Actionsの `Node 24 validation` が、`npm ci`、Track Dataset検証、unit test、lint/type check、buildを同じ順序で実行します。CIはcommit済みavailability baselineを使用し、live collectorやAWS credentialsを必要としません。

`collect:availability:range` は東京の当日から31日分を `src/data/availability/manifest.json` と日別JSONへ生成します。同一HTML/PDFをcacheし、日数分の重複fetchやPDF抽出を避けます。単日debug用 `npm run collect:availability -- --date YYYY-MM-DD` も維持しています。現在23施設を安全な自動判定対象とし、取得不能・予定未公開・期限切れ・形式変更は利用不可にせず「要確認」へ降格します。通常のbuild/devは外部sourceへアクセスしません。詳細は [`../docs/AVAILABILITY.md`](../docs/AVAILABILITY.md) を参照してください。

`test:smoke` は `npm run preview` が `http://127.0.0.1:4173` で起動していることを前提にします。Track Datasetのschema、raw OSM (`../data/osm/tracks.json` と `expansion-candidates.json`) と公開データの役割、調査・更新手順、既知の制限、ODbL/JAAF/OSM tileの注意点は [`../docs/TRACK_DATA.md`](../docs/TRACK_DATA.md) を参照してください。33施設時点の定量coverageと拡張pipeline評価は [`../research/track-expansion/dataset-expansion-report.md`](../research/track-expansion/dataset-expansion-report.md) にあります。

## AWSプレビュー環境

AWS CDKが、公開アクセスを遮断したS3バケットとOrigin Access Control付きCloudFront Distributionを作成します。独自ドメインやRoute 53は構成しません。

```sh
npm run infra:synth
npm run infra:deploy
```

デプロイ後のURLは `cdk-outputs.json` の `VerificationUrl` で確認できます。プレビュー環境を削除する場合は `npm run infra:destroy` を実行します。

GitHub Actionsはmaster push、手動実行、毎日05:00 JSTにfresh availabilityを生成し、既存Previewへcontent-only deployします。GitHub OIDCの専用role、cache metadata、targeted invalidation、concurrency、failure handlingは [`../docs/PREVIEW_DEPLOYMENT.md`](../docs/PREVIEW_DEPLOYMENT.md) を参照してください。通常deployでCDK hosting stackは更新しません。
