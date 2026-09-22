# Track availability生成・表示

## 目的と境界

Track Searchのavailabilityは、「その施設が一般の個人利用を受け付けるか」という比較的staticな `src/data/tracks.json` と、「指定日に実際に利用できるか」という日付別の `src/data/availability.json` を分離します。Track Datasetには133施設を掲載し、legacy collector 33施設に追加10施設（Luna AI 8施設、個人利用ICS 2施設）を加えた43施設を日付判定の対象にします。対応対象でも、予定未公開・取得失敗・日別根拠不足は `unknown` になり、43施設すべてが毎日positiveになるわけではありません。

```text
公式HTML / calendar / JSON / 固定規則 / PDF
              ↓
scripts/availability/ collectors + source cache
              ↓
src/data/availability/manifest.json + YYYY-MM-DD.json
              ↓（選択日だけ遅延load）
src/model/availability.ts
              ↓
/tracks Track Search UI
```

ブラウザは施設サイトへアクセスしません。collectorを明示的に実行して静的JSONを生成し、その後に通常のVite buildを行います。公式sourceへのburstを避けるため取得は逐次実行します。backend、database、scheduler、リアルタイムscrapingはありません。`src/data/availability.json` は単日debugと後方互換用に維持します。

## 実行方法

東京の当日を対象にする場合:

```sh
npm run collect:availability
npm run build
```

調査・テスト用に日付を指定する場合:

```sh
npm run collect:availability -- --date 2026-08-24
```

UI用に東京日付の当日から31日を生成する場合:

```sh
npm run collect:availability:range
# 再現・検証用
npm run collect:availability:range -- --from 2026-08-24 --days 31
```

range生成先は `src/data/availability/manifest.json` と日付別 `YYYY-MM-DD.json` です。先頭日のdatasetも後方互換用 `src/data/availability.json` へ書きます。古い日付別生成ファイルはrange commandが生成対象directory内だけで整理します。collector失敗時も全施設のrecordを生成し、失敗した施設だけを理由付き `unknown` にします。前回の `available` を無期限に再利用しません。

## 複数日datasetとcache

manifestは `schemaVersion`、`timezone`、`generatedAt`、`startDate`、`endDate`、31個の `dates` を持ちます。各日付ファイルは既存の単日schemaをそのまま保持します。Viteは日付JSONを別chunkとしてbuildし、Track Searchは選択日のchunkだけを遅延loadします。133掲載施設×31日を初期bundleへ含めません。追加collectorのAIキャッシュはrangeの日付計算とは別に、対象月全日を入力へ含めます。

range collectorは同一method・URL・request bodyをprocess内でcacheします。同じlanding page、fixed rule HTML、weekly HTML、WordPress月次notice、月単位のEvent Organiser JSON、月間PDFは再取得せず、同一PDFのtext extractionもsource hash単位で再利用します。TEFのような日付指定POSTはbodyが日ごとに異なるため各日1回だけ取得します。2026-08-24から31日のlive実行ではcache hit 390回、実HTTP 98回でした。retryや並列burstは行いません。

## 対応施設

