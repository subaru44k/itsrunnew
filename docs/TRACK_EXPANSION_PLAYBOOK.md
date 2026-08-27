# Track Dataset安全拡大playbook

この文書は、Track Searchへ施設を追加するときの調査、判断、記録、検証を統一するための正本です。目的は件数を増やすことではなく、ランナーが指定日に近くで集中して走れる候補を、根拠と不確実性を含めて安全に判断できるdatasetを維持することです。

適用対象は新規施設だけではありません。初期12施設、12→33施設の拡大、33→51候補の拡大を含む既存候補の再確認にも同じ基準を使います。2026-08-27の遡及監査で50施設へ補正した後、関東網羅性batchで19施設、関西batchで20施設、2026-08-28の中国・愛知・福岡batchで20施設を追加し、現在の公開候補は109施設です。

## 1. 守るべきプロダクト原則

優先する情報は次のとおりです。

1. 指定日に個人利用できる、または利用できる可能性があるか
2. ユーザーの基準地点から近いか
3. 400m等の集中して走れる環境か
4. 利用可能な時間帯
5. 最終判断に使える公式予定・利用案内への導線

料金、細かな利用条件、スパイク可否は補助情報であり、網羅率の目標にしません。現在の公式情報で容易に確認できれば記録しますが、施設追加を止めてまで収集せず、確認できない値は `null` のままにします。古い静的情報を断定するより、正しい `unknown` と公式確認導線を提示することを優先します。

以下を常に守ります。

- `unknown` は品質上の正常系であり、`unavailable` ではない。
- 情報がない、予定がない、予約が空いている、という事実だけから個人利用可否を推測しない。
- JAAF公認やOSM掲載は施設発見の根拠であり、個人利用可能性の根拠ではない。
- 施設の存在、静的な個人利用資格、指定日のavailabilityを分離する。
- 確認済みの範囲だけを保存し、数合わせで値や施設を追加しない。

## 2. 過去の拡大から得た教訓

### 初期12施設

公式施設ページ、個人利用案内、予定表を施設ごとに確認し、availabilityの公開方式と意味を詳細に調査した。特に、固定開放日に該当しない日、PDFの空欄、予約枠の空きを `unavailable` / `available` に変換しない原則は、その後のcollectorでも有効だった。

一方、`sources` はrecord全体のprovenanceであり、トラック長、路面、個人利用、料金等のどの値をどのsourceが支えるかまでは構造化されていない。既存12施設も再監査の対象から除外しない。

### 12→33施設

JAAFとOSMを候補発見に使い、公式一次情報で施設identityと個人利用を確認した。OSM objectを施設と同一視せず、relation、track way、施設label、補助走路をclusterした点は維持する。21追加施設の19施設にOSM evidence、17施設にJAAF external IDが残り、availability sourceも全施設で分類された。

collectorは、万能parserを作らず、共通fetch・cache・failure正規化の上に確認済みformatだけを追加した。府中のvector PDFや世田谷の不安定な日次情報を対応済みに数えず、guarded unknownとした判断も維持する。

### 33→51候補（監査後50施設）

一度に80〜120施設へ増やさず、首都圏の18施設に限定したこと、個人利用根拠を確認できなかった4施設を `unknown` にしたことは安全側の改善だった。新規sourceについてcollectorを無理に実装せず、施設を候補として残した点もプロダクト原則に合う。

ただし、次の改善が必要である。

- 新規18施設の `externalIds.osm` / `externalIds.jaaf` は空で、座標や候補発見のevidenceが公開recordから追跡しにくい。値が誤りという意味ではないが、今後は座標決定方法を調査記録へ残す。
- `sources` は属性単位ではないため、1つの公式ページだけで全属性を検証したように見える場合がある。
- `phase2-tracks.json` と `tracks.json` に同じnormalized値が重複し、将来driftする可能性がある。今後のbatch fileはnormalized recordの複製ではなく、判断と根拠を記録する。
- `availability-sources.json` の `automation.implementation` は古い施設で未記録のものがあり、単純集計が実collectorの23施設と一致しない。research metadataとcollector registryの整合を検証対象にする。
- Track Dataset、31日分のgenerated availability、UI、route、インフラ変更を1つの大きなPRに含めると、施設ごとの根拠をreviewしにくい。今後はresearch、dataset、collector/UIを分離する。
- 現行validatorはID、座標範囲、source形式、OSM参照、availability ID整合を確認するが、公式sourceが各属性を本当に支えるか、URLが生きているか、個人利用の意味が正しいかは人のreviewが必要である。

