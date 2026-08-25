# Production domain handover

`itsrun.info` をPreview版へ切り替える前に確認するための現状メモです。2026-08-25時点のread-only調査結果であり、この文書の作成時にはDNS、Firebase、AWSの設定を変更していません。

検索・GA4・Privacy・広告停止・Search Console等の公開品質チェックは [`PUBLIC_LAUNCH.md`](PUBLIC_LAUNCH.md) を参照してください。

Production AWSの段階的な構築、default-domain検証、Route 53委任、certificate、content workflowは [`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md) を参照してください。repositoryにはProduction定義がありますが、この記録時点ではAWS resourceとDNS切替は未実施です。

## 現在の配信経路

```text
https://itsrun.info/
  -> お名前.com DNS（01.dnsv.jp〜04.dnsv.jp）
  -> A: 151.101.1.195 / 151.101.65.195
  -> Firebase Hosting project: itsrun-aaf42
  -> 2022-08-09に更新された旧build
```

確認できた根拠:

- `itsrun.info` の権威NSは `01.dnsv.jp`〜`04.dnsv.jp` で、Route 53の `awsdns-*` ではない。
- apexのAレコードは `151.101.1.195` と `151.101.65.195`。
- HTTP responseにFirebase Hosting由来の `x-fh-requested-host` がある。
- `itsrun.info`、`itsrun-aaf42.web.app`、`itsrun-aaf42.firebaseapp.com` のHTMLは同一サイズ・ETag・SHA-256だった。
- TLS証明書はGoogle Trust Services発行で、SANに `itsrun.info` が含まれる。
- Git履歴上の旧 `itsrunnew/.firebaserc` はdefault projectを `itsrun-aaf42` としていた。旧 `firebase.json` は `dist/`、SPA rewrite、cache headerを設定していた。
- Firebase custom domainの対応付け自体はrepositoryの `firebase.json` ではなくFirebase Console側のHosting設定に保持される。
- `www.itsrun.info` のDNS recordは確認できなかった。

## 現在のAWS Previewとの関係

現在の新buildは次のisolated Previewで公開している。

```text
https://d2xryux7a95b54.cloudfront.net
  -> CloudFront distribution E2F8WYHWRDA3NS
  -> private S3 origin
```

- Preview distributionのaliasesは0件。
- CloudFront default certificateを使用している。
- `itsrun.info` のRoute 53 hosted zoneは、調査時に使用したAWS accountでは見つからなかった。
- したがって、`itsrun.info` は現時点でPreview CloudFrontへ接続されていない。
- Preview stackへproduction domain、Route 53、ACMを追加する変更はまだ行っていない。

## 本番切替で確認・変更する場所

切替はcontent deployとは別作業として扱う。最低限、次の管理画面・設定を確認する。

1. お名前.com Navi
   - `itsrun.info` の契約・管理権限
   - 現在のNSとA/TXT/CAA record
   - TTLと、apexをCloudFrontへ向ける方法
2. Firebase Console / project `itsrun-aaf42` / Hosting
   - `itsrun.info` custom domainの接続状態
   - 旧Hostingをいつ切り離すか
   - Firebaseによる証明書更新との競合がないか
3. AWS
   - `us-east-1` のACM certificate（CloudFront用）
   - CloudFront alternate domain name `itsrun.info`
   - production用cache policy、SPA fallback、security headers
   - Preview stackをそのままproduction化するか、production stackを分離するか

お名前.com DNSを維持する場合、zone apexをCloudFrontへ向けられるrecord形式を事前に確認する。対応できない場合は、Route 53等へDNS hostingを移す設計が必要になる。移行方式を決める前に現在のA recordを削除しない。

## 推奨する切替順序

1. 新CloudFront側でcustom domainと証明書を設定し、default domainで最終smokeを通す。
2. DNS TTLを考慮し、Firebaseを残したままDNSだけを新配信先へ切り替える。
3. `https://itsrun.info/` でTrack Search、英語版、日付指定、assets、availabilityを確認する。
4. DNS resolverを複数使い、期待する配信先へ収束したことを確認する。
5. 十分なrollback期間を取った後にFirebase custom domainや旧Hostingの扱いを決める。

切替直後に問題があった場合は、旧Firebase A recordへ戻せるよう、変更前のrecord値とFirebase Hosting状態を記録しておく。

## 切替後の確認項目

- apex `itsrun.info` のA/ALIAS解決先
- HTTPS証明書のSAN、issuer、有効期限
- `/`、`/tracks`、`/en/`、`/oda-field`、未来日query
- Track Searchの33施設、availability date chunks、unknown保持
- `index.html` の短期cacheとhash assetの長期cache
- CloudFront logs/metricsとFirebase側へのtraffic減少
- `www.itsrun.info` を使用するか、apexへredirectするか
- robots、sitemap、canonical、OGPの正式ドメイン反映

## 参考

- Firebase Hosting custom domain: https://firebase.google.com/docs/hosting/custom-domain
- お名前.com DNS record設定: https://help.onamae.com/answer/7878
- AWS Route 53 NS/SOA: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/SOA-NSrecords.html
