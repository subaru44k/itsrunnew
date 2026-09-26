# ItsRun

ItsRun の静的Webサイトです。Vue 3、TypeScript、Vite、Pinia、Vuetify 4で構成し、Firebase・schedule backendには接続しません。匿名の現地レポートのみ独立したAWS APIへ接続します。競技場スケジュールは日付をブラウザ内で生成し、各時間帯を「情報なし」として表示します。

ホーム `/`（英語版 `/en/`）では、東京・埼玉・神奈川・千葉・大阪・兵庫・京都・広島・山口・愛知・福岡の検証済み133施設をOpenStreetMap上から探せます。従来の `/tracks` と `/en/tracks` は日付queryを維持してホームへ移動します。各施設には共有可能な `/tracks/:trackId`（英語版 `/en/tracks/:trackId`）詳細ページがあり、織田フィールドは `/tracks/yoyogi-park-athletic-track` に統合しています。旧 `/oda-field` と英語版は、日付queryを維持して対応する施設詳細へ転送します。PC・スマホのメニューとホームの利用情報リンクも統合先へ案内します。施設詳細には工事案内、アクセス、工事前の使用感を保持します。現在地または地図上で指定した地点からの直線距離、今日から31日分の日付指定availability、利用不可表示switch、公式情報、API key不要のGoogle Maps経路リンクを提供します。通常表示は利用可能・一部利用可能・要確認を残し、選択日に明示的な利用不可だけを除外します。施設データと日付別availabilityは分離し、ブラウザからJAAF・Overpass・施設サイトへ検索リクエストは送りません。

施設詳細では、施設名と住所の直後に日付選択・利用状況・確認済み時間帯と公式予定へのリンクをまとめています。利用不可または要確認の日には、選択日を保ったまま施設周辺をホームの地図で探せます。「要確認」は利用不可を意味しません。

地図の初期表示は新宿周辺の表示例（zoom 13）です。「掲載エリア全体を見る」で全掲載施設が収まる範囲を画面幅から自動計算します。検索の基準地点は「現在地」と「地図上で指定」を同じUI・markerで扱います。基準地点がない一覧は都道府県別、設定後は距離順で12件ずつ表示し、広域地図では近接markerをcluster化します。単一markerの選択時は地図を施設へ寄せたうえで、固定headerに隠れない位置へ詳細cardをscroll表示します。`lat` / `lng` queryの共有URLは指定地点をzoom 13で中央表示します。施設詳細の「この施設と周辺を地図で見る」は、選択日を維持し、`track` queryで対象施設を選択するとともに、施設座標を`lat` / `lng`検索基準として渡します。`#track-map-section`へ直接scroll・focusし、施設の位置と周辺検索を一度に確認できます。`track`で明示された施設は、選択日に利用不可で通常filterから外れる場合も位置と詳細を表示します。検索専用ガイドは `/tracks/guide`（英語版 `/en/tracks/guide`）です。

正式URLは `https://itsrun.info` です。sitemap、canonical、日英hreflang、OGP、About、Privacyを備え、PreviewとProduction CloudFront default domainはnoindexにします。記録集には田中希実選手と三浦龍司選手の2020年以降の大会結果を掲載しています。GA4は正式domain上で利用者が同意した後だけ読み込み、現在地座標は送信しません。ProductionではGoogle CMPを伴うAdSenseを有効化し、Previewは広告なしを維持します。公開後の管理画面・配信層の確認は [`../docs/PUBLIC_LAUNCH.md`](../docs/PUBLIC_LAUNCH.md) を参照してください。

開発者・エージェント向けの全体構造は [`../docs/SITE_STRUCTURE.md`](../docs/SITE_STRUCTURE.md) を参照してください。

## ローカル実行

