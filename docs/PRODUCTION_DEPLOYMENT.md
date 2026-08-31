# Production deployment

`https://itsrun.info/` をAWSで運用する手順です。ProductionはPreviewとは別の、保持設定を持つprivate S3 + CloudFrontで配信します。Google CMP設定済みのProduction buildではAdSenseを有効化します。

2026-08-25にRoute 53委任、ACM certificate、CloudFront alternate domain、A/AAAA Aliasの切替まで完了しました。以下のstaged rolloutは再構築・監査・rollback時の手順として保持します。現在の配信経路とresource IDは [`PRODUCTION_DOMAIN.md`](PRODUCTION_DOMAIN.md) が正本です。

## Safety boundary

- Production bucketはversioning有効、CloudFormation削除時もretainする。
- Production CloudFront default domainにはHTTP `X-Robots-Tag: noindex, nofollow`を付け、ブラウザruntimeもnoindex・GA4無効にする。
- `itsrun.info` だけがindex・同意後GA4の対象になる。
- Production workflowでは`VITE_ADSENSE_ENABLED=true`、Previewでは`false`を維持する。
- content deploy roleはProduction bucketとdistribution以外を変更できない。
- DNS切替までFirebase Hostingを削除・切断しない。

## Repository components

- `infra/itsrun-production-stack.ts`: retained S3、CloudFront、OAC、既知route rewrite（英語ホーム・日英織田フィールド・施設詳細は個別HTML shell）、旧URL 301、実HTTP 404。証明書を渡した更新時だけCloudFrontへ`itsrun.info` alternate domainを追加する。DNS recordは切替作業で別管理し、旧Aを先に削除しない。
- `infra/itsrun-production-dns-stack.ts`: `itsrun.info` public Hosted Zone。既存recordを複製する前に委任してはいけない。
- `infra/itsrun-production-certificate-stack.ts`: 委任済みHosted Zoneで検証する`us-east-1` ACM certificate。
- `infra/itsrun-production-automation-stack.ts`: protected masterだけを信頼するcontent-only GitHub OIDC role。
- `scripts/deploy-production.sh`: account、tag、origin、aliasをguardするS3 syncとtargeted invalidation。
- `.github/workflows/deploy-production.yml`: master、手動、05:30 JST。repository variable `PRODUCTION_DEPLOY_ENABLED=true`になるまでjobは実行しない。

## Build and cache behavior

Production workflowはfresh 31-day availability、Track Dataset validation、unit test、lint、build、local smokeを終えてからOIDC credentialsを取得します。Production buildはGoogle CMPを伴う広告を有効にします。

- `index.html`: `no-cache`
- hashed `assets/`: `public,max-age=31536000,immutable`
- その他: `public,max-age=300`
- invalidation: `/`, `/index.html`, `/en/`, Track Searchの入口・ガイド・施設詳細、`/oda-field`, `/en/oda-field`

## Staged rollout

### 1. Default-domain hosting

```sh
npm run infra:production:synth
npm run infra:production:deploy
```

出力されたbucketとdistributionを使ってautomation stackを作り、GitHub repository variablesを設定する。最初のcontent deployとCloudFront smokeはdefault domainで行う。default domainはnoindexかつGA4無効であることを確認する。

### 2. DNS inventory and Hosted Zone

お名前.comからA、AAAA、CNAME、MX、TXT、CAAと利用中subdomainをexportし、rollback用に保存する。次でHosted Zoneを作成できるが、全recordを複製するまでお名前.comのnameserverを変更しない。

```sh
npm run infra:production:dns:synth
npm run infra:production:dns:deploy
```

旧Firebaseのapex A recordも新Hosted Zoneへ一度複製すれば、nameserver委任だけを先行しても配信先は変わらない。複数resolverでFirebaseへの到達を確認する。

### 3. Certificate and alias

Route 53委任後、`us-east-1` certificateを発行する。

```sh
ITSRUN_PRODUCTION_HOSTED_ZONE_ID=... npm run infra:production:certificate:deploy
```

現環境の`us-east-1`はCDK bootstrapしていないため、2026-08-25の実切替では不要なIAM/bucketを増やさず、ACM APIでcertificateを作成してRoute 53へvalidation CNAMEをUPSERTしました。現在の証明書を置き換える目的で上記CDK commandを実行しないでください。ACM自動更新のためvalidation CNAMEを削除しません。

発行済みARNを指定してhosting stackを更新すると、既存distributionへalternate domainが追加される。この時点ではDNSは旧Firebase Aのままなので公開経路は変わらない。

```sh
ITSRUN_PRODUCTION_DOMAIN=itsrun.info \
ITSRUN_PRODUCTION_CERTIFICATE_ARN=... \
npm run infra:production:deploy
```

CloudFrontの更新が`Deployed`になり、default domainと`Host: itsrun.info`で証明書・routeを確認した後、Route 53のapex AをCloudFront aliasへUPSERTし、AAAA aliasを同じchange batchで追加する。既存Firebase Aを先にDELETEしてはいけない。TXTと`_acme-challenge`は移行確認が終わるまで保持する。

### 4. Cutover verification

- certificate、`/`、`/en/`、全既知route、旧URL 301、未知URL 404
- 33 tracks、future date、unknown保持、公式・経路link
- `robots.txt`、`sitemap.xml`、canonical、OGP、`ads.txt`
- 同意前GA4なし、同意後GA4あり、広告なし
- cache metadata、CloudFront errors、availability daily run

問題時はRoute 53 apex Aを旧Firebaseの2 addressへUPSERTし、CloudFront向けAAAAを削除する。十分な安定期間を取るまでFirebase custom domainを切断しない。

## GitHub repository variables

Production hostingとautomation stackの作成後、次を設定する。

- `PRODUCTION_DEPLOY_ENABLED`: `true`（default-domain smokeの準備が整うまでは未設定）
- `ITSRUN_PRODUCTION_ROLE_ARN`
- `ITSRUN_PRODUCTION_BUCKET`
- `ITSRUN_PRODUCTION_DISTRIBUTION_ID`
- `ITSRUN_PRODUCTION_DOMAIN`: 最初はCloudFront default domain、切替後は`itsrun.info`
- `ITSRUN_PRODUCTION_URL`: 上記domainのHTTPS URL

long-lived AWS keyやAWS secretは登録しない。
