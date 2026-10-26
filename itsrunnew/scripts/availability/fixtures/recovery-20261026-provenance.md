# 2026-10-26 availability 原資料照合

監視: [40272765555](https://github.com/subaru44k/itsrunnew/actions/runs/40272765555)、revision `a0f35b8a2b029714d3d2194ff1a59c197b5a6672`、取得14:10 JST。09:30予定の当日scheduleは14:09に起動し完了。state/report/events/fetch-diagnosticsを取得し、継続中の7施設を調査した。以下の原資料は同日15時台JSTに再取得・画像と本文を照合。利用不可も既知statusに含め、電話確認・未掲載・期間外を障害へ追加しない。

## 戸田

- [公式予約案内](https://toda-zaidan.org/sportscenter/shisetsu_sc/yoyaku_sc/)、[11月原本](https://toda-zaidan.org/wp-content/uploads/2026.11.pdf)、[10月原本](https://toda-zaidan.org/wp-content/uploads/2026.10-2.pdf)。11月PDF SHA-256 `d0c0b1f4013634572f7bec8859d70f114b9c7415c9ecafb9228c1a7b45c6572a`。
- 11月表は「令和8年11月」、10月15日現在。夏季17–18時の○欄が消え、施設名・人数・時間の列が右へ移動。従来の夏季anchorがsource_changedの原因。日付が複数行の中央にあるため、全幅罫線で日を区切る。
- 陸上の専用利用: 1日9–13、3日9–17、7日9–13と13–17、8・12・13・15・28・29日9–17。11日は休場日。他施設の予定は除く。空欄と専用利用時間外はunknown、夏季開放を外挿しない。明示専用枠は保持して日全体はunknown、11日のみ終日利用不可。
- `toda-202610.pdf` / `toda-202611.pdf` は無変更原本。全30日の枠と隣接日混入なし、夏季の31日17–18時、罫線欠落・年違いの停止を回帰検証。

## 国府台

- [公式案内](https://www.city.ichikawa.lg.jp/page/4185.html)、[10月原本](https://www.city.ichikawa.lg.jp/uploaded/attachment/60241.pdf)、[11月原本](https://www.city.ichikawa.lg.jp/uploaded/attachment/58962.pdf)。10月SHA-256 `d7821db1027230dae579b01b7cb17ca9ee50a715b428e0897a554853be686058`。
- 10月はスキャン画像で文字抽出0。全31日の利用時間・使用時間・個別閉館注記を画像照合。公式landingの「使用時間」以外を一般開放する方針と更新年も毎回確認する。
- 26日は休場。27日は9–13時の陸上大会予備日で13–21時が開放、28・29日は9–21時、30・31日は大会9–17時の後17–21時が開放。5・13・19日は17時閉館。使用時間中の個人利用禁止を保持し、予備日を勝手に解除しない。
- `reviewed-kohnodai.ts` は上記hash・2026年10月のみの有限補正。無変更原本をfixtureへ保存。未知scanは抽出失敗のunknown、別月・翌年へ外挿せず、11月文字PDFは既存parserを使用。

## 博多の森補助

- [公式トップ](https://www.midorimachi.jp/higashihirao/)、[10月21日版2ページ原本](https://www.midorimachi.jp/higashihirao/images/park/26102110584262.pdf)、[利用方法](https://www.midorimachi.jp/higashihirao/guides/)。原本SHA-256 `d6cf4db43ba14630ddb13ab56120ba5a7b3af1810687787cba177851fe926df4`。
- 10月改訂と11月の全日・補助列・上部注記を実画像で照合。メイン、球技場、テニス、弓道、駐車場の予定は除く。10月の対象列の開放判定は既存確認と一致。26–30日は9–18:30、31日は大会終了予定17時から18:30。11月は通常9–17時。1・13・21・29日は「一般開放なし」。3日は大会後13時、6・8・15日は15時、14・28日は14時から17時。他日は通常開放。大会の実際の終了状況による変更、当日受付・有料、天然芝一般利用不可を保持。
- 利用方法text hash `7edfd87f6470e1e0055a6ffb3027a9247de10f2c11594ba58d8e8059683d78ed` と注意事項PDFの2ページ画像hashは以前の確認済み資料と一致。予定PDFの差し替えがsource_changedの原因。
- 現packetのトップ以外のURL/hash/順序のidentity SHA-256 `fde1a30a3b006619bae161741eee8b95b68b8ca0743488098c0bc8298f012325`。両予定ページを含む全資料一致時だけ採用。旧10月版の有限補正も保持。12月・未確認hashはunknown。無変更PDFとmetadata fixtureにより画像hash、全11月、10月末、片ページ変更・資料削除を検証。

## 維新補助

- [公式トップ](https://www.ishin100.com/main/)は10月26日に復帰。[お知らせ一覧](https://www.ishin100.com/main/category/notice/)へ移った[予定告知](https://www.ishin100.com/main/info_mirasta_kojin_20261005/)を確認。トップのみの探索が「notice not found」になっていた。
- 10月原寸画像 `info_hojyoriku_class_202610_230261013_1.png` SHA-256 `79cf1a09a92c59cfb24e08e4efd4689c8283fdb97b89a771e80912b306c4c2a7`、11月 `info_hojyoriku_202611_20261005.png` SHA-256 `8e2c1eaf45400f9a5735a1381bd717dad1ba8403c757dbaa57f0e256af73ab41`。
- [修繕告知](https://www.ishin100.com/main/info_hojyo_track_syuzzen_kouji_20261019/)も画像で照合。11月26–28日、100/110mスタートの一部修繕、直線練習は逆走5–8レーン、200/400m・中長距離は通常どおり。今回公開31日の末日25日より先だが、AIのfull-month packetには含め、更新時の欠落を防ぐ。
- 環境のkeyが未設定のため、許可済み.zshrcのコメント付き代入だけを安全に解析し、子プロセス環境へ渡した。既存設定のgpt-6-luna mediumで実API読解を実施し、61/61行を構造検証。新packetの推論（cache miss）は入力9202・出力10715 token。10/26・29、11/2・6・12・16・19・24の8:30–17時（芝生除く）、11/9休場、11/26の修繕条件付き枠を原本と照合。前日の事務所問い合わせと急な予定変更の注意を保持。
- 過去の既知判定だった11/3・4・15等は現資料から個人開放を裏付けられずunknownのまま。取得/読解の復旧とcoverage_dropの復旧は別。基準を緩めない。
- fixture HTMLは実取得の対象リンクmarkup抜粋で、無関係な本文を省略。公式カテゴリを1回たどる、未掲載時に停止、修繕条件の原寸画像を含みthumbnailを除くことを回帰検証。

## 外部要因の3施設

東京体育館・駒沢はそれぞれTEFの予定URLがHTTP 200の「緊急メンテナンスのご案内」を返し、サイト停止の説明を再確認。東寺は公式予定APIと[公式一覧](https://www.kyoto-sports.or.jp/category/cat_topics/)が403。unknown/fetch_failedを維持し、施設の休場とは断定しない。公式本文の復帰後に影響日の予定と既知statusを再確認する。

## Production公開後smoke

[40252609720](https://github.com/subaru44k/itsrunnew/actions/runs/40252609720)は収集・local smoke・配備・公開本文照合は成功し、CloudFront mobile drawerクリックで失敗。初回lazy route確定時にVuetifyがdrawerを閉じる競合を避けるため、runtime viewのmountを待ってから開き、active drawer内の通常クリックを検証する。固定sleep・forceクリック・gateの緩和はしない。公開内容とrunの全体成否は別に追跡する。

## 公開後に見つかった維新のAI回答差と有限判定

PR #124のe2d260bを公開したProduction [40283634804](https://github.com/subaru44k/itsrunnew/actions/runs/40283634804)とPreview [40283634880](https://github.com/subaru44k/itsrunnew/actions/runs/40283634880)は全工程成功。しかし同一sourceHash `sha256:5e7c8c894c340598fe3ef808fab0227b6287fd8686d5a8ba3a89b8cff084df36`の独立読取で、Productionは11/3・4・15を終日利用不可、Previewは芝生の制限だけで開放日を一部利用扱いにした。元のローカル回答は大会日をunknown、トラック開放はavailableであり、原本に忠実。公開後照合で差を検知したためworkflow成功だけを復旧にしない。

月表の全行を再照合し、10月の明示開放は1・5・8・13・15・19・22・26・29日、11月は2・6・12・16・19・24・26・30日（8:30〜17時、芝生除く）。終日不可の明示は10/6と11/9の清掃・点検だけ。大会の時間だけでは終日個人利用不可の明示がないためunknownへ戻す。11/26は明示開放に修繕の直線レーン制限がかかるため一部利用可、27・28日は修繕条件を保持してunknown。

`reviewed-ishin.ts` は上記期間・全資料URL/hash一致だけの有限判定。月表2画像・修繕の条件画像・地図の原本4点を無変更保存し、metadata fixtureはcontentを省略。告知textと修繕告知textのhashも照合。月またぎの不要な10月画像除外だけを許容し、必要月の欠落・新資料・条件変更・別施設・別年では停止またはunknown。AI/cacheへ戻さず、明示開放・休場以外を埋めない。外部AI6施設・有限判定2施設となる。全61日・期間外・source guard・実collector経由のAPI非呼出を回帰検証する。
