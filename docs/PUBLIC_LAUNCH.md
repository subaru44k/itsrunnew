# Public launch readiness

`https://itsrun.info/` を新サイトへ切り替える前後の、検索・計測・プライバシー・広告・確認項目をまとめます。DNSとhostingの現状、切替、rollbackは [`PRODUCTION_DOMAIN.md`](PRODUCTION_DOMAIN.md) が正本です。

## Repositoryで実装済みの公開準備

- 正式URLを `https://itsrun.info` に統一したcanonical、日英hreflang、OGP/Twitter metadata。
- 18 canonical URLだけを掲載した `public/sitemap.xml` と、sitemapを案内する `robots.txt`。`/tracks`、`/en/tracks`、日付queryは重複URLとして掲載しない。
- `/tracks` → `/`、`/en/tracks` → `/en/` のclient-side互換redirect。日付queryは維持する。
- About、Privacy、日本語・英語の各ページと、利用者向け404画面。
- GA4 `G-YNLS7KQXYW`。初期状態ではGoogle tagを取得せず、利用者がアクセス解析へ同意した後だけ読み込む。拒否しても全機能を利用でき、フッターから選択を変更できる。
- 広告は `VITE_ADSENSE_ENABLED=true` を明示しない限り読み込まない。正式URLのAdSense確認とGoogle CMPの設定・公開は完了しているが、広告枠とmobile CLSを見直す別変更まで無効を維持する。`ads.txt`は維持する。
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
   - `itsrun.info`のサイト確認とGoogle CMPの設定・公開は完了。PrivacyもAdSense再開時の情報取扱いを記載済み。
   - 広告同意はGoogle CMP、GA4同意はサイト内UIで分離するため、Google CMPのConsent Mode設定で「analytics purposes」をOFFにして二重管理を避ける。
   - 再開前にsite approval／配信可能status、`ads.txt`、Auto ads設定、既存広告枠、mobile CLS、CMPの地域別previewを最終確認する。
   - 確認後、PreviewはfalseのままProduction workflowの `VITE_ADSENSE_ENABLED` だけをtrueへ変更し、PR・Production deploy・正式URL実機確認を行う。
4. Production hosting（2026-08-25完了）
   - Preview stackとは別に、保持・versioning・rollbackを備えたProduction resourceを構築済み。
   - Route 53、ACM certificate、CloudFront custom domain、cache/security policyを確認済み。
   - PreviewとProduction default domainは引き続き検索対象外。

## Production配信層で実装済みの事項

Production CloudFrontは、既知routeをSPA entryへrewriteし、次の旧URLをHTTP 301、未知URLを静的`404.html`のHTTP 404として処理します。

- `/tracks` → `/`
- `/en/tracks` → `/en/`
- `/index.html` → `/`
- `/komazawa_olympic` → `/komazawa`
- Search Consoleで確認した旧URL

Social crawlerへroute別metadataを確実に渡す必要がある場合の静的HTML shell／prerenderは将来候補です。現在も各routeのブラウザ表示と検索engineのJavaScript renderingではroute別metadataへ更新されますが、初期HTMLのOGPはサイト共通です。

## 公開直前・直後の確認

- `robots.txt`、`sitemap.xml`、`ads.txt`のstatus、content type、本文。
- `/`、`/en/`、施設、About、Privacy、旧URL、未知URL、未来日query。
- canonical、hreflang、OGP image、title、description。
- 33施設、availability range、unknown保持、公式リンク、経路、現在地拒否。
- desktop/mobile、keyboard focus、横scroll、LighthouseのLCP/CLS/INP。
- fresh availability生成、validation、test、lint、build、production smoke。
- CloudFront cache、certificate、GitHub Actions失敗通知、手動再実行、直前buildへのrollback。
- DNS切替後の複数resolverと、旧Firebaseへ戻せるrecordの保持。
