# 練馬総合運動場公園・2026-10-23更新の週間表

監視run [39904494850](https://github.com/subaru44k/itsrunnew/actions/runs/39904494850)（revision `e674f82f5b43937ea595df81fdd8213d67f837ce`）を調査。公式週間表の更新によるsource_changedで、利用不可を意味しない。

- 施設案内: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html
- 週間表: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261023souun_kaihoujoukyou2.pdf
- 確認方法: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf
- 週間表SHA-256: `f1a4d6d0c0077c1581ef813fc72d3c65c83dba252af1a2e4ed8399cd1e1734c9`
- 凡例SHA-256（変更なし）: `464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`

2026-10-23に原本1ページの全21枠を画像で確認し、PDF.jsの文字抽出でも日付・公開日・枠時刻を照合。従来と違い一般開放の優先利用文字は抽出できるが、団体利用・半面の図は文字のみで判定できない。未知hashを旧文字parserへ戻すと部分的に読めて誤判定するため、週間表の未確認hashは常に再レビューを要求する。

| 日付 | 9〜12時 | 12〜15時 | 15〜17時 |
|---|---|---|---|
| 10/23〜25 | 団体利用 | 団体利用 | 団体利用 |
| 10/26 | 団体利用 | 全面・人工芝優先（緑レーンのみ） | 団体利用 |
| 10/27 | 全面・陸上トラック優先 | 全面・人工芝優先（緑レーンのみ） | 全面・陸上トラック優先 |
| 10/28 | 一般開放【半面】 | 全面・人工芝優先（緑レーンのみ） | 団体利用 |
| 10/29 | 団体利用 | 全面・人工芝優先（緑レーンのみ） | 団体利用 |

陸上トラック優先はボール類不可。半面は団体区画への立入不可。人工芝優先は緑レーンのジョギング・ウォーキングのみで、陸上競技の練習・幅跳びレーン不可。施設案内の10月終了時刻18時に対し週間表は17時までのため、全日17〜18時はunknown。23〜25日も終日不可とはせずinsufficient_information、26〜29日はpartially_available。22日以前・30日以降へ外挿しない。資料・凡例の両hashを照合する。
