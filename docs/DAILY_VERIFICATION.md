# Daily availability 更新の検証

## 2026-09-25 のスモークテスト競合

`7ed92cb` の通常smokeとlive dailyは、未来日・基準地点付きの施設一覧リンクを確認する `scripts/smoke.mjs` のURL待機で失敗した。リンクのhrefを読んでから `.facility-row a`.first() をクリックするまでに日別JSONが反映され、利用不可施設が消えて先頭の施設が変わっていた。診断時、期待したhrefは三郷、実際の遷移先は松戸で、日付・座標queryは保たれていた。`waitForURL` を `waitForFunction` に替えるだけでは期待先の不一致は解消しない。修正後は選択日の有効statusから求める掲載件数と読み込み表示の終了を待ち、同じ一覧状態でhref取得とクリックを行う。全unknown fixtureでは一覧の並びが変わらないため、この競合を検出できなかった。

## 2026-09-18 の障害

Production run [35284711731](https://github.com/subaru44k/itsrunnew/actions/runs/35284711731) と Preview run [35283081159](https://github.com/subaru44k/itsrunnew/actions/runs/35283081159)、revision `bd9fbc9` は、31日分の収集・unit test・buildに成功した後、local smokeで停止した。利用不可の施設を非表示に戻してから戸田市スポーツセンターを選択しており、その日のstatusがunavailableになると対象DOMが存在しなかった。S3への配備はskipされ、生成済みの新しいavailabilityは公開されなかった。

前日のProduction run [35161161499](https://github.com/subaru44k/itsrunnew/actions/runs/35161161499) は公開後の英語smokeで `Tomorrow available` 待機に失敗した。日別statusの有無と都道府県の折りたたみ・ページ送りに依存したassertionも修正対象とした。

## 各変更で実行するゲート

アプリケーションディレクトリ `itsrunnew/` で実行する。Node 24、`npm ci`、`npm run reports:install`、Chrome、Popplerの `pdfinfo` / `pdftoppm` が必要。macOSでは `brew install poppler`、Ubuntu系では `sudo apt-get install poppler-utils` を使う。Linuxでは `CHROME_PATH=/usr/bin/google-chrome` を指定する。

```sh
npm test
npm run lint
npm run build
npm run test:daily:fixtures
npm run test:daily
```

- `test:daily:fixtures`: JST当日から31日間の合成データでbuildとPC/モバイルの全smokeを実行。mixedでは4statusを網羅し、戸田を当日unavailable・翌日availableにする。unknownでは全施設をunknownとし、公式取得不能時の安全な表示とstatus欠落を検証する。
- `test:daily`: 実際の公式sourceから31日分を収集し、鮮度・全施設の完全性・Track Datasetを検証してbuildと全smokeを実行する。AWSへ配備しない。AI 8施設は`.cache/availability-ai`（`ITSRUN_AI_CACHE_DIR`で変更）を一時workspaceの外へ置いてcacheを継続利用できる。keylessでcache missのAI施設はunknownになるため、CIでのdaily成功は外部AI推論のfreshnessを証明しない。
- 両コマンドとも一時ディレクトリへソースをコピーし、インストール済み依存を共有する。live dailyのAI cacheだけは`ITSRUN_AI_CACHE_DIR`で指定したpersistent directoryを参照し、一時workspaceのコピー対象から除外する。checkoutのavailability・distや`.env`には触れない。合成データを公開する経路を設けず、deployの鮮度ゲートでも合成データを拒否する。通常終了・失敗時に一時領域を削除する。
- `Node 24 validation` check内で両コマンドをすべてのmaster向けPRとmaster pushに実行する。CIは`OPENAI_API_KEY`を外部AIへ渡さないため、keyless cache missを含むdaily gateの成功を外部AI推論の検証結果と扱わない。unit/lint/buildだけの成功もdaily互換性の確認と扱わない。

両deploy workflowは収集直後に `validate:availability:fresh` を実行する。JST当日始まりの連続31日、6時間以内の生成時刻、全施設IDの重複・欠落、日付・timezone・期限・statusを検査し、不完全または古い生成物を公開しない。取得不能は従来どおりunknownであり、全4statusの存在を公開条件にしない。

smokeは実データに存在するstatusと件数を検証し、存在しないstatusはcoverage logへ記録する。4statusの表示自体はmixed fixtureで必ず検証する。特定施設のテストでは利用不可表示を有効にし、折りたたみ・ページ送りを展開した後に選択する。

## 修正の公開と完了判定

1. PRで上記checkの成功を確認する。回帰テストをskipやcontinue-on-errorで隠さない。
2. レビュー後のmaster反映でPreview/Production deployが起動する。公開の承認範囲を確認し、通常のcontent deployのみを使用する。
3. 両runでavailability収集・local smoke・S3 deployment・CloudFront smokeの成功を確認する。summaryには収集とlocal smokeの成否も表示する。
4. 翌日のschedule runでも生成日と公開結果を確認する。再失敗時はrun URL、revision、失敗step、JST対象日を記録する。

このゲートは日付やstatus変化による既知の回帰を防ぎ、変更時点の実収集と表示を確認する。将来の公式サイト変更、GitHub/AWS/ネットワーク障害まで無条件に成功保証するものではない。取得できない情報を利用可能と偽らずunknownにし、収集成功と公開成功を区別して追跡する。

## Delegation review

初期調査では実行log・公開revision・失敗境界を主担当で調査。契約確定後、`scripts/smoke.mjs` の日別status・一覧表示に関する修正をLuna Maxへ委任。主担当は隔離したdaily検証コマンド、fixture、鮮度ゲート、CI、文書と最終検証を担当する。実diffのreviewと検証結果は作業報告に記録する。

主担当のdiff reviewでは、利用不可を再び隠す既存assertionの維持、日付付きの戸田ラベルとの整合、織田の代替候補見出しのstatus依存を修正した。英語一覧の折りたたみ・ページ送りと翌日status検証の仕上げは主担当へ戻した。委任範囲はsmokeに限定し、アプリの表示・collector判定ロジックは変更していない。

## 公開方式変更の運用監視

日次gateの成功と各施設の取得成功は別に扱う。`availability-monitor.yml` は毎日09:30 JSTに独立収集し、施設別の取得/解析異常・同じ対象日の判定数低下・Production更新停止を監視する。異常/復旧メールと前回状態artifactの設定は [AVAILABILITY_MONITORING.md](AVAILABILITY_MONITORING.md) を参照。monitorはdeployのgateにせず、既存のunknown許容を維持する。Gmail送信処理のmock検証 `npm run test:monitor:email` はNode 24 validationにも含める。
