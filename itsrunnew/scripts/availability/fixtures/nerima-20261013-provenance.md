# 練馬総合運動場公園・2026-10-13更新の週間表

公式原本を2026-10-13に取得し、全ページと確認方法の凡例を画像で照合した。

- 施設案内: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html
- 週間表: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261013souun_kaihoujoukyou.pdf
- 確認方法: https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/kakuninnhouhou_kaihoujoukyou.pdf
- 週間表SHA-256: `b76afbae515b271ce8b99b477e8669f9825acb70a3d1a40f0700d8fc5f2a1e5f`
- 凡例SHA-256: `464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffb`

PDFの文字は外部のAdobe-Japan1 CMapを必要とし、PDF.jsへ同梱CMapを指定しない旧処理では文字抽出が空になった。CMap指定後も日別statusは複数セルを含む画像であり、旧文字ベースの優先利用判定には使えない。

週間表の対象は10月13〜19日。時間枠は9〜12、12〜15、15〜17時。13日午前は一般開放【半面】、昼は全面の人工芝優先（陸上競技の練習不可）、午後は団体利用。14〜19日は3枠とも団体利用。凡例は人工芝優先時でも陸上トラック端の緑レーンでジョギング・ウォーキング可と明示するため、昼を一律利用不可にはしない。

施設案内は10月9〜18時だが、この週間表は17時までしか掲載しない。17〜18時はunknownとして残し、14〜19日も終日利用不可と断定しない。13日は一部利用可能。掲載外の20日以降はoutside_published_periodであり、31日全体へ予定を外挿しない。

`nerima-reviewed.ts` はこの週間表と凡例の両hashが一致するときだけ適用する有限補正。新しいPDFは旧文字parserで検証し、画像形式・未知構造はsource_changedのunknownになる。新資料の手動レビューが必要な場合は対象期間、全日・全枠、凡例、時間差を再確認し、hash・fixture・回帰テストを同じ変更で更新する。今回のPDFを翌週へ読み替えない。