| source type | 施設 | collector |
|---|---|---|
| `structured_html` | 光が丘公園 | 改修等の明示的な期間告知を解析 |
| `structured_html` | 武蔵野陸上競技場 | 当日HTMLの2時間枠、A・B・貸切を解析 |
| `structured_html` | 越谷しらこばと | 日付付き「個人利用できます」の時間だけを解析 |
| `structured_html` | 日産スタジアム・日産フィールド小机 | 共通ページを1回取得し、施設名・実施日・時間が明示された枠だけを解析 |
| `structured_html` | 東寺ハウジングフィールド西京極 | WordPress月次記事から補助競技場の一般開放日・時間だけを解析 |
| `structured_html` | 柳島スポーツ公園総合競技場 | WordPress月次記事から個人利用日時と明示休館だけを解析 |
| `calendar_html` | 東京体育館 | 日付をPOSTし、コース別1時間枠を解析 |
| `calendar_html` | 駒沢 | 東京体育館と共通のTEF POST表parserで陸上競技場行を解析 |
| `calendar_html` | 江戸川 | 当日から7日分の一般・専用3時間帯を解析 |
| `calendar_json` | 町田GIONスタジアム | Event Organiser JSONの個人利用・専用利用・休場イベントを対象月単位で解析 |
| `fixed_schedule` | 大泉中央公園 | 水曜・第1日曜・第3土曜等を評価 |
| `fixed_schedule` | 赤塚公園 | 水曜・第1日曜・第3土曜等を評価 |
| `fixed_schedule` | 井の頭恩賜公園 | 貸切申請可能日以外の一般利用規則を評価 |
| `fixed_schedule` | 朝霞中央公園 | 火曜・第2/4土曜の陸上割当時間を評価 |
| `fixed_schedule` | 代々木公園 | 定期開放時間に工事・休場overlayを優先適用。2026年11月30日までは利用不可、12月1日以降は再開告知確認までunknown |
| `fixed_schedule` | 大井 | 第1・第3木曜9～17時だけを開放候補として評価 |
| `fixed_schedule` | 舎人公園 | 水曜・第1日曜・第3土曜9～21時を評価 |
| `fixed_schedule` | 奥戸 | 月・水・金9～21時を評価 |
| `fixed_schedule` | 秋留台公園 | 水曜・第1日曜・第3土曜を評価 |
| `pdf` | 練馬総合運動場公園 | stable pageから直近1週間PDFを発見し3枠を解析 |
| `pdf` | 戸田市スポーツセンター | 対象月PDFの陸上競技場行事と夏季個人枠を解析 |
| `pdf` | 和田堀公園 第一・第二 | 同じ表formatを共有し、施設別凡例で半日枠を解析 |
| `pdf` | セナリオハウスフィールド三郷 | 専用・共用・予約可能空欄を区別 |
| `pdf` | 上尾運動公園 | 個人利用日一覧の明示日・時間だけを解析 |
| `pdf` | 八王子富士森競技場 | 複数月matrixと早朝地域開放規則を解析 |
| `pdf` | 上柚木公園 | 施設ページから複数月PDFを発見し、3区分の○・貸切・整備を解析 |
| `pdf` | 神奈川県立スポーツセンター | 対象月PDFの陸上競技場欄について、午前・午後の○と×を解析 |
| `pdf` | 万博記念競技場 | 対象月の個人利用予定表について、明示時間帯と×を解析 |
| `pdf` | 国府台陸上競技場 | 月次使用予定表から明示イベントを差し引き、公式規則の一般開放時間を解析 |
| `pdf` | びんご運動公園陸上競技場 | 月次PDFのトラック利用可・時間境界・終日不可を解析 |
| `pdf` | 府中市民陸上競技場 | 日別記号がvector図形のためguarded unknown |
| `weekly_notice` | 京都府立山城総合運動公園 | 固定URLを上書きする短期告知の対象日・時間だけを解析 |

追加の10施設は次のsource方式です。

| source type | 施設 | collector |
|---|---|---|
| `ai`（PDF/HTML/画像） | 等々力、知多、平塚、広島広域公園補助、維新補助、博多の森補助、世田谷、荻野 | 公式landing pageとリンクされた当月・翌月資料を取得し、Lunaの構造化出力を検証 |
| `calendar_ics` | 神戸総合運動公園補助、市原ZAオリプリスタジアム | 公式ページに埋め込まれたGoogle Calendarの所有権を確認し、個人利用ICSを決定論的に解析 |

133施設中43施設（32.3%）を安全な自動判定対象にしています。内訳はlegacy 33施設と追加10施設です。legacyのpublication format内訳はstructured HTML 7、calendar HTML 3、calendar JSON 1、固定規則9、weekly notice 1、PDF 12（合計33）で、追加分はAI 8、calendar ICS 2です。collector対応数は「対象日を判定できる実装」の数であり、対応施設の全日positiveを意味しません。府中はPDF取得と構造確認までは行いますが、日別記号を通常の文字抽出で読めないため判定対象数へ含めません。世田谷は当日朝の公式noticeだけを対象にするtoday-only sourceで、当日以外へ一般規則を外挿せず、noticeがない日は `unknown` です。

未対応施設もdatasetとUIから除外しません。

ただしstaticな `individualUse.status = unavailable` を公式に確認した施設は、日別予定が未自動化でも「要確認」へ戻さず、全日 `unavailable` を生成します。日程情報の欠落を根拠にするのではなく、個人利用を受け付けないという施設規則そのものをnegative evidenceとして使います。