Node.js 22.13.0 以上とnpmが必要です。AI資料のPDFを画像化するcollectorにはPopplerの `pdfinfo` / `pdftoppm` が必要です（macOS: `brew install poppler`、Ubuntu: `sudo apt-get install poppler-utils`）。通常のbuildは外部sourceを取得しません。

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
npm run test:pace
```

`master`向けPull RequestではGitHub Actionsの `Node 24 validation` が、`npm ci`、候補batch検証、Track Dataset検証、unit test、lint/type check、buildを同じ順序で実行します。続けてdaily fixturesとlive daily gateも実行します。CIはrepository secretをAIへ渡さず、cache missのAI施設はunknownになるため、外部AI推論のfreshnessを証明しません。trusted deployとmasterの有効化済み収集監視だけがcollection stepへ`OPENAI_API_KEY`を渡します。 外部sourceへのnetwork、Poppler、Python 3（監視メールのmock検証）が必要ですが、CI検証にAWS credentialsやSMTP secretsは不要です。

`collect:availability:range` は東京の当日から31日分を `src/data/availability/manifest.json` と日別JSONへ生成します。`public/availability` を通じて安定したJSON URLで公開し、日次更新だけではアプリJSや全ページのHTML shellを変えません。ブラウザはmanifestを待たずに画面を起動し、選択日のJSONを並行取得します。同じ日付のデータは画面間で短時間再利用し、開いたままのタブでも後の画面操作でmanifestを再確認し、更新分を取り直します。同一HTML/PDF、月次JSON、WordPress noticeをcacheし、日数分の重複fetchやPDF抽出を避けます。単日debug用 `npm run collect:availability -- --date YYYY-MM-DD` も維持しています。133施設を掲載し、そのうちlegacy 33施設＋追加10施設（Luna AI 8施設、決定論的個人利用ICS 2施設）の43施設を安全な自動判定対象とします。これは毎日のpositive件数ではなく、対象日を判定できる実装数です。取得不能・予定未公開・期限切れ・形式変更・AIのkeyless cache missは利用不可にせず「要確認」へ降格します。AIは知多・平塚・荻野を`gpt-6-luna` `low`、等々力・維新補助を`gpt-6-luna` `medium`、残る3施設を`gpt-5.6-luna` `none`で読みます。施設ごとに公式資料一式を1回入力します。公式資料は順番に取得し、AI読取は最大3件まで同時に実行して結果を施設順に戻します。読取結果は`.cache/availability-ai`（`ITSRUN_AI_CACHE_DIR`で変更）へcacheします。source/prompt/model/effort/schema/対象月全日付がcache keyに含まれ、runtimeにAstraはありません。比較根拠は [`../research/availability/luna-feasibility/gpt6-effort-and-routing-2026-09-24.md`](../research/availability/luna-feasibility/gpt6-effort-and-routing-2026-09-24.md)、内訳と各sourceの意味は [`../docs/AVAILABILITY.md`](../docs/AVAILABILITY.md)、[`../research/availability/ai-adoption-2026-09.json`](../research/availability/ai-adoption-2026-09.json)、[`../research/availability/ai-collector-integration-2026-09.md`](../research/availability/ai-collector-integration-2026-09.md) を参照してください。通常のbuild/devは外部sourceへアクセスしません。

`npm run build` はsitemapと日英の全固定ページ・施設詳細ページ用の静的HTML shellも生成します。`test:smoke` は `npm run preview` が `http://127.0.0.1:4173` で起動していることを前提にします。Track Datasetのschema、raw OSM (`../data/osm/tracks.json`、`expansion-candidates.json`、`coverage-followup-2026-08.json`) と公開データの役割、調査・更新手順、既知の制限、ODbL/JAAF/OSM tileの注意点は [`../docs/TRACK_DATA.md`](../docs/TRACK_DATA.md) を参照してください。33施設時点の調査は [`dataset-expansion-report.md`](../research/track-expansion/dataset-expansion-report.md)、51候補への品質優先の追補は [`phase2-expansion-report.md`](../research/track-expansion/phase2-expansion-report.md)、全候補の遡及監査と50施設への補正は [`current-51-audit.md`](../research/track-expansion/current-51-audit.md)、以後の追加判断は [`batches/`](../research/track-expansion/batches/) にあります。

施設を追加・再調査するときは、候補発見、公式source、属性別evidence、個人利用status、availability分類、collector判定、review手順を定めた [`../docs/TRACK_EXPANSION_PLAYBOOK.md`](../docs/TRACK_EXPANSION_PLAYBOOK.md) に従ってください。初期施設も例外にせず、確認できない値は推測せずunknownを維持します。

