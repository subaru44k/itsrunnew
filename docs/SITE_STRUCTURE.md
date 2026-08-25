# ItsRun サイト構造

この文書は、新しい作業セッションがコード全体を最初から調査せずに、サイトの構造・責務・制約を把握するための基準資料です。実装を変更したときは、ルートの [`AGENTS.md`](../AGENTS.md) の指示に従ってこの文書も更新してください。

## 1. リポジトリとアプリケーションルート

Gitリポジトリのルートはこの文書の親ディレクトリです。実際のWebアプリとCDKコードは `itsrunnew/` 以下にあります。npm、Vite、テスト、CDKの各コマンドは原則として `itsrunnew/` で実行します。

主要技術は次のとおりです。

- Vue 3.5 + Composition API + TypeScript
- Vite 7
- Vuetify 4 + Material Design Icons
- Vue Router 4
- Pinia 3
- Vue I18n 11
- Day.js
- Leaflet 1.9 + OpenStreetMap tiles
- PDF.js (`pdfjs-dist`) 6（availability collectorの座標付き文字抽出。ブラウザbundleには含めない）
- VitestおよびPlaywright Core
- AWS CDK 2（S3 + CloudFrontの検証環境）

開発・build・collector実行には Node.js 22.13.0 以上とnpmを使用します。

Firebase SDK、データベース、認証、APIサーバーはありません。生成物は静的ファイルだけです。

## 2. 実行時の全体像

```text
index.html
  -> src/main.ts
     -> Pinia / Vue I18n / Vuetify / Vue Routerを登録
     -> src/App.vue（全ページ共通のヘッダー、ナビゲーション、フッター）
        -> src/router.ts
           -> src/views/*.vue
              -> src/components/*
                 -> src/store.ts または src/model/*
```

`src/main.ts` が唯一のブラウザエントリーポイントです。グローバルCSSは `src/styles.css`、VuetifyのテーマとMDI設定は `src/plugins/vuetify.ts`、翻訳初期化は `src/i18n.ts` が担当します。

## 3. ディレクトリと責務

```text
itsrunnew/
├── index.html                 ViteのHTMLエントリー、メタ情報、アクセス解析タグ
├── package.json               依存関係と開発・検証・デプロイコマンド
├── vite.config.ts             Vue/Vuetifyプラグイン、@エイリアス、ビルド対象
├── src/
│   ├── main.ts                Vueアプリの起動
│   ├── App.vue                共通シェル、メニュー、言語切替、フッター
│   ├── router.ts              全ルート、SEOメタ情報、言語、ハッシュスクロール
│   ├── store.ts               Pinia状態、日付生成、情報なしスケジュール、ペース選択
│   ├── data/tracks.json       公式情報で検証済みの公開用Track Dataset
│   ├── data/availability.json 単日debug・後方互換用availability dataset
│   ├── data/availability/    manifestと今日から31日分のdate-specific JSON
│   ├── styles.css             全体CSSと旧サイト再現用のVuetify 4補正
│   ├── i18n.ts                日本語・英語のVue I18n設定
│   ├── locales/               ja.json / en.json
│   ├── views/                 ルート単位のページ
│   ├── components/
│   │   ├── AdsDisplay.vue     共通広告serviceの準備後に表示するAdSenseスロット
│   │   ├── PrivacyConsent.vue GA4へのアクセス解析同意
│   │   ├── schedule/          週間表、ページ送り、状態アイコン
│   │   └── laptime/           PC・スマホ用マラソンペース表
│   ├── model/                 ペース表の計算モデル、トラック型・距離・経路URL
│   ├── services/              同意状態、GA4の遅延loadと同意済みevent
│   └── plugins/vuetify.ts     Vuetifyテーマとアイコン設定
├── public/                    favicon、manifest、robots、ads.txt、状態画像
├── scripts/
│   ├── smoke.mjs              公開機能のブラウザスモークテスト
│   ├── smoke-preview.mjs      Vite Previewの起動・終了を含むsmoke wrapper
│   ├── deploy-preview.sh      Preview対象をguardしたS3 syncとinvalidation
│   ├── deploy-production.sh   Production対象をguardしたS3 syncとinvalidation
│   ├── deployment-summary.mjs GitHub Actions run summary生成
│   ├── deployment.test.ts     workflow/deploy contract test
│   ├── validate-tracks.mjs    raw OSMと公開Track Datasetの整合検証
│   ├── availability/          HTML/calendar/fixed/PDF collector、range/cache、config、fixture、unit test
│   └── visual-compare.mjs     広告なし旧版との全画面比較
└── infra/
    ├── app.ts                              hosting CDKアプリのエントリー
    ├── itsrun-preview-stack.ts             S3、CloudFront、静的ファイル配備
    ├── automation-app.ts                   deploy role専用CDKエントリー
    ├── itsrun-preview-automation-stack.ts  master限定Preview GitHub OIDC role
    ├── itsrun-production-stack.ts          retained S3、CloudFront、route/404、任意の正式domain
    ├── itsrun-production-dns-stack.ts      Route 53 public Hosted Zone
    ├── itsrun-production-certificate-stack.ts us-east-1 ACM certificate
    └── itsrun-production-automation-stack.ts master限定Production GitHub OIDC role

data/osm/
├── tracks.json                    初期範囲のOverpass raw research data
└── expansion-candidates.json      拡張範囲で選別・clusterしたOSM/Nominatim evidence

research/
├── availability/
│   ├── availability-sources.json  Track Dataset全33施設のavailability source調査データ
│   ├── availability-research.md   「今日利用可能」機能の調査と拡張追補
│   ├── pdf-collector-validation.md PDF collectorのlive比較・format・coverage
│   └── html-calendar-collector-validation.md HTML/calendar/fixed拡張9施設のlive比較・coverage
└── track-expansion/
    └── dataset-expansion-report.md 33施設時点のcoverage・PDF・pipeline評価

.github/workflows/
├── node-validation.yml          master向けPRとmaster pushのNode 24検証
├── deploy-preview.yml           master push・手動・日次のPreview content deploy
└── deploy-production.yml        variableでguardしたmaster・手動・日次Production deploy
```

