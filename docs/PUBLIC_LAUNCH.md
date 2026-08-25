# Public launch readiness

`https://itsrun.info/` を新サイトへ切り替える前後の、検索・計測・プライバシー・広告・確認項目をまとめます。DNSとhostingの現状、切替、rollbackは [`PRODUCTION_DOMAIN.md`](PRODUCTION_DOMAIN.md) が正本です。

## Repositoryで実装済みの公開準備

- 正式URLを `https://itsrun.info` に統一したcanonical、日英hreflang、OGP/Twitter metadata。
- 18 canonical URLだけを掲載した `public/sitemap.xml` と、sitemapを案内する `robots.txt`。`/tracks`、`/en/tracks`、日付queryは重複URLとして掲載しない。
- `/tracks` → `/`、`/en/tracks` → `/en/` のclient-side互換redirect。日付queryは維持する。
- About、Privacy、日本語・英語の各ページと、利用者向け404画面。
- GA4 `G-YNLS7KQXYW`。初期状態ではGoogle tagを取得せず、利用者がアクセス解析へ同意した後だけ読み込む。拒否しても全機能を利用でき、フッターから選択を変更できる。
- 広告は `VITE_ADSENSE_ENABLED=true` を明示しない限り読み込まない。正式公開初日は無効とし、正式URLでPrivacy/CMPを設定した後に別変更で再開する。`ads.txt`は維持する。
- Preview buildは `VITE_DEPLOY_TARGET=preview` により全routeを `noindex,nofollow` とし、同意後もGA4を読み込まない。正式buildではこの値を設定しない。
- OGP画像 `public/img/itsrun-og.jpg`。

Vue Routerはroute遷移時にtitle、description、canonical、hreflang、OGP、robotsを同期します。日付queryはcanonicalへ含めず、GA4 page viewもpath単位に正規化します。日付選択、施設選択、現在地利用結果、公式情報・経路リンク等は、同意済みの場合だけイベント送信します。現在地の緯度経度は送信しません。

## 正式公開前に管理画面で行うこと

1. Google Analytics
   - GA4 propertyとweb streamが `itsrun.info` を対象にしていることを確認する。
   - 公開後にRealtimeとDebugViewで同意前は通信なし、同意後はpage viewと操作eventが届くことを確認する。
   - Previewと内部アクセスをproduction集計から除外する。
2. Google Search Console
   - Domain propertyの所有権と既存DNS verificationを確認する。
   - 公開後に `https://itsrun.info/sitemap.xml` を送信し、主要URLをURL検査する。
   - 旧サイトの上位URLと被リンクを確認し、必要なHTTP 301 mappingを決める。
3. AdSense
   - 初回公開では広告を無効のままにし、正式URLでPrivacyを確認してからGoogle認定CMPを設定する。
   - 再開前にsite approval、ads.txt、privacy policy、Google認定CMP、Consent Mode、mobile CLSを確認する。
4. Production hosting
   - Preview stackをそのままproduction化せず、保持・versioning・rollbackを備えたproduction resourceを用意する。
   - CloudFront用certificate、custom domain、cache/security policyを確認する。
   - Previewのdefault domainは引き続き検索対象外にする。

## 配信層で未実装の事項

現在のSPA fallbackは、既知routeの直接アクセスを成立させる一方、HTTP上ではclient-side redirectやsoft 404になります。正式公開用CloudFrontでは、旧URLの301と未知URLの404をedgeまたは静的hosting設定で扱ってください。候補には次が含まれます。

- `/tracks` → `/`
- `/en/tracks` → `/en/`
- `/index.html` → `/`
- `/komazawa_olympic` → `/komazawa`
- Search Consoleで確認した旧URL

Social crawlerへroute別metadataを確実に渡す必要がある場合は、公開routeごとの静的HTML shell／prerenderとCloudFront rewriteをproduction hostingに組み込みます。現在も各routeのブラウザ表示と検索engineのJavaScript renderingではroute別metadataへ更新されますが、初期HTMLのOGPはサイト共通です。

## 公開直前・直後の確認

- `robots.txt`、`sitemap.xml`、`ads.txt`のstatus、content type、本文。
- `/`、`/en/`、施設、About、Privacy、旧URL、未知URL、未来日query。
- canonical、hreflang、OGP image、title、description。
- 33施設、availability range、unknown保持、公式リンク、経路、現在地拒否。
- desktop/mobile、keyboard focus、横scroll、LighthouseのLCP/CLS/INP。
- fresh availability生成、validation、test、lint、build、production smoke。
- CloudFront cache、certificate、GitHub Actions失敗通知、手動再実行、直前buildへのrollback。
- DNS切替後の複数resolverと、旧Firebaseへ戻せるrecordの保持。
