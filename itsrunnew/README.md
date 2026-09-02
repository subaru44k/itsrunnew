# ItsRun

ItsRun の静的Webサイトです。Vue 3、TypeScript、Vite、Pinia、Vuetify 4で構成し、Firebaseやその他のバックエンドには接続しません。競技場スケジュールは日付をブラウザ内で生成し、各時間帯を「情報なし」として表示します。

ホーム `/`（英語版 `/en/`）では、東京・埼玉・神奈川・千葉・大阪・兵庫・京都・広島・山口・愛知・福岡の検証済み133施設をOpenStreetMap上から探せます。従来の `/tracks` と `/en/tracks` は日付queryを維持してホームへ移動します。各施設には共有可能な `/tracks/:trackId`（英語版 `/en/tracks/:trackId`）詳細ページがあり、織田フィールドの従来ページは `/oda-field` です。現在地または地図上で指定した地点からの直線距離、今日から31日分の日付指定availability、利用不可表示switch、公式情報、API key不要のGoogle Maps経路リンクを提供します。通常表示は利用可能・一部利用可能・要確認を残し、選択日に明示的な利用不可だけを除外します。施設データと日付別availabilityは分離し、ブラウザからJAAF・Overpass・施設サイトへ検索リクエストは送りません。

地図の初期表示は全掲載施設が収まる範囲を画面幅から自動計算します。検索の基準地点は「現在地」と「地図上で指定」を同じUI・markerで扱います。基準地点がない一覧は都道府県別、設定後は距離順で12件ずつ表示し、広域地図では近接markerをcluster化します。単一markerの選択時は地図を施設へ寄せたうえで、固定headerに隠れない位置へ詳細cardをscroll表示します。`lat` / `lng` queryの共有URLは指定地点をzoom 13で中央表示します。施設詳細の「地図上の位置を見る」は`track` queryで対象施設を選択し、「この施設を基準に周辺を比較」は施設座標を`lat` / `lng`検索基準として渡します。両方とも`#track-map-section`へ直接scroll・focusし、地図操作から開始できます。`track`で明示された施設は、選択日に利用不可で通常filterから外れる場合も位置と詳細を表示します。検索専用ガイドは `/tracks/guide`（英語版 `/en/tracks/guide`）です。

正式URLは `https://itsrun.info` です。sitemap、canonical、日英hreflang、OGP、About、Privacyを備え、PreviewとProduction CloudFront default domainはnoindexにします。記録集には田中希実選手と三浦龍司選手の2020年以降の大会結果を掲載しています。GA4は正式domain上で利用者が同意した後だけ読み込み、現在地座標は送信しません。ProductionではGoogle CMPを伴うAdSenseを有効化し、Previewは広告なしを維持します。公開後の管理画面・配信層の確認は [`../docs/PUBLIC_LAUNCH.md`](../docs/PUBLIC_LAUNCH.md) を参照してください。

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
npm run validate:track-batches
npm run validate:tracks
npm run test:smoke
npm run test:smoke:preview
```

`master`向けPull RequestではGitHub Actionsの `Node 24 validation` が、`npm ci`、候補batch検証、Track Dataset検証、unit test、lint/type check、buildを同じ順序で実行します。CIはcommit済みavailability baselineを使用し、live collectorやAWS credentialsを必要としません。

`collect:availability:range` は東京の当日から31日分を `src/data/availability/manifest.json` と日別JSONへ生成します。同一HTML/PDFをcacheし、日数分の重複fetchやPDF抽出を避けます。単日debug用 `npm run collect:availability -- --date YYYY-MM-DD` も維持しています。現在23施設を安全な自動判定対象とし、取得不能・予定未公開・期限切れ・形式変更は利用不可にせず「要確認」へ降格します。通常のbuild/devは外部sourceへアクセスしません。詳細は [`../docs/AVAILABILITY.md`](../docs/AVAILABILITY.md) を参照してください。

`npm run build` はsitemapと施設詳細ページ用の静的HTML shellも生成します。`test:smoke` は `npm run preview` が `http://127.0.0.1:4173` で起動していることを前提にします。Track Datasetのschema、raw OSM (`../data/osm/tracks.json`、`expansion-candidates.json`、`coverage-followup-2026-08.json`) と公開データの役割、調査・更新手順、既知の制限、ODbL/JAAF/OSM tileの注意点は [`../docs/TRACK_DATA.md`](../docs/TRACK_DATA.md) を参照してください。33施設時点の調査は [`dataset-expansion-report.md`](../research/track-expansion/dataset-expansion-report.md)、51候補への品質優先の追補は [`phase2-expansion-report.md`](../research/track-expansion/phase2-expansion-report.md)、全候補の遡及監査と50施設への補正は [`current-51-audit.md`](../research/track-expansion/current-51-audit.md)、以後の追加判断は [`batches/`](../research/track-expansion/batches/) にあります。