`dist/`、`cdk.out/`、`cdk-outputs.json`は生成物であり、実装の正本ではありません。

## 4. 共通レイアウトとナビゲーション

`src/App.vue`には次の共通UIがあります。

- PCではアプリバー内のドロップダウンメニュー、スマートフォンでは一時表示のナビゲーションドロワー。
- 東京都の競技場、神奈川県の競技場、ラップタイム、記録集へのメニュー。
- サイト名と「トラックを探す」はTrack Searchホームへ、東京都メニューの「織田フィールド」は専用ページへ遷移する。
- 日本語と英語を現在のパスを維持して切り替えるボタン。
- `router-view`で描画される本文。
- 要望送付先と著作権表示を含む、旧サイトと同じ2段構成のフッター。

旧Vuetifyサイトとの見た目を維持するため、`src/styles.css`が文字サイズ、行間、段落余白、コンテナ幅、余白ユーティリティ、フッター寸法を補正しています。通常のVuetify 4既定値へ無条件に戻さないでください。

## 5. 公開ルート

ルートの正本は `src/router.ts` の `pages` です。各ページは日本語パスと、同じ末尾に `/en/` を付けた英語パスを持ちます。

| 日本語 | 英語 | View | 用途 |
|---|---|---|---|
| `/` | `/en/` | `TrackSearch.vue` | 陸上トラック検索（ホーム） |
| `/tracks` | `/en/tracks` | redirect | queryを維持してTrack Searchホームへ移動する互換URL |
| `/oda-field` | `/en/oda-field` | `OdaField.vue` | 織田フィールド |
| `/yumenoshima` | `/en/yumenoshima` | `Yumenoshima.vue` | 夢の島陸上競技場 |
| `/komazawa` | `/en/komazawa` | `Komazawa.vue` | 駒沢オリンピック公園陸上競技場 |
| `/todoroki` | `/en/todoroki` | `Todoroki.vue` | 等々力陸上競技場 |
| `/pace/marathon` | `/en/pace/marathon` | `LapTime.vue` | マラソンのペース表 |
| `/nozomiantena/index` | `/en/nozomiantena/index` | `NozomiAntena.vue` | 田中希実選手の記録集 |
| `/about` | `/en/about` | `About.vue` | 掲載範囲、状態表示、公式情報と訂正窓口 |
| `/privacy` | `/en/privacy` | `Privacy.vue` | GA4、現在地、広告、外部サービスの取扱い |

`/tracks` と `/en/tracks` は日付queryを維持して `/` と `/en/` へ移動します。互換リダイレクトは `/index.html` → `/`、`/komazawa_olympic` → `/komazawa`、削除済み `/manage` → `/` です。それ以外の未知パスは言語に対応した404画面を表示し、robotsをnoindexにします。CloudFrontのSPA fallbackではHTTP status自体は200のため、正式公開時のedge 301/404は [`PUBLIC_LAUNCH.md`](PUBLIC_LAUNCH.md) の残作業です。

