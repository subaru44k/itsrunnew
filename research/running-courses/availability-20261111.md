# ランニングコースの利用状況確認（2026-11-11）

`codex/training-courses`での実装・ローカル確認。本番公開・新しい外部scheduleの有効化は行っていない。

## 表示と対象

- 一周距離filterを削除し、名称を「ランニングコース」に統一。距離自体は比較のため施設情報に残す。
- 対象は既存5施設。133トラックのavailability generation・partition・現地レポートAPIとは分離する。
- コースは四角markerとし、利用可（緑）、一部利用可（黄）、要確認（灰）、利用不可（赤）を地図・一覧・詳細・近隣リンクに反映する。明示不可のみ既定で除外する。
- 出典確認日・制限理由・公式告知を表示する。通常の開園時間と臨時制限は区別する。

## 確認結果

2026-11-11 16:35 JST取得（ファイルの生成時刻）。当日について和光樹林・駒沢・所沢航空記念・越谷は利用可、みさとは一部利用可。通常開放案内だけではなく、現在掲載されている告知本文・添付の変更も確認した。気象や当日突発事象まで保証するものではない。

| 施設 | 通常利用の根拠 / 告知 | 注意した区別 |
| --- | --- | --- |
| 和光樹林 | [施設案内](https://www.seibu-green.co.jp/wako-jurin/facility.html)、[開園案内](https://www.seibu-green.co.jp/wako-jurin/about.html)、トップ/ニュース | 自由利用の明示、既存のスピード走・集団走・スパイク禁止を保持。トイレ工事・断水・出店・催事をコース閉鎖としない |
| 駒沢 | [運動場の公園案内](https://www.tef.or.jp/kopgp/park/)、[公園管理者](https://www.tokyo-park.or.jp/park/komazawa-olympic/)、双方の掲載告知 | 11/16停電の対象設備は自販機と特定トイレ。11/25〜26の点検はストリートスポーツ広場。第一球技場・駐車場の工事をコース閉鎖としない |
| 所沢航空記念 | [トップ](https://www.parks.or.jp/tokorozawa-kokuu/)、[ジョギング案内](https://www.parks.or.jp/tokorozawa-kokuu/guide/009/009146.html)、ニュース/別配信重要告知 | 記念館駐車場閉鎖、南駐車場工事、サッカー場観覧席工事、テニス11番照明不良は対象別。重要告知の添付図面も目視照合 |
| 越谷（たかもとヘルスパーク） | [トップ](https://www.parks.or.jp/koshigaya/)、[公園エリア](https://www.parks.or.jp/koshigaya/guide/001/001182.html)、ニュース/別配信重要告知 | ソフトボール場解体・仮設事務所工事の車両横断/敷鉄板はサイクリングコース。添付の閉鎖区域は直線スケートエリア。1,830mジョギングコースの全面閉鎖ではない |
| みさと | [施設案内](https://www.seibu-la.co.jp/misato-yoshikawa/facility/misato.html)、[開園案内](https://www.seibu-la.co.jp/misato-yoshikawa/about/misato.html)、[夜間立入制限](https://www.seibu-la.co.jp/misato-yoshikawa/news/park/misato/202604011807485001.html) | 照明故障により3/31夕方から日没〜日の出は立入不可。復旧時期未定のため終了日null。同じサイトの吉川公園の洪水閉鎖と混同しない。みさとの池沿い冠水は告知タイトルの9/27解消追記を確認 |

個別の確認済み記事URL、本文/添付hash、採否の理由は`itsrunnew/scripts/course-availability/sources.json`に保持する。原本全文や大きな画像はリポジトリに複製しない。作業中の公式原本・添付の照合メモは`/tmp/itsrun-course-status-research/`（一時領域）にある。

## 更新の仕組み

`npm run collect:courses`で、公開済み`https://itsrun.info/availability/running-courses.json`を取得する。schema・全コースID・期限・fixture拒否を検証し、configHash一致かつ次回確認前ならその内容を再利用する。公開ファイルを取得できない、不正、設定が変わった、次回確認時刻を過ぎた場合は公式を再取得する。通常は7日後、unknownが一つでもあれば1日後を次回確認とし、取得時刻から8日で期限切れにする。`--force`で再取得できる。

通常利用の明示案内と全対象news feedの取得が必要。専用の通常案内ページはhash一致も必要とする。所沢・越谷はHTMLだけでは重要告知が得られないため、`/exis/c_jsdata/important.json`の共通10000と施設10008/10009を照合する。告知本文と添付画像/PDFのbyte hashを使い、同じURLの画像差替えも変更として扱う。非表示のJSテンプレート内のimgは添付としない。

確認済みhashは明示的なreview recordで解釈する。未知の告知は、施設名・ランニング/ジョギングコースの全体・終日・完全な西暦年月日期間が揃うHTML閉鎖のみ自動で不可にできる。曖昧な新規告知、部分規制、画像/PDFだけの情報、再開告知はunknownにしてreviewを待つ。単に「閉鎖」という文字がなかったことを利用可の根拠にはしない。新しい告知を完全自動で理解する仕組みではなく、定期取得・差替え検出と、確認済み根拠に基づく判定の自動化である。

閉鎖がニュース一覧から消えても、未解除の制限元URLは引き続き取得する。終了予定日だけで再開にしない。再開確認後にreviewへ根拠を残して`reopenConfirmed`を更新する。現在の継続制限を、次回確認より先の無期限な一般開放へ外挿しない。通常の利用可を出せる選択日は確認日〜次回確認日までで、それ以外の未確認日はunknown。

出力は`src/data/availability/running-courses.json`一つ。取得失敗や未知資料もfreshなunknownとして公開し、古い利用可を残さない。クライアントの取得失敗・期限切れもunknown。既存Preview/Productionデータ準備処理へ追加し、新しいbackend/cron/OpenAI呼び出しやアプリ再buildは使わない。rollback時も現在のコース情報を再利用/収集する。既存health monitorはトラックgenerationの監視であり、コースに専用の外部アラートは追加していない。

## 告知の再確認手順

1. `npm run collect:courses -- --force --capture /tmp/course-review`で公式を取得する。公開JSONの`pending`に対象URL・hash・タイトルが残る。
2. 施設・対象コース・期間・全面/一部・通常条件との関係を原文と添付で確認する。別設備や別公園の閉鎖を転用しない。
3. `sources.json`へhashと理由、必要なrestrictionを登録する。未確認の予定終了を再開済みとしない。専用通常案内の変更も再確認する。
4. 強制収集→`npm run validate:courses`→関連unitを実行する。config変更時は週次待ちをせず再取得する。
5. 変更を既存の保護master検証・データ公開経路へ渡す。本番のS3/CloudFrontへ手動で未検証ファイルを置かない。

## 検証

- Production設定の`npm run build`、全unit71ファイル430件が成功（`npm test -- --maxWorkers=2 --testTimeout=60000`）。テンプレート除外/別公園/告知の一覧落ちの境界を含むcollector21件、deployment6件、release artifact/public readiness8件が成功。
- 5施設の公式live collectionを実行し、公開用snapshotのschema・configHash・generation・期限を`validate:courses`で検証。
- 日英PC/スマホの全feature（pace/archives/reports/schedule）、mixed統合smoke、全unknown安全性が成功。新版のcourse smokeも、4status・不可filter・距離filter削除・期限切れ/取得失敗を検証した。
- 最初のfeature実行はfield reports APIを無効にしたbuildを誤って再利用したため、既存レポートの空表示assertで失敗。テスト用API設定でbuildし直した再検証は成功。外部への実投稿はしていない。
- legacy visual baselineの4172は利用できないため、差分画像テストの代わりに対象Playwright screenshotと要素重なり/横幅assertを確認する。

- 対象ローカル実データも1440/390pxで4利用可・1一部利用可、距離filterなし、横幅超過なしを確認。`/tmp/itsrun-course-status-research/local-*-*.png`を目視確認。
- 既存SMTP mock5件・再確認runner mock9件が成功。
