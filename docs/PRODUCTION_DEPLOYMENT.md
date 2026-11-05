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

- `infra/itsrun-production-stack.ts`: retained S3、CloudFront、OAC、既知route rewrite（全固定ページ・施設詳細は個別HTML shell）、旧URL 301（織田フィールドの旧日英URL・末尾スラッシュを含みqueryを保持）、実HTTP 404。証明書を渡した更新時だけCloudFrontへ`itsrun.info` alternate domainを追加する。DNS recordは切替作業で別管理し、旧Aを先に削除しない。
- `infra/itsrun-production-dns-stack.ts`: `itsrun.info` public Hosted Zone。既存recordを複製する前に委任してはいけない。
- `infra/itsrun-production-certificate-stack.ts`: 委任済みHosted Zoneで検証する`us-east-1` ACM certificate。
- `infra/itsrun-production-automation-stack.ts`: protected masterだけを信頼するcontent-only GitHub OIDC role。
- `scripts/deploy-production.sh`: account、tag、origin、aliasをguardし、前回成功時の生成物SHA-256との差分だけをS3へ反映・無効化する。
- `.github/workflows/deploy-production.yml`: 成功master push検証のworkflow_run、手動、05:30 JST、08:15 JST。08:15 runは世田谷のtoday-only noticeを拾う。repository variable `PRODUCTION_DEPLOY_ENABLED=true`になるまでjobは実行しない。

## Build and cache behavior

`Node 24 validation` がproduction設定（広告有効・Production現地レポートAPI）でappを1回buildします。feature/daily検証は `ITSRUN_PREBUILT_DIST` の隔離copyへfixtureまたは実収集JSONだけを差し替え、availability以外の全file hashが元artifactと同じことを検査します。成功master pushだけ、SHA・validation run ID・app全file hash・施設ID hash・公開要否を含む `production-release-<SHA>` artifactを7日保持します。合成データを差し込んだcopyは公開しません。

Productionのplan jobは成功した同じrepositoryのmaster push検証だけを受け入れ、PR/forkのartifactを拒否します。app jobはartifactをhash照合して復元し、公開manifestのschemaと施設IDを照合してappの担当ファイルだけを更新します。再build、再収集、unitの再実行はしません。data jobはPopplerと既存AI cacheを使ってfresh 31-day availabilityを収集し、鮮度・全施設・全partitionの一致を検査して `availability/` だけを更新します。定時/通常手動実行はdata jobだけです。app/data両方の変更ではdata成功後にappを公開します。

app/dataは別々のconcurrency groupで直列化し、無関係なdocs/dataのrunが待機中appを取り消さないようにします。旧SHAから現在masterへの差分がその配備scopeへ関係する、比較不明、300 file以上なら公開を拒否します。後続が文書や相手scopeだけなら公開を許可します。これにより文書pushが直前appの公開を妨げません。両scopeは互いのファイルを更新・削除しません。

trusted collection stepはrepository secret `OPENAI_API_KEY` と `ITSRUN_REQUIRE_AI_KEY=true` を要求します。通常のlocal buildは外部sourceを取得せず、keylessでcache missのAI施設はunknownです。PDFをAI入力へ変換するため、runnerにはPopplerをインストールします。runtimeはAstraを呼び出しません。

- `index.html`: `no-cache`
- hashed `assets/` と `availability/generations/`: `public,max-age=31536000,immutable`
- `availability/manifest.json`: S3 `no-store`、専用CloudFront `CACHING_DISABLED` behavior
- availability世代: 通常deployで削除せずS3 lifecycleで7日保持。Productionのavailability旧versionも7日
- その他: `public,max-age=300`
- `service-worker.js`: `no-cache`
- invalidation: 更新・削除された既存URLだけ。新しいハッシュ付きassetは未キャッシュのため対象外。HTML shellは直接パスとCloudFront Functionがrewriteする元のrouteを含める。施設詳細の全shellが変わる配備だけは日英の`/tracks/*`・`/en/tracks/*`にまとめる。availabilityの複数ファイル変更は専用prefix `/availability/*` の1パスにまとめ、差分なしなら0パス。

