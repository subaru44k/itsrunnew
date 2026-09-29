# 三郷の結合セル休場 regression fixture

2026-09-29取得。公式のPDF原本を保存し、PDF.js 6の文字と罫線の座標抽出、結合セルの上下端、隣接する通常利用日をまとめて検証する。ブラウザ配信・availability生成物には含めない。

| Fixture | 公式URL | SHA-256 | 明示的な休場範囲 |
|---|---|---|---|
| `misato-202609-closure.pdf` | https://www.misato-hall.com/secure/4855/89-21.pdf | `39866bef0800ad5838c9717096a398cd08927463d643355a7ee38550842dcec6` | 9/22〜9/30 |
| `misato-202610-closure.pdf` | https://www.misato-hall.com/secure/4855/810-12.pdf | `c1700f7f669fdf2ee505b99968669962a2b1431ab826897ac5c661d5140a200a` | 10/1〜10/9 |

実際の再開を保証するfixtureではない。公開判定は毎回の公式資料を取得し、形式変更や境界不明時はunknownへ降格する。
