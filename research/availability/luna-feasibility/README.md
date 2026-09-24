# Luna availability feasibility pilot

このディレクトリは2026年9月22日までの採用評価の履歴です。その後、候補10施設のうち8施設をLuna AI、2施設をICSでcollectorに実装しました。現行の動作と運用境界は [`docs/AVAILABILITY.md`](../../../docs/AVAILABILITY.md) と [`ai-collector-integration-2026-09.md`](../ai-collector-integration-2026-09.md) を参照してください。以下の「未実施」や「次」は評価時点の記録です。

2026-09-20に公式資料を保存。同日、Luna APIで3施設×3回の解析を実行済み。府中10件は人手記入済みで、[比較・再確認案](fuchu-review.md)を作成。分類2件の再確認待ち。岡崎10件も記入済みで、[比較・再確認案](okazaki-review.md)を作成。3件は休止告知の全施設対象行に基づきユーザー確認済みで、判定表へ修正を反映した。枚方10件も記入済みで、[比較結果](hirakata-review.md)は全件判断不能で一致、修正不要。
実行結果の概要は [API試行結果](pilot-report.md) を参照。個別回答は人手判定へ影響しないようGit対象外のresults/に分離する。
第2回は5施設29日をLuna none（3回）とCodex内Astra low（独立1回）で比較済み。[結果と制限](round2-report.md)、[全件比較](round2-comparison.md)を参照。statusは23/29・29/29・29/29で一致したが、非掲載の不可断定・条件欠落・分類定義の揺れがあり、無確認公開は見送る。
対象設定は `gpt-5.6-luna` / `reasoning.effort: none`。別設定で代用しない。

## 最初に行うこと

府中は現状の単純読み取りでは採用しないと判断し、施設別チューニングは行わない。岡崎の差分3件は修正済み。枚方10件も比較済み。利用可能枠を含む文章・HTMLの追加評価は第2回で実施済み。次は共通定義の整理と、画像・PDFを含む未対応施設の未使用資料で検証する。

専用入力画面をリポジトリルートから起動する（Python 3標準ライブラリのみ）。

```sh
python3 research/availability/luna-feasibility/annotator.py
```

`http://127.0.0.1:8766` を開く。施設と日付を選び、左の保存資料を見ながら判定ボタン・自然言語の入力欄を埋め、「保存」または「保存して次へ」を押す。最初は岡崎龍北の未記入日が開く。保存完了後は画面を閉じても再開できる。
入力画面は `annotator.html` / `annotator.js` / `annotator.css`、ローカル保存は `annotator.py` が担当する。停止は起動したターミナルでCtrl+C。別portを使う場合は `--port 8767` を指定する。

保存先は既存の [人手判定シート](annotation.md)。府中の記入もそのまま読み込む。保存時は対象行だけ更新し、保存前の表をGit対象外の `local-state/backups/` へ退避する。別画面で同じ日が変更されたときは競合を表示して上書きしない。
未保存のまま日付を移る場合も保存成功後に移動する。ファイルへの保存に失敗した場合は画面の入力を保持する。ブラウザを閉じる前に「保存済み」を確認する。
判定と根拠の両方が入った日を進捗上の記入済みと数える。空欄は未記入、判断不能は判定済みの選択肢。時間・条件・根拠・迷った点は自然言語でよい。
AIの回答・比較レポートは入力画面から配信しない。外部通信・APIキー・アカウントは不要で、Macの127.0.0.1だけで動く。公開サイトの `/manage` やcollectorには接続しない。

根拠資料は入力画面内とシートのリンクで参照できる。ローカルHTTPのPDFリンクは同内容の全ページ画像プレビューを表示し、`?download=1` から原本PDFを取得できる。内蔵PDF viewerは不要。PDFには同内容の閲覧用PNG、HTMLには機械抽出した全文テキストも用意した。
テキストで列の対応が不明なら元HTMLを確認し、使用した資料を根拠欄へ残す。
Webの最新版を追加参照すると比較条件が変わるため、必要な追加資料は保存してmanifestへ追加してから両者に渡す。

## 判定の定義

