# 練馬総合運動場公園 2026-10-27更新表の原本確認

2026-10-28 10:44〜10:46 JSTに公式資料を再取得・確認。

- [公式施設案内](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html)は更新日2026年10月27日。無変更HTMLを`nerima-20261028.html`に保持。現行の直近1週間リンクから下記PDFを発見する。
- [新週間PDF](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261027souun_kaihoujoukyou2.pdf)は`nerima-20261027.pdf`に無変更で保持。SHA-256 `ebc422b517fd3dc18f90a8672d85b15073fe77b1cfa2a51cdc46bbf4572a692f`。1ページのタイトル・更新日・全7行21枠・注意書きを原本レンダリングで確認。文字抽出だけでは画像内のstatusを読めない。
- [凡例PDF](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf)は全2ページを確認し、既存`nerima-opening-guide.pdf`とSHA-256 `464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`が一致。人工芝優先は緑レーンのジョギング・ウォーキングだけ可、陸上競技・幅跳びレーン不可。半面開放と団体全面貸切を区別する。

| 日付 | 09〜12時 | 12〜15時 | 15〜17時 |
|---|---|---|---|
| 10/27 | 全面・陸上トラック優先、ボール不可 | 緑レーンのみ | 全面・陸上トラック優先、ボール不可 |
| 10/28 | 半面開放、団体区画不可 | 緑レーンのみ | 団体貸切 |
| 10/29 | 団体貸切 | 緑レーンのみ | 団体貸切 |
| 10/30 | 団体貸切 | 団体貸切 | 団体貸切 |
| 10/31 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/1 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/2 | 団体貸切 | 団体貸切 | 団体貸切 |

現行施設案内の「陸上競技場・多目的広場」利用時間は、4〜5月9〜18時、6〜7月9〜19時、8〜9月9〜18時、10〜3月9〜17時（6列結合）。会議室の9〜18時、開園6〜19時と混同しない。新表の期間は施設利用時間と一致するため17〜18時のunknown枠は加えず、10/30〜11/2は利用不可とする。過去に確認した旧packetの補正を遡及変更しない。混雑・予定変更の注意は保持。

新資料・凡例hash不一致は引き続きsource_changed。10/27より前と11/3以降へ外挿しない。`nerima-20261028.test.ts`で実landing HTMLからの発見、全21枠の独立転記、条件、月またぎ・範囲外、画像と凡例の変更guardを検証。

障害は前回終了後の[scheduled monitor 40455185603](https://github.com/subaru44k/itsrunnew/actions/runs/40455185603)で発生（10/27 14:25 JST）。10/28のProduction [40605397843](https://github.com/subaru44k/itsrunnew/actions/runs/40605397843)は配備全工程成功だが練馬はsource_changedでunknown。東京体育館・駒沢の外部停止は同monitorで復旧している。維新の既報coverage incidentは別件として保持する。

当日のscheduled monitor未起動・実行中なしを確認し、許可済み手動監視[40616696970](https://github.com/subaru44k/itsrunnew/actions/runs/40616696970)を実行。state/report/events/fetch-diagnosticsは全て正常に保存され、練馬はcoverage_drop+source_changedに変化。通信診断は空配列で、取得障害ではなく未確認新表の安全停止と特定。