ルート遷移時に `router.beforeEach` が言語、`document.title`、description、robots、canonical、日英hreflang、OGP/Twitter metadataを更新します。canonicalは `https://itsrun.info` を正本とし、日付queryを含めません。共通HTMLにはfavicon、apple-touch-icon、theme color、共有OGP画像を持ち、`public/sitemap.xml`はcanonical 18 URLだけを掲載します。Preview workflowはbuild時に `VITE_DEPLOY_TARGET=preview` を渡し、初期HTMLとroute遷移後をnoindexにします。記録集の `#2021` と `#2020` は実要素のIDであり、`scrollBehavior`が固定ヘッダーを避けてスクロールします。

## 6. ページと機能

### 競技場ページ

`OdaField.vue`、`Yumenoshima.vue`、`Komazawa.vue`、`Todoroki.vue`は同じ基本構造です。

- ページ説明
- `AdsDisplay.vue`による広告スロット
- `Pagination.vue`とPC・スマートフォン別の週間スケジュール表
- 競技場情報、Google Maps iframe、アクセス、連絡先、説明文

競技場固有の文章は主に `src/locales/ja.json` と `en.json` にあります。

### スケジュール

`src/store.ts`が今日を起点に7日間の日付をブラウザ内で生成します。前週・次週ボタンは`weekIndex`だけを変更します。各日には3つの時間帯がありますが、すべて表示値は`00:00`、状態値は`0`（情報なし）です。

データ取得処理は存在しません。`ConditionalStatus.vue`は状態値を公開画像へ変換します。

- `0`: `/img/unknown.svg`（情報なし）
- `1`: 日本語ではcircle、英語ではdone（利用可能）
- `2`: 日本語ではremove、英語ではborder（利用不可）

### マラソンペース表

`LapTime.vue`が目標タイム帯を選び、Piniaの`targetTimeIndex`を更新します。計算は `src/model/`、表示は `components/laptime/PcPaceTable.vue` と `PhonePaceTable.vue` が担当します。

### 記録集

`NozomiAntena.vue`は大会記録を静的HTMLテーブルとして保持します。2021年・2020年の年別アンカーもこのファイルにあります。本文は翻訳ファイルではなく、現状は日本語で直接記述されています。

### 陸上トラック検索

`TrackSearch.vue` は日本語・英語のホームであり、従来の `/tracks` と `/en/tracks` からもaliasとして表示します。Leafletと標準OpenStreetMap tilesで地図を表示し、`src/data/tracks.json` の検証済み施設だけをmarkerと一覧へ描画します。ブラウザのGeolocation APIはユーザー操作時だけ呼び出し、成功時は現在地marker・地図移動・Haversine直線距離順、拒否・取得不能・timeout時は石神井公園中心の地図を維持します。

施設仕様・料金・確認日の詳細、公式案内、API key不要のGoogle Maps Directions URLを提供します。詳細の予定・公式・経路actionはアイコン、明確な文字色、44px以上の押下領域を持ちます。さらに `src/data/availability/manifest.json` と日付別JSONを `src/model/availability-range.ts` / `availability.ts` が対象日・期限込みで遅延loadし、利用可能・一部利用可能・要確認・利用不可のmarker、詳細、施設一覧を表示します。「今日」「明日」「土曜」「日曜」、native date input、`?date=YYYY-MM-DD` URL stateを持ちます。通常は選択日に明示的な利用不可だけを除外してunknownを残し、単一の利用不可表示switchで全施設へ切り替えます。公開UIではcollectorやbuild方式を説明せず、公式情報を基にしたこと、当日変更、要確認は利用不可ではないことだけを短く示します。一覧では要確認理由を短縮し、選択cardを強調して詳細・公式確認・経路へつなぎます。静的な個人利用資格との複合filterや3択dropdownは設けません。routing API、backend、リアルタイムOverpass/JAAF/施設検索はありません。

