# 練馬総合運動場公園・2026-10-20更新の週間表

監視run [39373314946](https://github.com/subaru44k/itsrunnew/actions/runs/39373314946)（revision `d64df72c6a47b298ad9d9b160f68f6219933aaa9`）のsource_changedを調査。公式週間表が10月16日版から20日版へ更新され、未確認の画像資料が文字parserの凡例anchor検証で停止した。通信障害や終日利用不可の通知ではない。

- 施設案内: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html
- 週間表: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261020souun_kaihoujoukyou.pdf
- 確認方法: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf
- 週間表SHA-256: `635046cef4cf10eccc7d765c02b325a3e456abd41b815d4aa4362f7a94c5ddd1`
- 凡例SHA-256（変更なし）: `464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`

原本1ページの全21枠を画像で確認し、PDF.jsの文字抽出で日付・更新日・枠時刻を照合。凡例は既存fixtureと同一hashで、本文も再確認した。

| 日付 | 9〜12時 | 12〜15時 | 15〜17時 |
|---|---|---|---|
| 10/20 | 全面・陸上トラック優先 | 全面・人工芝優先（緑レーンのみ） | 全面・陸上トラック優先 |
| 10/21 | 一般開放【半面】 | 一般開放【半面】 | 団体利用 |
| 10/22 | 団体利用 | 全面・人工芝優先（緑レーンのみ） | 団体利用 |
| 10/23〜25 | 団体利用 | 団体利用 | 団体利用 |
| 10/26 | 団体利用 | 全面・人工芝優先（緑レーンのみ） | 団体利用 |

陸上トラック優先はボール類不可、半面は団体区画への立入不可。人工芝優先は緑レーンのジョギング・ウォーキングのみで、陸上競技の練習・幅跳びレーン不可を保持する。

施設案内の10月終了時刻18時に対し週間表は17時までのため、17〜18時はunknown。20・21・22・26日はpartially_available、23〜25日はinsufficient_informationとし、終日利用不可にしない。19日以前・27日以降はoutside_published_period。既存資料の結果も保持し、新しいPDF・凡例は両hash照合で再レビューを要求する。公式更新頻度は毎週火・金曜日のため、この有限補正は次回の未知資料へ外挿しない。
