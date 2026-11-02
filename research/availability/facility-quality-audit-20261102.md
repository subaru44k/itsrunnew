# 2026-11-02 施設品質点検の反映根拠

点検時の本番・作業開始baseは `4ab0fbc56f027273d2bb46a43db241cd78ce6654`。
公式ページの本文を2026-11-02に再確認し、公開予定の判定範囲は広げず、利用条件・確認方法を補足する。

- 奥戸：[個人利用](https://www2.city.katsushika.lg.jp/tourism/1002753/1030217/1003242.html)の受付20:10、小学生以上・小中学生夜間付き添いと、[10月以降の変更](https://www.city.katsushika.lg.jp/tourism/1002753/1042971.html)の芝生立入制限を案内。新告知はトラック運用に変更なしと明記している。
- 世田谷：[施設案内](https://www.se-sports.or.jp/facility/sougou/)は個人利用の原則区内在住・在勤・在学を明記。[競技場案内](https://www.se-sports.or.jp/facilityinfo/sougou-athletics-stadium/)の料金は平日一般9〜12・12〜15時各450円、15〜17・17〜19・19〜21時各300円。対象資格と受付・公式料金表を案内。当日告知23113は点検時404で、公開中の11/2 17〜19時の原文は再照合できなかった。この値を新しい固定予定にせず、既存today-onlyとunknown境界を維持する。
- 上柚木：[公式施設ページ](https://kamiyugi-park.jp/facility/athletics-stadium/)と10/23 PDFの原本hashは既存 `itsrunnew/scripts/availability/fixtures/kamiyugi-20261102-provenance.md` を参照。2026/11/2〜2027/2/28（予定）の公認更新工事を案内し、再開日は保証しない。公式予定actionは施設ページへ改善。
- 済美山：[11・12月告知](https://www.tokyo-park.or.jp/park/wadabori/news/2026/wada_sch_11_12.html)と11月月表を照合。日別貸切・整備・一般開放の区分は一致するが、月表の午後13〜17時と本文の冬季フィールド16時・トラック19時で差がある。表示外時間を開放へ拡張せず、利用範囲と時間差を要問い合わせとして表示。整備・終日貸切日は月表凡例に従い12〜13時も不可。一般開放は無料、空欄はトラックのみ、用具なしの陸上練習という条件を案内。
- 新座：[市の案内](https://www.city.niiza.lg.jp/site/sieiundousisetu/index.html)は専用利用がない場合の共用利用、予約・登録不要、8:30〜12・13〜18時（10〜3月17時）、利用前後の管理事務所、当日状態確認を明記。[予約システム](https://k5.p-kashikan.jp/niiza-city/index.php)へ確認手順付きで案内。空き枠を利用可へ自動変換しない。
- 大泉：[施設案内](https://www.tokyo-park.or.jp/park/oizumi-chuo/facility/)の定期公開日・貸切なしの無料開放・陸上競技のみを案内。時刻不明・定期公開日以外のunknownを保持。

案内JSONは静的な説明であり、当日availabilityやリアルタイム確認の代替ではない。公式資料が変わったときは日別collectorと静的案内を別々に照合する。検索順位・実検索語・実際の検索snippetは未確認で、metadata変更によるCTR改善は保証しない。
