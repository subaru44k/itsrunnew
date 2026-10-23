# 2026-10-23 availability source incident

監視run [39904494850](https://github.com/subaru44k/itsrunnew/actions/runs/39904494850)、revision `e674f82`。同日再取得で以下を確認。これは公式サイトの公開状況であり、施設の休場を意味しない。

| 施設 | 通知時の証拠 | 再取得時の証拠・対応 |
|---|---|---|
| 東京体育館 | coverage_drop | https://www.tef.or.jp/tmg/opening.html はHTTP 200で「緊急メンテナンスのご案内」。予定の公開範囲外ではなくfetch_failedとしてunknownを維持 |
| 駒沢 | coverage_drop | https://www.tef.or.jp/kopgp/opening.html も同じメンテナンス本文。東京体育館の取得本文を共通fixtureとして保存 |
| 万博 | arena landingが503×2 | https://www.expo70-park.jp/sports/facility/arena/ はHTTP 200へ回復し、10・11月PDFリンクを再確認。既存parserで実収集を確認する |
| 東寺ハウジングフィールド | WordPress APIが403 | https://www.kyoto-sports.or.jp/category/cat_topics/ も403。利用不可へ変換せずunknownを保持。アクセス制限の回避や古い予定の再公開は行わない |
| 維新補助 | landingが503×2、旧分類extraction_failed | https://www.ishin100.com/main/ はHTTP 200の maintenance.htmlへredirectし「ただいまメンテナンス中です」。公式サイトはPHPの脆弱性に対応する停止と説明。HTML原本をfixtureとして保存 |

HTTP 200の全面メンテナンス画面はtitle/h1の明示文言で識別し、通常予定内の設備メンテナンスとは区別する。AIの公式資料取得段階のHTTP・ネットワーク・メンテナンスエラーはfetch_failed、取得後の読取失敗はextraction_failedとして区別する。停止画面はAI入力やcacheへ入れず、利用可能・不可を推測しない。

保存した維新HTML fixtureは末尾空白のみ除去し、見出し・本文・リンクは保持しています。