施設を追加・再調査するときは、候補発見、公式source、属性別evidence、個人利用status、availability分類、collector判定、review手順を定めた [`../docs/TRACK_EXPANSION_PLAYBOOK.md`](../docs/TRACK_EXPANSION_PLAYBOOK.md) に従ってください。初期施設も例外にせず、確認できない値は推測せずunknownを維持します。

## AWSプレビュー環境

AWS CDKが、公開アクセスを遮断したS3バケットとOrigin Access Control付きCloudFront Distributionを作成します。独自ドメインやRoute 53は構成しません。

本番domain `itsrun.info` はRoute 53のA/AAAA Aliasから、Previewとは別のProduction CloudFrontで配信します。旧Firebase HostingはDNS rollback確認期間のため残しています。DNS、certificate、CloudFront、移行記録とrollback項目は [`../docs/PRODUCTION_DOMAIN.md`](../docs/PRODUCTION_DOMAIN.md) を参照してください。

```sh
npm run infra:synth
npm run infra:deploy
```

デプロイ後のURLは `cdk-outputs.json` の `VerificationUrl` で確認できます。プレビュー環境を削除する場合は `npm run infra:destroy` を実行します。

GitHub Actionsはmaster push、手動実行、毎日05:00 JSTにfresh availabilityを生成し、既存Previewへcontent-only deployします。GitHub OIDCの専用role、cache metadata、targeted invalidation、concurrency、failure handlingは [`../docs/PREVIEW_DEPLOYMENT.md`](../docs/PREVIEW_DEPLOYMENT.md) を参照してください。通常deployでCDK hosting stackは更新しません。

Preview workflowは `VITE_DEPLOY_TARGET=preview` と `VITE_ADSENSE_ENABLED=false` を使用します。Production workflowだけが `VITE_ADSENSE_ENABLED=true` で、アクセス解析の選択後に全route共通のAdSenseタグを読み込みます。広告・Cookieの選択はGoogle CMP、アクセス解析の選択はサイト内UIがそれぞれ担当し、両画面は同時に表示しません。

## AWS本番環境

ProductionはPreviewとは別の、versioning・retain有効のprivate S3 + CloudFrontとして段階的に構築します。最初はCloudFront default domainでnoindex・GA4無効の確認を行い、Route 53へ既存DNS recordを複製・委任してから`us-east-1` ACM certificateとCloudFrontの`itsrun.info` alternate domainを追加します。最後に旧Firebase Aを先に削除せず、Route 53のA/AAAAをCloudFront Aliasへ原子的に切り替えます。

Production workflowはfresh availabilityと全検証を実行してcontentだけを配備し、Google CMPを伴うAdSenseを読み込みます。コマンド、OIDC role、GitHub variables、DNS切替、旧Firebaseへのrollbackは [`../docs/PRODUCTION_DEPLOYMENT.md`](../docs/PRODUCTION_DEPLOYMENT.md) を参照してください。

GA4は正式domainでアクセス解析へ同意した場合だけ読み込みます。Track Searchの操作event、privacy boundary、GA4管理画面で登録するcustom dimension/key event候補は [`../docs/ANALYTICS.md`](../docs/ANALYTICS.md) を参照してください。緯度・経度、住所、自由入力文字列は送信しません。

`public/service-worker.js`は旧Firebase版のoffline cacheを削除して登録解除する移行専用ファイルです。新サイトのoffline cacheではありません。既存利用者を旧画面に残さないため、移行期間中は`no-cache`で配備します。
