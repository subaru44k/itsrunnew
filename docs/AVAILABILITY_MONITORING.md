# Availability 公開方式の変更監視

## 目的と実行経路

`.github/workflows/availability-monitor.yml` は毎日07:15 JSTと手動実行で、公式sourceの31日分をメモリ内へ収集する。Production/Previewの配備とは独立し、`src/data/availability`、公開ファイル、AWS、domainを変更しない。Productionが停止していても監視を実行できるよう、deploy生成物の再利用ではなく独立収集とする。同一run内のsource cacheは通常collectorと共通。通常build/devは従来どおり外部通信しない。

`monitor-fetch.ts` は監視だけで用いる再試行wrapper、`health.ts` は状態比較、`monitor.ts` は収集・検証・出力、`monitor-github.mjs` は前回成功runのartifactとProduction最終成功時刻の取得、`monitor-email.py` はGmailのSMTP over TLSによる通知を担当する。Node 24、Python 3標準ライブラリ、GitHub CLI（ActionsのUbuntu runnerに付属）を使う。SMTP認証情報をcollectorへ渡さない。

このworkflowはmasterだけで実行でき、concurrencyで直列化する。`contents: read` と `actions: read` のみを付与し、Issue作成・AWS認証・Gitへの自動commitは行わない。

## 検知と通知

- `fetch_failed`、`parse_failed`、`extraction_failed`、`invalid_content_type`、`source_changed`、`source_stale` は明確な異常として、初回から通知する。監視のHTTP取得では一時的な通信障害・408・429・5xxを1回再試行する。
- 日付をそろえて、以前に判定できた日がunknownへ変わったか比較する。全判定日を失った場合、または3日以上かつ50%以上を失った場合を減少候補とする。別のJST日にも続いた場合に `coverage_drop` として通知する。同じ日に手動実行を繰り返しても確定しない。異常中も以前判定できた日付を保持する。
- `unavailable` も「判定できた」に含める。初回から未対応、電話確認、期間外、予定未公開だけの施設は異常にしない。月替わりで範囲から外れた日や、前回存在しなかった未来日を減少に数えない。
- 原因の組合せ・重要度が変わらない限り、日付・hash・URLの変更だけでは再通知しない。復旧には影響日の既知statusへの回復が必要。影響日がすべて過去になった場合も新しい既知statusが必要で、エラーが予定未公開に変わっただけでは復旧扱いにしない。掲載削除は「監視対象から削除」とし、復旧と区別する。
- Production deployが有効な場合、直近のmasterの成功runが30時間以上前、または見つからない場合は `production_update_overdue` を通知する。配備失敗・起動漏れを間接的に捉える。成功runの時刻による監視であり、公開HTMLや公開データの直接検査ではない。
- 異常発生・原因変化・復旧・監視対象削除を1通にまとめる。施設名、原因、影響日、最終正常確認、公式source URL、Actions実行URLを含める。変化がない日は送らない。全施設の状態とunknown理由別件数はActions summaryとreport artifactで確認できる。

メールはSMTP受付までを確認する。受信箱への到着・迷惑メール判定は受信側で確認する。メール送信後のartifact保存失敗や、SMTP受付後の通信断では次回に同じ通知が再送される可能性がある（通知欠落を避ける設計）。

## 状態の保持と障害

`availability-monitor-state` artifact（90日保持）の `state.json` に、施設別のstatus、unknown理由別件数、source URL/hash、過去に判定できた範囲内の日付、最終正常確認、保留中・発生中の異常を保存する。公開サイトの入力にはしない。

メール送信（または変化なし）が成功してからstateを保存し、次回は成功したmonitor runのstateだけを読む。無効化中の全job skip runは飛ばす。過去runがない初回だけ基準なしで開始する。artifactが期限切れ・欠落・取得失敗・不正な場合は、正常として基準をリセットせずjobを失敗させる。成功runの検索上限は100件で、全件skipなら手動復旧を要求する。

`availability-monitor-report` artifact（30日保持）はメール失敗時もreportとeventsを保持する。履歴取得・collector実行・state保存など監視基盤の失敗は、別の失敗メールを試みる。この基盤障害通知は失敗runごとで、施設別の重複抑制とは別扱い。メール送信そのものが失敗した場合は再度同じSMTP送信を試みず、Actionsを失敗にする。`continue-on-error` は使わない。

