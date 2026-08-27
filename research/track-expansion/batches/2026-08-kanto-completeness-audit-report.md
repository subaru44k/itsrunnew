# 2026-08 関東4都県 completeness audit

## Batch definition

- Batch ID: `2026-08-kanto-completeness-audit`
- 対象: 東京都、埼玉県、千葉県、神奈川県
- 基準日: 2026-08-27
- 既存dataset: `origin/master` の50施設（東京25、埼玉11、千葉7、神奈川7）
- discovery: 2026年JAAF一覧と、4都県の `leisure=track` / `sport=athletics` Overpass 707 object
- 重複判定: 既存ID、名称、住所、トラック中心。独立して個人利用できる補助競技場だけ別施設とした。
- 公開上限: 20施設

## Result

JAAF一覧の学校・大学施設は一般利用の明示がないため公開対象外とし、同一敷地の補助競技場は独立した公式個人利用制度がある場合だけ別施設にした。一般個人利用を公式情報で確認できた19施設をincludeした。

| 都府県 | 既存 | 追加 | 公開後 |
|---|---:|---:|---:|
| 東京都 | 25 | 1 | 26 |
| 埼玉県 | 11 | 0 | 11 |
| 千葉県 | 7 | 10 | 17 |
| 神奈川県 | 7 | 8 | 15 |
| 合計 | 50 | 19 | 69 |

埼玉県は、JAAF現行一覧の一般向け公共競技場について主競技場単位ですべて既登録だった。熊谷の補助競技場は同一施設・同一利用案内のため別施設にしていない。

AGFフィールドは400mトラックのidentityと仕様を確認したが、現行公式案内が施設貸切問い合わせのみで一般個人利用の根拠を確認できないためholdとした。大学・学校施設は明示的な一般利用根拠がないためcandidate worksheetへ重複掲載せず、discovery pool内の除外として扱った。

## Availability and collector decision

19施設すべてについてavailability sourceを分類する。予約枠の空き、予定表の空欄、記事の不在をavailable/unavailableへ変換しない。既存collectorへ安全なconfig追加だけで対応できる施設はなく、新parserを本batchへ含めないため全施設をguarded unknownとして公開する。

## Review notes

- 新規IDは命名権名称に依存しない地理的IDを優先した。
- 座標はOSM geometryを採用し、OSMにtrack objectがない施設だけ公式配置図とOSM施設geometryを目視照合した。
- トラック長・路面・公認種別は施設公式または2026年JAAF一覧で確認した。
- 個人利用statusは全include施設で公式の個人・共同・一般開放規定を確認した。
- 料金・スパイクは確認できた値だけを保存し、条件が複雑または未確認なら `null` にした。

## Post-release revalidation

- availability: 日次range生成ではunknownを維持し、公式sourceごとのcollectorは別batchでreviewする。
- URL health: 月次。
- 個人利用資格と指定管理者: 3〜6か月ごと。
- トラック仕様とJAAF公認: 年次または改修時。

## Verification

- 新規19施設が参照する公式URL 30件へ低頻度でGETし、全件HTTP 200を確認した。
- `npm run collect:availability:range`: 69施設×31日を生成（公式HTTP 93、cache hit 390）。
- `npm run validate:tracks`: 69施設とresearch/availability/31日manifestの整合を確認。
- `npm test`: 57 test成功。
- `npm run lint`: 成功。
- `npm run build`: sitemap 158 URL、日英の施設詳細shell 138件を生成。
- `npm run test:smoke`: desktop/mobileと公開routeのsmoke成功。
