# 2026-08 関西3府県 public tracks batch

## Batch definition

- Batch ID: `2026-08-kansai-public-tracks`
- 対象: 大阪府、兵庫県、京都府
- 基準日: 2026-08-27
- 基準dataset: Step 1 Production反映済みの69施設
- discovery: 2026年JAAF一覧の33施設（大阪10、兵庫15、京都8）、公共施設一覧、targeted OSM/Nominatim geometry
- 公開上限: 20施設

## Result

一般個人利用を公式情報で確認でき、地理的な分布とrunner向け有用性が高い20施設をincludeした。

| 府県 | 追加 | 公開後 |
|---|---:|---:|
| 大阪府 | 7 | 7 |
| 兵庫県 | 7 | 7 |
| 京都府 | 6 | 6 |
| 全dataset | 20 | 89 |

ヤンマーフィールド長居は個人利用停止後の再開根拠を確認できないためholdとした。浪商学園、住友総合グラウンド、京都産業大学は私立・企業施設で一般個人利用の根拠がなくexcludeした。伊丹スポーツセンターは市公式案内が個人使用不可を明示するためexcludeした。

主競技場と補助競技場は、三木第2陸上競技場と東寺ハウジングフィールド西京極のように独立した個人・共同利用制度が確認できた場合だけ別施設とした。

## Availability and collector decision

20施設すべてでavailability sourceを分類する。予約空きや予定表の空欄を個人利用可能とは解釈しない。既存collectorへ安全なconfig追加だけで対応できる施設はないため、本batchではcollectorを増やさずguarded unknownとして公開する。

## Review notes

- 20施設すべてで公共主体または指定管理者の公式ページから個人利用を確認した。
- 座標はOSM track geometryを優先し、track tagがない寝屋川とgeometry未整備の小野は公式配置図・住所geocodeを目視照合した。
- トラック長・路面・公認種別は施設公式と2026年JAAF一覧を属性単位で照合した。
- 寝屋川の路面は公式文言を確認できないため `null` とした。
- 料金・スパイクは複雑または未確認の値を推測せず `null` とした。
- 新規source 42 URLを低頻度GETで再確認した。404だった金岡の旧月別PDF、枚方の旧指定管理者予定表、吹田の旧広報PDFは公開導線から除き、安定した現行公式ページへ差し替えた。
- 吹田は現行公式料金に合わせ、一般個人使用を1時間150円へ補正した。

## Verification

- `npm run collect:availability:range`: 89施設×31日を生成（実HTTP 98、cache hit 390）
- `npm run validate:tracks`: success（89施設、監査・availability ID集合一致）
- `npm run build`: success（sitemap 198 URL、施設詳細shell 178件）
- `npm test`: 57 tests passed
- `npm run lint`: success
- `npm run test:smoke:preview`: desktop/mobile、公開route、削除済みroute、Firebase非依存を確認

## Post-release revalidation

- availability: 日次rangeではunknownを維持し、新parserはsource semanticsを別batchでreviewする。
- URL health: 月次。
- 個人利用資格・指定管理者・個人利用停止: 3〜6か月ごと。
- トラック仕様とJAAF公認: 年次または改修時。
