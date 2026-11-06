# 国府台の一般開放案内・検索metadata：2026-11-05

## 公式資料の確認

2026-11-05に[施設案内](https://www.city.ichikawa.lg.jp/page/4184.html)と[月間使用予定表の掲載ページ](https://www.city.ichikawa.lg.jp/page/4185.html)をHTTPS GETし、HTTP 200と本文を確認した。取得本文のSHA-256は順に `a0acca30b1c631e33d06bc60b77ca91981bcd6581c4fc83d623b447ed449bc36`、`d0ba3b9c2ca1e08095f9b9fb6b9986c4d59e7098e3b4f4eb074e0c839b7f5134`。

- 月間予定の「使用時間」以外が一般開放。大会・専用予約の時間を個人利用枠と誤認させない。
- 通常9〜21時、月曜日・祝日の翌日は17時まで。毎月の最終月曜日（祝日の場合は前週の月曜日）と年末年始は閉場。通常の開場時間を当日の一般開放時間として表示しない。
- 当日は体育館1階窓口で使用申請する。
- 天候による閉場、予約取消、急な大会等が予定表に反映されない場合がある。問い合わせ先はスポーツ施設課047-373-3112。

## 反映範囲

[`facility-guidance.json`](../../itsrunnew/src/data/facility-guidance.json)に日英案内、確認日、施設案内へのリンク、固有title/descriptionを追加した。既存のTrackDetail、router、静的HTML shellが同じJSONを使用するため、新しいroute・専用component・日次HTML更新は追加しない。

日本語titleは「国府台陸上競技場の一般開放・個人利用スケジュール - いつラン」。descriptionは日付から利用時間を確認できることを案内する。画面では予定一覧と日付操作を先に表示し、補足は「個人利用の受付は、当日、体育館1階窓口へ。」の1文と料金・利用案内へのリンクに絞る。予定変更の注意と公式予定へのボタンは既存の共通表示を使用し、重複する説明や通常営業時間の長い列挙を加えない。

FacilityScheduleの任意prop `guidanceAfterSchedule` を国府台だけ有効にし、補足を日付操作・選択日詳細の後に置く。他施設の資格・休場などの重要案内は従来どおり。日付別の可否・時間は既存のavailabilityを使い、この案内から利用可能枠を生成しない。

collectorと確認済みPDFの判定、公開generation、施設数、料金値は変更しない。資料hashの更新・予定改訂は引き続き既存のcollector review経路で扱う。

## 検証と公開後の評価

既存のroute shell testが日英本文・リンク・固有metadataの初期HTML出力を確認する。施設予定smokeに国府台を追加し、日英PC/スマホで受付の1文・利用案内リンク・日付操作より後の配置・runtime title・横幅を確認する。共通/施設変更の検証policyに従い全unit、production build、全feature、mixed統合、all-unknownも実行する。

検索表示はGoogleの再クロールと検索語によって変わる。公開後は同じquery・device・近い順位帯でCTRとclickを比較し、title/description変更だけで増加を保証しない。Search Consoleの設定変更やindex登録リクエストは行っていない。
