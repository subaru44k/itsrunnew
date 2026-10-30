# 練馬総合運動場公園 2026-10-30更新表の原本確認

2026-10-30 16:43〜16:48 JSTに公式資料を取得・確認。

- [公式施設案内](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html)の更新日は2026年10月30日。無変更HTMLを`nerima-20261030.html`に保持し、直近1週間リンクから現行PDFを発見する。
- [週間PDF](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261030souun_kaihoujoukyou2.pdf)の無変更原本を`nerima-20261030.pdf`に保持。SHA-256 `7d4f98c05268af7e9e31bc4a40aa5a7e2d32911cb6e4f82dc88cb56313412b67`。全1ページの施設名・更新日・7行21枠・注意を画像で確認した。画像statusは文字抽出だけでは確認できない。
- [凡例PDF](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf)は既存`nerima-opening-guide.pdf`とSHA-256 `464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`が一致。全2ページを再確認。人工芝優先ではトラック端の緑レーンのみジョギング・ウォーキング可、陸上競技の練習・幅跳びレーン不可。団体利用は全体の貸切で個人利用不可。

| 日付 | 09〜12時 | 12〜15時 | 15〜17時 |
|---|---|---|---|
| 10/30 | 団体貸切 | 団体貸切 | 団体貸切 |
| 10/31 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/1 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/2 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/3 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/4 | 団体貸切 | 団体貸切 | 団体貸切 |
| 11/5 | 団体貸切 | 緑レーンのみ | 団体貸切 |

施設案内の「陸上競技場・多目的広場」の10〜3月は9〜17時（6列結合）。週間表と一致するため、この版も17〜18時のunknown枠を追加しない。会議室の9〜18時と混同しない。混雑時の人数・時間制限、集団・団体による占有禁止、予定変更の注意を原資料で確認し、既存の混雑・変更warningを保持する。

新資料hashに日程・範囲を結び付け、10/29以前と11/6以降に外挿しない。10/30〜11/4は利用不可、11/5は緑レーン条件付きの一部利用可能。未知の週間表・凡例は引き続きsource_changedで安全停止する。以前の確認版を遡及変更しない。`nerima-20261030.test.ts`で実landingからの発見、全21枠の独立転記、時間・緑レーン条件、境界日・別年、原本/凡例変更guardを検証する。

## 障害の根拠

[当日のscheduled monitor 41013182345](https://github.com/subaru44k/itsrunnew/actions/runs/41013182345)は09:30予定から遅れて15:17 JSTに開始し、新PDF未確認によるsource_changedを検知。state/report/events/fetch-diagnosticsは全て保存されていた。[Production 40992447348](https://github.com/subaru44k/itsrunnew/actions/runs/40992447348)、revision `1f168b0624a5599872f84798c9cda4ef2ea542ac` は全配備工程に成功していたが、16:47 JSTの公開31日×133施設の照合では練馬のみsource_changed。workflow成功を施設正常とは扱わない。

同monitorは大井・しらこばと・上柚木・町田・ゼットエーオリプリ・等々力・万博の7施設でも接続timeout（Undiciとcurl、各2試行）を記録。16:45 JSTのローカル再取得では全公式URLがHTTP 200、公開中データもこの7施設に取得異常なし。原因は練馬の資料変更とは分離し、GitHub runnerからの再収集と既知日の回復を確認するまで復旧と断定しない。日産2施設の年月裏付け不足と維新の既報coverage incidentも別件として維持する。
