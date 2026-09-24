# ローカル入力画面の検証・レビュー

2026-09-21。公開アプリとは独立した研究用フォームを追加。府中は現状の単純読み取りを不採用とし、施設別チューニングを行わず次の施設へ進む判断を記録した。

## 実装と保存範囲

- Python 3標準ライブラリ、HTML/CSS/JavaScriptのみ。外部通信やAI呼び出しはない。
- 最初は岡崎龍北の未完了ケースを表示。資料切替・画像拡大・判定選択・自然言語入力・保存して次へに対応。
- 前のケースから空欄へのコピーはstatusを除外。対象日が連続しないため「前日」とは表記しない。
- annotation.mdの対象行のみを保存し、元の全文をlocal-state/backupsへ退避。複数画面の同一行編集はrevisionで競合検出。
- 保存失敗時は画面の入力を保持し、移動を止める。未保存で閉じる際はブラウザの確認が出る。
- 配信allowlist、Host/Origin検証、JSON型・長さ検証、文字のエスケープ。results・任意ファイル・キーは配信しない。
- 原本の府中10件と他20件の未記入状態を確認。操作テストは隔離コピーで実施した。

## 検証結果

- Python unittest 4件成功: 複数行・特殊文字往復、他行とバックアップ保持、更新競合、不正入力とHTTP配信/書込境界。
- node --check成功。
- Headless Chrome/Playwright: 府中の記入継承、岡崎初期表示、保存・再表示・次へ、保存失敗、別クライアント更新の競合、画像・テキスト表示、外部通信なし、PC/スマホの横幅確認が成功。
- 追加確認: 初期読込失敗時の入力無効化、空欄だけへのコピー、status非コピー、複数行保存を確認。
- PC 1500px/1440px・スマホ390pxのスクリーンショットで表示を確認。
- npm test: 最初は既存CDKテスト1件が20秒timeout（限定再試行でも再現）。処理が落ち着いてから再実行し、22ファイル・124テストすべて成功。timeout設定やテスト内容は変更していない。
- npm run lint成功。
- npm run test:daily:fixtures成功（mixed 4status、all unknownのbuild＋PC/mobile smoke）。
- npm run test:daily成功（実収集・検証・build＋PC/mobile smoke）。生成物は隔離workspaceで、checkoutのavailabilityやdistは更新していない。
- git diff --check成功。

今回の公開アプリbuild/smokeは上記daily gate内で実施。公開サイトのlayout変更がないため旧版とのvisual比較は対象外。

## 委譲レビュー

契約確定後、入力画面3ファイルをLuna（gpt-5.6-luna、max、clean spawn）へ委譲。HTML骨格を受領し、進捗確認後にJS/CSSと統合を主担当へ戻した。
主担当が保存API、JS/CSS、文書、テストを実装し、HTMLの「前日」を「前のケース」へ修正、メモ欄の名前を調整。初期読込エラー時のradio無効化も修正した。
実ファイルをレビューし、保存処理と自動ブラウザ検証の成功を確認して統合。人手原文、Luna判定結果、他タスクの変更は保持した。

## PDF表示の修正（2026-09-21）

元PDFはHTTP 200・application/pdfで取得できたが、内蔵ブラウザで表示できない報告があった。また共通CSPのframe-ancestors noneはiframe表示を拒否していた。PDF閲覧routeを保存済み全ページPNGのHTMLプレビューへ変更し、同一origin内への埋め込みを許可した。元PDFはdownload=1時だけattachmentとして返す。PDF原本と人手記入には変更なし。

PythonのHTTPテストでHTML表示・同一origin CSP・原本bytes一致を確認。Playwrightで直リンクの画像読込、原本ダウンロード、入力画面のPDFタブ内の画像読込に成功。daily fixture/live gateも両方成功（build・desktop/mobile smokeを含む）。ログはlocal-state/verification/pdf-fixtures.log / pdf-live.log。保存資料のmanifest hashもすべて一致。
