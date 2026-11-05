# Availability 公開方式の変更監視

## 目的と実行経路

`.github/workflows/availability-monitor.yml` は外部Schedulerから09:15 JST、独立したGitHub cron fallbackから10:15 JST、または手動で起動し、実際に公開されたgenerationの日別31ファイルを読みます。公式sourceの再収集・AI呼び出し・app build・公開ファイル更新は行いません。データ更新の問題を別収集で隠さず、利用者が見ている結果の品質を監視します。外部Schedulerは [AVAILABILITY_SCHEDULER.md](AVAILABILITY_SCHEDULER.md) の手順で、認証と実起動を検証してから有効化します。

`published-range.mjs` が公開manifestとimmutable日別JSONの世代/content identity・当日から31日・全施設・期限・fixture禁止を検査します。監視は当日朝に公開済みのデータを午後の遅延runでも評価できるよう、生成時刻の上限を30時間とします。JST当日開始と各recordの有効期限は必須です。**公開前の6時間以内というgateは変更しません。** 公開データが昨日のまま・壊れている・取得不能なら再収集へfallbackせず、jobを失敗させて既存の失敗通知経路へ進みます。

`health.ts` は状態比較、`monitor.ts` は入力検証・出力、`monitor-github.mjs` は前回成功monitorのartifact復元、`monitor-email.py` は既存Gmail SMTP over TLS通知を担当します。app/plan jobの成功時刻をデータ更新と誤認せず、実際の公開manifestの生成時刻でpipelineを評価します。Node 24、Python 3標準ライブラリ、GitHub CLIを使い、通常monitorにはPoppler・AI key・AWS権限は不要です。

このworkflowはmasterだけで実行でき、concurrencyで直列化する。`contents: read` と `actions: read` のみを付与し、Issue作成・AWS認証・Gitへの自動commitは行わない。

## 検知と通知

- `fetch_failed`、`parse_failed`、`extraction_failed`、`invalid_content_type`、`source_changed`、`source_stale` は明確な異常として、初回から通知する。これらはdata更新で記録された結果を評価します。公式sourceの収集側では一時的な通信障害・408・429・5xxを1回再試行する。Nodeの `UND_ERR_CONNECT_TIMEOUT` だけは同じ公式GET/HEADをcurlで取得する（HTTPS限定・証明書検証有効・20 MB/20秒・redirect 5回）。代替取得も失敗すればunknownを維持する。HTTP errorや証明書error、POSTへ代替取得を適用しない。取得の失敗段階（headers/body/http）、HTTP status、通信error code、再試行の復旧をdata更新のActionsログに残す。公開データだけを読むmonitorの `fetch-diagnostics.json` は空配列です。query・認証情報・応答本文・error messageは含めない。
- 日付をそろえて、以前に判定できた日がunknownへ変わったか比較する。全判定日を失った場合、または3日以上かつ50%以上を失った場合を減少候補とする。別のJST日にも続いた場合に `coverage_drop` として通知する。同じ日に手動実行を繰り返しても確定しない。異常中も以前判定できた日付を保持する。
- `unavailable` も「判定できた」に含める。初回から未対応、電話確認、期間外、予定未公開だけの施設は異常にしない。月替わりで範囲から外れた日や、前回存在しなかった未来日を減少に数えない。
- 原因の組合せ・重要度が変わらない限り、日付・hash・URLの変更だけでは再通知しない。復旧には、影響日のうち以前に判定できていた対象日の既知statusへの回復が必要。以前から要確認・未掲載だった日まで既知になることは要求しない。判定履歴がない場合も影響日の新しい既知statusを要求し、全unknownでは復旧させない。影響日がすべて過去になった場合も新しい既知statusが必要で、エラーが予定未公開に変わっただけでは復旧扱いにしない。掲載削除は「監視対象から削除」とし、復旧と区別する。
- Production deployが有効な場合、公開manifestの生成時刻で `production_update_overdue` を評価する。さらに公開データ自体の当日開始・期限・content identityを直接検査し、未更新・破損・取得不能なら失敗通知する。appだけの成功では更新済みとしない。
- 異常発生・原因変化・復旧・監視対象削除を1通にまとめる。施設名、原因、影響日、最終正常確認、公式source URL、Actions実行URLを含める。変化がない日は送らない。全施設の状態とunknown理由別件数はActions summaryとreport artifactで確認できる。

メールはSMTP受付までを確認する。受信箱への到着・迷惑メール判定は受信側で確認する。メール送信後のartifact保存失敗や、SMTP受付後の通信断では次回に同じ通知が再送される可能性がある（通知欠落を避ける設計）。

## 状態の保持と障害

