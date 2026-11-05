# デプロイ・検証の段階的見直し

2026-11-05に合意した改善の引継ぎ資料です。現在の実装の正本は [SITE_STRUCTURE.md](SITE_STRUCTURE.md)、個別PRの完了証拠はそのrevisionのCIとProduction deployです。以下の将来段階を、実装済みの仕様として扱わないでください。

## 現在の状態（最終policyのPR準備時点）

- 第1・2段階：完了。
- 第3・4段階：検証済みartifactとapp/data分離を本番確認済み。app-only再配備でdata skipも確認済み。
- 第5段階：世代別日別/施設bundleを本番確認済み。旧URL互換・7日保持・manifest最後の切替を実装。
- 第6段階：認証・実Scheduler配送・公開monitor反復を確認済み。定時3 schedulesはDISABLED。実Schedulerからdata公開までの一時試験を継続中。
- 最終policy：`codex/deterministic-validation` / `/Users/yamadashinya/work/itsrunnew-modernization`。CIのlive collectionを外して本番data gate/公開監視へ分担し、独立feature/known opsを関連検証へ絞る。mixed統合・unknown専用・原本回帰・未知diffの広いgateを維持する。S3転送をmetadataごとの一括CLIへ変更し、source確認日だけは再収集を省略。Production未指定/all scopeを拒否する。

このPRのmaster反映と旧Production cron削除は、実Scheduler→data公開・確認の成功後に行う。policy移行のローカルmixed/unknownとlive互換検証は成功。新たに任意の施設数上限を削除し、現地レポートAPIの施設ID一致と、外部fetch禁止・同一世代への実monitor CLI 2回の回帰を追加した。最終CI/本番/enableの証拠は完了時に追記する。

## 合意した条件

- 利用者へ提供する価値、外観、日英の公開URLと主要操作を維持する。
- Vueの静的アプリとS3 + CloudFrontを維持し、アプリ・availability・インフラの変更単位を分ける。
- 取得不能・期限切れ・未確認資料はunknownとし、利用可にも利用不可にも捏造しない。原本fixtureと判定guardを残す。
- 新規運用費から廃止・削減分を差し引いた月額増分は、予測で200円以内を目標、500円を上限とする。1ドル未満のOpenAI費用はこの比較から除く。費用の発生しない改善から進める。
- 各段階を小さなPRで検証・公開し、途中でセッションが止まっても、この文書とGitHubの結果から再開できるようにする。
- 通常の当日データ更新完了は09:00 JSTを目標にする（2026-11-05に合意）。当面のProduction scheduleは05:30 / 08:15 JSTを維持し、起動方式の切替で遅延を改善する。

## 第1段階：Previewの必要時利用と型検査重複の解消（完了）

- `deploy-preview.yml` はmasterからの手動実行だけにする。push・日次scheduleを削除し、他branchは収集・secret参照前にjobをskipする。
- 既存のPreview基盤と現地レポートAPIは保持する。通常のProductionリリースにPreview成功を要求しない。
- Node validationと両deployから、build直前の `npm run lint` を外す。buildの `vue-tsc --noEmit` を必須として維持する。`npm run lint` は型だけ確認する開発用コマンドとして残す。
- `Node 24 validation` のcheck名、既存のunit・daily fixtures/live・配備前後smoke、Productionのtriggerと配備先guardを維持する。
- AGENTS.mdの旧scheduleとPreview限定の記述を、現在の静的availability・独立した本番/Preview配備に合わせる。

予測追加費用は0円。Preview自動更新停止によるS3/AI等の減少はあり得るが、GitHub Actionsの標準runner実行は無料で、保持するAPIのsecret保管料も残るため、大きな削減額を計上しない。

必要時の手動Previewは [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md) の手順を使う。

### 2026-11-05の完了証拠