過去データを一律に信用または否定するのではなく、上記の弱点を全51候補の遡及監査で補う。監査では1件を誤登録として除外し、現在は50施設を掲載している。

## 3. sourceの役割と優先順位

### 候補発見に使えるsource

- JAAFの公認競技場情報
- OSM / Overpassの `leisure=track` 等
- 自治体のスポーツ施設一覧
- 既存施設ページからの関連施設リンク
- Nominatim等のgeocoding結果

これらは候補pool、位置候補、外部IDの発見に使える。ただし、JAAF公認だから個人利用可能、OSMに `access=yes` があるから一般開放、といった推論には使わない。

### 公開値の検証に使うsource

原則として次の順序で採用する。

1. 自治体公式サイト・条例・規則
2. 施設公式サイト
3. 指定管理者公式サイト
4. JAAF公式情報（公認状態・公認種別）
5. その他の管理主体による一次情報

検索結果のsnippet、ブログ、まとめサイト、口コミ、個人SNS、画像検索結果は、公式sourceを発見する手掛かりにはできるが、公開値の確定根拠にはしない。公式SNSも臨時告知の補助sourceに限定し、安定した静的属性の唯一の根拠にはしない。

sourceは実ページを開いて、対象施設、対象設備、対象年度、見出し、注釈まで確認する。検索snippetだけを読んで判定しない。

月次PDF等は、差し替わるattachment URLだけでなく、そこへ案内するstable landing pageも記録する。`verifiedAt` は検索結果で発見した日ではなく、実ページのHTTP応答と本文を確認した日とする。ページに公式の更新日・対象年度があれば併記し、現在も有効な規則かを確認する。

## 4. batchの開始方法

一度に調査する公開候補は10〜20施設程度を推奨する。候補pool自体は多くてもよいが、公式確認とreviewを終えた施設だけを公開batchへ進める。

品質と手間のバランスを取るため、最初の公式source探索は1施設20〜30分程度を目安に区切る。identity、位置、個人利用、availability sourceを確認できないまま補助属性を深掘りせず、`hold` と未解決理由を残して次の候補へ進む。collector固有解析や施設への問い合わせは、公開候補の価値と想定coverageを比較して別タスクにする。

batch開始時に次を決める。

- `batchId`: 例 `2026-09-kanagawa-west`
- 対象地域と選定理由
- 候補発見queryと取得日時
- 想定候補数、公開上限、完了期限
- 既存datasetとの重複判定方法
- 調査担当と、可能なら別のreview pass

将来の調査記録は `research/track-expansion/batches/<batchId>.json` と `<batchId>-report.md` に置く。raw OSMは `data/osm/` に保持し、公開datasetと混ぜない。

## 5. 施設追加の標準手順

### Step 1: 候補発見

JAAF、OSM、自治体一覧を並行して調べる。OSMでは競馬、自転車、motor track、private accessを明示的に除外するが、`sport` tagがないだけで公園trackを除外しない。

この段階では個人利用や料金を埋めず、次だけを候補記録へ保存する。

- 仮名称
- 候補位置
- discovery sourceと外部ID
- 発見日
- 候補にした理由

### Step 2: 施設単位のdeduplication

`OSM object != facility` を前提とする。次を同一施設clusterとして確認する。

- outer / inner way
- relationとmember way
- 主競技場と補助競技場
- track polygonと施設label
- 旧名称、命名権名称、略称
- 既存datasetとの近接・名称重複

主競技場と補助競技場が独立して一般利用できる場合だけ別施設にする。判断できなければ公開せず候補queueに残す。

### Step 3: 施設identityと位置の確認

最低1つの公式sourceで正式名称、住所、施設の存在を確認する。座標はtrackの中心を指し、管理事務所、公園全体、隣接球技場の中心にしない。

座標決定方法をbatch evidenceに残す。

- `osm_geometry`: 採用したOSM type/IDとraw file
- `official_map_manual`: 公式配置図・地図を見てtrack中心を確認
- `address_geocode_verified`: 住所をgeocodeし、公式地図と目視照合

geocoderの値を無確認で採用しない。OSM IDがないこと自体は不採用理由ではないが、代替の座標evidenceを必須とする。

### Step 4: ランナーに有用な基本仕様の確認