## 地図のローカル確認

検索地図はLeaflet + OpenStreetMapを使用します。APIキーや地図配信方式の環境設定は不要です。任意で`.env.example`をGit管理外の`.env.local`へコピーし、`VITE_ADSENSE_ENABLED=false`でローカル広告を無効化できます。本番workflowの広告設定は独立しています。

従来の背景・縮尺・クラスタリングを維持し、検索後も使える全域表示、44pxのmarker buttonとkeyboard操作、地図読み込み失敗時の再試行を提供します。地図が失敗しても施設一覧・日付検索・距離順を使えます。OSMの帰属表示を維持してください。

`src/components/TrackMap.vue`が地図の初期化・再試行・resizeを、`src/components/map/leaflet.ts`が描画を担当します。Leafletは遅延loadし、日付・言語変更では地図を再生成しません。

`npm run build`後に`npm run preview -- --host 127.0.0.1 --port 4173`で確認します。`npm run test:smoke`で公開機能を、`npm run test:visual`で従来ページの表示を検証します。検索地図は`npm run test:map`で旧版4172・新版4173を比較します（`ITSRUN_OLD_URL` / `ITSRUN_NEW_URL`で変更可）。帰属、keyboard操作、日付・言語切替、tile通信403からの復帰を確認し、画像と計測JSONを`/tmp/itsrun-map-comparison`（`ITSRUN_MAP_OUTPUT`で変更可）へ出力します。初期表示時間は同意ボタン操作と800msの待機を含む単発の参考値で、厳密な速度比較には使いません。

## マラソンペース表のローカル確認

`/pace/marathon`（英語版 `/en/pace/marathon`）で、目標タイムまたは1kmペースから個人用の通過表と400m・1km・5km・10kmの練習時間を計算できます。既存の比較表は下部の折りたたみから利用できます。最後の設定はブラウザ内に保存し、共有リンクの有効な `goal` / `pace` query（秒）があれば優先します。「設定をリセット」で保存値と計算用queryを削除します。画像保存はブラウザ内でPNGを生成し、サーバーや追加依存を使いません。

`VITE_ADSENSE_ENABLED=false npm run build` 後、`npm run preview -- --host 127.0.0.1 --port 4173` を起動し、`npm run test:pace` で入力・復元・共有・画像保存・日英PC/スマホを確認します。`ITSRUN_BASE_URL` / `CHROME_PATH`で接続先・Chromeを変更できます。スクリーンショットとPNGは `/tmp/itsrun-pace-check` に保存します（`ITSRUN_PACE_OUTPUT`で変更可）。この手順はローカル確認のみでデプロイしません。

## AWSプレビュー環境

AWS CDKが、公開アクセスを遮断したS3バケットとOrigin Access Control付きCloudFront Distributionを作成します。独自ドメインやRoute 53は構成しません。

本番domain `itsrun.info` はRoute 53のA/AAAA Aliasから、Previewとは別のProduction CloudFrontで配信します。旧Firebase HostingはDNS rollback確認期間のため残しています。DNS、certificate、CloudFront、移行記録とrollback項目は [`../docs/PRODUCTION_DOMAIN.md`](../docs/PRODUCTION_DOMAIN.md) を参照してください。

```sh
npm run infra:synth
npm run infra:deploy
```

デプロイ後のURLは `cdk-outputs.json` の `VerificationUrl` で確認できます。プレビュー環境を削除する場合は `npm run infra:destroy` を実行します。

GitHub Actionsはmaster push、手動実行、毎日05:00 JSTにfresh availabilityを生成し、既存Previewへcontent-only deployします。前回成功時の生成物SHA-256との差分だけS3へ反映し、変更URLだけをCloudFrontで無効化します。差分なしなら無効化せず、公開ページとService Workerの本文を配備後に照合します。GitHub OIDCの専用role、cache metadata、concurrency、failure handlingは [`../docs/PREVIEW_DEPLOYMENT.md`](../docs/PREVIEW_DEPLOYMENT.md) を参照してください。`infra:deploy`はhosting基盤のみ更新し、contentは別途deployします。