GitHub Actions全体の停止、監視workflow自体の未起動、Gmailの停止は、このworkflow自身からメール通知できない。Actionsの失敗通知も受け取れる設定にし、厳密な未起動検知が必要になったら別基盤のheartbeat監視を追加する。

## Gmail設定と有効化

初期状態ではRepository variable `AVAILABILITY_MONITOR_ENABLED` が `true` でなければ実行しない。

1. 送信元Googleアカウントで2段階認証と専用のアプリパスワードを準備する。通常のログインパスワードを使用しない。組織設定やアカウント条件によってアプリパスワードを使用できない場合がある。[Google公式手順](https://support.google.com/accounts/answer/185833?hl=ja)
2. Repository Actions Secretsへ次を設定する。メールアドレスもコードに埋め込まない。
   - `AVAILABILITY_SMTP_USER`: 送信元Gmailアドレス
   - `AVAILABILITY_SMTP_APP_PASSWORD`: 専用アプリパスワード
   - `AVAILABILITY_ALERT_TO`: 宛先1件（送信元と同一でもよい）
3. 変更をmasterに反映した後、variable `AVAILABILITY_MONITOR_ENABLED=true` を設定して `Availability monitor` を `send_test_email=true` で手動実行する。
4. 初回のreport/state artifactを確認する。正常施設は基準を作り、明確な取得・解析異常は初回から通知する。宛先の受信を確認する。`send_test_email=true` を選んだ手動実行では状態変化がなくても接続テストメールを送る。通常の日次実行では送らない。
5. 次回runで同じ異常の通知が抑制されること、07:15 JSTのschedule runが動くことを確認する。停止する場合はvariableをfalseへ戻す。

SMTPは `smtp.gmail.com:465` の証明書検証付きTLS、接続timeoutは30秒。Python標準ライブラリ以外のメール依存は追加しない。[Gmail SMTP仕様](https://developers.google.com/workspace/gmail/imap/imap-smtp)

CLIでSecretsを設定する場合、`gh secret set AVAILABILITY_SMTP_APP_PASSWORD --repo subaru44k/itsrunnew` の対話入力を使う。秘密値をコマンド引数、会話、ファイル、Gitへ書かない。

## ローカル確認

アプリディレクトリで実行する。

```sh
npm run monitor:availability
npm run monitor:availability -- --output /tmp/itsrun-monitor-first
npm run monitor:availability -- --previous /tmp/itsrun-monitor-first/state.json --output /tmp/itsrun-monitor-second
npm run test:monitor:email
```

デフォルト出力先はOSの一時ディレクトリ。ローカル実行はメールもGitHub APIも呼ばない。`--input /path/to/availability` で既存のmanifestと31日JSONを読み、再収集せず比較できる。ただし通常のfreshness gateを通る当日・6時間以内の実データが必要で、synthetic公開fixtureは拒否する。前回stateを明示指定した場合、存在しなければ失敗する。`--pipeline /path/to/pipeline.json` は `{ "enabled": true, "lastSuccessAt": null }` の形式の配備証跡を受け取る。`lastSuccessAt` は最終成功のISO時刻文字列、成功履歴がなければnullとする。

実メールの到達テストはActionsの手動実行で `send_test_email=true` を選ぶ。ローカルでは機密値を環境変数へ安全に設定した上で、monitorの出力に対して `python3 scripts/availability/monitor-email.py /path/to/output --test` を実行する。件名・本文に接続テストと明記し、通知すべき状態変化がある場合はその内容も同じメールに含める。

変更時はunit・build・lint・smokeに加えて `npm run test:daily:fixtures` と `npm run test:daily` を必ず実行する。SMTP unit testはmockを使用し、メールを送らない。Node 24 validationでも実行する。

## 残る限界

HTTP成功・既知statusを返したまま起きる凡例の意味変更、別施設の表の誤読、古い資料の読み続けは、この状態比較だけでは網羅しない。source hashは調査証跡で、hash変更自体を異常扱いにしない。施設別の公開予定時刻・月次公開期限や、資料の構造・凡例の追加検証は今後の拡張とし、現段階では日次2回の比較で減少を確定する。AIによる自動修正・新規collector採用・施設予定の自動上書きは行わない。