availabilityは `scripts/availability/collect-range.ts` をbuild前に明示実行し、東京日付の当日から既定31日をmanifest＋日別JSONへ生成します。単日 `collect.ts` も維持します。range内では同一requestをcacheし、月間PDF、landing page、fixed/weekly HTML、PDF text extractionを再利用します。structured HTML 3施設、calendar HTML 3施設、固定規則9施設、PDF 8施設の計23施設を安全な自動判定対象とし、世田谷の不安定な日次導線、府中PDFのvector記号、予約・電話・予定なしsourceは理由付きunknownにします。取得失敗、解析失敗、source変更、対象期間外、予定未公開、期限切れは利用不可ではなくunknownへ降格します。通常のdev/buildは外部sourceへアクセスしません。schema、timezone、日付UI、更新手順は [`AVAILABILITY.md`](AVAILABILITY.md) が正本です。

調査用raw dataはアプリ外の `../data/osm/tracks.json`、拡張時に選別したOSM/Nominatim evidenceは `../data/osm/expansion-candidates.json`、公開用normalized datasetは `src/data/tracks.json` に分離されています。normalized datasetは現在33施設です。候補cluster、一次情報の優先順位、schema、更新手順、ライセンスは [`TRACK_DATA.md`](TRACK_DATA.md) が正本です。`scripts/validate-tracks.mjs` はstable ID、既存12 ID、必須値、座標範囲、source provenance、両raw fileのOSM ID、30〜50件目標、単日および31日manifest全件のavailability trackId/date一致を検証します。

availability source調査は、アプリ外の [`../research/availability/availability-sources.json`](../research/availability/availability-sources.json) に33施設分の公式情報源・公開方式・推論条件を、[`../research/availability/availability-research.md`](../research/availability/availability-research.md) に初回調査と拡張追補を記録しています。dataset/地理/source分布、PDF、future date、pipeline scalabilityは [`../research/track-expansion/dataset-expansion-report.md`](../research/track-expansion/dataset-expansion-report.md) に記録します。research JSONをUIが直接読むことはなく、静的施設データと頻繁に変わるavailability生成物を分離し、取得不能を利用不可と扱わない方針です。

### 広告

`services/advertising.ts`は `VITE_ADSENSE_ENABLED=true` の場合だけ、全route共通でGoogle AdSenseタグを読み込みます。`AdsDisplay.vue`は共通serviceが準備できた後だけ既存広告枠を初期化します。これによりホームのTrack SearchでもGoogle CMPとAdSense Auto adsを利用でき、一部の旧施設ページには従来の明示的な広告枠も残ります。現在はPreview・Production workflowとも明示的にfalseで、広告スクリプトも広告枠も読み込みません。`ads.txt`とpublisher IDは再開に備えて維持します。AdSense管理画面で`itsrun.info`の確認とGoogle CMPの設定・公開は完了しています。

### プライバシーとアクセス解析

`PrivacyConsent.vue`はアクセス解析だけの選択肢を初回に日本語・英語で表示し、同意状態をlocalStorageへ保存します。拒否してもサイト機能は変わらず、フッターから再設定できます。広告を再開したbuildでは、解析への同意・拒否のどちらかが選ばれた後にAdSenseタグを初期化するため、サイト独自の解析画面とGoogle CMPを同時に重ねません。広告の選択はGoogle CMPへ分離し、フッターの「プライバシーとCookieの設定」からGoogle公式のrevocation flowを開けます。Google CMP側の「analytics purposes」はサイト独自の解析同意と二重管理にしないためOFFを維持します。

`services/analytics.ts`は正式buildかつbrowser originが`https://itsrun.info`の場合に、サイト内で同意した後だけGA4 `G-YNLS7KQXYW`を読み込み、広告関連storageはdeniedのままにします。PreviewおよびProduction CloudFront default domainは同意後もGA4を読み込まずnoindexです。page viewはqueryを除いたcanonical path単位とし、Track Searchの主要操作eventを送ります。Geolocationの緯度経度は送信しません。Privacyページは広告停止中であることに加え、再開後にAdSense、Cookie等、パーソナライズ／非パーソナライズ広告、Google CMPを利用する予定と、Googleの関連方針への導線を日英で説明します。

## 7. AWS検証環境

`infra/itsrun-preview-stack.ts`の `ItsRunPreviewStack` が次を作成します。

```text
ブラウザ
  -> CloudFront（HTTPS、圧縮、セキュリティヘッダー）
     -> Origin Access Control
        -> 非公開S3バケット
```

