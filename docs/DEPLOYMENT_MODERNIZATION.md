# デプロイ・検証の段階的見直し

2026-11-05に合意した改善の引継ぎ資料です。現在の実装の正本は [SITE_STRUCTURE.md](SITE_STRUCTURE.md)、個別PRの完了証拠はそのrevisionのCIとProduction deployです。以下の将来段階を、実装済みの仕様として扱わないでください。

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

再開時は最新masterと [merge後のNode validation](https://github.com/subaru44k/itsrunnew/actions/runs/41977698080) の結果を確認し、未実装の第2段階から進む。失敗したrunが残っていれば先に原因を確認して解決する。完了済みの同じrevisionの検証を理由なく再実行しない。

## 第2段階：機能ごとのブラウザ検証（実装・検証中）

- 既存smokeから記録集と施設予定のシナリオを独立させ、pace / archives / reports / scheduleを個別実行する。
- `test:features` は隔離workspaceで当日mixed fixtureを生成し、1回buildした同じ成果物へ必要なsuiteを実行する。現地レポートはテスト専用の架空APIだけをmockし、実APIへ投稿しない。
- 新しい3選手のView、共通記録集component・registry・大会名・駅伝/地域大会データ、現地レポートを独立機能の判定へ追加する。未知・共有・削除/renameは従来のfull dailyを維持する。
- 施設予定の期限切れ・失敗・品質差・世代切替・フォーカス競合はschedule suiteで1回検証し、mixed/unknown/liveごとの全smokeでは重複実行しない。
- 現地レポートの古い日付入力selectorを現行DOMへ合わせる。

予測追加費用は0円。必須check名とfull dailyの適用境界は維持する。完了証拠はこの段階のPRと本番runを追記する。

## 次の変更単位（未実装）

| 順序 | 変更 | 完了条件 |
|---|---|---|
| 2（上記で実装中） | ブラウザ検証を機能ごとに分割し、影響範囲を判定する | 新しい記録集も独立機能として扱う。現地レポートの専用smokeを現行DOMに修復し、関連変更時に実行する。unknown・期限・日付・世代・競合の回帰を固定データで再現する |
| 3 | アプリとavailabilityの配備を分離する | アプリ変更で実収集を待たず、日次データ更新でアプリをbuildしない。書込み/削除の担当prefix、schemaと施設ID互換性、同時更新、個別rollbackを検証する |
| 4 | 検証済み成果物を配備する | 公開対象SHA・成果物hash・必須検証成功を結び付け、配備側で再buildしない。古いjobによる上書きを防ぎ、公開済み/公開確認失敗を区別する |
| 5 | データ配信を用途と世代で分ける | ホーム向け日別と詳細向け施設別31日を同じ収集結果から生成。世代付きURLとmanifest切替、旧アプリとの移行、旧世代保持、キャッシュ、rollbackを検証する |
| 6 | 定時起動と監視を整理する | 目標更新時刻を確認し、起動遅延と処理時間を分けて評価。新規方式の認証情報・ログ・無料枠を含む月額純増予測を記録して費用条件を守る |

各段階で構造資料・README・AGENTS.mdの現在形を更新する。既存のdaily gateは、安全な代替検証を実装してその変更自体を検証するまで省略しない。未知pathは広い検証へ倒し、失敗をcontinue-on-errorで隠さない。

## 評価する数値

PR検証時間、master反映から公開確認まで、収集からデータ公開まで、定時起動遅延、再実行率を区別する。変更前の例は2026-11-04のProduction run [41756550053](https://github.com/subaru44k/itsrunnew/actions/runs/41756550053)（job 538秒、収集134秒、unit17秒、lint12秒、build16秒、local smoke108秒、配備94秒、公開smoke118秒）。Preview削除で並行するProductionの時間がそのまま短縮されるとは見積もらない。

運用費の基準は2026年10月のProject=ItsRun付きAWS利用料1.460849 USD（税別）とドメイン年2,055円。タグなし旧環境・共有費用の帰属は未確定であり、AWSアカウント全体をサイトの費用と扱わない。新規基盤の費用予測は具体的な実行回数・時間・保存量と価格確認日を添え、予算を使い切るためのサービス追加は行わない。
