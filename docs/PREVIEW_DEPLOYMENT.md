# Preview deployment

ItsRunのPreviewは、既存の非公開S3 bucketとCloudFront default domainへ静的contentだけを配備します。Route 53、ACM、custom domain、production domainは対象外です。

## GitHub Actions

`.github/workflows/deploy-preview.yml` は次の3 triggerで同じjobを実行します。

- `master` push
- `workflow_dispatch`
- 毎日20:00 UTC（05:00 JST）

PRの `Node 24 validation` とは分離しています。deploy jobはPoppler（`pdfinfo` / `pdftoppm`）を導入し、`.cache/availability-ai`のActions cacheを復元し、同じ実行内のHTTP取得を共有して31日availabilityを生成します。AIは公式資料を施設ごとの入力にまとめ、等々力・維新補助は`gpt-6-luna`・`medium`、知多・平塚・荻野は`gpt-6-luna`・`low`、残り3施設は`gpt-5.6-luna`・`none`で1回読みます。公式sourceの取得は順番に行い、AI読解だけ最大3件を並列実行します。source/prompt/model/effort/schema/full-month datesが変わるとcache keyが変わります。Track Dataset検証、unit test、lint/type check、build、local smokeを通した後にだけAWS credentialsを取得します。Preview全体でconcurrency groupを1つにし、同時deployを防止します。

fresh collection stepだけがrepository secret `OPENAI_API_KEY` と `ITSRUN_REQUIRE_AI_KEY=true` を受け取ります。通常のlocal buildやAWS deploy stepへsecretを渡しません。cache hitなら再推論しませんが、trusted deployはcacheの有無にかかわらず開始時にkeyを必須とし、未設定なら失敗します。

## AWS authentication and authorization

GitHub Actionsはlong-lived keyではなく、既存の標準GitHub OIDC providerから `itsrun-track-preview-deploy` roleを引き受けます。旧migration branch専用roleは再利用しません。trust subjectは次に限定します。

```text
repo:subaru44k/itsrunnew:ref:refs/heads/master
```

roleはPreview bucketのmetadata/list/get/put/deleteと、Preview distributionのread/invalidationだけを許可します。CloudFormation、IAM、Route 53、ACM、他bucket、他distributionへの権限はありません。role定義は独立した `ItsRunPreviewAutomationStack` にあり、既存hosting stackを更新せず次でsynth/deployできます。

```sh
npm run infra:automation:synth
npm run infra:automation:deploy
```

## Content deployment

`scripts/deploy-preview.sh` はaccount、region、bucket tags、distribution domain/status/originを検証してから、共通の`scripts/deploy-content.mjs`を実行します。前回の無効化完了後に保存したS3内の`.itsrun-deploy/manifest-v1.json`（各ファイルのSHA-256）と今回の`dist/`を比較します。変更・新規ファイルだけを送信し、削除済みの非assetファイルを削除します。旧ハッシュ付きassetは既存タブが参照できるよう保持します。初回は旧配備のS3 objectを一時ディレクトリへ取得してhashを比較し、既存と同じ内容は再送信・無効化しません。

- non-hashed files: `public,max-age=300`
- hashed `assets/`: `public,max-age=31536000,immutable`
- `index.html`: `no-cache`
- `service-worker.js`: `no-cache`
- 更新・削除された既存URLだけをCloudFrontで無効化する。新しいハッシュ付きassetは未キャッシュのため対象外。HTML shellは直接URLと公開routeの両方を含める。施設詳細の全shellが変わる配備だけは日英それぞれの`/tracks/*`・`/en/tracks/*`にまとめる。availabilityが複数ファイル変わる日は専用prefix `/availability/*` の1パスにまとめる。無変更なら無効化しない。
- 無効化が完了するまでmanifestを更新しない。失敗時の再実行は同じ差分を再送信・再無効化する。

invalidation完了後、workflowはCloudFrontから`/`、`/service-worker.js`、変更された非assetの本文を取得して`dist/`と照合し、既存のdesktop/mobile smokeを実行します。run summaryにはtrigger、commit、availability range、track数、status集計、変更・削除ファイル数、無効化パス数、S3/invalidation/smoke結果を記録します。

Preview hosting CDK stackは基盤のみ管理します。`npm run infra:deploy`の後、content workflowまたは上記scriptで公開します。旧CDK BucketDeploymentをstackから外しても、その削除時に既存S3 objectは保持されます。

個別sourceの取得・解析失敗はcollectorの安全規則によりunknownへ降格できます。range生成、dataset検証、test、lint、build、local smoke、OIDC、差分S3配備、invalidation、公開本文照合、CloudFront smokeのいずれかが失敗した場合はjob全体を失敗させます。key未設定ならtrusted Preview collectionは開始時に失敗し、AI施設だけを前回のpositiveで埋め戻しません。