- S3のパブリックアクセスは全面遮断、S3管理暗号化、SSL必須。
- `dist/`をS3へ同期し、削除済みファイルもpruneする。
- デプロイ時にCloudFrontの`/*`を無効化する。
- SPA対応のため、S3由来の403/404を`/index.html`の200へ変換する。
- CDK出力は`VerificationUrl`、`DistributionId`、`BucketName`。
- スタック名は`ItsRunPreviewStack`、既定リージョンは`ap-northeast-1`。
- 独自ドメイン、Route 53、ACM証明書は構成しない。本番ドメインには触れない。

バケットとオブジェクトはスタック削除時に削除される検証用途の設定です。

本番domain `itsrun.info` はRoute 53のA/AAAA Aliasから、Previewとは別のProduction CloudFrontへ配信します。2026-08-25に旧Firebase Hostingから無停止で切り替え、旧FirebaseはDNS rollback確認期間のため残しています。現在のDNS record、certificate、CloudFront、切替記録とrollback方針は [`PRODUCTION_DOMAIN.md`](PRODUCTION_DOMAIN.md) に記録しています。

`ItsRunPreviewAutomationStack` は既存の標準GitHub OIDC providerを参照し、`master` branchの `subaru44k/itsrunnew` workflowだけが引き受けられる `itsrun-track-preview-deploy` roleを作成します。既存migration roleは使用しません。権限はPreview bucketのcontent操作とPreview distributionのread/invalidationに限定し、hosting stackとは独立して管理します。

