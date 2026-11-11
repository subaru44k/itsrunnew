# 練馬 2026-11-10 更新表の確認（11/11取得）

公式 https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html と、そこに掲載された https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20261110souun_kaihoujoukyou2.pdf を取得。全1ページの7日21枠を画像化して凡例と照合した。原本SHA256 f86450b13d051c650918cdb8b615ec83ac3e9cc9d1fd65ebbe6d2db07272f486。凡例も再取得し464257780a924b091241d55a04d062addbb507d535316a043a14b0c2524a4ffbで一致、PyMuPDFで文字を含め表示確認（ローカルPopplerの日本語CMap欠損を補完）。

11/10・14は朝と午後トラック優先（ボール不可）、昼は緑レーンのみジョギング・ウォーキング可、陸上競技・幅跳び不可。11日は朝半面、昼緑レーン、午後団体。12日は昼緑レーンのみ。13日は午後半面のみ。15・16日は全枠団体貸切。各枠9–12、12–15、15–17時。掲載外はunknown、新hash以外へ外挿しない。旧表11/10の団体判定は遡及変更しない。

検知 https://github.com/subaru44k/itsrunnew/actions/runs/42929895744 。新表への更新でsource_changedとなった。回帰は原本collector経由の全21枠・時間・scope・条件・掲載外・原本/凡例変更拒否を検証する。
