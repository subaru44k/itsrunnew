# 「今日、個人利用できるトラック」フィージビリティ調査

初回調査日: 2026-08-24（Asia/Tokyo）
最終更新: 2026-09-04（Asia/Tokyo）

対象データ: [`itsrunnew/src/data/tracks.json`](../../itsrunnew/src/data/tracks.json)
構造化結果: [`availability-sources.json`](availability-sources.json)

## 51候補への品質優先拡張追補

2026-08-25に神奈川・千葉・埼玉の公式一次情報を確認した18候補を追加し、当時のTrack Datasetは51施設になった。2026-08-27に初期33施設を含む全51候補を遡及監査し、施設identityを確認できなかった1件を除外して50施設へ補正した。同日の関東網羅性batchで東京・千葉・神奈川の19施設、関西batchで大阪・兵庫・京都の20施設、2026-08-28の中国・愛知・福岡batchで20施設を追加した。さらに同日のcoverage gap follow-upで過去対象地域を再監査し24施設を追加して、現在は133施設である。2026-09-04のbatch 1では日産スタジアム・日産フィールド小机の共通HTMLと、神奈川県立スポーツセンター・万博記念競技場の月次PDFを実データで検証してcollectorへ追加し、27/133（20.3%）になった。同日のbatch 2では6施設を追加し、意味まで安全に確定できる施設数は33、coverageは33/133（24.8%）になった。未対応施設は共通fallbackにより `unknown` となり、情報欠落を利用不可とは解釈しない。

施設・属性・地域の追加履歴は [`../track-expansion/phase2-expansion-report.md`](../track-expansion/phase2-expansion-report.md)、遡及監査は [`../track-expansion/current-51-audit.md`](../track-expansion/current-51-audit.md) を参照する。batch 2のsource・意味付け・live検証は [`high-confidence-collector-validation-batch-2-2026-09.md`](high-confidence-collector-validation-batch-2-2026-09.md) に記録する。以下の33施設・12施設の節は当時の調査履歴として残す。

## 2026-09 batch 2: 6施設の高確度collector

2026-09-04に、公式sourceの対象日・時間・利用可否を明示情報だけで判定できる6施設を追加検証した。27施設から33施設となり、Track Dataset 133施設に対するcoverageは33/133（24.8%）である。自動判定対象の実装形式は、実際のrecordが持つ `publicationFormat` に基づき次のとおりである。

| publicationFormat | 施設数 | 施設 |
|---|---:|---|
| `structured_html` | 7 | 光が丘、武蔵野、越谷、日産スタジアム、日産フィールド小机、西京極補助競技場、柳島 |
| `calendar_html` | 3 | 東京体育館、駒沢、江戸川 |
| `calendar_json` | 1 | 町田GIONスタジアム |
| `fixed_schedule` | 9 | 大泉、赤塚、井の頭、朝霞、代々木、大井、舎人、奥戸、秋留台 |
| `weekly_notice` | 1 | 山城総合運動公園 |
| `pdf` | 12 | 練馬、戸田、和田堀第一、和田堀第二、三郷、上尾、富士森、上柚木、神奈川県立スポーツセンター、万博記念、国府台、びんご |
| **合計** | **33** | |

WordPress記事や施設の調査上の公開方式と、collectorが生成recordへ保存する `publicationFormat` は同じ分類とは限らない。本coverageでは現行codeを正本とし、西京極・柳島のWordPress月次noticeを `structured_html` として数えた。研究用source分類での `weekly_notice` / `calendar_html` との重複カウントは避ける。

### 追加施設の公式sourceと安全な意味付け

