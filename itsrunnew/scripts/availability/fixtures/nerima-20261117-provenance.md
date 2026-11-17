# 練馬 2026-11-17 更新表確認

- 公式landing: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html
- PDF: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261117souun_kaihoujoukyou2.pdf
- SHA-256: `45ce921efb45d0b5f9e32e281a975fce9d20aacdb89c7f1fab7b9595831762c5`
- 取得: 2026-11-17 JST。原本`nerima-20261117.pdf`、landing`nerima-20261117.html.gz`。
- 凡例も再取得し2ページの本文確認。hashは既存確認済み`464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`と一致。

原本1ページをPyMuPDFでrenderし、全7日21枠・更新年月日・施設名・凡例の表示を目視確認。bundled Popplerの日本語CMap不足のため文字が欠けたrenderは使わず、正常なPyMuPDF画像で確認した。9–12時／12–15時／15–17時の冬季時間を保持。

| 日 | 朝 | 昼 | 午後 |
|---|---|---|---|
| 11/17 | 半面 | 芝優先・緑レーン | 半面 |
| 11/18 | トラック優先 | 芝優先・緑レーン | 団体 |
| 11/19 | トラック優先 | 芝優先・緑レーン | トラック優先 |
| 11/20 | トラック優先 | 芝優先・緑レーン | 団体 |
| 11/21–23 | 団体 | 団体 | 団体 |

トラック優先はボール類不可。芝優先は緑レーンのジョギング・ウォーキングのみで、陸上練習・幅跳びレーン不可。半面のみ開放では団体区画への立入り不可。団体貸切は個人利用不可。旧版11/19の団体を新しい開放へ遡及変更しない。

`nerima-20261117.test.ts`で実collectorの全21枠/status/scope/時間/条件・URL発見・原本hash・期間外/別年・新PDFや凡例の変更停止を検証する。unknown日を利用可へ補完しない。
