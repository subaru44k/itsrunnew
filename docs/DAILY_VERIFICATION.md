# Daily availability 更新の検証

## 2026-09-25 のスモークテスト競合

`7ed92cb` の通常smokeとlive dailyは、未来日・基準地点付きの施設一覧リンクを確認する `scripts/smoke.mjs` のURL待機で失敗した。リンクのhrefを読んでから `.facility-row a`.first() をクリックするまでに日別JSONが反映され、利用不可施設が消えて先頭の施設が変わっていた。診断時、期待したhrefは三郷、実際の遷移先は松戸で、日付・座標queryは保たれていた。`waitForURL` を `waitForFunction` に替えるだけでは期待先の不一致は解消しない。修正後は選択日の有効statusから求める掲載件数と読み込み表示の終了を待ち、同じ一覧状態でhref取得とクリックを行う。全unknown fixtureでは一覧の並びが変わらないため、この競合を検出できなかった。

## 2026-09-18 の障害

Production run [35284711731](https://github.com/subaru44k/itsrunnew/actions/runs/35284711731) と Preview run [35283081159](https://github.com/subaru44k/itsrunnew/actions/runs/35283081159)、revision `bd9fbc9` は、31日分の収集・unit test・buildに成功した後、local smokeで停止した。利用不可の施設を非表示に戻してから戸田市スポーツセンターを選択しており、その日のstatusがunavailableになると対象DOMが存在しなかった。S3への配備はskipされ、生成済みの新しいavailabilityは公開されなかった。

前日のProduction run [35161161499](https://github.com/subaru44k/itsrunnew/actions/runs/35161161499) は公開後の英語smokeで `Tomorrow available` 待機に失敗した。日別statusの有無と都道府県の折りたたみ・ページ送りに依存したassertionも修正対象とした。

## 現行の変更時gate

検証と公開の境界は [VALIDATION_POLICY.md](VALIDATION_POLICY.md)。`Node 24 validation` は独立機能の関連unit/browser、known operationsの関連unit/実CLI/型検査、共通・availability・未知/構造差分の全unit/all features/mixed統合/unknown専用を選択する。Markdownだけではapp検証をしない。PRの通常gateで外部sourceを実収集しない。

当日mixed fixtureで4statusと戸田の当日unavailable/翌日availableを全smokeで確認する。全unknownでは安全な検索・確認案内・近隣候補・日付選択だけを日英PC/スマホで検証する。scheduleの期限・失敗・世代・focus競合は独立suiteで1回。production appを1回buildし、隔離copyのJSONだけを変え、他の全file hashを照合する。同じrevisionのbuildとlintを重複実行しない。

実収集は成功master検証に基づくdata jobで実施し、当日31日・6時間以内・全施設/期限/status・fixture禁止・全partition照合後に配備、公開byteを検証する。monitorは公開generationを読み、再収集/AIなしで実際の公開品質と未更新/破損を監視する。独立pace/記録集の修正を外部source障害で止めない。

collectorや新しい配備境界の調査が必要なときは、配備なしの `npm run test:daily` を使う。これは隔離workspaceでlive collection・鮮度/全施設・build（またはprebuilt app copy）・PC/スマホ統合smokeを行う。keyless AI cache missはunknownであり、AI推論の正常性まで証明しない。通常のfixture/live診断にはChrome、liveや全PDF unitにはPoppler、関連API unitにはAPI依存が必要。LinuxのChromeは `CHROME_PATH=/usr/bin/google-chrome`。SMTP mockは送信しない。

smokeは実データに存在するstatusと件数を検証し、存在しないstatusはcoverage logへ記録する。4statusの表示自体はmixed fixtureで必ず検証する。特定施設のテストでは利用不可表示を有効にし、折りたたみ・ページ送りを展開した後に選択する。

## 修正の公開と完了判定

1. 関連コードを変更したPRでは上記checkの成功を確認する。MarkdownだけのPRでは意図した差分確認のみを行い、関連コードの回帰テストをskipやcontinue-on-errorで隠さない。
2. 成功master push検証のworkflow_runでProductionの公開要否を判定する。Markdownだけならmetadata確認だけでapp/data公開をskipし、日次scheduleはdata-onlyで継続する。Previewは必要時だけmasterから手動実行する。公開の承認範囲を確認し、通常のcontent deployのみを使用する。
3. Productionのdata jobでは収集・鮮度/全partition検証・data prefix配備・公開byte照合、app jobでは成功master artifactとhash/schema/施設ID照合・app prefix配備・公開byte照合・短いrelease smokeの成功を確認する。両方の変更はdata成功後にappを公開する。Preview手動配備は従来の一括収集・build・smoke・公開確認を維持する。summaryで公開済み/部分更新失敗/公開後確認失敗を区別する。
4. 翌日のschedule runでも生成日と公開結果を確認する。再失敗時はrun URL、revision、失敗step、JST対象日を記録する。

このゲートは日付やstatus変化による既知の回帰を防ぎ、変更時点の実収集と表示を確認する。将来の公式サイト変更、GitHub/AWS/ネットワーク障害まで無条件に成功保証するものではない。取得できない情報を利用可能と偽らずunknownにし、収集成功と公開成功を区別して追跡する。

## Delegation review

初期調査では実行log・公開revision・失敗境界を主担当で調査。契約確定後、`scripts/smoke.mjs` の日別status・一覧表示に関する修正をLuna Maxへ委任。主担当は隔離したdaily検証コマンド、fixture、鮮度ゲート、CI、文書と最終検証を担当する。実diffのreviewと検証結果は作業報告に記録する。

主担当のdiff reviewでは、利用不可を再び隠す既存assertionの維持、日付付きの戸田ラベルとの整合、織田の代替候補見出しのstatus依存を修正した。英語一覧の折りたたみ・ページ送りと翌日status検証の仕上げは主担当へ戻した。委任範囲はsmokeに限定し、アプリの表示・collector判定ロジックは変更していない。

## 公開方式変更の運用監視

日次gateの成功と各施設の取得成功は別に扱う。`availability-monitor.yml` は外部Schedulerで09:15 JST、GitHub cron fallbackで10:15 JSTに公開generationを読み、施設別の取得/解析異常・同じ対象日の判定数低下・公開データの未更新・破損も監視する。再収集やAI呼び出しは行わない。異常/復旧メールと前回状態artifactの設定は [AVAILABILITY_MONITORING.md](AVAILABILITY_MONITORING.md) を参照。monitorはdeployのgateにせず、既存のunknown許容を維持する。Gmail送信処理のmock検証 `npm run test:monitor:email` はNode 24 validationにも含める。

## 2026-10-26 公開後メニュー検証の競合

Production run [40252609720](https://github.com/subaru44k/itsrunnew/actions/runs/40252609720)、revision `a0f35b8` は収集・local smoke・配備・公開本文照合に成功後、mobile drawerの「神奈川県の競技場」が画面外になり停止。Appのtoolbarは初回lazy routeより先にmountし、Vuetifyはroute変更時にtemporary drawerを閉じる。smokeはroute view `.track-search-page` が現れた後に開き、active drawer内で通常クリックする。forceクリック・固定sleep・失敗の無視は行わない。

## ブラウザ検証の並列実行

`test:smoke`と`test:pace`はPC・スマホを別processで最大2並列実行する。通信記録・browser stateを分離し、両worker完了前にPreviewや一時workspaceを削除しない。一方でも失敗すれば失敗扱いとする。dailyのmixed/unknownはbuild署名比較を保持して直列実行する。`ITSRUN_BROWSER_WORKERS=1`で直列比較・低リソース環境の診断が可能。
