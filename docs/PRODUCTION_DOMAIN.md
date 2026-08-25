# Production domain handover

`https://itsrun.info/` の正式配信経路、移行記録、rollback手順です。2026-08-25に旧Firebase HostingからAWS Productionへ無停止で切り替えました。

検索・GA4・Privacy・広告停止・Search Console等の公開品質チェックは [`PUBLIC_LAUNCH.md`](PUBLIC_LAUNCH.md)、content更新とautomationは [`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md) を参照してください。

## 現在の配信経路

```text
https://itsrun.info/
  -> Route 53 Hosted Zone Z03544833P5RRB2UBCDH7
  -> apex A / AAAA Alias
  -> CloudFront E3O62QVPUO8DZ1
     (dukd79dlhtmkc.cloudfront.net)
  -> private, versioned Production S3 bucket
```

- CloudFront alternate domainは`itsrun.info`、certificateは`us-east-1` ACMのDNS検証済み証明書。
- default CloudFront domainは引き続き`X-Robots-Tag: noindex, nofollow`、正式domainだけがindex・同意後GA4の対象。
- Production S3/CloudFrontはPreview stackから分離され、content workflowだけが日次更新する。
- AdSenseはGoogle CMP完了まで無効。

## Route 53委任とrecord

お名前.comの委任先は次のRoute 53 NSへ変更済みです。

```text
ns-893.awsdns-47.net
ns-1257.awsdns-29.org
ns-289.awsdns-36.com
ns-1886.awsdns-43.co.uk
```

移行前にお名前.comのzone exportを取得し、次をRoute 53へ複製しました。

- apex A: 旧Firebaseの2 address（委任切替中だけ維持し、現在はCloudFront Alias）
- apex TXT: Google所有権確認record
- `_acme-challenge` TXT: 旧Firebase certificate用record

ACMの自動更新に必要なDNS validation CNAMEもRoute 53に保持します。SOA/NSはRoute 53生成値を使用し、コメントアウト済みの旧Aは移行していません。MX、CAA、`www` recordはありませんでした。zone export原本はrepositoryへcommitせず、rollback資料として保管します。

## 2026-08-25 migration record

1. retained Production S3 + CloudFrontをdefault domainで作成し、content deployとdesktop/mobile smokeを完了。
2. Route 53 Hosted Zoneへ旧A/TXTを完全一致で複製。
3. お名前.comのNSをRoute 53へ変更。親`.info` zoneと複数resolverで委任を確認。
4. `us-east-1` ACM certificateを作成し、Route 53 DNS validationで`ISSUED`を確認。
5. CloudFrontへcertificateと`itsrun.info` alternate domainを追加し、`Deployed`を確認。
6. CloudFront edgeへ正式Host/TLSで直接アクセスし、routes、robots、sitemap、404、noindex境界を確認。
7. Route 53のapex AをCloudFront AliasへUPSERTし、AAAA Aliasを同じchange batchで追加。

旧Firebase Aを先に削除せず、A/AAAAを原子的に切り替えました。resolverの旧A cacheが残る間は旧Firebaseと新CloudFrontが併存するため、切替中もサイトを停止しません。

切替直後にローカルOSの旧A cacheが残る場合は、DNS cacheを強制削除せず、`ITSRUN_HOST_RESOLVER_RULE="MAP itsrun.info <CloudFront edge IP>"`付きのsmokeで正式Host/TLSをCloudFrontへ固定して検証できます。通常運用ではこの指定を使用せず、公開resolverの収束も別途確認します。

## Rollback

問題時はFirebase custom domainを残したまま、Route 53で次を同じchange batchにします。

1. apex Aを移行前のFirebase 2 addressへUPSERT。
2. CloudFront向けapex AAAA AliasをDELETE。

移行前の正確なrecord値は保管したzone exportを正本とします。十分な安定期間を取るまでFirebase Hosting project `itsrun-aaf42` のcustom domainや旧buildを削除しません。CloudFront/S3 stack、Route 53 Hosted Zone、ACM certificateもrollback確認期間中は削除しません。

## 切替後の運用確認

- `https://itsrun.info/`、`/en/`、施設route、未来日query、旧URL 301、未知URL 404
- 33 tracks、availability chunks、unknown保持、公式・経路link
- `robots.txt`、`sitemap.xml`、canonical、OGP、`ads.txt`
- 同意前GA4なし、同意後GA4あり、広告なし
- CloudFront cache、5xx、certificate expiry、自動更新用CNAME
- Production GitHub Actionsの日次availability生成とCloudFront smoke
- Search Console sitemap、GA4 Realtime、Google CMPと広告再開の別判断

## 参考

- Firebase Hosting custom domain: https://firebase.google.com/docs/hosting/custom-domain
- AWS Route 53 NS/SOA: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/SOA-NSrecords.html
- AWS CloudFront alternate domain: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html
