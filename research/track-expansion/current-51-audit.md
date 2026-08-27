# 既存51候補の遡及品質監査

監査日: 2026-08-27（Asia/Tokyo）

## 結論

初期12施設、12→33施設、33→51施設の3 cohortを同じ基準で再確認した。51候補のうち50施設は掲載継続、1候補は施設identityを一次情報で確認できず除外した。公開件数を維持するための代替施設追加は行っていない。

監査の施設別証跡は [`track-source-audit.json`](track-source-audit.json)、今後の標準手順は [`../../docs/TRACK_EXPANSION_PLAYBOOK.md`](../../docs/TRACK_EXPANSION_PLAYBOOK.md) を正本とする。

## 監査方法

1. 現行Track Datasetとavailability researchのIDを突合した。
2. datasetとresearchに含まれる115個のunique URLを、低い並列度で各1回だけ取得確認した。
3. identity、個人利用、料金、座標、availabilityの判断に影響する問題は、自治体・施設・指定管理者の現行一次情報を目視確認した。
4. 最新18候補については周辺OSM geometryも再確認し、`OSM object != facility` として施設単位で照合した。
5. 情報不在を `unavailable`、大会予定不在を `available` と解釈しなかった。

URL確認では108 URLを取得または正常なredirectとして確認した。残る7件は、403、TLS hostname不整合、404、または月替わり文書の失効だった。月替わりPDFはstable discovery pageからの発見を継続し、壊れた固定URLは公開導線から除去・置換した。

## 修正した施設

| 施設 | 修正 | 根拠・判断 |
|---|---|---|
| 千葉県総合スポーツセンター 陸上競技場 | 個人利用を `unknown` から `unavailable`、座標を主競技場へ修正 | 指定管理者の現行案内は主競技場を「専用利用のみ」と明記。共同利用は第2陸上競技場。公式場内図とtrack geometryで主競技場を識別 |
| 松戸運動公園 陸上競技場 | 座標修正 | 千葉県公式資料記載の緯度経度 |
| 柏の葉公園総合競技場 | 座標修正 | 千葉県公式資料記載の緯度経度 |
| 岩名運動公園 小出義雄記念陸上競技場 | 個人利用sourceを佐倉市公式PDFへ変更、schedule linkを非表示 | 指定管理者HTTPSは証明書hostname不整合。利用条件は佐倉市公式情報で継続確認可能 |
| セナリオハウスフィールド三郷 | 施設・予定URLを安定した公式ページへ変更 | 旧URLは証明書hostname不整合 |
| 相模原ギオンスタジアム | 公開schedule linkを非表示 | 指定管理者URLは自動取得不能。市公式FAQへの手動確認導線は維持 |
| レモンガススタジアム平塚 | `0円` 表示を撤回し、料金表現と予定URLを更新 | 無料なのは12:00〜13:00。その他は団体料金または年度会員料 |
| 不入斗公園陸上競技場 | 市内一般料金を100円から200円へ修正、404 PDFを除去 | 2026年度の横須賀市公式施設ページ |

## 除外した候補

### 八部公園陸上競技場

藤沢市の現行八部公園施設ページと指定管理者の施設一覧には、プール、野球場、テニスコート、トレーニングルーム等はあるが陸上競技場がない。登録地点周辺のOSM geometryにもrunning/athletics trackはなく、旧公式URLも404だった。名称・400m・8レーン・全天候という登録内容の一次根拠を確認できないため、誤登録として削除した。

## cohort別評価

- 初期12施設: stable ID、公式source、個人利用、availability sourceを再確認した。既存collectorの安全原則を維持。
- 12→33施設: JAAF/OSM discoveryと公式verificationの分離が概ね保たれていた。個別sourceの到達性を再確認。
- 33→51施設: 一次情報は付いていたが、座標provenance不足、壊れた公開URL、汎用文面による個人利用判断、候補ファイルと正規datasetの二重管理が弱点だった。今回の除外・修正と監査台帳で補正した。

## 今回あえて埋めなかった属性

スパイク可否は、公式規則が変化し得る一方、このサービスの中核である「指定日に近くで集中して走れる環境を探す」判断への寄与が相対的に低い。公式根拠が既にある値は維持したが、件数を増やすための追加調査や推測はしなかった。

## 再発防止

- `validate:tracks` はTrack Dataset、availability research、施設別監査台帳のIDと件数を突合する。
- 監査で除去対象にしたbroken public URLがTrack Datasetへ戻った場合はvalidationを失敗させる。
- 新規施設はidentity、coordinate evidence、individual use、availability sourceを監査台帳へ追加しない限り公開できない。
- batch候補JSONは履歴・作業材料であり、公開データの正本にしない。
- live link checkは外部サイトへ負荷を掛けるためPR CIでは行わず、拡張・定期再監査時に低頻度で実行する。