- 府中: `unsupported_pdf_graphics`。text-based PDFだが日別○・◇・×がvector図形。
- 世田谷: 追加AI source。公式の「本日の個人開放」noticeのタイトル日だけを判定し、予約枠の空きを個人開放と推測しない。未来日とnotice欠落は `unknown`。
- 新座: `reservation_system_unsupported`。専用予約枠の空きと個人利用可否が同義か、規約・取得頻度も含めて確認後に対応。
- 城北中央: `phone_confirmation_required`。Web日程がなく、個人利用可能＋本日は要確認として表示。
- その他の未対応施設: source方式に応じて `reservation_system_unsupported`、`phone_confirmation_required`、`web_schedule_unavailable` を生成。施設自体は個人利用可能な候補として残す。

現行のavailability source分類は、更新で変わり得るためこの文書へ固定件数を書きません。現在値は `../research/availability/availability-sources.json` の分類registryから読みます。legacy 33施設の内訳と追加6施設の根拠は [2026-09高確度collector追加検証 batch 2](../research/availability/high-confidence-collector-validation-batch-2-2026-09.md)、追加10施設の採用候補・試行評価は [AI adoption 2026-09](../research/availability/ai-adoption-2026-09.json)、collector統合とsource identityは [AI collector integration 2026-09](../research/availability/ai-collector-integration-2026-09.md) を参照してください。従来分は [HTML/calendar/fixed collector検証](../research/availability/html-calendar-collector-validation.md) と [PDF collector検証](../research/availability/pdf-collector-validation.md) にあります。

## HTML・calendar・fixed collector

`scripts/availability/collectors.ts` は共通fetch・hash・provenance・failure正規化の上に、確認済み構造だけを扱うparserと施設configを載せます。

- TEF calendar: 東京体育館と駒沢でPOST、日付header、時間帯header、対象施設行の構造検証を共有し、施設ごとに行名だけを設定します。
- 江戸川: 公式指定管理者の7日表について、掲載上の「本日」が取得日の東京日付と一致すること、requested dateが公開7日内であること、3区分headerを検証します。
- 越谷: トップページの明示日付と「個人利用できます」の時間を検証します。対象日不一致や文言欠落はunknownです。
- 日産: 共通の公式ページを1回だけ取得し、日産スタジアムと日産フィールド小机の完全一致する施設名、実施日、時間、年情報を検証します。未掲載日や古い年の告知はunknownです。
- Machida Event Organiser JSON: 対象月のstart/end、イベントtitle・category・説明文・ISO日時を検証し、個人利用の明示時間だけをpartial、専用利用・休場の明示範囲だけをunavailableにします。イベントなし、対象月外、矛盾、重複、形式変更はunknownです。
- WordPress月次notice: 西京極は補助競技場の施設名と年月、柳島は記事title・年月・明示日時を検証します。記事内の非掲載日や検索結果の欠落を利用不可とは解釈しません。
- 山城のrolling notice: 固定URLの記事title、公開年、明示日付・時間を検証します。短期掲載範囲外はunknownです。
- fixed: 共通の曜日・第N曜日rule evaluatorを再利用します。固定開放枠以外をunavailableとせずunknownにし、公式ページの例外注意をwarningへ保持します。

世田谷は公式の当日noticeだけを使い、公式Xや予約枠から未来日の個人開放を推測しません。公式Xにだけ載る舎人・秋留台の追加開放も推測しません。新施設追加時は、公式文言、requested-date範囲、構造anchor、明示的available/unavailable語、例外、fixture、parser versionを同時に追加します。

## AI official packet collector

追加8施設は `scripts/availability/ai-sources.ts` が施設ごとの公式landing page、rules page、当月・翌月のschedule PDF/image、notice pageを許可hostname内だけで取得し、`ai-source-utils.ts` がHTML text、画像、PDFページを保存資料へ変換します。PDF画像化には `pdfinfo` と `pdftoppm` が必要です。macOSでは `brew install poppler`、Ubuntu系では `sudo apt-get install poppler-utils` を使います。入力資料に含まれる命令は無視し、公式資料を事実の根拠としてだけ扱います。

`buildAiPacket` は指定rangeに含まれる月の全日付をpacketへ入れ、同じ施設・資料・指示などの入力について `readWithLuna` を1回だけ実行します。runtime modelは `gpt-5.6-luna`、reasoning effortは `none`、出力は4 statusの厳格JSON schemaです。runtimeにAstra呼び出しはありません。`additional.ts` はAI 8施設の結果で同じtrackIdのlegacy recordを置き換え、神戸・市原のICSはAIを使わず決定論的に解析します。