Productionは `.itsrun-deploy/app-v2.json` / `data-v2.json` にscope別のSHA-256 stateを保存し、初回は旧 `.itsrun-deploy/manifest-v1.json` から担当prefixを移行します。immutable asset/世代JSONを先にアップロードし、その他の担当ファイル、公開manifestの順にmetadataごとのAWS CLI transfer managerで配置します。一時treeにはSHAで選択した変更分だけを入れ、`cp --recursive`で古いmtimeや同サイズのrollbackも確実に送ります。世代ファイルに失敗したら公開manifestへ進みません。新しいimmutable URLを無効化せず、互換日別JSONのinvalidationは維持します。旧hashed assetと旧availability世代は既存タブ用に保持します。

公開後は変更された本文を全byte照合し、appだけ `npm run test:release` で301/404・entry asset・世代JSON・日英PC/スマホの起動を確認します。詳細なfeatureシナリオはCIで検証済みです。summaryでは未公開・部分更新失敗・公開済みだが公開確認失敗・公開確認成功を区別します。失敗はworkflow失敗となり、確認失敗を公開未実施とは扱いません。

## 通常更新と個別rollback

```sh
# データだけをfresh collectionして公開（app buildなし）
gh workflow run deploy-production.yml --repo subaru44k/itsrunnew --ref master

# 7日以内の成功master validation runにあるappを、そのまま復元
# run IDはDeploy ProductionではなくNode validationのIDを指定
gh workflow run deploy-production.yml --repo subaru44k/itsrunnew --ref master -f app_validation_run=VALIDATION_RUN_ID

# 同じJST日・生成6時間以内・現施設ID一致のデータ世代だけを復元
gh workflow run deploy-production.yml --repo subaru44k/itsrunnew --ref master -f data_generation=GENERATION_24_HEX
```

appとdataのrollbackは同時指定できません。appはschema/施設IDが公開データと一致しなければ拒否し、dataは鮮度・fixture禁止・全日程/全施設・content identityを再検証します。期限切れ世代を戻すことはできません。古い資料を利用可として再公開せず、通常のfresh collectionかcollectorの修正を行います。rollback後も同じ公開確認を行います。直後の後続自動releaseは現在のmasterを再公開し得るため、問題のあるコードはmaster上でも修正/revertします。

直接content deployを使うときも、Productionは `ITSRUN_DEPLOY_SCOPE=app` または `data` が必須で、未指定/allを拒否します。同じ検証済み成果物とguardを使います。通常は上記workflowを使い、appをローカルで再buildして代用しません。

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
- 44 supported tracks（掲載133施設のうちlegacy 33＋夢の島HTML 1＋追加AI/ICS 10）、future date、unknown保持、公式・経路link
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
- `ITSRUN_PRODUCTION_FIELD_REPORTS_API`: production build用の公開API origin

long-lived AWS keyやAWS secretは登録しない。

## 旧施設ページ統合の配備

織田（`/oda-field`）、夢の島（`/yumenoshima`）、駒沢（`/komazawa`、`/komazawa_olympic`）、等々力（`/todoroki`）と英語版は同じ言語の施設詳細へHTTP 301で転送します。末尾スラッシュにも対応し、queryを保持します。この変更はcontent deployだけでは反映されないため、現行のdomain・certificate ARNを指定したCDK差分でRouteFunctionだけが変更されることを確認してhosting stackを更新します。DNS・証明書・配信元を変更しません。転送先の施設詳細は既に存在するため、edge更新後に検証済みcontentを配備できます。公開後は旧URLのHTTP 301、転送先の本文・canonical・日英導線、旧URLを除いたsitemapを確認します。

## 固定ページのcanonical修正の配備

固定ページのmetadataは`src/data/page-metadata.json`でrouterとbuild後のHTML shell生成が共有します。全固定ページを個別shellへrewriteするRouteFunctionの変更はcontent deployだけでは反映されません。検証済みcontent（新しいshellを含む）を先に配備し、現行のdomain・certificate ARNを保持したCDK差分でRouteFunction以外に変更がないことを確認してhosting stackを更新します。DNS・証明書・配信元は変更しません。更新完了後に固定ページのcanonicalをHTTPレスポンスで確認し、Production smokeを実行します。


source確認日だけの単独tracks変更は意味差分を検査してdata再収集を省略し、dateOnlyをapp artifactへ保存します。通常公開は旧方針同様にページのcache期限（最大300秒）を待ち、必要なmetadata更新だけでinvalidation待ちを増やしません。明示的app rollbackではこのdeferを使いません。検証の選択と実収集の担当は [VALIDATION_POLICY.md](VALIDATION_POLICY.md) を参照してください。
