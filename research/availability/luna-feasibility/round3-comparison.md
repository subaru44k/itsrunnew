# Round 3比較

同じ固定資料でLuna noneを3回独立実行。188件・5施設（4資料系統）。Astraの2件を原資料確認で訂正した別referenceと比較。ID不一致は日付で診断比較するが、合格にはしない。

|施設|件数|core一致 run1/2/3|3回安定|ID整合 run1/2/3|core gate|
|---|---:|---|---:|---|---|
|todoroki|37|27/30/26|25|NG/OK/OK|hold|
|balcom-main|37|19/15/6|3|OK/NG/NG|hold|
|balcom-aux|37|14/13/17|12|OK/OK/OK|hold|
|chita|38|24/33/25|25|NG/OK/OK|hold|
|anjo|39|37/37/37|39|OK/OK/OK|hold|

Luna API推計実費: $0.10801348（15 requests、応答usageと取得時料金から算出）。AstraはCodexサブエージェントで実行、API課金なし。

coreはstatus・隣接区間を結合した開始/終了・最終入場。条件や根拠の言い回しは採点対象外。これはモデル比較であり、全件の人手正解に対する精度ではない。詳細はローカル results/round3/comparison.json、core-differences.json、primary-adjudications.json。
