# Preview deployment

ItsRunのPreviewは、既存の非公開S3 bucketとCloudFront default domainへ静的contentだけを配備します。Route 53、ACM、custom domain、production domainは対象外です。

## GitHub Actions

`.github/workflows/deploy-preview.yml` は次の3 triggerで同じjobを実行します。

- `master` push
- `workflow_dispatch`
- 毎日20:00 UTC（05:00 JST）

PRの `Node 24 validation` とは分離しています。deploy jobはsource cacheを共有して31日availabilityを生成し、Track Dataset検証、unit test、lint/type check、build、local smokeを通した後にだけAWS credentialsを取得します。Preview全体でconcurrency groupを1つにし、同時deployを防止します。

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

`scripts/deploy-preview.sh` はaccount、region、bucket tags、distribution domain/status/originを検証してから次を実行します。

- non-hashed files: `public,max-age=300`
- hashed `assets/`: `public,max-age=31536000,immutable`
- `index.html`: `no-cache`
- S3 sync: current `dist/`にない旧objectを削除
- targeted invalidation: `/`, `/index.html`, `/en/`, `/tracks`, `/en/tracks`, `/oda-field`, `/en/oda-field`

invalidation完了後、workflowはCloudFront URLに対して既存のdesktop/mobile smokeを実行します。run summaryにはtrigger、commit、availability range、track数、status集計、S3/invalidation/smoke結果を記録します。

個別sourceの取得・解析失敗はcollectorの安全規則によりunknownへ降格できます。range生成、dataset検証、test、lint、build、local smoke、OIDC、S3 sync、invalidation、CloudFront smokeのいずれかが失敗した場合はjob全体を失敗させます。