- [PR #143](https://github.com/subaru44k/itsrunnew/pull/143) をmerge。本段階の本番配備revisionは `cdcaa16acbd653f46942e2d329f4d5aaae59984c`。
- ローカルの型検査込みbuild、deployment/deploy-content/validation-scopeの36テスト（1 worker）、変更文書のローカルリンク72件、`git diff --check` が成功。
- [PRのNode validation](https://github.com/subaru44k/itsrunnew/actions/runs/41976821020) で全unit・型検査込みbuild・pace検証・mixed/全unknownのdaily fixtures・実収集dailyまで成功。
- [master以外からの手動Preview](https://github.com/subaru44k/itsrunnew/actions/runs/41977206974) はjob全体がskipされ、収集・配備を開始しないことを確認。
- merge後はNode validationとProductionだけがpushで起動し、Previewの自動runは作成されなかった。
- [Production deploy](https://github.com/subaru44k/itsrunnew/actions/runs/41977698081) の収集・鮮度検証・unit・型検査込みbuild・local smoke・差分配備・公開本文照合・公開smokeが成功。正式URLのmanifestでも2026-11-05〜12-05、生成時刻2026-11-05T06:02:11.443Zを確認。
- 今回のProduction jobは377秒（収集93秒、build10秒、local smoke76秒、配備71秒、公開smoke87秒）。収集・配信・ブラウザの所要時間も変わるため、変更前との差全体を型検査削減の効果とは扱わない。

各段階の再開時は最新masterと直前のProduction/Node validationの結果を確認する。失敗したrunが残っていれば先に原因を解決し、完了済みの同じrevisionの検証を理由なく再実行しない。

## 第2段階：機能ごとのブラウザ検証（完了）

- 既存smokeから記録集と施設予定のシナリオを独立させ、pace / archives / reports / scheduleを個別実行する。
- `test:features` は隔離workspaceで当日mixed fixtureを生成し、1回buildした同じ成果物へ必要なsuiteを実行する。現地レポートはテスト専用の架空APIだけをmockし、実APIへ投稿しない。
- 新しい3選手のView、共通記録集component・registry・大会名・駅伝/地域大会データ、現地レポートを独立機能の判定へ追加する。未知・共有・削除/renameは従来のfull dailyを維持する。
- 施設予定の期限切れ・失敗・品質差・世代切替・フォーカス競合はschedule suiteで1回検証し、mixed/unknown/liveごとの全smokeでは重複実行しない。
- 現地レポートの古い日付入力selectorを現行DOMへ合わせる。

予測追加費用は0円。必須check名とfull dailyの適用境界は維持する。[PR #145](https://github.com/subaru44k/itsrunnew/pull/145) をmergeし、revision `f446dc67140f23b588c8da5f0c6d37ec852af6e6` の [Production](https://github.com/subaru44k/itsrunnew/actions/runs/41981677635) と [master検証](https://github.com/subaru44k/itsrunnew/actions/runs/41981677636) が成功。[PR検証](https://github.com/subaru44k/itsrunnew/actions/runs/41980642123) でも全feature・daily fixtures/liveが成功した。schedule suiteの詳細を閉じた後の競合はDOMの消失を待つことで修正し、固定sleepは追加していない。

## 第5段階の配信基盤（第3・4段階より先に実装・検証中）

配備の担当prefixと世代互換性を先に確立するため、依存関係に従って第5段階の基盤を先行する。1回の収集から日別・施設別31日bundle・世代manifestを生成し、全partitionを公開前に照合する。新アプリの施設予定は1リクエストになり、検索は日別JSONを維持する。旧アプリには従来のURLを残す。immutableファイルを先行配置し、全成功後に公開manifestを最後に送る。旧世代は7日保持し、通常deployでは削除しない。manifestだけCloudFront cacheを無効にし、ドメイン・証明書・DNSは変えない。

このPRでは既存の一括deployとdaily gateを維持する。アプリ/データ配備分離・成果物固定・rollback操作は次段階。公開・インフラ適用・ブラウザ検証の証拠は完了時に追記する。

費用予測（2026-11-05、1 USD=150円の比較用仮定）：1日2回、31日/133施設、追加immutable object約166個/回、7日保持、月10万回のmanifest参照を仮定。追加PUT約10,300回/月、保持データ約0.2GB以下、manifestのS3 GETを見込み、S3のstorage/request単価を保守的に切り上げて月40円以内の増分と予測する。施設詳細の転送量減少は削減額へ計上しない。Scheduler等は未導入で別途合算し、純増200円目標・500円上限を維持する。基準：[S3料金](https://aws.amazon.com/s3/pricing/)、[CloudFront cache policy](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)。実測値ではなく、trafficが仮定を超えれば再計算する。

## 次の変更単位

| 順序 | 変更 | 完了条件 |
|---|---|---|
| 2（完了） | ブラウザ検証を機能ごとに分割し、影響範囲を判定する | 新しい記録集も独立機能として扱う。現地レポートの専用smokeを現行DOMに修復し、関連変更時に実行する。unknown・期限・日付・世代・競合の回帰を固定データで再現する |
| 3 | アプリとavailabilityの配備を分離する | アプリ変更で実収集を待たず、日次データ更新でアプリをbuildしない。書込み/削除の担当prefix、schemaと施設ID互換性、同時更新、個別rollbackを検証する |
| 4 | 検証済み成果物を配備する | 公開対象SHA・成果物hash・必須検証成功を結び付け、配備側で再buildしない。古いjobによる上書きを防ぎ、公開済み/公開確認失敗を区別する |
| 5（基盤を先行中） | データ配信を用途と世代で分ける | ホーム向け日別と詳細向け施設別31日を同じ収集結果から生成。世代付きURLとmanifest切替、旧アプリとの移行、旧世代保持、キャッシュ、rollbackを検証する |
| 6 | 定時起動と監視を整理する | 目標更新時刻を確認し、起動遅延と処理時間を分けて評価。新規方式の認証情報・ログ・無料枠を含む月額純増予測を記録して費用条件を守る |

各段階で構造資料・README・AGENTS.mdの現在形を更新する。既存のdaily gateは、安全な代替検証を実装してその変更自体を検証するまで省略しない。未知pathは広い検証へ倒し、失敗をcontinue-on-errorで隠さない。

## 評価する数値

PR検証時間、master反映から公開確認まで、収集からデータ公開まで、定時起動遅延、再実行率を区別する。変更前の例は2026-11-04のProduction run [41756550053](https://github.com/subaru44k/itsrunnew/actions/runs/41756550053)（job 538秒、収集134秒、unit17秒、lint12秒、build16秒、local smoke108秒、配備94秒、公開smoke118秒）。Preview削除で並行するProductionの時間がそのまま短縮されるとは見積もらない。

運用費の基準は2026年10月のProject=ItsRun付きAWS利用料1.460849 USD（税別）とドメイン年2,055円。タグなし旧環境・共有費用の帰属は未確定であり、AWSアカウント全体をサイトの費用と扱わない。新規基盤の費用予測は具体的な実行回数・時間・保存量と価格確認日を添え、予算を使い切るためのサービス追加は行わない。

## 2026-11-05 再開チェックポイント（配備分離の実装中）

第5段階の基盤は [PR #146](https://github.com/subaru44k/itsrunnew/pull/146) / `a79794126e0832d5d3e9434c15128dcf1b0d4b18` にmerge済み。[PR検証](https://github.com/subaru44k/itsrunnew/actions/runs/41983609215) は全feature・mixed/unknown・実収集dailyまで成功。ローカルのmixed PC/スマホsmokeでも施設bundle 1 requestと日別取得数の上限を確認。Production/Previewのmanifest cache無効化と7日lifecycleは適用済み。Previewに残っていた旧BucketDeploymentの実Lambdaコードでretain-on-delete既定trueを確認してから削除し、contentを保持した。

merge後の [Production](https://github.com/subaru44k/itsrunnew/actions/runs/41985346320) と [master検証](https://github.com/subaru44k/itsrunnew/actions/runs/41985346294) はこの記録時点で実行中。まず結果と公開generationを確認する。

第3・4段階は別worktree `/Users/yamadashinya/work/itsrunnew-modernization` / `codex/split-production-publication` で実装中。CIでproduction設定のappを1回buildし、コピーへfixture JSONだけを差し替えて検証し、元の成果物のSHA/hash/validation run IDを固定する。Productionは成功したmaster push検証を受け、data-only収集/配備とapp-only成果物配備へ分離する。prefix別stateとscopeを使い、相手のファイルを削除しない。app/dataそれぞれのconcurrency groupを使い、無関係なdataやdocsのrunが待機中appを取り消さないようにする。古いSHAでも後続差分がその配備scopeへ影響しない場合は公開可能とし、関係する差分・比較不明は拒否する。

rollbackは7日保持の成功master artifact（app）と、同じJST日・6時間以内でschema/施設IDが一致する既存generation（data）を手動選択する設計。公開済み/部分更新失敗/公開後確認失敗をsummaryで区別する。既存daily fixtures/live gateはこの段階では維持し、CI・本番で新しい経路を検証してから次のPRで重複を削減する。作業途中のコードを現行の運用手順として使わないこと。

配備分離のローカル検証：production設定の1 buildをコピーした4 feature suite（日英PC/スマホ）が成功。scope別deployerの実CLIテストで、旧v1 stateから移行しても相手prefixのupload/deleteがないことを確認。artifact破損・run/SHA違い・PR/fork由来・schema/施設ID不一致を拒否する。新しいrelease smokeは正式サイトの世代 `40e221cbe1bf7e9d8b5b7b51` で日英PC/スマホ、301/404、entry asset、日別/施設bundleを確認済み。第5段階merge後のmaster検証も成功。Production runの最終結果は継続確認する。

費用予測追補：app artifactは7日保持し、日次データだけのrunではapp artifactを増やさない。1日10回・1成果物10MBを仮定すると最大約0.7GB保持で、仮にGitHubのstorage無料分を使い切っていても保守的に月30円程度を見込む（公開repositoryの標準runner計算費は無料）。第5段階と合算で月70円以内の増分予測。実際のrelease回数と圧縮サイズに依存するため、Scheduler導入時に再合算する。[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) を参照。

定時起動の観測：既存monitorの [run 41985579040](https://github.com/subaru44k/itsrunnew/actions/runs/41985579040) はscheduleで作成され、`created_at` と `run_started_at` はともに2026-11-05T07:12:20Z（16:12 JST）。定義の09:30 JSTと約6時間42分離れており、job開始後の処理時間とcron起動自体の遅延を分けて扱う。新しい外部起動方式は実運用の起動遅延改善として検証する。

## 第3・4段階のmergeと第6段階の実装チェックポイント

[PR #147](https://github.com/subaru44k/itsrunnew/pull/147) をmerge。revision `e1603753681d69796e70a2e3bf3987abbc5ac7f5` の [master検証](https://github.com/subaru44k/itsrunnew/actions/runs/41988186100) が進行中。成功後にexact artifactを使う最初のProductionが起動するため、そのplan/data/appの結果を先に確認する。PR検証 [41987233291](https://github.com/subaru44k/itsrunnew/actions/runs/41987233291) は全gate成功。旧方式のpush・配備job内広告設定を文字列で要求する重複テスト2件を、現行のartifact/production-build policy検証へ統合した。安全境界とguardは維持した。

第5段階の [Production 41985346320](https://github.com/subaru44k/itsrunnew/actions/runs/41985346320) は全step成功。公開generation `40e221cbe1bf7e9d8b5b7b51`、source revision `a79794126e0832d5d3e9434c15128dcf1b0d4b18` を確認。隔離ディレクトリでこのgenerationのdata rollbackを実行し、公開manifestと完全一致する再構築を確認した（配備なし）。

現在の作業branchは `codex/scheduled-data-monitoring`、worktreeは `/Users/yamadashinya/work/itsrunnew-modernization`。PR #147の旧head `0376e20924a8ccedbb891ea56de159719b0828ee` に依存して始めたため、作業をcommit後、同じ内容のmerge revisionをbaseにrebaseしてからPRを作る。root worktreeはmasterに同期済み。

第6段階の実装は独立Scheduler/Lambda/App secretと、公開generationを再収集せず読むmonitor。09:00 JST目標、05:30/08:15更新・09:15監視、10:15 GitHub cron fallback、初回DISABLEDを実装中。公開前6時間gateは変更せず、遅延monitorは当日公開済みデータを30時間上限・全record期限で読む。App認証と実Scheduler→GitHub→data公開を確認後にenableし、その後Productionの旧cronを削除する。手順・純増月150円程度の予測は [AVAILABILITY_SCHEDULER.md](AVAILABILITY_SCHEDULER.md)。現在は未配備・未有効化。

ローカルで署名/token scope/拒否・公開content identity・監視履歴・CDKのJST/disabled/権限/timeoutを検証し、型検査込みbuildも成功。公開generationを読むmonitor CLIは再収集/AIなし、状態変化0件で成功。CDK初回synthには約8秒必要で、既存infra検証と同じ20秒のtest timeoutを使う。


## Scheduler実起動で見つかった監視stateの修正

第6段階は [PR #148](https://github.com/subaru44k/itsrunnew/pull/148) / `29b759480be80949faca526d02b1d7bd389d0c78` にmerge。Scheduler stackはDISABLEDで作成し、3 variablesを設定。[configure 41990607040](https://github.com/subaru44k/itsrunnew/actions/runs/41990607040) の既存App認証登録とLambda invoke、そこからの [monitor 41990666744](https://github.com/subaru44k/itsrunnew/actions/runs/41990666744) は成功した。secret値は取得・表示していない。

一時的な実Scheduler scheduleは17:00:17 JSTを指定し、[monitor 41991290972](https://github.com/subaru44k/itsrunnew/actions/runs/41991290972) が17:01:01 JSTに作成された（44秒差、Schedulerの分単位実行内）。AWS IAM/非同期Lambda/dispatch経路を通ったが、同じ公開世代の2回目を旧「毎回新しい収集」前提のstate時刻guardが拒否した。jobを失敗させ、既存の失敗通知経路が動いた。定時3 schedulesはまだDISABLEDのまま。一時scheduleは完了後自動削除済み。

修正は監視時刻と元データ生成時刻の分離。`HealthState.generatedAt`を公開monitorの観測時刻とし、任意の`collectionGeneratedAt`へ収集時刻を保持する。旧stateをそのまま読み、parsed-slot復旧の新しさは収集時刻同士で比較する。同じ世代の再監視、前のgenerationへの明示的rollback、収集より遅い前回観測からの復旧を回帰検証する。修正のPR/CI/実再起動の成功を確認してからscheduleを有効化する。

配備分離の [Production 41989003737](https://github.com/subaru44k/itsrunnew/actions/runs/41989003737) はplan/data/appすべて成功。data 246秒（収集95秒、配備103秒）、app 54秒で再buildなし。 [同じartifactのapp-only実行 41989777672](https://github.com/subaru44k/itsrunnew/actions/runs/41989777672) も成功し、data jobはskip、収集なしを確認した。これは同じ成果物の再配備であり、実機能変更の所要時間比較ではない。


第6段階の修正は [PR #149](https://github.com/subaru44k/itsrunnew/pull/149) / `c542ada433f30c7f9bbb84ff88a0a45aa5542e32` にmerge。 [PR検証 41992107628](https://github.com/subaru44k/itsrunnew/actions/runs/41992107628) と [master検証 41995817234](https://github.com/subaru44k/itsrunnew/actions/runs/41995817234)、[Production 41996746029](https://github.com/subaru44k/itsrunnew/actions/runs/41996746029) は成功した。修正後の [manual dispatch monitor 41995832951](https://github.com/subaru44k/itsrunnew/actions/runs/41995832951)、[実Schedulerからの反復monitor 41996275932](https://github.com/subaru44k/itsrunnew/actions/runs/41996275932) も成功。前の同世代失敗は放置せず解決済み。Schedulerの一時data試験は17:51:49 JST予定 `itsrun-refresh-proof-20261105085149`（完了後自動削除）を作成した。
