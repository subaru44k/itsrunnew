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
- VitestおよびPlaywright Core
- AWS CDK 2（S3 + CloudFrontの検証環境）

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
│   ├── styles.css             全体CSSと旧サイト再現用のVuetify 4補正
│   ├── i18n.ts                日本語・英語のVue I18n設定
│   ├── locales/               ja.json / en.json
│   ├── views/                 ルート単位のページ
│   ├── components/
│   │   ├── AdsDisplay.vue     AdSenseスロットとスクリプト読み込み
│   │   ├── schedule/          週間表、ページ送り、状態アイコン
│   │   └── laptime/           PC・スマホ用マラソンペース表
│   ├── model/                 ペース表の計算モデル
│   └── plugins/vuetify.ts     Vuetifyテーマとアイコン設定
├── public/                    favicon、manifest、robots、ads.txt、状態画像
├── scripts/
│   ├── smoke.mjs              公開機能のブラウザスモークテスト
│   └── visual-compare.mjs     広告なし旧版との全画面比較
└── infra/
    ├── app.ts                 CDKアプリのエントリー
    └── itsrun-preview-stack.ts S3、CloudFront、静的ファイル配備
```

`dist/`、`cdk.out/`、`cdk-outputs.json`は生成物であり、実装の正本ではありません。

## 4. 共通レイアウトとナビゲーション

`src/App.vue`には次の共通UIがあります。

- PCではアプリバー内のドロップダウンメニュー、スマートフォンでは一時表示のナビゲーションドロワー。
- 東京都の競技場、神奈川県の競技場、ラップタイム、記録集へのメニュー。
- 日本語と英語を現在のパスを維持して切り替えるボタン。
- `router-view`で描画される本文。
- 要望送付先と著作権表示を含む、旧サイトと同じ2段構成のフッター。

旧Vuetifyサイトとの見た目を維持するため、`src/styles.css`が文字サイズ、行間、段落余白、コンテナ幅、余白ユーティリティ、フッター寸法を補正しています。通常のVuetify 4既定値へ無条件に戻さないでください。

## 5. 公開ルート

ルートの正本は `src/router.ts` の `pages` です。各ページは日本語パスと、同じ末尾に `/en/` を付けた英語パスを持ちます。

| 日本語 | 英語 | View | 用途 |
|---|---|---|---|
| `/` | `/en/` | `OdaField.vue` | 織田フィールド |
| `/yumenoshima` | `/en/yumenoshima` | `Yumenoshima.vue` | 夢の島陸上競技場 |
| `/komazawa` | `/en/komazawa` | `Komazawa.vue` | 駒沢オリンピック公園陸上競技場 |
| `/todoroki` | `/en/todoroki` | `Todoroki.vue` | 等々力陸上競技場 |
| `/pace/marathon` | `/en/pace/marathon` | `LapTime.vue` | マラソンのペース表 |
| `/nozomiantena/index` | `/en/nozomiantena/index` | `NozomiAntena.vue` | 田中希実選手の記録集 |

互換リダイレクトは `/index.html` → `/`、`/komazawa_olympic` → `/komazawa` です。それ以外の未知パス（削除済みの `/manage`を含む）は `/` へリダイレクトされます。

ルート遷移時に `router.beforeEach` が言語、`document.title`、descriptionメタタグを更新します。記録集の `#2021` と `#2020` は実要素のIDであり、`scrollBehavior`が固定ヘッダーを避けてスクロールします。

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

### 広告

`AdsDisplay.vue`はGoogle AdSenseスクリプトを必要時に一度だけ読み込み、各スロットを初期化します。広告ブロッカーや未承認の検証ドメインでの失敗は握りつぶします。これはFirebaseやサイトデータ取得とは無関係です。レイアウト比較では広告の自動挿入による変形を避けるため、広告・解析通信と広告要素を遮断します。

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

## 8. コマンドと検証

すべて `itsrunnew/` で実行します。

| コマンド | 内容 |
|---|---|
| `npm run dev` | Vite開発サーバー |
| `npm run build` | `vue-tsc --noEmit`後に本番ビルド |
| `npm test` | Piniaのローカル日付生成・週送り単体テスト |
| `npm run lint` | TypeScript/Vue型検査 |
| `npm run preview` | `dist/`のローカル配信 |
| `npm run test:smoke` | PC・スマホの全公開ルート、フッター、年別アンカー、横幅、Firebase非通信、`/manage`削除を確認 |
| `npm run test:visual` | 旧版と新版の全6ページをPC・スマホで全画面撮影・寸法比較 |
| `npm run infra:synth` | ビルド後にCloudFormationを生成 |
| `npm run infra:deploy` | ビルドして検証スタックへ配備、`cdk-outputs.json`へ出力 |
| `npm run infra:destroy` | 検証スタックを削除 |

スモークテストの既定URLは `http://127.0.0.1:4173` です。CloudFront確認時は `ITSRUN_BASE_URL=https://... npm run test:smoke` のように上書きします。Chromeの場所は必要に応じて`CHROME_PATH`で指定します。

ビジュアル比較は、広告を無効化した旧版が`ITSRUN_OLD_URL`（既定 `http://127.0.0.1:4172`）、新版が`ITSRUN_NEW_URL`（既定 `http://127.0.0.1:4173`）で起動済みであることが前提です。画像は既定で`/tmp/itsrun-visual-comparison`へ出力されます。全画面高の差は100px以内、フッター高の差は1px以内、横方向のはみ出しは1px以内を合格条件としています。

## 9. 変更時の確認先

| 変更内容 | 主な実装 | 同時に確認・更新するもの |
|---|---|---|
| ページやURLの追加・削除 | `src/router.ts`, `src/views/` | `App.vue`のメニュー、locale、smoke、visual、この文書 |
| 共通ヘッダー・フッター | `src/App.vue`, `src/styles.css` | locale、smoke、visual、この文書 |
| 競技場ページ | 対応するView、schedule components | locale、公開画像、smoke、visual、この文書 |
| スケジュール挙動 | `src/store.ts`, `components/schedule/` | `store.test.ts`、smoke、Firebase非依存の記述、この文書 |
| ペース計算 | `src/model/`, `components/laptime/` | `store.test.ts`または追加単体テスト、smoke、この文書 |
| 翻訳・言語URL | `src/locales/`, `src/i18n.ts`, `src/router.ts` | `App.vue`、SEOメタ情報、smoke、この文書 |
| 見た目・レスポンシブ | View、components、`src/styles.css` | 広告なしのvisual、PC/スマホsmoke、この文書 |
| 依存・ビルド | `package.json`, lockfile、Vite/TS設定 | README、ビルド、lint、この文書 |
| AWS構成・配備 | `infra/`, `cdk.json`, package scripts | README、synth、出力と本番境界、この文書 |

この表にない変更でも、新しいセッションがシステムを理解するために必要な事実が変わるなら、この文書を同じコミットで更新します。
