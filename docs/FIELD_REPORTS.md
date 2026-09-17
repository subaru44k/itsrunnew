# 現地確認レポート MVP

公式のavailability・旧週間スケジュールとは独立した、匿名の構造化利用実績です。公式情報の自動修正、星評価、アカウント、設備評価は追加しません。

## 表示と対象日

施設詳細の日付に対応するレポートを表示します。日本時間の今日だけ投稿でき、過去・未来の日付では今日へ戻る導線を出します。APIもJST日付を検証するため、開いたまま日付を跨いでも前日の報告には保存しません。時刻は利用時刻ではなく投稿時刻です。新着20件と非表示分を除く件数を表示します。未投稿、読込中、通信障害は別の状態です。

`FieldReports.vue` と `services/field-reports.ts` がUIと通信を担当します。`VITE_FIELD_REPORTS_API` が未設定なら投稿不可の案内を表示します。localStorageは投稿共有の保存先ではありません。既存canonical、robots、route、sitemap、静的施設HTMLには投稿を追加せず、API応答もnoindex/no-storeです。

## APIとデータ

`infra/field-reports-app.ts` は既存hostingから独立したPreview/Production stackを作成します。HTTP API Gateway → Node.js Lambda → DynamoDB (on-demand/PITR/retain)です。DNS、証明書、既存CloudFrontは変更しません。APIはschedule backendではありません。

- `GET /reports?trackId=…&date=YYYY-MM-DD`: `{reports, count}`。最新20件、visibleかつ有効期限内だけ返します。
- `POST /reports`: `{trackId,date,outcome,comment,clientId,website:''}`。outcomeは`available|partial|unavailable`。成功201、入力400、日付跨ぎ409、制限429、障害503。
- レポート項目: `schemaVersion:1`, `id`, `trackId`, `date`, `outcome`, `comment`, サーバー生成`createdAt`, `status:visible|hidden`, `expiresAt`。
- DynamoDB key: `pk=REPORT#施設ID#日付`, `sk=投稿ISO時刻#UUID`。将来属性を足せますが汎用フォーム基盤は作りません。
- 施設allowlist: `backend/field-reports/track-ids.json`。施設追加時はtracks.jsonから再生成し、APIも再配備してください。unit testで不一致を検出します。

```sh
node --input-type=module -e "import fs from 'node:fs'; fs.writeFileSync('backend/field-reports/track-ids.json', JSON.stringify(JSON.parse(fs.readFileSync('src/data/tracks.json')).map(t=>t.id)))"
```

## 匿名投稿の防御と限界

APIで厳密なJSON型・施設・日付・選択肢・4096byte本文・200 UTF-16文字コメントを検証します。URL、HTMLタグ、メールアドレス、制御文字、20文字以上の同一文字反復を拒否し、コメントをHTMLとして表示しません。予約済みのwebsite項目も空文字以外は拒否します。

投稿保存と次の制限をDynamoDB transactionで原子的に実行します。

- 同一IP: 1分5件、JST日ごと30件。
- 同一ブラウザID・同一施設: 30分間隔、日ごと3件。
- 同一IP・同一施設: 60秒間隔、日ごと10件。
- 施設・日付全体: 最大200件（非表示分も含む負荷上限）。

IP/ブラウザIDはSecrets Manager生成の秘密値による日替わりHMACに変換し、制限レコードだけに約2日保存します。生IPや生ブラウザIDをDB・アプリログ・解析に保存せず、公開投稿とも結合しません。投稿は365日TTLで削除し、期限切れ処理を待つ間もAPIでは非表示です。バックアップにはPITRの保持期間中残ることがあります。API access logは有効化せず、Lambdaアプリログはエラー名のみ・7日保持です。

API Gatewayは20 requests/sec、burst40、Lambda同時実行5に制限します。これは完全なbot対策や本人確認ではありません。共用IPで制限に当たる場合があり、IP・ブラウザIDを大量に変える攻撃は防ぎ切れません。CORS/Origin検証はブラウザ境界であり、本人認証として扱いません。問題があればAPI停止・制限調整を優先し、CAPTCHA等は実利用を見て検討します。

## モデレーション

公開管理画面・管理APIは設けません。AWS認証を持つ運営者がtable限定のUpdateItem権限で既存投稿のstatusを変更します。GETの結果から施設・日付・createdAt・idを特定できます。CLIは存在しない投稿を作成しません。非表示後の次回取得で除外され、すでに開かれた画面は再読込時に反映されます。

