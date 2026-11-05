# 検証と公開のpolicy

公開価値・外観・日英URL・unknownの安全性を維持し、変更していない機能の全ケースと、外部サイトの現況に左右されるPR検証を繰り返さない。必須check名は `Node 24 validation` のまま。未知・共有・削除/rename・比較不明は広い検証へ倒し、失敗をcontinue-on-errorで隠さない。

## 検証の選択

| 変更 | Unit / 型 | ブラウザ | 通常の公開 |
|---|---|---|---|
| Markdownだけ | diff/リンク/whitespace | なし | なし |
| allowlist内のpace | marathon unit、production build内の型検査 | paceの日英PC/スマホ | app artifactのみ |
| allowlist内の記録集 | registry/大会名unit、型検査込みbuild | archivesの日英PC/スマホ | app artifactのみ |
| allowlist内の現地レポート | frontend service / backend core unit、型検査込みbuild | reportsの日英PC/スマホ・通信mock | frontendはappのみ。backendだけは既存の独立API配備手順 |
| 既知のmonitor/schedulerだけ | 関連unit・実CLI反復・SMTP mock、型検査だけ | なし | site content配備なし。Scheduler基盤/設定は別手順 |
| availability / 施設 / 共通UI / tooling / 未知・構造差分 | 全unit・必要なPython mock・型検査込みproduction build | 全feature + mixed統合 + unknown専用 | 所有prefixに応じapp/data。未知は両方 |

独立機能の混在は対象unitとbrowser suiteの和集合。operationsと共有変更が混在した場合は広い検証へ戻す。`validation-scope.mjs`、`validation-unit.mjs`、`release-scope.mjs` が実装上の正本。検証範囲と公開要否を混同しない。source確認日だけの単独tracks変更は意味差分を検査し、dataの再収集を省略する。IDs・status・属性・順序なども変わる場合や比較不能なら通常のdata gateへ戻す。

## 固定データで確認すること

production設定で1回buildし、同じappの隔離copyへ当日31日JSONだけを差し替える。availability以外の全file hashが元artifactと一致することを確認する。コピーは公開しない。

- mixed：4status、戸田の当日利用不可/翌日利用可、検索・filter・地図・未来日・リンク/正規URL・施設詳細/近隣候補をPC/スマホで統合検証する。
- unknown：全施設が要確認のまま検索でき、利用不可/利用可を捏造せず、予定なしの確認案内・近隣候補・末尾日への選択を日英PC/スマホで検証する。無関係なpace/記録集の全ルートは再実行しない。
- schedule：期限切れ、失敗、旧manifest互換、世代切替、日付/focus競合を固定通信で1回検証する。mixed/unknown/liveの各回に同じmockを繰り返さない。
- collector：レビュー済み公式原本とURL/hash・月/年・凡例・時間・資料変更guardの回帰を残す。未知資料はunknown。件数の恣意的な上限は設けない。
- monitor：ローカルHTTPの同一generationに実CLIを2回実行し、外部fetchを禁止して、再収集・通知差分の重複がないことを確認する。

## 実収集と公開確認の担当

PR CIからlive collectionを外す。実収集は検証済みmasterを使うProduction data jobが担当し、当日開始・連続31日・6時間以内・全施設ID/期限/status・fixture禁止・全partitionの一致を公開前に検証する。配備後は公開本文を全byte照合する。公開された結果は別monitorがgeneration hash/当日/全施設/期限と施設別の品質を確認する。外部sourceの変更・停止を、PRの別機能のテスト失敗と混同しない。

appは同じ成功master CIのSHA/run ID/全file hash付きartifactだけを復元し、公開データとのschema/施設ID互換性を検査する。再build・再unit・再収集はしない。公開後は本文照合と短いrelease smokeでroute/asset/日英PC・スマホ起動を確認する。

site contentを更新しないmonitor/scheduler/backend API/test/docsだけの変更は、公開可能なsite artifactやdaily dataの配備を増やさない。backend APIの公開は [FIELD_REPORTS.md](FIELD_REPORTS.md)、Schedulerは [AVAILABILITY_SCHEDULER.md](AVAILABILITY_SCHEDULER.md)。

## ローカル確認

同じPR revisionの成功CIが必要なgateを満たせば、理由なくローカルで反復しない。必要な場合はアプリディレクトリで行う。

```sh
# 独立pace変更の例
ITSRUN_FULL_VALIDATION=false ITSRUN_TEST_SUITES=pace npm run test:affected
ITSRUN_TEST_SUITES=pace npm run test:features

# 共通/未知変更の再現可能な検証
npm test
npm run build
ITSRUN_PREBUILT_DIST="$PWD/dist" npm run test:features
ITSRUN_PREBUILT_DIST="$PWD/dist" npm run test:daily:fixtures

# collectorや新しい配備境界の調査が必要なときだけ、配備なしのlive診断
ITSRUN_PREBUILT_DIST="$PWD/dist" npm run test:daily
```

`npm run lint` は型だけを見るときに使い、同じrevisionでbuildもするなら重複させない。ops-onlyではbuildせず型検査する。Chromeはbrowser検証に、PopplerとAPI test依存は対象unit/collector検証に必要な場合だけ用意する。layout/style変更では既存baselineがある場合のvisual検証も選ぶ。

## 変更したテストの理由

旧deploy jobにpush triggerや広告build設定があることを要求した重複文字列テストは、artifact方式とCI側production buildのpolicy検証へ統合した。単純な施設数30〜150という境界は削除し、非空・重複なし・出典・歴史的施設の保持で品質を確認する。現地レポートの施設ID allowlistがTrack Datasetと一致する回帰を追加した。S3配備は実CLI mockで、前state移行後も相手prefixを更新/削除しないこと、失敗時に公開manifestを切り替えないことを確認する。
