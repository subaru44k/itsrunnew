# 施設情報再確認向け GPT-6 Luna 推論設定の試験

実施日: 2026-09-26（JST）。対象は `gpt-6-luna` の標準モード、`reasoning.effort=none | low | medium | high | xhigh | max`。本試験は公開施設の情報を変更していない。

## 方法

- `master` の Track Dataset から10施設を選び、施設・自治体等の公式HTMLを同日にHTTP 200で取得した。HTMLからナビゲーション、script、style等を除いた本文を全設定へ同じ形で渡した。原本と抽出テキストは `/private/tmp/itsrun-eval-*.html|txt` に一時保存した。
- 個人利用、料金、トラック長、改修期間、施設の取り違え、年齢・レーン制限、期間限定休止について、施設ごとに2つの主張を作った。各設定で各施設を2回独立実行した。合計120 API呼び出し、各設定40判定。
- Responses APIに公式本文と主張を渡し、`supported | refuted | insufficient` と短い原文引用を厳密なJSON schemaで要求した。`store=false`、`max_output_tokens=12000`、built-in web searchなし。結果はモデルから取得した `usage` で計算した。APIキー、生レスポンス、公式ページ全文はGitへ保存していない。
- 第2競技場の「専用利用がない日に共同利用できる」は、原文がより狭い「施設の利用がない日に限り可能」であるため、採点時に正解を `supported` から `insufficient` へ訂正した。この主張のモデル回答は両設定とも全試行で `insufficient` だった。判断変更は原文の条件を再確認した結果である。
- 正答は主張ラベルの一致で数えた。根拠引用は、空白を除いた原文との連続部分文字列一致で検査した。引用1件は離れた文を連結したため不一致だった。

