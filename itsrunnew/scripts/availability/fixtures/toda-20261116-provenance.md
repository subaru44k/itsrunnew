# 戸田12月行事表の文字baseline差（2026-11-16）

- 公式landing: https://toda-zaidan.org/sportscenter/shisetsu_sc/yoyaku_sc/
- 原本: https://toda-zaidan.org/wp-content/uploads/2026.12.pdf
- 取得日: 2026-11-16 JST。表題「戸田市スポーツセンター行事予定表 令和8年12月」、右下「令和8年11月15日現在」。全1ページを画像化して全31行・施設列・人数列・時刻列を照合。
- 原本fixture `toda-202612.pdf` SHA-256: `ff6bc5b9deaeb81fa22917d83f26b4d3831c47e87f30bb5d1b8d2404d8fec8d5`。landing原文は `toda-20261116-landing.html.gz`。

## 全日照合

陸上競技場の専用利用は5・6・12・19・20・26・27日13–17時、13日9–13時と13–17時。9日は休場日、10日は臨時休場日、30・31日は結合セルの年末・年始休場日。他日は陸上の記載なし。第一競技場・剣道場・テニスコート等の予定を混ぜず、専用利用以外を個人利用可と推測しない。冬季は夏季17–18時の開放欄なし。

## 原因と境界

6日の陸上競技場labelはPDF座標y=579.94、同じ行の時間はy=577.66。差2.28ptが従来の1.5pt上限を超えた。隣接するevent行は9.6pt間隔。冬季だけ3pt未満の照合に広げ、時刻候補が一つの場合だけ採用。既存の全幅罫線による日付境界・施設名の完全一致・時刻列x>510・年月/identity guardは保持。時間欠落・3pt外・複数候補はsource_changedで停止。

`../toda-20261116.test.ts` は全31日、他施設を借りないこと、空欄unknown、専用枠unknown+unavailable period、欠落/曖昧/距離/境界/年guard、実collectorの発見・sourceHash・parser versionを検証する。旧11月・夏季10月の原本回帰も維持する。

## 同時調査した公開障害

2026-11-16 monitor run 43779267520 は世田谷extraction_failedも検出。08:15 JST収集ログでは `Setagaya daily notice not found`。調査時の公式landingには https://www.se-sports.or.jp/news/23330/ （2026/11/16、陸上17–19時・19–21時、他の時間は不可）が現れており、コード変更せず既存Productionの実収集・AI読解・公開後monitorで復旧を確認する。未来日は引き続きoutside_published_period。維新の復旧イベントは公式再取得と公開枠を照合し、日付経過だけで判断しない。

## 維新の調査中のナビゲーション更新

朝の収集後、11/11告知の抽出本文は次の記事「維新公園ガーデニング教室」追加、修繕告知は前の記事が「清掃・点検日」から「WEBアンケートのお願い」に変更。公式2ページの本文を全文比較し、11・12月表と修繕条件/地図の4原寸画像を再取得・表示して全61行/条件を再照合した。個人利用条件・日程は変更なし。新しい本文hashだけを11/11告知packetの場合に有限追加し、旧packetも維持する。本文からナビを一般的に削るようなguard緩和はしない。

- 告知 https://www.ishin100.com/main/info_mirasta_kojin_20261111/ 正規化本文SHA-256 `e3aa4c15fdd048bc11f8d12e21aa2871c94618442600c334af55d9f9bd4bc20d`
- 修繕 https://www.ishin100.com/main/info_hojyo_track_syuzzen_kouji_20261019/ 正規化本文SHA-256 `171b03bfe712bc77795a7c76e5cdec06e97df150fbc22d442defeba0d88a97e1`
- 11月原寸表 `ecacb225bef98759fd26401b21752909640a9df2a115768038557f140c351ad9`、12月 `8c27eb69fb616ad355f0809b9c65447463421edbee02ffbffc1ad265b6ce7486`、修繕本文画像 `3fce558458d3c018a3a723ad71aa889512abfb31c9bd28b78fab9c6fc5f3ef39`、地図 `58fe55b009b85330c4b4acb9e4e65df2d7909490dcf6fa8e67024aa45f5a9a5e` は前回reviewと同一。

原文HTML2件は `ishin-20261116-{notice,repair}.html.gz`、原寸画像入りpacketは `ishin-20261116-packet.json.gz`。`../ishin-20261116.test.ts` は元byte/本文hashの一致、旧packetと全61日同一、11/15unknown維持、11/16の13–22時、26日の逆走条件、各資料の変更/欠落/別施設/別年guardを確認する。監視の復旧条件は変更しない。