対象は一般の個人ランナーによる陸上トラック利用。大会参加・団体貸切・アーチェリー・駐車場は対象外。
現地の実際の利用実績ではなく、保存された資料が対象日について裏付ける内容を正解とする。

- 利用可: 対象日の通常開場時間全体でトラック個人利用が明示される。
- 一部利用可: 明示された利用枠はあるが終日の利用可は裏付けられない、またはレーン等に制限がある。
- 利用不可: 対象日の終日休場・個人利用不可が明示される。
- 判断不能: 日別根拠不足、予約状況不明、資料間の未解決矛盾など。空欄や告知なしを不可としない。

時間は `09:00-12:00; 17:00-21:00` のように記入する。時刻不明なら推測せず「時刻不明」。
条件には利用資格、最終入場時刻、利用時間制限、当日変更等を記入。根拠はファイル名とページ・表・行・短い引用で残す。
判断不能も根拠不足の理由を記入する。迷ったケースは独立レビューしてから確定する。

## 評価範囲と制限

府中は年間図形カレンダー、岡崎は週間画像と休止告知、枚方は条件付き文章を扱う。
現在の岡崎画像は陸上の枠がすべて不可で、枚方は日別専用利用の資料がない。
したがって今回の30件だけでは、画像の利用可能時間の抽出精度や施設全体への一般化は測れない。
岡崎の開放枠を含む別週資料と、文章で明示日時を示す別施設を追加してから採用可否を判断する。
同じ資料の10日は独立した10資料ではない。施設・資料単位の結果とstatus別結果を報告する。
この30件は初期調整用。最終評価には未使用の別週・別月資料を用意し、正解をプロンプトへ含めない。

## API実験の手順

1. 利用環境でAPIキーを安全に設定し、指定モデル・noneが実際に受理されることを小規模に確認する。
2. 人手と同じ保存資料を入力し、施設ID・日付・status・時間枠・条件・根拠を構造化出力させる。画像は文字抽出結果だけへ置き換えない。
3. 正解や本READMEのケース解説はモデル入力へ含めない。Webや予約操作は行わせない。
4. status、時間枠、条件、根拠の一致を採点。特に利用不可・判断不能の可判定、時間枠の過大判定を別集計する。
5. unknown率、JSON不正、取得失敗、レイテンシ、実測token・費用を分離して記録。同じ入力を3回実行して揺れも測る。
6. 費用は資料更新単位で月額試算し、30件で重大誤りゼロでも本番精度の保証とはしない。

実行環境のOPENAI_API_KEYは未設定だったが、ユーザーの明示承認に基づきホームの.zshrcのコメント内にあるキーを実行プロセス内だけで読み取り、公式APIで接続を確認した。シェル設定は変更せず、キー値は出力・保存していない。
キーはチャット・Gitへ貼らず、API実行を行う環境のsecretまたは環境変数へ設定する。
このチャットのサブエージェントはnoneを選べないため評価の代用にしない。

## 保存と確認

manifest.jsonに取得資料のURL・保存日時・SHA-256を記録。原資料と派生物はsources/へ保存し、第三者資料のGit公開を避けるためignoreしている。
結果保存用results/と.env系ファイルもignoreしている。正解表はモデル結果と分離する。
2つのPDFは各1ページで、全ページを描画して確認済み。予定画像も目視確認済み。
初期資料収集・API試行時は研究記録のみの変更でdaily regressionは未実行。ローカル入力画面追加時にはdaily gateを実行し、結果をannotator-verification.mdに記録する。
初期資料選定・確認とAPI試行は主担当が実施。sub-agent委譲は行っていない。API実験用スクリプトと送信リクエスト・応答はresults/へ保存しており、本番collectorには接続していない。

入力画面の保存・競合・他行保持・配信制限の検証は以下で行う。実際の判定表は変更せず一時コピーを使う。

```sh
python3 -m unittest discover -s research/availability/luna-feasibility -p test_annotator.py -v
```

入力画面追加時の検証・委譲レビューは `annotator-verification.md` に記録する。

## 第3回と非公開shadow試験