次を公式施設仕様、自治体資料、JAAF情報で確認する。

- トラック長
- 路面
- レーン数（確認できれば）
- JAAF公認状態・種別（確認できれば）

トラック長と路面は候補選定への影響が大きいため優先する。レーン数、料金、スパイクは未確認でも公開を妨げない。JAAF公認から400m、全天候、個人利用可能を推測しない。公認期限・現行種別を確認できなければ `null` にする。

### Step 5: staticな個人利用資格の確認

日付別予定とは分けて、施設が一般個人を受け付けるかを確認する。

| status | 使用条件 |
|---|---|
| `available` | 公式情報が個人利用、一般開放、共用利用等を明示する |
| `temporarily-unavailable` | 個人利用制度自体の一時停止をstatic dataで表す必要があり、公式根拠とreviewがある場合だけ |
| `unavailable` | 公式情報が一般個人利用不可を明示する |
| `unknown` | 施設identityは確認できるが、一般個人利用の根拠を確認できない |

「団体利用がない場合に個人利用可能」はstatic eligibilityとして `available` にできるが、指定日の団体利用状況は別のavailabilityで `unknown` にできる。改修・大会・休場等の期間付き例外も原則として日付別availabilityで表し、static eligibilityを安易に `temporarily-unavailable` へ変えない。学校、大学、企業施設、会員制・宿泊者限定施設は、一般利用の公式根拠がない限り公開しない。

`unknown` の新規施設は例外扱いとし、次をすべて満たす場合だけ公開候補にできる。

- 自治体等の公共スポーツ施設である
- 一般利用の可能性を否定する情報がない
- ランナーにとって地理的・設備的価値が高い
- 電話、公式ページ等の確認行動を提示できる
- PRで `unknown` 採用理由を明記する

### Step 6: 補助属性の確認

料金、利用資格、スパイク等は同じ公式案内で明確に確認できる範囲だけ記録する。

- 無料は明示的な無料だけ `feeYen: 0` とする。
- 市内・市外、一般・学生、時間帯別に複数料金がある場合、単一の代表料金で全条件を表現できないことをnoteと確認導線で失わない。
- スパイクの記載がないことを禁止・許可へ変換しない。
- 一部レーン、ピン長、種別制限がある場合、単純な `true` だけで条件を隠さない。現行schemaで安全に表現できなければ `null` と公式リンクを優先する。

補助属性の調査に時間を使いすぎず、availabilityと公式導線を優先する。

### Step 7: availability sourceを同時調査

施設を追加する時点で、日付別情報が自動化できるかにかかわらず `availability-sources.json` のrecordを作る。

最低限記録する。

- track IDと施設名
- sourceの有無
- stable landing pageと実予定表URL
- `structured_html | calendar_html | weekly_notice | fixed_schedule | pdf | reservation_system | phone_only | no_schedule_found | other`
- 粒度、更新頻度、URL安定性
- 対象日・未来日を判定できる範囲
- available / unavailableと判断できる明示的な根拠
- 空欄・非掲載・予約空きの意味
- 例外、休場、大会、天候等
- automation feasibilityと未実装理由
- `verifiedAt`

次のnegative evidence ruleを必ず適用する。

- 行事なし `!=` 個人利用可能
- scheduleに記載なし `!=` 利用不可
- 予約枠の空き `!=` 個人利用可能
- PDFの空欄 `!=` available（凡例が明示する場合を除く）
- fixed schedule非該当 `!=` unavailable
- fetch / parse失敗 `!=` unavailable

### Step 8: evidence worksheetをreviewする

`tracks.json` を編集する前に、施設ごとのevidenceをreviewする。推奨形式は次のとおり。

```json
{
  "trackId": "stable-geographic-id",
  "decision": "include",
  "identity": {
    "officialName": "正式名称",
    "sourceUrl": "https://...",
    "verifiedAt": "YYYY-MM-DD"
  },
  "coordinates": {
    "latitude": 35.0,
    "longitude": 139.0,
    "method": "osm_geometry",
    "source": "way/123"
  },
  "attributes": {
    "lengthMeters": { "value": 400, "sourceUrl": "https://..." },
    "surface": { "value": "all-weather", "sourceUrl": "https://..." },
    "individualUse": {
      "value": "available",
      "sourceUrl": "https://...",
      "evidenceSummary": "公式案内が個人利用日を明示"
    }
  },
  "availability": {
    "sourceType": "pdf",
    "automationDecision": "research_only",
    "reason": "凡例確認後にparserを検討"
  },
  "unresolved": ["spikesAllowed"]
}
```