```sh
npm run reports:install
node scripts/moderate-field-report.mjs TABLE TRACK_ID YYYY-MM-DD CREATED_AT REPORT_ID hidden
# 誤操作の取り消しは最後の引数をvisibleにする
```

削除依頼は既存のお問い合わせ窓口へ施設・日付・投稿時刻を送ってもらいます。必要な永久削除はAWS認証によるDeleteItemで行います。非表示はデータ削除ではありません。

## 計測

既存のProduction origin + 同意済みGA4だけで、`field_report_ui_view`（投稿フォームが画面内に入った）、`field_report_start`（初回操作）、`field_report_complete`（API保存成功）を送信します。施設ID・対象日・言語だけを付加し、コメント・IP・匿名ID・投稿IDは送信しません。解析拒否時も投稿できます。

## 配備・検証

appディレクトリで実行します。backendの依存は独立lockfileに固定され、Lambda assetへ含めます。

```sh
npm run reports:install
npm run reports:synth -- -c environment=preview
npm run reports:deploy -- -c environment=preview --outputs-file /tmp/itsrun-reports-preview.json
# Productionは検証後に同じ操作でenvironment=productionを指定
VITE_FIELD_REPORTS_API=https://API_ID.execute-api.ap-northeast-1.amazonaws.com npm run build
npm test
npm run lint
npm run test:smoke:preview
# 起動済みPreviewに対して、APIをmockした日英・モバイル・障害・投稿の検証
npm run test:reports
```

Preview CORSは既存Preview CloudFrontとlocalhost 127.0.0.1:4173、Productionはhttps://itsrun.infoだけを許可します。GitHub variables `ITSRUN_PREVIEW_FIELD_REPORTS_API` / `ITSRUN_PRODUCTION_FIELD_REPORTS_API`を各API URLへ設定し、次の日次content buildでも設定を維持します。既存workflowはcontentのみのため、APIの変更は別途`reports:deploy`が必要です。APIを無効化するときは該当variableを空にしてcontentを再build/deployします。緊急停止はLambda同時実行を0にできます。投稿データは保持します。

公開前にPreviewの実APIへ投稿→取得→連投拒否→非表示を確認します。Productionでは架空の利用報告を投稿せず、取得と不正入力拒否を検証します。

## 2026-09-16 初回API配備

- Preview API: `https://nn63pjxblj.execute-api.ap-northeast-1.amazonaws.com`
- Preview table: `ItsRunFieldReportsPreviewStack-Reports65402A0A-39MA1HZMLG36`
- Production API: `https://i5gqiq19ag.execute-api.ap-northeast-1.amazonaws.com`
- Production table: `ItsRunFieldReportsProductionStack-Reports65402A0A-6T1RV0E529EQ`

Previewの実APIで201保存、GET反映、連投429、CLI非表示後の除外を確認しました。検証用投稿は非表示済みです。Production APIはGET 200とCORS/noindex、不正POST 400を確認し、架空の利用報告は保存していません。

### 委譲とレビュー記録

初期調査では共有投稿の保存先・匿名制限・日付境界・公開基準を主担当で決定しました。契約確定後、独立したUI/通信/既存計測への接続をLuna Maxへ委譲しました。API・インフラ・privacy・運用ドキュメント・単体/ブラウザテストと公開統合は主担当の責任範囲です。

主担当は実際のdiffを確認し、送信中textarea編集による入力消失、アンマウント後の非同期処理、同一画面のGET競合、解析parameterの`client_id`漏れを修正指示しました。Lunaが修正し、主担当がbuild、単体114件、日英・PC/スマホの投稿・通信障害・日付跨ぎ・storage拒否・HTML文字列表示を再検証しました。負荷の高いローカル環境では既存CDK testが20秒でtimeoutしたため、`npm test -- --maxWorkers=1`で全件成功を確認しました。対象日の明示と公式情報の分離は維持し、SEO routeや公式availabilityに変更を加えません。

旧版の広告無効ビジュアル比較用server（4172）は利用できなかったため、新機能の日英・PC/スマホのPlaywrightスクリーンショットを確認しました。投稿数が増えてもフォームが埋もれないよう、今日の投稿欄を一覧より先に配置しています。