Preview workflowは `VITE_DEPLOY_TARGET=preview` と `VITE_ADSENSE_ENABLED=false` を使用します。Production workflowだけが `VITE_ADSENSE_ENABLED=true` で、アクセス解析の選択後に全route共通のAdSenseタグを読み込みます。広告・Cookieの選択はGoogle CMP、アクセス解析の選択はサイト内UIがそれぞれ担当し、両画面は同時に表示しません。

## AWS本番環境

ProductionはPreviewとは別の、versioning・retain有効のprivate S3 + CloudFrontとして段階的に構築します。最初はCloudFront default domainでnoindex・GA4無効の確認を行い、Route 53へ既存DNS recordを複製・委任してから`us-east-1` ACM certificateとCloudFrontの`itsrun.info` alternate domainを追加します。最後に旧Firebase Aを先に削除せず、Route 53のA/AAAAをCloudFront Aliasへ原子的に切り替えます。

Production workflowは毎日05:30 JSTと08:15 JSTにfresh availabilityと全検証を実行してcontentだけを配備し、Google CMPを伴うAdSenseを読み込みます。trusted collection stepだけがrepository secret `OPENAI_API_KEY`を使用し、キャッシュがない場合や資料・指示などの入力が変わった場合にLunaへ再推論します。コマンド、OIDC role、GitHub variables、DNS切替、旧Firebaseへのrollbackは [`../docs/PRODUCTION_DEPLOYMENT.md`](../docs/PRODUCTION_DEPLOYMENT.md) を参照してください。

GA4は正式domainでアクセス解析へ同意した場合だけ読み込みます。Track Searchの操作event、privacy boundary、GA4管理画面で登録するcustom dimension/key event候補は [`../docs/ANALYTICS.md`](../docs/ANALYTICS.md) を参照してください。緯度・経度、住所、自由入力文字列は送信しません。

`public/service-worker.js`は旧Firebase版のoffline cacheを削除して登録解除する移行専用ファイルです。新サイトのoffline cacheではありません。既存利用者を旧画面に残さないため、移行期間中は`no-cache`で配備します。

## 現地確認レポート

施設詳細に匿名の利用結果3択＋任意200文字コメントを追加しています。公式availabilityを変更せず、日本時間の今日だけ投稿できます。共有データのため、静的フロントエンドとは別にAPI Gateway / Lambda / DynamoDBを使います。

`npm run reports:install`でAPI依存を準備し、`npm run reports:synth -- -c environment=preview`、`npm run reports:deploy -- -c environment=preview`で独立stackを配備します。出力API URLを`VITE_FIELD_REPORTS_API`へ設定してbuildします。未設定では投稿を無効化します。Productionは別stack・別データです。既存schedule backendは追加しません。

単体テストは`npm test`、起動済みPreviewの機能検証は`npm run test:reports`。制限、保存期間、モデレーション、GitHub変数と配備手順は[FIELD_REPORTS.md](../docs/FIELD_REPORTS.md)を参照してください。

## AvailabilityのAI読解調査

availabilityのAI読解を人手で評価するローカル入力画面は、リポジトリルートから `python3 research/availability/luna-feasibility/annotator.py` で起動します。`http://127.0.0.1:8766` で保存資料を見ながら判定を入力し、既存の判定表へ保存できます。Python 3標準ライブラリのみで動き、APIキーは不要です。公開アプリのbuild・配備対象には含みません。使い方と検証は[調査README](../research/availability/luna-feasibility/README.md)を参照してください。

## 各変更時のdaily更新検証

通常のunit・lint・buildに加え、`npm run test:daily:fixtures` と `npm run test:daily` を実行します。前者は4status・戸田が利用不可の日と全施設unknownの回帰検証、後者は公式sourceの実収集・当日31日分の鮮度と完全性・build・PC/スマホsmokeです。両方とも一時workspaceを使い、checkoutのデータ・distは変更せず、AWSへ配備しません。Node 24、インストール済み依存、Chromeが必要です（Linuxは`CHROME_PATH=/usr/bin/google-chrome`）。PR/masterの`Node 24 validation`でも両方を必須実行します。