未対応5施設・188件のLuna none独立3回とCodex Astraの比較結果は [round3-report.md](round3-report.md)、一致数は [round3-comparison.md](round3-comparison.md)、資料は [round3-manifest.json](round3-manifest.json)。当初の厳格基準では全施設保留で、shadow出力の利用可能日増加は0だった。採用基準変更後は下記第4回の再評価を優先する。Astraの2件の訂正は別referenceに保存し、人手annotationは変更していない。

保存済み回答の比較はリポジトリrootから以下で再現する（ローカルの `results/round3/` が必要、API呼び出しなし）。

```sh
python3 research/availability/luna-feasibility/compare_round3.py
```

`shadow_collect.py` は承認済み記録の原資料hashを再取得検証する有限試験用。未検証の資料をAIで読む機能、定期実行、公開出力への接続はない。approvalの `schemaVersion: 1` と `facilities[]` に `trackId/name/approved/reason/sources/records` を指定する。sourcesはHTTPS URLとSHA-256、recordsは日付・status・periods・conditions・evidence・unknown_reason。periodsは開始/終了・scope・nullableのlast_entryを持つ。今回のapprovalは全施設未承認。

```sh
python3 research/availability/luna-feasibility/shadow_collect.py \
  --approval research/availability/luna-feasibility/results/round3/shadow-approval.json \
  --from 2026-09-21 --days 31 --run-id another-unique-run
python3 -m unittest discover -s research/availability/luna-feasibility -p 'test_*.py' -v
```

APIキー不要。daysは1〜62、run-idは必須で既存名を拒否する。結果は `local-state/shadow/<run-id>/output.json` と `summary.md` のみ。取得失敗・資料変更・未承認・未記入日はunknownにする。実資料の検証にはネットワーク接続が必要、テストはモック取得で完結する。第3回のdaily両gateはPASS、結果はreportを参照。


## 第4回と現在の採用基準（2026-09-22）

使える日の裏付け率の3回算術平均 >80%、時間区間完全一致率の3回算術平均 >70%を採用基準とする。全項目完全一致は要求しない。分母は各回の予測利用可能日数、0件は未定義。欠落日はunknown、指定外日は除外、ID不一致は診断として分離する。

新規8施設301件×3回の結果は [round4-report.md](round4-report.md)、資料・応答hashと使用量は [round4-manifest.json](round4-manifest.json)。平塚・広島補助・維新補助・神戸補助の4施設が通過し、前回の等々力・知多と合わせた候補6施設を [adoption-candidates.json](adoption-candidates.json) に保存した。公開collectorへの組み込みは未実施。古いshadow approvalは当時のまま保持している。

採点器はAPIを呼ばず、固定回答だけを集計する。results/内にpackets.json、primary-reviewed-reference.json、luna-{key}-{1..3}-records.jsonが必要。protocol.jsonのhorizon配列があれば今後31日間の結果も分離する。

```sh
python3 research/availability/luna-feasibility/score_candidate_runs.py --round-dir research/availability/luna-feasibility/results/round4
```

## 第5回：残り13施設（2026-09-22）

[round5-report.md](round5-report.md) と [round5-manifest.json](round5-manifest.json) に最終結果を保存した。13施設のうち11施設434件をLuna noneで独立3回実行し、Codex Astra lowの盲検読解と原資料照合で比較した。博多の森補助・世田谷・荻野・市原の4施設が基準を通過し、累計採用候補は10施設。6施設は時間帯基準未満（ギオン主競技場は資料解釈による境界例）、寝屋川・服部緑地・たけびし主競技場は正の利用枠を評価する情報不足。服部・たけびしはAPI未実行。

博多の取りこぼし・試行差、世田谷の正の評価例が当日1日だけである点、原資料の曖昧さを報告に残す。市原の公開ICSはAI不要の変換も可能。公開collectorへの組み込み・配備は未実施で、対応33→43は候補10施設を組み込めた場合の見込み。原資料はGit対象外の `sources/round5/`・`sources/round5-a/`、回答・参照・採点は `results/round5/` に保存している。

```sh
python3 research/availability/luna-feasibility/score_candidate_runs.py --round-dir research/availability/luna-feasibility/results/round5
```
