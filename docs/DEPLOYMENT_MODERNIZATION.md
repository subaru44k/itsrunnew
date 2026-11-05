# デプロイ・検証の段階的見直し

2026-11-05に合意した改善の引継ぎ資料です。現在の実装の正本は [SITE_STRUCTURE.md](SITE_STRUCTURE.md)、個別PRの完了証拠はそのrevisionのCIとProduction deployです。以下の将来段階を、実装済みの仕様として扱わないでください。

## 合意した条件

- 利用者へ提供する価値、外観、日英の公開URLと主要操作を維持する。
- Vueの静的アプリとS3 + CloudFrontを維持し、アプリ・availability・インフラの変更単位を分ける。
- 取得不能・期限切れ・未確認資料はunknownとし、利用可にも利用不可にも捏造しない。原本fixtureと判定guardを残す。
- 新規運用費から廃止・削減分を差し引いた月額増分は、予測で200円以内を目標、500円を上限とする。1ドル未満のOpenAI費用はこの比較から除く。費用の発生しない改善から進める。
- 各段階を小さなPRで検証・公開し、途中でセッションが止まっても、この文書とGitHubの結果から再開できるようにする。
- 定時起動方式を決める前に更新時刻の目標を確認する。当面のProduction scheduleは05:30 / 08:15 JSTを維持する。

## 第1段階：Previewの必要時利用と型検査重複の解消（本変更）

- `deploy-preview.yml` はmasterからの手動実行だけにする。push・日次scheduleを削除し、他branchは収集・secret参照前にjobをskipする。
- 既存のPreview基盤と現地レポートAPIは保持する。通常のProductionリリースにPreview成功を要求しない。
- Node validationと両deployから、build直前の `npm run lint` を外す。buildの `vue-tsc --noEmit` を必須として維持する。`npm run lint` は型だけ確認する開発用コマンドとして残す。
- `Node 24 validation` のcheck名、既存のunit・daily fixtures/live・配備前後smoke、Productionのtriggerと配備先guardを維持する。
- AGENTS.mdの旧scheduleとPreview限定の記述を、現在の静的availability・独立した本番/Preview配備に合わせる。

予測追加費用は0円。Preview自動更新停止によるS3/AI等の減少はあり得るが、GitHub Actionsの標準runner実行は無料で、保持するAPIのsecret保管料も残るため、大きな削減額を計上しない。

検証はdeployment contract testとbuildをローカルで実施し、workflow変更を含む同じPR revisionの `Node 24 validation` で両daily gateまで確認する。merge後はProduction runの収集・local smoke・配備・公開本文照合・公開smokeと、Previewのpush runが作成されないことを確認する。必要時の手動Previewは [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md) の手順を使う。

再開時は `codex/deploy-policy-step-1` のPRと対象SHAのActionsを確認する。未完了runがあれば先に追跡し、失敗はstepと原因を記録して解決する。merge済みならworktreeを安全にmasterへ同期し、次へ進む。

## 次の変更単位（未実装）

| 順序 | 変更 | 完了条件 |
|---|---|---|
| 2 | ブラウザ検証を機能ごとに分割し、影響範囲を判定する | 新しい記録集も独立機能として扱う。現地レポートの専用smokeを現行DOMに修復し、関連変更時に実行する。unknown・期限・日付・世代・競合の回帰を固定データで再現する |
| 3 | アプリとavailabilityの配備を分離する | アプリ変更で実収集を待たず、日次データ更新でアプリをbuildしない。書込み/削除の担当prefix、schemaと施設ID互換性、同時更新、個別rollbackを検証する |
| 4 | 検証済み成果物を配備する | 公開対象SHA・成果物hash・必須検証成功を結び付け、配備側で再buildしない。古いjobによる上書きを防ぎ、公開済み/公開確認失敗を区別する |
| 5 | データ配信を用途と世代で分ける | ホーム向け日別と詳細向け施設別31日を同じ収集結果から生成。世代付きURLとmanifest切替、旧アプリとの移行、旧世代保持、キャッシュ、rollbackを検証する |
| 6 | 定時起動と監視を整理する | 目標更新時刻を確認し、起動遅延と処理時間を分けて評価。新規方式の認証情報・ログ・無料枠を含む月額純増予測を記録して費用条件を守る |

各段階で構造資料・README・AGENTS.mdの現在形を更新する。既存のdaily gateは、安全な代替検証を実装してその変更自体を検証するまで省略しない。未知pathは広い検証へ倒し、失敗をcontinue-on-errorで隠さない。

## 評価する数値

PR検証時間、master反映から公開確認まで、収集からデータ公開まで、定時起動遅延、再実行率を区別する。変更前の例は2026-11-04のProduction run [41756550053](https://github.com/subaru44k/itsrunnew/actions/runs/41756550053)（job 538秒、収集134秒、unit17秒、lint12秒、build16秒、local smoke108秒、配備94秒、公開smoke118秒）。Preview削除で並行するProductionの時間がそのまま短縮されるとは見積もらない。

運用費の基準は2026年10月のProject=ItsRun付きAWS利用料1.460849 USD（税別）とドメイン年2,055円。タグなし旧環境・共有費用の帰属は未確定であり、AWSアカウント全体をサイトの費用と扱わない。新規基盤の費用予測は具体的な実行回数・時間・保存量と価格確認日を添え、予算を使い切るためのサービス追加は行わない。