日次deployは`validate:availability:fresh`を収集直後に実行し、古い・不完全なデータや合成fixtureの公開を拒否します。失敗調査と公開後の確認手順は[DAILY_VERIFICATION.md](../docs/DAILY_VERIFICATION.md)を参照してください。

### 正規URLの検証

日付未指定のホームURLはそのまま今日を表示します。通常の施設リンクはqueryなしのhrefを持ち、通常クリックでは選択済みの日付・地点を引き継ぎます。条件込みの共有は遷移後のアドレスバーURLで行えます。`test:smoke`は日英・PC/スマホで正規href、日付自動付与なし、未来日・地点の引継ぎと再読込を検証します。

固定ページのmetadataは`src/data/page-metadata.json`からrouterと全固定ページのHTML shellへ供給します。Productionの固定ページrewriteを変更する場合は、contentを先に配備してから、既存domain・certificateを維持したRouteFunctionのみのCDK更新を行います。詳細は[`PRODUCTION_DEPLOYMENT.md`](../docs/PRODUCTION_DEPLOYMENT.md)を参照してください。

## Availabilityの公開方式変更を検知する監視

`npm run monitor:availability` で当日31日分を独立収集し、施設別の状態・unknown理由・source証跡を一時ディレクトリへ保存します。`--previous /path/to/state.json --output /path/to/output` で同じ対象日の変化を比較できます。ローカル実行はメール・配備・公開データ更新を行いません。

GitHub Actionsの `Availability monitor` は毎日09:30 JSTに取得/解析異常、判定日数の減少、Production更新停止を検知し、新規・変化・復旧だけGmailから通知します。Secrets `AVAILABILITY_SMTP_USER`、`AVAILABILITY_SMTP_APP_PASSWORD`、`AVAILABILITY_ALERT_TO` とvariable `AVAILABILITY_MONITOR_ENABLED=true` が必要です。状態はメール成功後にartifactへ保存し、同じ施設障害の繰り返し通知を抑えます。Python 3標準ライブラリとGitHub CLIを使用し、`npm run test:monitor:email` は実送信なしで送信処理を検証します。設定・監視範囲・障害復旧と残る制限は [AVAILABILITY_MONITORING.md](../docs/AVAILABILITY_MONITORING.md) を参照してください。

## 静的施設情報の自動再確認

`Facility reverification` workflowは毎週日曜11:15 JSTに登録済みの公式施設・個人利用資料を取得し、本文変更、redirect、期限到来を確認します。新しい公式資料の検索は各施設につき365日ごとに行い、1回の実行では最大20施設です。確認には `gpt-6-luna` の `xhigh` を使います。確定値を変更する場合は原文引用・属性型・独立した再判定を通過した差分だけをPRへ入れ、`Node 24 validation`成功後に自動マージします。全ての既知資料を28日間読めない場合は個人利用statusを `unknown` に下げます。facility ID、名称、座標、日別availabilityはこのworkflowで自動変更しません。

workflowには既存の `OPENAI_API_KEY` に加え、このrepositoryだけにインストールしたGitHub Appの `REVERIFICATION_APP_CLIENT_ID` と `REVERIFICATION_APP_PRIVATE_KEY` secrets、およびrepositoryのauto-merge設定が必要です。GitHub Appへはrepository Contents・Pull requestsのwriteだけを付与します。source fingerprintと暦年の保守的なAPI費推計は `automation/facility-reverification-state` branchで保持し、推計$4.80に達した年は新たなAI確認を止めて未処理対象を繰り越します。reportはActions summaryと90日保持のartifactに残します。2026-09-26の133施設試走、検索料の実測と年間見積もりは[初回試走レポート](../research/track-expansion/reverification-initial-trial-2026-09-26.md)を参照してください。

外部APIを使わないローカルの回帰検証は `npm run test:reverification`。APIキーを環境変数へ設定した上で `python3 scripts/reverification/trial.py --output .cache/reverification/new-trial.json` を実行すると、公開データを変更せず133施設を再試走できます。既存のoutputを指定すると完了分は再利用されます。