| 施設 | 公式source | 安全に判定する根拠 |
|---|---|---|
| 町田GIONスタジアム | [町田市案内](https://www.city.machida.tokyo.jp/bunka/sport/sport/gion-stadium/sport06.html)、[公式カレンダー](https://www.nozuta-park.com/calender.html)、[Event Organiser JSON](https://www.nozuta-park.com/wp-admin/admin-ajax.php?action=eventorganiser-fullcal) | 月境界付きJSONの完全一致title・category・説明文・ISO日時。個人利用の明示時間だけpartial、専用利用・休場の明示範囲だけunavailable。イベントなし、対象月外、重複・矛盾、形式変更はunknown |
| 国府台陸上競技場 | [市川市施設案内](https://www.city.ichikawa.lg.jp/page/4184.html)、[月次使用予定表](https://www.city.ichikawa.lg.jp/page/4185.html) | 月次表の対象日「利用時間」から明示イベントの「使用時間」を差し引く。予定表ページの「使用時間以外を一般開放」という規則、対象月、時刻を検証できなければunknown |
| 柳島スポーツ公園総合競技場 | [茅ヶ崎市案内](https://www.city.chigasaki.kanagawa.jp/shisetsu_info/s_sports/1028429.html)、[個人利用案内](https://www.ys-park.jp/user-guide/athletics/)、[2026年9月記事](https://www.ys-park.jp/2026/09/01/17617/) | WordPress検索結果の年・月・完全一致titleと、記事内の明示日時・休館・開放なしだけを判定。記事内非掲載日はunknown |
| 東寺ハウジングフィールド西京極 | [施設案内](https://www.kyoto-sports.or.jp/facilities/detail.php?id=4)、[月次topic一覧](https://www.kyoto-sports.or.jp/category/cat_topics/) | 記事titleの年月、本文の補助競技場名、開放日と時間を相互検証。主競技場の予定や非掲載日を補助競技場の不可・可へ流用しない |
| 京都府立山城総合運動公園 | [個人利用申込案内](https://www.kyoto-park.jp/application/)、[固定URLの個人利用告知](https://www.kyoto-park.jp/2022/03/31/%E9%99%B8%E4%B8%8A%E7%AB%B6%E6%8A%80%E5%A0%B4%E5%80%8B%E4%BA%BA%E5%88%A9%E7%94%A8%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B/) | 固定URLを上書きする記事のtitle、公開年、対象日、明示時間を検証。記事の短期掲載範囲外はunknownで、過去記事から補完しない |
| びんご運動公園陸上競技場 | [利用案内](https://bingo-sportspark.com/guide.html)、[月次PDF掲載記事](https://www.bingo-sportspark.com/news.php?c=topics_view&pk=1566461033) | 月次PDFの年月・凡例とトラック可否を検証。トラック利用可、明示時間境界、終日×だけを判定し、空欄・混在記号はunknown |

国府台の「利用時間以外は一般開放」は、公式規則が明示する開場時間を根拠にした限定的な差し引きであり、他施設へ一般化しない。全施設で予定変更・大会・専用利用・整備・天候等の当日差異が残るため、freshなavailableでも公式確認を案内する。

### 代表的なlive例

2026年9月の公式資料・応答をfixtureと目視比較した代表例は次のとおりである。いずれもsourceの掲載範囲に依存し、将来の掲載内容を保証するものではない。

- Machida JSON: `個人利用日` / `personal` の9月1日9:00–18:00は `partially_available`、9月3日開始・9月7日終了のend-exclusive範囲は9月6日までを対象とする。`専用利用日` / `rikujyou` と `休場日` / `break` は明示範囲だけ `unavailable`、非掲載日はunknown。
- 国府台PDF: 9月1日は9:00–21:00、9月4日は9:00–12:00の市民スポーツ教室を差し引いて12:00–21:00をavailable、9月28日の休場表示はunavailable。
- 柳島記事: 9月4日14:30–22:00をpartial、9月14日の施設休館・9月21日の開放なしをunavailable、記事にない9月3日はunknown。
- 西京極記事: 9月1日と7〜9日の7:00–21:00をpartial、非掲載日はunknown。主競技場の予定とは混同しない。
- 山城告知: 9月4日9:00–21:00をpartial、9月6日の利用不可をunavailable、短期告知にない9月7日はunknown。
- びんごPDF: 9月1日はトラック利用可、9月3日は16:00まで、9月5日は14:00以降をpartial、9月19日の終日×はunavailable。

### 取得・解析の失敗時

JSONの対象月、PDFの年月・凡例、WordPress記事のtitle・公開年・施設anchorを検証する。取得失敗、content type不一致、抽出失敗、anchor変更、年月不一致、時刻欠落、空欄、非掲載、重複や意味の矛盾は `unknown` へ降格し、`unavailable` にはしない。PDFはOCRを導入せず、座標付きtext extractionで意味を確定できる形式だけを対応する。range collectorの同一URL cacheにより、月次PDF・月次JSON・WordPress記事・固定URL告知を31日分繰り返し取得しない。

## 33施設への拡張追補

Track Datasetは2026-08-24に12施設から33施設へ拡張した。最新の施設別source of truthは `availability-sources.json`、拡張時のcoverage・pipeline評価は [`../track-expansion/dataset-expansion-report.md`](../track-expansion/dataset-expansion-report.md) である。

- 公式Web上のavailability source確認: 30/33（90.9%）
- structured HTML/calendar/fixed: 16/33（48.5%）。15施設を実装し、世田谷1施設は安定した当日HTML取得元がないためguarded unknown
- PDF: 9/33（27.3%）。上柚木を現行sourceに合わせPDFへ再分類し、8施設を実装。府中1施設は日別vector図形のためguarded unknown
- 現collector対応: 23/33（69.7%）。詳細は [`html-calendar-collector-validation.md`](html-calendar-collector-validation.md)
- reservation system: 5/33（15.2%）
- phone only / Web予定なし: 3/33（9.1%）
- future date対応可能: 26、today only 4、unknown 3

2026-08-24の再検証で、舎人・秋留台は週次SNS主方式ではなく公式固定開放ルール、上柚木はHTML calendarではなく複数月PDFを主方式とする方が正確と判明した。過去節の12施設時点の数値は当時の調査記録として残し、33施設時点のsource of truthは `availability-sources.json` と上記検証reportとする。

以下は12施設時点の初回フィージビリティ調査を履歴として残す。最新の件数判断には上記追補と構造化JSONを使う。

## 12施設時点の結論（履歴）

現在のTrack Datasetは12施設である。11施設（91.7%）では、日付別予定、固定一般開放ルール、または公開予約状況のいずれかを公式Web上で確認できた。ただし、任意の日について高い信頼度で自動判定できると評価したのは、光が丘公園、武蔵野陸上競技場、東京体育館の3施設（25.0%）である。

最初の実装は、HTML 3施設と固定ルール5施設を対象にするのが費用対効果が高い。これにより8/12施設（66.7%）をcollectorの対象にできる。ただし固定ルール施設では、ルールから確定できる日時だけ `available` / `unavailable` を返し、それ以外は必ず `unknown` とする。PDF 2施設を次に追加すると10/12施設（83.3%）まで広げられる。

「collectorが対応している施設数」と「毎日、終日の結論を必ず返せる施設数」は同じではない。固定ルール型は、貸切不可の一般開放日を確定できても、それ以外の日の非公開予約状況は確定できない。この差をUIと集計で隠してはならない。

## 調査方法と判定基準

- normalized Track Datasetのstable internal IDを基準に12施設を全件照合した。
- 自治体、施設、指定管理者、公式予約システムだけをavailabilityの根拠とした。
- 施設トップではなく、実際の日程表、日別表、固定規則、予約状況へのURLを優先した。
- 「大会予定がない」「検索結果がない」だけでは個人利用可と判定しなかった。
- `yes` は現在の公式Web情報だけで対象日・時間・意味を高い信頼度で解釈できるもの、`probably` はPDF解析または固定ルールの限定的判定で実現できるもの、`difficult` は外部システム操作と追加の意味確認が必要なもの、`no` はWebから日別情報を得られないものとした。
- URLと掲載方式は2026-08-24にHTTP応答と本文を再確認した。これは将来のURL・規則の継続を保証しない。

## 定量結果

### 公開方式

| 主方式 | 施設数 | 割合 | 施設 |
|---|---:|---:|---|
| `structured_html` | 2 | 16.7% | 光が丘、武蔵野 |
| `calendar_html` | 1 | 8.3% | 東京体育館 |
| `weekly_notice` | 0 | 0.0% | — |
| `fixed_schedule` | 5 | 41.7% | 大泉中央、赤塚、井の頭、朝霞、代々木 |
| `pdf` | 2 | 16.7% | 練馬、戸田 |
| `reservation_system` | 1 | 8.3% | 新座 |
| `phone_only` | 1 | 8.3% | 城北中央 |
| `no_schedule_found` | 0 | 0.0% | — |
| **合計** | **12** | **100.0%** | |

`phone_only` の城北中央公園では、一般利用の原則は公式Webにあるものの、当日の貸切・整備状況はWebにない。そのため「公式Web上でavailability情報を発見」の件数は11/12である。`no_schedule_found` ではなく `phone_only` としたのは、公式案内が現地掲示・サービスセンター確認へ明示的に誘導しているためである。

### 自動判定フィージビリティ

| 評価 | 施設数 | 割合 | 意味 |
|---|---:|---:|---|
| `yes` | 3 | 25.0% | HTMLの日付・時間・状態を直接解釈可能 |
| `probably` | 7 | 58.3% | PDFまたは固定ルールで限定的・計画上の判定が可能 |
| `difficult` | 1 | 8.3% | 予約システムと施設規則の結合、運用確認が必要 |
| `no` | 1 | 8.3% | 日別情報が電話・現地掲示のみ |
| **合計** | **12** | **100.0%** | |

`yes + probably` は10/12（83.3%）だが、`probably` の固定ルール施設は判定不能日を `unknown` にする前提である。無条件に「毎日判定できる10施設」という意味ではない。

## 施設別結果

| 施設 | 主方式 | 粒度 / 更新 | 自動化 | 判定できる範囲と主な障害 |
|---|---|---|---|---|
| 練馬総合運動場公園 | `pdf` | 3時間枠 / 火・金 | `probably` | [直近1週間PDF](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.files/20260821souun_kaihoujoukyou.pdf)の明示枠。URL差替えと表の列対応が必要。人工芝優先枠は陸上練習不可 |
| 光が丘公園 | `structured_html` | 午前・午後・全日 / 月次 | `yes` | [月次告知](https://www.tokyo-park.or.jp/park/hikarigaoka/news/2026/trackfield_2026_8_1.html)と貸切ルール。現在は2026年度末まで改修閉鎖 |
| 大泉中央公園 | `fixed_schedule` | 時間帯 / 固定 | `probably` | [施設規則](https://www.tokyo-park.or.jp/park/oizumi-chuo/facility/)の定期一般開放日は確定可能。その他の日の貸切状況は非公開 |
| 城北中央公園 | `phone_only` | 不明 / 不明 | `no` | [施設規則](https://www.tokyo-park.or.jp/park/johoku-chuo/facility/)は「貸切のない日」のみ。不可日は入口掲示・電話確認でWeb日程なし |
| 赤塚公園 | `fixed_schedule` | 終日 / 固定 | `probably` | [施設規則](https://www.tokyo-park.or.jp/park/akatsuka/facility/)の水曜・第1日曜・第3土曜。臨時整備と他日の貸切は不明 |
| 武蔵野陸上競技場 | `structured_html` | 2時間枠 / 日次 | `yes` | [当日開放状況](https://www.musashino.or.jp/sports/kaihou/index.html)のA・B・貸切を解釈可能。Bは外周ジョギングだけでトラック可としない。表示日検証が必要 |
| 井の頭恩賜公園 | `fixed_schedule` | 終日 / 固定 | `probably` | [貸切可能日の規則](https://www.kensetsu.metro.tokyo.lg.jp/jimusho/seibuk/inokashira/shinsei)から、それ以外の日は原則一般利用。水曜・第2・第4日曜の予約有無は非公開 |
| 戸田市スポーツセンター | `pdf` | 時間帯 / 月次 | `probably` | [月次行事予定PDF](https://toda-zaidan.org/wp-content/uploads/2026.080-1.pdf)と「専用利用時を除き個人可」を結合。複数施設の列を誤結合しないレイアウト解析が必要 |
| 朝霞中央公園 | `fixed_schedule` | 時間帯 / 年度ルール | `probably` | [施設ページ](https://www.city.asaka.lg.jp/soshiki/41/chuourikujou.html)と年度日程。陸上・球技の交代、市内在住・在勤・在学限定、当日中止を表現する必要 |
| 新座市総合運動公園 | `reservation_system` | 予約枠 / ほぼリアルタイム | `difficult` | [公開予約システム](https://k5.p-kashikan.jp/niiza-city/index.php)はログインなしで閲覧可。ただし状態を持つPOST、利用規約、専用枠の空きと共用利用規則の結合が必要 |
| 代々木公園 | `fixed_schedule` | 時間帯 / 固定＋告知 | `probably` | [定期規則](https://www.tokyo-park.or.jp/park/yoyogi/facility/)に[長期閉鎖告知](https://www.tokyo-park.or.jp/park/yoyogi/news/2026/park_info_73.html)を優先適用。貸切のない追加時間は確定不能 |
| 東京体育館 | `calendar_html` | 1時間・コース別 / 随時 | `yes` | [一般開放カレンダー](https://www.tef.or.jp/tmg/opening.html)へ日付をPOSTすると一般開放・貸切・休館をHTML表で取得可能。コース別scopeを保持する必要 |

施設ごとの補助URL、例外、推論規則、URL安定性は `availability-sources.json` に記録した。

## PDF調査

PDF parserの投資で主方式として追加できるのは練馬と戸田の2施設であり、HTML＋固定ルールの8施設から10施設へ、16.7ポイント増える。加えて武蔵野の月間予定と朝霞の年度日程を、当日HTML・固定ルールの補助証拠として扱える。

確認した4例はいずれも1ページのtext-based PDFで、OCRは不要だった。

| 施設 | 表の形 | URL更新 | 抽出上の論点 |
|---|---|---|---|
| 練馬 | 7日 × 3枠 | 日付入りURL、安定ページから発見 | 空セルと結合セル、人工芝優先とトラック優先の区別 |
| 戸田 | 月間の日付・イベント・施設・時間 | 月ごとの不規則なファイル名 | 別施設イベントを陸上競技場へ誤結合しないこと、夏季17-18時列 |
| 武蔵野 | 月間の日付 × 5枠 | 年月入りURL、一覧から発見 | A・(A)・B・×の意味。日次HTMLを優先 |
| 朝霞 | 年間日付表＋曜日別種目割当 | 年度ごとのattachment URL | 月列の読順、陸上と球技の時間交代、利用資格 |

したがって最初からOCR基盤を作る必要はない。Phase Bでは、安定した索引ページから最新PDFを発見し、PDF bytesのhashと公開日を保存し、座標情報を保つtext extractionで施設別parserを作るのが妥当である。通常の文字列抽出だけでは戸田・朝霞で列を取り違える可能性が高い。

## 予約システム調査

新座市公共施設予約システムは、空き状況の閲覧にはログイン不要で、予約時だけ登録が必要である。施設 `ShisetsuCode=013` が総合運動公園で、室場に「陸上競技場（専用）」がある。日付と施設はフォームのPOST値で指定でき、結果はサーバー生成HTMLとして返るため、ブラウザ自動操作は必須ではない。一方、安定した日付deep linkや公開APIは確認できなかった。

最大の問題は技術より意味である。表示される「空き」は専用予約枠の空きであり、それ単独では当日の個人利用保証ではない。[市の施設規則](https://www.city.niiza.lg.jp/site/sieiundousisetu/index.html)にある「専用利用がない場合に共用利用可能」と結合して初めて候補枠になる。雨天・グラウンド状態では現地判断で利用できない場合もある。

[利用規約](https://k5.p-kashikan.jp/niiza-city/index.php?op=tos)には自動取得を名指しした条項は確認できなかったが、不正アクセスは禁止されている。実装前に運営者への確認、低頻度アクセス、結果キャッシュ、識別可能なUser-Agent、障害時の停止を検討する。予約操作やログインはcollectorの対象外とする。

## 誤判定しやすいケース

1. 大会予定がないことを、一般開放とみなす。
2. 専用予約枠の「空き」を、無条件の個人利用可とみなす。
3. 固定一般開放日以外を、貸切告知が見つからないだけで可とする。
4. PDFの空欄、結合セル、別施設のイベント列を誤解釈する。
5. 武蔵野のB開放（外周ジョギングのみ）や練馬の人工芝優先枠を、通常のトラック利用可とする。
6. 一部レーンだけ利用可なのに、施設全体を終日availableとする。
7. 市内在住等の資格条件を無視して、全利用者にavailableと表示する。
8. 改修、芝生養生、整備、年末年始、季節時間を固定ルールより後に評価しない。
9. 雨天・雷・台風・大気汚染等の当日閉鎖を、事前予定だけで上書きする。
10. 取得失敗、古いPDF、対象日不一致、parserエラーを `unavailable` にする。

優先順位は、明示的な当日閉鎖・長期閉鎖 > 当日HTML > 最新予定表 > 固定開放ルール > 不明、とする。矛盾時は安全側に `unknown` とし、`unavailable` は公式な不可情報または完全な予定表からのみ生成する。

## 将来の共通availability schema

施設データとは別の、日付単位の生成物を推奨する。

```json
{
  "schemaVersion": 1,
  "trackId": "musashino-athletic-track",
  "date": "2026-08-24",
  "timezone": "Asia/Tokyo",
  "status": "partially_available",
  "periods": [
    {
      "from": "09:00",
      "to": "11:00",
      "status": "available",
      "scope": "track_and_jogging_course",
      "eligibility": "public",
      "conditions": []
    },
    {
      "from": "11:00",
      "to": "13:00",
      "status": "unknown",
      "scope": "track",
      "eligibility": "public",
      "conditions": ["same_day_change_possible"]
    }
  ],
  "source": {
    "url": "https://www.musashino.or.jp/sports/kaihou/index.html",
    "type": "official",
    "publicationFormat": "structured_html",
    "publishedAt": null,
    "documentId": null
  },
  "freshness": {
    "fetchedAt": "2026-08-24T06:00:00+09:00",
    "parsedAt": "2026-08-24T06:00:01+09:00",
    "checkedAt": "2026-08-24T06:00:01+09:00",
    "validForDate": "2026-08-24",
    "expiresAt": "2026-08-25T00:00:00+09:00"
  },
  "evidence": {
    "collector": "musashino-html",
    "parserVersion": "1.0.0",
    "sourceHash": "sha256:...",
    "confidence": "high"
  },
  "warnings": ["当日変更の可能性あり"]
}
```

`status` は `available | partially_available | unavailable | unknown` とする。時間枠内にも `available | unavailable | unknown` を持たせる。施設全体のstatusは、明示されたscopeと時間枠から機械的に集約する。

鮮度情報は次の意味を分ける。

- `publishedAt`: 発行元が表示した更新・公開時刻。表示がなければ `null`。
- `fetchedAt`: collectorがHTTP responseを取得した時刻。
- `parsedAt`: parserが生成物を作成した時刻。
- `checkedAt`: schema・対象日・整合性検証に最後に成功した時刻。
- `validForDate`: availabilityが対象とする施設現地日付。
- `expiresAt`: UIが最新情報として扱える期限。超過時はstatusを `unknown` に降格する。

`scope` は少なくとも `full_track | track_and_jogging_course | jogging_course_only | lane_subset | unknown` を持つ。利用資格は `eligibility` と `conditions` に分離し、朝霞の市内要件を失わないようにする。生の根拠を再検証できるよう、source URL、bytes hash、collector名、parser versionも保存する。

## 実装優先順位（初回調査時点の履歴）

### Phase A: HTML/calendar + fixed rule evaluator

対象はHTML 3施設（光が丘、武蔵野、東京体育館）と固定ルール5施設（大泉中央、赤塚、井の頭、朝霞、代々木）の計8/12、66.7%。

- 3つの公式HTMLをfixture保存して施設別parserを作る。
- fixed ruleは曜日・第n曜日・時間帯・季節・利用資格を設定データとして持つ。
- 長期閉鎖と整備を固定ルールより優先するoverlayとして扱う。
- 判定不能日は成功扱いの `unknown` を出し、collector失敗と区別する。
- Webページ表示時に取得せず、事前生成したavailability JSONだけをTrack Searchが読む構成を守る。

この段階で、低コストに全体の66.7%をcollector対象にできる。HTMLだけに限定すると3/12、25.0%である。固定ルールを含めても、8施設すべてで毎日確定値が出るわけではない。

### Phase B: text PDF collectors

練馬と戸田を追加し、10/12、83.3%へ拡大する。OCR共通基盤ではなく、索引ページ発見処理と座標付きtext extraction、施設別parser、golden fixtureを先に作る。武蔵野・朝霞のPDFは補助・回帰確認に利用する。

### Phase C: 新座予約システム

運営者・規約確認と意味検証後に再評価する。実装する場合も公開閲覧だけ、低頻度、キャッシュ必須とし、予約・ログイン操作は行わない。追加可能性は1施設、8.3ポイントである。

### 手動確認を維持

城北中央公園は電話・現地掲示のみのため自動化対象外とし、`unknown` と公式連絡先を表示する方が正確である。

## 初回調査時点の次のCodexタスク（履歴）

以下は初回調査時点の計画である。Phase A・Bと後続collector追加の一部は実装済みで、現在の6施設追加の詳細はbatch 2の検証記録を正本とする。

1. `trackId + source config`、fixed rule、closure overlayのschemaとvalidatorを追加する。
2. 光が丘・武蔵野・東京体育館のfixtureベースHTML parserを実装する。
3. 大泉中央・赤塚・井の頭・朝霞・代々木の固定ルール評価器を実装する。
4. 任意の日付を指定して、上記共通schemaの静的JSONを生成するCLIを追加する。
5. 取得失敗、古い情報、対象日不一致、矛盾、限定利用をすべて `unknown` にするテストを追加する。
6. collectorを実サイトへ過剰アクセスさせず、fixture testと低頻度の明示的refresh commandを分ける。

UIの「本日利用可能」filter、scheduler、予約システムcollectorは、この生成物の精度と運用許容を確認してから別タスクで実装する。PDF parserとbatch 2の6施設は後続作業で実装済みである。

## 現在の後続課題

- 33/133のcollectorを日次rangeで運用し、source変更・予定未公開・当日変更を `unknown` として監視する。
- 町田、国府台、柳島、西京極、山城、びんごのlive sourceを定期的に目視比較し、月次PDF・WordPress記事・固定URL告知の掲載範囲を再確認する。
- 予約システム、電話・現地確認、today-only sourceは、意味と運用許容を別途確認するまで自動化しない。

## 制約と未解決事項

- 公式サイトのURL、HTML、PDF名は予告なく変わり得る。
- 一般開放予定は利用保証ではなく、当日変更・天候・混雑・安全判断がある。
- 固定ルール型の実日付カバレッジは、将来の観測期間を決めて別途測定する必要がある。
- 公開予約システムの自動取得は、技術的に可能でも運用者の許容と利用規約を先に確認する。
- 調査結果はTrack Datasetのsource metadataと分離し、頻繁に変わるavailabilityはcollectorの生成物として扱う。batch 2でもこの境界を維持し、未確定のsource semanticsや取得失敗を既存UIで利用不可と表示しない。