公式ページ本文を大量転載せず、短い自分の言葉の要約、対象見出し、URL、確認日を残す。値ごとのsourceが同じ場合も参照を省略しない。

### Step 9: 公開可否を決める

以下をすべて満たした施設だけnormalized datasetへ追加する。

- stable IDが既存IDと重複しない
- 公式sourceで施設identityを確認した
- track中心の合理的な座標と、その決定方法を記録した
- ランニング用trackであり、競馬・自転車・motor施設ではない
- 学校・企業等の場合は一般利用の明示的根拠がある
- 個人利用statusが根拠付きである。`unknown` は前述の例外条件を満たす
- トラック長と路面は確認済み、または不明を明示して候補価値を説明できる
- official URLがある
- availability research recordがある
- 不明値を推測で補っていない

候補を保留・除外しても失敗ではない。理由を `hold` / `exclude` としてbatch reportに残し、同じ候補を別担当が無駄に再調査しないようにする。

### Step 10: normalized datasetへ追加

- IDは施設名の変更や命名権に左右されにくい地理的名称を優先する。
- 既存IDは表示名が変わっても変更しない。
- OSM/JAAF IDをprimary keyにしない。
- 公式英語名があれば使用し、なければ一貫した英訳・ローマ字表記を使う。
- `null`、0、falseを区別する。
- 既存recordを機械的に再formatして巨大diffを作らない。
- 既存施設を修正する場合、新規追加と分けて変更理由・旧値・新値・sourceをreportへ記録する。

`tracks.json` をnormalized dataの唯一の正本とする。batch evidenceは判断根拠であり、normalized record全体を複製しない。

### Step 11: collectorの扱いを決める

施設追加とcollector実装は別の品質ゲートである。collector未対応を理由に有用な施設を除外せず、未対応時は理由付きunknownと公式確認導線を生成する。

既存collectorへconfig追加だけで安全に対応できる場合は同じbatchで追加してよい。新parserが必要な場合は、原則としてdataset追加後の別commitまたは別PRにする。

collectorを対応済みにする条件は次のとおり。

- stable landing pageから対象資料を発見できる
- requested dateと対象期間を検証できる
- title、header、凡例、施設行等の構造anchorを検証できる
- available / unavailableの意味を公式情報で説明できる
- blank、非掲載、範囲外、未公開を安全にunknownへできる
- fetch、content type、parse、layout変更をunknownへ降格できる
- source hash、parser名・version、取得時刻を保持できる
- fixtureで成功・partial・明示不可・missing・layout変更・fetch失敗を試験できる
- live sourceと最低1回目視比較した

予約システムは「専用予約枠の空き」と「個人利用」が同義と公式に確認できるまで自動化しない。電話・現地掲示だけの施設は正常な手動確認対象として扱う。

## 6. 自動検証と手動確認

### dataset変更時の自動検証

少なくとも次を確認する。

- duplicate stable IDなし
- required fieldとsourceあり
- 緯度経度が対象地域内で、地図上のtrack位置と一致
- 外部IDがある場合はraw evidenceに存在
- HTTPS公式URL
- `verifiedAt` の形式
- status、0、false、nullの意味が正しい
- Track Dataset、availability research、collector config、単日・range availabilityのID集合が一致
- 既存施設IDと情報を意図せず削除・上書きしていない
- 追加数、変更数、削除数がbatch reportと一致

現行validatorで未検証の、属性単位provenance、live URL、research上の実装状態とcollector registryの一致は、今後validatorを拡張するまではPR checklistで人が確認する。

### 実行コマンド

アプリdirectory `itsrunnew/` で実行する。

```sh
npm run collect:availability:range
npm run validate:tracks
npm test
npm run lint
npm run build
npm run test:smoke:preview
```

collectorを変更しないresearch段階ではlive range生成を繰り返さない。datasetへ新IDを追加する最終段階では、全31日・全施設のguarded recordを生成し、ID欠落がないことを確認する。公式サイトへの同一requestはcacheし、過度な並列取得を行わない。

### 手動確認

- 地図markerが実track中心にある
- 新規施設が正しい都道府県groupに表示される
- 日本語・英語の名称と詳細routeが表示される
- 個人利用unknownが検索結果から消えない
- availability unknownが利用不可表示にならない
- 公式、予定、経路リンクが対象施設へ遷移する
- desktop / mobileでmarker、card、detailが対応する
- 代表施設について公式sourceと表示値を再比較する