正式配信用のCDK定義はPreviewと分離しています。`ItsRunProductionStack`はversioningとretainを有効にしたprivate S3、CloudFront OAC、既知routeのSPA rewrite、旧URLのHTTP 301、未知URLの実HTTP 404を定義します。初回はcustom domainなしで作成し、default domainをnoindex・GA4無効のまま検証できます。Route 53委任と`us-east-1` ACM発行後にdomainとcertificate ARNを渡す更新でCloudFrontへ`itsrun.info`を追加し、DNSは旧Firebase AからCloudFront Aliasへ別の原子的changeで切り替えます。旧Aを先に削除しない切替順序・rollback・repository variablesは [`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md) が正本です。Google CMPは設定・公開済みですが、広告は広告枠・mobile CLS・管理画面設定を再確認する別変更までfalseです。

## 8. コマンドと検証

すべて `itsrunnew/` で実行します。

| コマンド | 内容 |
|---|---|
| `npm run dev` | Vite開発サーバー |
| `npm run build` | `vue-tsc --noEmit`後に本番ビルド |
| `npm test` | Pinia、Track Dataset、availability model/collectorの単体テスト |
| `npm run lint` | TypeScript/Vue型検査 |
| `npm run preview` | `dist/`のローカル配信 |
| `npm run test:smoke` | PC・スマホの全公開ルート、フッター、年別アンカー、横幅、Firebase非通信、`/manage`削除を確認 |
| `npm run test:smoke:preview` | Vite Previewを起動して`test:smoke`を実行し、終了時にserverを停止 |
| `npm run test:visual` | 旧版と新版の全6ページをPC・スマホで全画面撮影・寸法比較 |
| `npm run validate:tracks` | 公開Track Datasetのschema/provenanceとraw OSM参照を検証 |
| `npm run collect:availability` | 東京の当日について公式HTML/calendar/fixed rule/PDFを取得し、静的availability JSONを生成 |
| `npm run collect:availability:range` | 東京の当日から31日についてsource cacheを共有し、manifest＋日別availability JSONを生成 |
| `npm run infra:synth` | ビルド後にCloudFormationを生成 |
| `npm run infra:deploy` | ビルドして検証スタックへ配備、`cdk-outputs.json`へ出力 |
| `npm run infra:destroy` | 検証スタックを削除 |
| `npm run deploy:preview:content` | guard後に既存Preview S3へcontent syncし、targeted invalidationを完了まで待機 |
| `npm run deploy:production:content` | Productionのaccount/tag/origin/aliasをguardしてcontent syncとtargeted invalidationを行う |
| `npm run deployment:summary` | availability範囲・status・deploy結果のActions summaryを生成 |
| `npm run infra:automation:synth` | GitHub OIDC deploy role専用stackを生成 |
| `npm run infra:automation:deploy` | hosting stackへ触れずdeploy role専用stackだけを配備 |
| `npm run infra:production:deploy` | retained Production S3/CloudFrontを作成・更新する |
| `npm run infra:production:dns:deploy` | 委任前のProduction Hosted Zoneを作成する |
| `npm run infra:production:certificate:deploy` | 委任済みzoneでus-east-1 certificateを発行する |
| `npm run infra:production:automation:deploy` | Production content-only OIDC roleを作成する |

スモークテストの既定URLは `http://127.0.0.1:4173` です。CloudFront確認時は `ITSRUN_BASE_URL=https://... npm run test:smoke` のように上書きします。Chromeの場所は必要に応じて`CHROME_PATH`で指定します。DNS切替中にOS cacheの影響を除いて正式Host/TLSを確認する場合だけ、`ITSRUN_HOST_RESOLVER_RULE="MAP itsrun.info <CloudFront edge IP>"`をChromeへ渡せます。通常のCI・日次smokeでは指定しません。

`.github/workflows/node-validation.yml` は `master` 向けPull Requestと `master` pushで、`itsrunnew/` をworking directoryとして `npm ci`、Track Dataset検証、unit test、lint/type check、buildをNode 24で実行します。job/check名はbranch protectionと一致する `Node 24 validation` です。commit済みavailability baselineを使うためlive collector、AWS権限、secretsは必要としません。

`.github/workflows/deploy-preview.yml` は `master` push、手動実行、毎日05:00 JSTに、fresh availability生成から検証、build、local smoke、OIDC認証、content-only S3 sync、targeted CloudFront invalidation、CloudFront smokeまでを実行します。deploy concurrencyはPreview全体で1つです。共通処理、least-privilege role、failure境界は [`PREVIEW_DEPLOYMENT.md`](PREVIEW_DEPLOYMENT.md) が正本です。

`.github/workflows/deploy-production.yml`は同じ安全な生成・検証・content-only deployをProduction専用role/targetで行います。`PRODUCTION_DEPLOY_ENABLED=true`になるまで全triggerでskipし、広告はfalseです。master push・手動・毎日05:30 JSTを持ち、Production全体でconcurrencyを1つにします。

正式公開前のSEO、Search Console、GA4、広告停止、Privacy、HTTP redirect/404、運用確認は [`PUBLIC_LAUNCH.md`](PUBLIC_LAUNCH.md) を参照します。

ビジュアル比較は、広告を無効化した旧版が`ITSRUN_OLD_URL`（既定 `http://127.0.0.1:4172`）、新版が`ITSRUN_NEW_URL`（既定 `http://127.0.0.1:4173`）で起動済みであることが前提です。画像は既定で`/tmp/itsrun-visual-comparison`へ出力されます。全画面高の差は100px以内、フッター高の差は1px以内、横方向のはみ出しは1px以内を合格条件としています。

## 9. 変更時の確認先

| 変更内容 | 主な実装 | 同時に確認・更新するもの |
|---|---|---|
| ページやURLの追加・削除 | `src/router.ts`, `src/views/` | `App.vue`のメニュー、locale、smoke、visual、この文書 |
| トラック施設データ | `src/data/tracks.json`, `src/model/tracks.ts` | `TRACK_DATA.md`、validate、unit、smoke、この文書 |
| availability調査・将来の取得方式 | `../research/availability/` | Track Datasetの全ID、公式source、`unknown`の意味、この文書 |
| availability collector・schema・UI | `scripts/availability/`, `src/data/availability.json`, `src/model/availability.ts`, `src/views/TrackSearch.vue` | `AVAILABILITY.md`、unit、smoke、README、この文書 |
| 共通ヘッダー・フッター | `src/App.vue`, `src/styles.css` | locale、smoke、visual、この文書 |
| 競技場ページ | 対応するView、schedule components | locale、公開画像、smoke、visual、この文書 |
| スケジュール挙動 | `src/store.ts`, `components/schedule/` | `store.test.ts`、smoke、Firebase非依存の記述、この文書 |
| ペース計算 | `src/model/`, `components/laptime/` | `store.test.ts`または追加単体テスト、smoke、この文書 |
| 翻訳・言語URL | `src/locales/`, `src/i18n.ts`, `src/router.ts` | `App.vue`、SEOメタ情報、smoke、この文書 |
| 見た目・レスポンシブ | View、components、`src/styles.css` | 広告なしのvisual、PC/スマホsmoke、この文書 |
| 依存・ビルド | `package.json`, lockfile、Vite/TS設定 | README、ビルド、lint、この文書 |
| AWS構成・配備 | `infra/`, `cdk.json`, package scripts | README、synth、出力と本番境界、この文書 |

この表にない変更でも、新しいセッションがシステムを理解するために必要な事実が変わるなら、この文書を同じコミットで更新します。
