# Availabilityの定時起動

通常の当日データ公開完了は09:00 JSTが目標。公式未公開・取得不能はunknownを維持する。GitHub cronの起動遅延と処理時間を分け、EventBridge SchedulerからGitHubの既存の無料標準runnerを起動する。収集の実行場所や判定内容は変えない。

## 構成と認証

独立した `ItsRunSchedulerStack` は次だけを作る。hosting、DNS、証明書、現地レポートAPIは変更しない。

- EventBridge Scheduler：05:30 / 08:15 JSTに `availability-refresh`、09:15 JSTに `availability-monitor`。timezoneはAsia/Tokyo、flexible windowなし。
- 128MB Node 24 Lambda：既存GitHub AppのJWTからItsRun installation tokenを発行し、repository_dispatchを送る。tokenはこのrepositoryのcontents writeだけ。private key・JWT・tokenをログや応答へ出さない。
- Secrets Managerの1 secret：既存 `REVERIFICATION_APP_CLIENT_ID` / `REVERIFICATION_APP_PRIVATE_KEY` のコピー。新しいPATやApp権限追加は不要。
- master限定OIDC setup role：このsecretへのPutSecretValueとこのLambdaのInvokeだけ。Lambdaはこのsecretのread、SchedulerはこのLambdaのinvokeだけ。
- CloudWatch logは7日。VPC/NATなし。Scheduler配送とLambda async retryは最大15分・2回。

起動はat least once。重複はdata scopeのconcurrencyとmonitorの既存state比較で扱い、取得不能を既知へ変えない。GitHub/AWS全体の停止やrunner待ちまで09:00を保証するものではない。monitorには独立したGitHub cron fallbackを残す。

## 初回適用と有効化

アプリディレクトリから、CIとCDK差分を確認してから適用する。初回はDISABLEDで、App secretの値はまだ格納しない。

```sh
npm run infra:scheduler:synth
npm run infra:scheduler:deploy -- --parameters ItsRunSchedulerStack:SchedulerState=DISABLED
```

`scheduler-outputs.json` のSetupRoleArn、SecretArn、FunctionNameから次の公開repository variablesを設定する。**secretの値を取り出す操作は行わない。**

- `ITSRUN_SCHEDULER_CONFIG_ROLE_ARN`
- `ITSRUN_SCHEDULER_SECRET_ARN`
- `ITSRUN_SCHEDULER_FUNCTION_NAME`

masterへ反映後、既存のGitHub App secretsを使う設定workflowを実行する。一時ファイルはmode600、secret値はコマンド引数・ログへ出さず、終了時に削除する。

```sh
gh workflow run configure-scheduler.yml --repo subaru44k/itsrunnew --ref master -f test_event=availability-refresh
```

設定workflowだけでなく、そのLambdaから作られたProductionのrepository_dispatch runがdata-onlyで公開・公開byte確認まで成功したことを確認する。同様に `test_event=availability-monitor` で公開データ監視と既存state復元を確認する。実際のSchedulerからの一時at scheduleでも配送経路を検証し、試験scheduleは完了後に削除する。

検証後に有効化する。

```sh
npm run infra:scheduler:deploy -- --parameters ItsRunSchedulerStack:SchedulerState=ENABLED
```

GitHubのProduction cronを削除するのは実dispatch・公開確認後。切替前後のrun URL、scheduled time・run作成時刻・処理時間、AWS stateを [DEPLOYMENT_MODERNIZATION.md](DEPLOYMENT_MODERNIZATION.md) に記録する。monitorの10:15 JST fallback cronは維持する。翌朝の予定時刻は将来なので、完了していない定時runを成功済みと記録しない。

## 停止・復旧・鍵更新

```sh
npm run infra:scheduler:deploy -- --parameters ItsRunSchedulerStack:SchedulerState=DISABLED
```

停止時も手動のdata更新とmonitorは実行できる。必要なら旧GitHub cronを復元する。App private keyをrotateしたら既存GitHub secretsを更新し、configure workflowを再実行してAWS側も更新する。secretはstack削除時retainのため、サービス廃止時は保持要否を確認して別途削除する。

Lambdaの失敗は該当log group、Schedulerの配送失敗はAWS/Scheduler metrics、実際の公開失敗はProduction workflowと公開manifestで確認する。Lambdaが成功してもGitHub runnerで処理が完了したとは扱わない。GitHub/AWS全体停止やSMTP停止はこの構成だけで即時通知できない。

## 費用予測（2026-11-05）

月31日・1日3回・再試行を含め300 invocation以内、128MB・最大45秒、log 7日、1 secretを仮定する。Secrets Manager $0.40/月を主費用とし、Lambda・Scheduler・secret API・logを無料枠なしでも保守的に丸め、新基盤は月80円以内と予測する（1 USD=150円の比較用仮定）。前段階のS3/manifest配信増分40円とapp artifact増分30円を合わせて月150円程度。1 USD=180円・税10%を仮定しても約200円以内の予測で、合意した500円上限より低い。traffic・app release回数は前段階の仮定に依存する。OpenAIの1ドル未満は比較から除外し、monitor再収集廃止による削減は計上しない。

価格の根拠：[Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/)、[EventBridge Scheduler](https://aws.amazon.com/eventbridge/pricing/)、[Lambda](https://aws.amazon.com/lambda/pricing/)、[GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。実測請求ではなく予測であり、予算を使い切るためにサービスを増やさない。