## 7. PRとreviewの分け方

review可能性を優先し、次の単位を推奨する。

1. candidate evidenceとbatch report
2. Track Dataset、availability research、validator、必要なbaseline生成物
3. 新規collectorとfixture
4. UI変更が本当に必要な場合だけ別PR

1つのPRにまとめる場合もcommitをこの順に分ける。generated availabilityの大きなdiffで、施設recordとsourceのreviewが埋もれないようにする。

PR本文には次を記載する。

- 候補数、追加数、hold数、exclude数
- 新規IDと施設名
- 地域・400m・路面・個人利用statusの集計
- discovery sourceとverification sourceの内訳
- `unknown` を採用した施設と理由
- availability source typeとcollector対応・未対応
- 既存施設の修正内容と公式根拠
- 手動比較した施設
- 実行した検証command

件数目標をPRの成功条件にしない。

## 8. 公開後の再検証

施設追加は公開して終わりではない。推奨周期は次のとおり。

- availability: 日次range生成。取得・解析失敗は該当施設だけunknownへ降格
- URL healthとredirect: 月次の低頻度check
- 個人利用資格、長期休場、指定管理者変更: 3〜6か月ごと、または公式source変更時
- トラック長、路面、レーン、公認状態: 年次または改修時
- 料金、スパイク、細かな条件: 積極的な網羅対象にせず、source変更・利用者報告時に再確認

sourceが404、別施設へredirect、内容変更、意味の矛盾になった場合、古い確定値を残すのではなく影響する属性を `unknown` へ戻し、公式確認導線を更新する。既存値を修正するときは履歴が追えるreportを残す。

## 9. 既存51候補の遡及監査

初期33施設も含め、次の順で全51候補を同一基準へ揃える。

1. 51候補のevidence matrixを作り、属性ごとのsourceと確認日を記録する。
2. 33→51で追加した18施設について、座標決定方法と候補発見evidenceを補う。
3. 個人利用が `unknown` の4施設を再確認し、根拠がなければunknownを維持する。
4. 初期12および12→33の33施設も、公式URL、位置、個人利用根拠、availability semanticsを再確認する。
5. `availability-sources.json` のimplementation metadataと実collector registryを照合する。
6. 既存recordの値に誤り・根拠不足があれば、黙って置換せず施設別の変更理由をreportに残す。

履歴上の比較は次のとおりである。

| cohort | 施設 | 個人利用available | 個人利用unknown | OSM evidenceあり | schedule URLあり |
|---|---:|---:|---:|---:|---:|
| 初期 | 12 | 12 | 0 | 11 | 7 |
| 12→33で追加 | 21 | 21 | 0 | 19 | 20 |
| 33→51で追加 | 18 | 14 | 4 | 0 | 6 |

この表は調査の優先度を示すものであり、OSM IDやschedule URLがないことだけで施設を不正確と判断するものではない。最終判断は公式sourceと施設ごとのevidenceで行う。

2026-08-27にこの監査を実施した。施設別結果は [`../research/track-expansion/track-source-audit.json`](../research/track-expansion/track-source-audit.json)、変更理由とURL監査結果は [`../research/track-expansion/current-51-audit.md`](../research/track-expansion/current-51-audit.md) に記録した。八部公園陸上競技場はidentityを確認できず除外し、公開datasetは50施設になった。初期12と12→33の33施設も監査対象に含め、除外していない。

## 10. 完了条件

batchを完了とするには、次をすべて満たす。

- 候補、hold、exclude、includeの判断が記録されている
- 公開施設はidentity、位置、主要track仕様、個人利用statusの根拠を持つ
- availability sourceが全追加施設で分類されている
- 不明値を推測していない
- collector対応数と施設掲載数を混同していない
- 既存施設の変更が明示されている
- normalized datasetとresearch/availability IDが一致する
- fresh rangeで全施設×31日を生成できる
- validation、tests、lint、build、desktop/mobile smokeが成功する
- PRで施設ごとの根拠をreviewできる
- 公開後の再検証対象と周期が決まっている

品質上の最終判断に迷う場合は、値をunknownにする、施設をholdする、collectorを未対応にする、の順で安全側に倒す。正しく保留することは、誤った施設情報を公開するより価値が高い。
