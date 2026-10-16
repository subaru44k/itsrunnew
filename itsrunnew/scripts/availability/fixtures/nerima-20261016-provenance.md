# 練馬総合運動場公園・2026-10-16更新の週間表

2026-10-16の監視run [38852739742](https://github.com/subaru44k/itsrunnew/actions/runs/38852739742)（revision `4bcdfe86a83e3e9547381e59db3792123bd55631`）のsource_changedを調査。公式ページの週間表が10月13日版から16日版へ更新され、旧版だけのhash照合から文字parserへ戻り、画像の凡例anchorを確認できず全31日がsource_changedになった。通信障害や利用不可を示す通知ではない。

- 施設案内: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html
- 週間表: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261016souun_kaihoujoukyou.pdf
- 確認方法: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf
- 週間表SHA-256: `2bb147e1a314fe7517e8a33b3ab670470065c326f0105ebf93cdd07ffd9768f0`
- 凡例SHA-256（変更なし）: `464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`

原本の全ページ（1ページ）を画像で確認し、凡例は既存fixtureと同一hash、文字抽出でも内容を再確認した。対象は10月16〜22日。9〜12、12〜15、15〜17時の3枠を全日確認した。

| 日付 | 9〜12時 | 12〜15時 | 15〜17時 |
|---|---|---|---|
| 10/16〜20 | 団体利用 | 団体利用 | 団体利用 |
| 10/21 | 一般開放【半面】 | 一般開放【半面】 | 団体利用 |
| 10/22 | 団体利用 | 一般開放【全面】・人工芝グラウンド優先 | 団体利用 |

半面開放は団体区画に入らない条件を保持。人工芝優先は陸上競技の練習（幅跳びレーン含む）は不可だが、端の緑レーンでジョギング・ウォーキングは可能なので、lane_subsetのavailableとする。

施設案内の10月終了時刻18時に対し週間表は17時までのため、17〜18時はunknownを保持する。16〜20日も終日利用不可と断定せずinsufficient_information、21〜22日はpartially_available。掲載外の日はoutside_published_period。

13日版の確認済み結果も保持し、PDFごとに期間・公開日・全枠を分離する。週間表・凡例の両hash照合を必須とし、未知の画像資料へ予定を外挿しない。確認方法に記載の更新頻度は毎週火・金曜日。今後も新しい画像資料にはレビューとfixture・日程・回帰テストの更新が必要。この修正は今回の資料への対応であり、汎用画像読解の導入ではない。