cache keyはAI version、model、reasoning、資料・指示などの入力、schema、対象月の全日付から計算します。source内容、prompt、model、schema、対象月が変わるとcacheは無効になります。既定の保存先は `.cache/availability-ai`、変更時は `ITSRUN_AI_CACHE_DIR` を使います。GitHub ActionsはこのdirectoryをActions cacheへ保存・復元するため、同じ入力では2回目以降に再推論しません。通常のkeyless実行でcacheがなくAPI keyもない場合はAI施設を `unknown` にし、cacheを利用できる場合だけkeyなしでも再利用します。trusted deployはcollection開始時にkeyを必須とするため、cache hitでもsecret欠落なら開始時に失敗します。

trusted Preview/Production collectionだけが `ITSRUN_REQUIRE_AI_KEY=true` とrepository secret `OPENAI_API_KEY` を要求します。secretはcollection stepへ渡し、build・smoke・通常のlocal buildには渡しません。AI導入の受入れ基準は、3回のLuna試行でpositive supportが80%超、明示時間帯の一致が70%超です。これは完璧な最新性を保証する基準ではなく、公開UIは当日変更と公式確認の注意を残します。

## normalized schema

トップレベルは `schemaVersion`、対象 `date`、`timezone`、`generatedAt`、Track Dataset全施設（現在133施設）の `facilities` を持ちます。各recordは次を持ちます。

- identity: `trackId`, `date`, `timezone`
- result: `status`, `periods`, `unknownReason`
- source: 実資料URL、安定landing page URL、official種別、publication format、`publishedAt`, `documentId`
- freshness: `fetchedAt`, `parsedAt`, `checkedAt`, `validForDate`, `expiresAt`
- evidence: collector、parser version、source SHA-256、confidence
- notes: `warnings`

`status` は `available | partially_available | unavailable | unknown` です。periodは時間、period status、`full_track | track_and_jogging_course | jogging_course_only | lane_subset | unknown` のscope、利用資格、条件を保持します。内部設計はtoday専用ではなく、常に `trackId + date` です。

## unknownとnegative evidence

`unknown` は「利用不可」ではありません。個人利用可能な施設でも、その日の情報がWebから確定できなければ正常に `unknown` になります。UIでは選択日に合わせて「本日は要確認」「8月29日は要確認」等と表示し、公式sourceへ確認行動を用意します。`schedule_not_published` は「対象月の予定表はまだ公開されていません」、取得・解析失敗は別の確認案内として区別します。

理由は次を区別します。

- `source_stale`, `fetch_failed`, `parse_failed`, `extraction_failed`, `invalid_content_type`, `source_changed`
- `outside_published_period`, `schedule_not_published`, `unsupported_pdf_graphics`, `insufficient_information`
- `phone_confirmation_required`, `reservation_system_unsupported`
- `unsupported_source_type`, `web_schedule_unavailable`

情報がない、固定規則に一致しない、取得できない、解析できないことを `unavailable` にしません。`unavailable` は改修、休場、専用利用、整備等の明示的な公式情報がある場合だけです。固定規則で開放時間だけが確認できる場合、その時間をavailableとし、日全体は `partially_available` にします。

## freshnessとfailure

生成recordは対象日の翌日0:00 JSTを `expiresAt` とします。UIの対象日と `validForDate` が異なる、または `expiresAt` を過ぎたrecordは、元の状態にかかわらずruntimeで `source_stale` のunknownへ降格します。collectorのHTTP失敗は `fetch_failed`、想定tableの解析失敗は `parse_failed`、固定sourceの根拠文言変更は `source_changed` です。

source bytesのSHA-256とparser versionを残すため、誤解析時に使った原典とparserを追跡できます。公式予定は当日変更され得るため、freshなavailableでも訪問前の公式確認を案内します。

公開UIの予定actionは、施設別に管理する `tracks.json` の `urls.schedule` を最優先し、未設定の場合は `source.landingPageUrl`、`source.url`、個人利用案内、公式トップの順で選びます。ファイル名が更新ごとに変わり旧PDFが削除されるsourceは安定したlanding pageへ案内しつつ、`source.url` とhashは取得時の証跡としてdatasetに保持します。施設情報のsource確認日は日別availabilityの取得日とは別に「施設情報の確認日」と表示します。

## PDF collector