| 施設と主な論点 | 公式ページ |
|---|---|
| 練馬・一般開放と無料 | [練馬区](https://www.city.nerima.tokyo.jp/shisetsu/koen/undo/nerima.html) |
| 光が丘・改修開始月と利用停止範囲 | [東京都公園協会](https://www.tokyo-park.or.jp/park/hikarigaoka/facility/) |
| 織田フィールド・再開予定と公認検定日の例外 | [東京都公園協会](https://www.tokyo-park.or.jp/park/yoyogi/news/2026/7_1_11_30.html) |
| 千葉県総合スポーツセンター主競技場・専用利用のみ | [指定管理者](https://www.cue-net.or.jp/kouen/sportscenter/annai/stadium.html) |
| 同第2競技場・共同利用の条件と料金 | [指定管理者](https://www.cue-net.or.jp/kouen/sportscenter/annai/substadium.html) |
| 不入斗・一般料金と専用使用時の例外 | [横須賀市](https://www.city.yokosuka.kanagawa.jp/5560/sisetu/fc00000043.html) |
| 東京体育館・長さと年齢制限 | [施設公式](https://www.tef.or.jp/tmg/stadium/) |
| 駒沢・レーンとスパイク制限 | [施設公式](https://www.tef.or.jp/kopgp/stadium/?no=tab2) |
| 等々力・主／補助競技場と料金 | [指定管理者](https://kawasaki-todoroki-park.co.jp/guide/track-and-field/) |
| 半田・期間限定休止と通常の個人利用規則 | [半田市](https://www.city.handa.lg.jp/bunka/sports/1002825/1002831/1002833.html) |

## 実測結果

各設定とも20/20応答が完了し、入力は47,234 tokenだった。出力tokenには推論tokenを含む。

| 推論設定 | 正答/40 | 根拠のない `supported` | 原文一致の引用/40 | 出力token | 中央応答時間 | 20回の推計モデル費 |
|---|---:|---:|---:|---:|---:|---:|
| none | 37 | 2 | 40 | 1,658 | 1.55秒 | $0.0041 |
| low | 37 | 2 | 40 | 1,662 | 1.52秒 | $0.0041 |
| medium | 35 | 1 | 40 | 5,722 | 2.30秒 | $0.0061 |
| high | 35 | 2 | 40 | 8,855 | 2.77秒 | $0.0077 |
| xhigh | 39 | 0 | 40 | 11,504 | 3.67秒 | $0.0090 |
| max | 38 | 0 | 39 | 27,683 | 6.76秒 | $0.0171 |

`none`〜`high` の根拠のない `supported` は、千葉の第2競技場で「施設の利用がない日に限り可能」を「専用利用がなければ可能」へ広げたもの。`medium` のもう1回は `refuted` とした。`xhigh` と `max` は全試行で `insufficient` とした。光が丘の「第二期工事は10月から年度末まで」という主張を `insufficient` としたのは、lowで1回、mediumとhighで各2回、xhighで1回、maxで2回。公式本文に月と範囲はあるが、慎重な不採用である。等々力の主競技場まで休止しているという誤主張を `insufficient` としたのはnone、medium、highで各1回。半田のmax 1回はラベルは正しかったが、離れた原文2箇所を結合した引用を返した。

料金計算は [OpenAI公式のGPT-6 Luna料金](https://developers.openai.com/api/docs/models/gpt-6-luna) に従い、100万tokenあたり通常入力$0.10、cached入力$0.01、cache write$0.125、出力$0.50を実測usageへ適用した概算であり、請求書の確定額ではない。推論設定ごとのtoken単価は同じ。各設定の20回について、入力は通常1,918、cached 22,658、cache write 22,658 tokenで、入力料金は約$0.00325。残りが出力料金である。120回のモデル費合計は約 **$0.0480**。built-in web searchは使用せず、今回の検索呼び出し料金は **$0**。

## 周期運用への費用外挿

133施設を年4回、1施設あたり今回と同じ1ページ・1回のAI照合で巡回すると **532 API呼び出し／年**。今回の平均入出力tokenを外挿したモデル費は次のとおり。左端は入力がすべて通常料金、右端はすべてcache write料金の場合で、検索・PDF処理等を含まない。

| 推論設定 | 年間モデル費の試算 |
|---|---:|
| none / low | 約$0.15〜$0.18 |
| medium | 約$0.20〜$0.23 |
| high | 約$0.24〜$0.27 |
| xhigh | 約$0.28〜$0.31 |
| max | 約$0.49〜$0.53 |

全件に独立した2回目の照合を付ければモデル費はおよそ2倍。複数ページ、PDF画像、再試行、長い属性一覧を使う本番処理では増える。逆に、同じ資料がcache hitすれば入力料金は下がる。

**検索呼び出し料金は今回の実験でも上表の運用試算でも発生していない。** 評価資料は既知の公式URLへ直接HTTPリクエストして取得した。AIの built-in web search を別途使う場合だけ、[OpenAI公式料金](https://developers.openai.com/api/docs/pricing)の1,000回あたり$10に検索結果の入力token料金が加わる。例えば年間532件すべてで1回検索するなら検索呼び出しだけで **$5.32／年**、10%に限れば約 **$0.53／年**。これは設計上の仮定であって今回の実測費用ではない。HTTP取得、GitHub Actions、保存領域の費用はモデル費に含めない。

## 判断と限界

この**公式本文を与えた照合試験**ではxhighを第一候補とする。high以下では、公式文面より緩い利用条件を `supported` とする誤りが出た。highからxhighへの年間モデル費差は、この小さな入力を仮定すると約$0.04である。maxはxhighより正答を増やさず、出力token約2.4倍、実測推計API費約1.9倍、応答時間中央値約1.8倍だった。正答率は推論設定に対して単調ではなく、10施設・20主張の2反復だけで全133施設の精度を保証しない。高い推論設定の優位が別の資料でも続くかは追加検証が必要。

今回測っていないのは、公式ページの再発見、複数資料の矛盾解消、PDF画像読解、英語名・座標更新、AIによる差分パッチ生成、CIを経た自動公開である。自律的な周期運用へ採用する前に、この一連の処理をshadowで全133施設へ適用し、変更候補・根拠なし判定・既存値への影響を別に検証する。

試験中、公開データの光が丘のnoteは「2026年8月から年度末まで改修予定」だが、取得した[公式施設ページ](https://www.tokyo-park.or.jp/park/hikarigaoka/facility/)は第二期工事を「10月～今年度末」と案内していた。これは実データの再確認対象として別途扱う。今回の試験では公開データを更新していない。
