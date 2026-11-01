# 2026-11-01 知多・和田堀の公式原本確認

取得・全文/全表の確認: 2026-11-01 JST。監視run [41261646198](https://github.com/subaru44k/itsrunnew/actions/runs/41261646198) の新規異常を調査した。

## 知多運動公園陸上競技場

公式 [一般開放予定](https://www.chita-sports.com/info/105/) の原本を `chita-20261101.html.gz` にgzip保存（元バイト列は改変なし）。raw SHA-256: `ce8d613b4b9bba74cde4de806bcd47326f2abf991fc6056ee1b6ba8faa0bef54`。`sourceInputs` の可視本文 SHA-256: `be3626cfa127a3f392e12f83f93da5974803c6c57f333264ad929af90be5bd9c`。

当該記事の施設identity、改修期間「令和8年11月3日〜令和9年3月31日」、期間中に競技場を利用できない本文、11月1日の専用利用で一般開放不可の追記を全文確認した。記事に残る2024-04-23は記事初出表示で、改修の対象年ではない。11月1日は2026年の日曜と改修文脈も照合した。残存する10月PDFを11月へ外挿しない。11月2日は日別根拠がないためunknown（一般の月曜休館案内だけから競技場の終日閉鎖を推定しない）。4月1日の自動再開も推定しない。

11月以降は当月PDFがなく従来のdiscoveryが全日extraction_failedになっていた。改修見出しと施設identityがあるtext-only packetを有限reviewへ渡す。原本本文hash、URL、施設IDが一致するときだけ、11月1日と11月3日〜3月31日をunavailableにする。未知告知はsource_changedで停止しAIへ戻さない。通常の月間PDFがある場合のAI経路は維持する。全5か月150閉鎖日、11月2日、期間外・別年・改変本文・identityとAPIなしの統合を `chita-20261101.test.ts` で検証する。

## 和田堀公園 第一・第二競技場

公式 [一覧](https://www.tokyo-park.or.jp/park/wadabori/news/index.html) と [11月・12月告知](https://www.tokyo-park.or.jp/park/wadabori/news/2026/wada_sch_11_12.html) の原本を `wadabori-20261101.html.gz` / `wadabori-article-20261101.html.gz` に保持する。

- 第一原本 `wadabori-202612-1.pdf`: [公式PDF](https://www.tokyo-park.or.jp/park/wadabori/assets/%E7%AC%AC%E4%B8%80%E7%AB%B6%E6%8A%80%E5%A0%B412%E6%9C%88%E5%88%86_1.pdf)、SHA-256 `156a991789278e4c4037f290ea955c842027ad24657ff567e53f33b5d808dfd3`。
- 第二原本 `wadabori-202612-2.pdf`: [公式PDF](https://www.tokyo-park.or.jp/park/wadabori/assets/%E7%AC%AC%E4%BA%8C%E7%AB%B6%E6%8A%80%E5%A0%B412%E6%9C%88%E5%88%86_1.pdf)、SHA-256 `106d9f078347467eb07af8863d4f3d1517e9fcedef323567a05e0878a8de9cb1`。

両方A3縦1ページ、2026年10月25日付の12月表。PDFレンダリングを視認し、全62日/124半日枠・曜日・施設identity・凡例を独立転記した。A3の日付x座標は第一77〜87、第二59〜64で、旧parserのx<=55から外れ12月1日がsource_changedになっていた。従来parserの座標範囲を無制限に広げず、この2原本と2026年12月だけを有限判定する。未知の12月PDFはsource_changedで停止し、1月/別年/別施設に流用しない。11月と他の既存月のparserは維持する。

第一: 午後貸切3/10/17/24、午前整備4/11/18/25、終日貸切5/12/13/20/26/27、12/29〜1/3年末年始休み。その他は一般開放（空欄含む）。第二: 終日貸切5/12/13/20/26/27（12/13/27は☆で昼も不可）、終日整備7/14/21/28（原則昼も不可）、12/29〜1/3休み。2/6/9/16/19/23はトラック・フィールド一般開放、その他空欄はトラックのみ。両施設9〜12時/13〜17時、夜間利用を控える案内。1月はこのreviewで外挿しない。

回帰検証 `wadabori-202612.test.ts` は実原本によるdiscovery、全124枠、凡例条件、年末休場、hash・施設・年月guardを確認する。

## 外部取得障害と継続中の情報不足

同monitorの井の頭・富士森はHTTP 403。localで公式GETは両方200、08時台Productionの収集も成功しており、恒常的な形式変更とは未確定。公開後monitorで再確認し、unknownを利用可に置換するコードは追加しない。日産小机の年付き根拠不足と維新の未明示日も本修正で緩和しない。