`scripts/availability/pdf.ts` は、取得・content type/PDF magic検証、pdfjsによる座標付きtext extraction、対象月URL discovery、format固有parser、normalized record化を分離します。AI packetのPDFは別経路で `pdfinfo` と `pdftoppm` によりページ画像化します。macOSでは `brew install poppler`、Ubuntu系では `sudo apt-get install poppler-utils` が必要です。requested dateの年月からmonthly/annual/latest資料を選びます。和田堀だけはnews index → 対象月article → PDFの2段階です。

formatは練馬、戸田、府中guard、和田堀共通、三郷、上尾、富士森、上柚木、神奈川県立スポーツセンター、万博記念競技場、国府台、びんごの13 configです。府中guardを除く12施設を対応し、府中は図形statusを推測しません。万能table parserではなく、確認済みtitle/header/legend/月のanchorを必須にします。OCR、reservation system、schedulerは実装していません。

新formatを追加する場合は、安定landing page、requested dateに対応するPDF discovery、公式凡例によるsemantic mapping、座標付きfixture、missing/changed layoutのunknown test、parser name/versionを同時に追加します。PDFそのものは著作権上commitせず、最小のmocked extractor outputをtest fixtureにします。

## テスト

`scripts/availability/collectors.test.ts` はTEF共通calendar、江戸川7日表、越谷当日HTML、日産2施設の共通HTML、Machida JSON、WordPress月次notice、新旧fixed ruleと、日付欠落・週外・古い表・見出し変更・意味曖昧時のunknownをfixtureで確認します。`scripts/availability/notices.test.ts` は西京極・柳島・山城の成功、非掲載日、年・anchor変更を確認します。`scripts/availability/pdf.test.ts` は12対応formatと府中guard、requested month、複数period、partial、明示的不可、空欄、header/legend変更、対象月未公開、fetch/content/extraction failureをmocked extractor outputで確認します。失敗がunavailableにならないことを必須にしています。`src/model/availability.test.ts` はunknownを候補に残すことを確認します。

`scripts/availability/range.test.ts` は31日、月・年境界、HTTP cache reuseと日付固有POSTの分離を確認します。`scripts/availability/ai-runtime.test.ts` と `additional.test.ts` は厳格schema、cache hit、keyless unknown、公式source replacement、AI/ICS追加施設を確認します。`src/model/availability-range.test.ts` はAsia/Tokyoのdate-only演算、URLのinvalid/out-of-range fallback、土日のshortcutを確認します。browser smokeは今日・明日・native date input、URL query、marker/list/filter同期、未来日のunknown維持をdesktop/mobileで確認します。

## Track Searchの日付UI

`/tracks?date=YYYY-MM-DD` と `/en/tracks?date=YYYY-MM-DD` が選択日のsource of truthです。「今日」「明日」「土曜」「日曜」とnative date inputを提供します。土日shortcutは、今日がその曜日なら今日、そうでなければ次に来る曜日を選びます。invalidまたは生成範囲外queryは、manifestに今日があれば今日、なければrange先頭日へ安全に戻します。

日付変更時にavailability map、marker色と件数、施設一覧、詳細、時間帯、利用不可switch、source linkが一緒に更新されます。位置情報、地図中心、距離は再取得しません。manifest外の日を利用不可とは表示しません。

date-only値は常に `YYYY-MM-DD` のまま扱い、加減算時は正午 `+09:00`、表示・「今日」の算出は `Asia/Tokyo` を明示します。UTCのmidnight変換による日付shiftを避けます。

## 更新・deploy

通常開発ではbuildが外部sourceを自動取得しません。運用時に1日1回、AI keyをcollection stepへだけ渡して次の順で更新できます。

```text
npm run collect:availability:range
→ npm test / npm run lint / npm run build
→ preview smoke
→ static dist deploy
```

schedulerは未実装です。日次生成が失敗した場合もunknown datasetを出し、古いavailableを新しい日付へ転用しません。

## 次の段階

現collectorは43/133（32.3%）で、31日の日付検索UIと全施設の安全なunknown fallbackまで実装済みです。AI 8施設は当月・翌月資料を施設別packetへまとめ、世田谷だけはtoday-onlyです。新規施設はsource semanticsを個別検証してからcollectorへ加えます。公開範囲外・対象月未公開・keylessでcache missのAI資料は引き続きunknownです。

新座予約システムは、規約・低頻度アクセス・cache・「空き」の意味を確認するまで実装しません。城北中央は公式Web日程が提供されない限りmanual confirmationを維持します。