`availability-monitor-state` artifact（90日保持）の `state.json` に、施設別のstatus、unknown理由別件数、source URL/hash、過去に判定できた範囲内の日付、最終正常確認、保留中・発生中の異常を保存する。公開サイトの入力にはしない。公開monitorではstateの`generatedAt`は監視時刻、任意の`collectionGeneratedAt`は元データ生成時刻で、reportにも両方を表示する。同じ世代の再確認と明示的なdata rollbackでも監視時刻は前進し、同じ異常を重複通知しない。parsed-slotの復旧証拠は元の収集時刻と比較する。

メール送信（または変化なし）が成功してからstateを保存し、次回は成功したmonitor runのstateだけを読む。無効化中の全job skip runは飛ばす。過去runがない初回だけ基準なしで開始する。artifactが期限切れ・欠落・取得失敗・不正な場合は、正常として基準をリセットせずjobを失敗させる。成功runの検索上限は100件で、全件skipなら手動復旧を要求する。

`availability-monitor-report` artifact（30日保持）はメール失敗時もreport・events・fetch-diagnosticsを保持する。履歴取得・公開データ検証・state保存など監視基盤の失敗は、別の失敗メールを試みる。この基盤障害通知は失敗runごとで、施設別の重複抑制とは別扱い。メール送信そのものが失敗した場合は再度同じSMTP送信を試みず、Actionsを失敗にする。`continue-on-error` は使わない。

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
5. 次回runで同じ異常の通知が抑制されること、09:15 JSTの外部起動と10:15 JSTのfallbackが動くことを確認する。停止する場合はvariableをfalseへ戻す。

SMTPは `smtp.gmail.com:465` の証明書検証付きTLS、接続timeoutは30秒。Python標準ライブラリ以外のメール依存は追加しない。[Gmail SMTP仕様](https://developers.google.com/workspace/gmail/imap/imap-smtp)

CLIでSecretsを設定する場合、`gh secret set AVAILABILITY_SMTP_APP_PASSWORD --repo subaru44k/itsrunnew` の対話入力を使う。秘密値をコマンド引数、会話、ファイル、Gitへ書かない。

## ローカル確認

アプリディレクトリで実行する。

```sh
npm run monitor:availability -- --published-url https://itsrun.info
npm run monitor:availability -- --published-url https://itsrun.info --output /tmp/itsrun-monitor-first
npm run monitor:availability -- --published-url https://itsrun.info --previous /tmp/itsrun-monitor-first/state.json --output /tmp/itsrun-monitor-second
npm run test:monitor:email
```

デフォルト出力先はOSの一時ディレクトリ。ローカル実行はメールもGitHub APIも呼ばない。`--published-url` ではその公開URL以外のsourceを取得しない。従来の引数なし実行は手元でのcollector診断用に残し、その場合だけ公式sourceを収集する。AI処理は通常collectorと共通で、`OPENAI_API_KEY` があればcache miss時にAPIを使用する。keyless/cacheなしではAI施設がextraction_failedになるため、ローカルの検知件数をそのまま公開sourceの障害件数と解釈しない。`--input /path/to/availability` で既存のmanifestと31日JSONを読み、再収集せず比較できる。ただし通常のfreshness gateを通る当日・6時間以内の実データが必要で、synthetic公開fixtureは拒否する。前回stateを明示指定した場合、存在しなければ失敗する。`--pipeline /path/to/pipeline.json` は `{ "enabled": true, "lastSuccessAt": null }` の形式の配備証跡を受け取る。`lastSuccessAt` は最終成功のISO時刻文字列、成功履歴がなければnullとする。

実メールの到達テストはActionsの手動実行で `send_test_email=true` を選ぶ。ローカルでは機密値を環境変数へ安全に設定した上で、monitorの出力に対して `python3 scripts/availability/monitor-email.py /path/to/output --test` を実行する。件名・本文に接続テストと明記し、通知すべき状態変化がある場合はその内容も同じメールに含める。

変更時はunit・build・lint・smokeに加えて `npm run test:daily:fixtures` と `npm run test:daily` を必ず実行する。SMTP unit testはmockを使用し、メールを送らない。Node 24 validationでも実行する。

## 残る限界

HTTP成功・既知statusを返したまま起きる凡例の意味変更、別施設の表の誤読、古い資料の読み続けは、この状態比較だけでは網羅しない。source hashは調査証跡で、hash変更自体を異常扱いにしない。施設別の公開予定時刻・月次公開期限や、資料の構造・凡例の追加検証は今後の拡張とし、現段階では日次2回の比較で減少を確定する。公開データを生成するcollectorには既存AI読解も含まれるが、monitor自体は呼び出さない。監視結果による自動修正・新規collector採用・施設予定の自動上書きは行わない。

取得・解析エラーだけのincidentは、日全体がunknownでも、実取得時刻・資料hashと時間付きの既知status枠がある `insufficient_information` を復旧証拠として扱います。未掲載・空のunknown・資料変更は復旧証拠にせず、日単位coverage_dropの復旧条件は緩めません。これにより、練馬の17〜18時の未確認を保持しながらPDF解析の復旧を検知できます。
