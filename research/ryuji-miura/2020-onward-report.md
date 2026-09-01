# 三浦龍司選手 2020年以降の試験収集

## 収集結果

2020年1月1日から2026年8月23日までに、World Athleticsの選手ID `14860379` の公開結果として確認できた67レースを `itsrunnew/src/data/ryuji-results.json` に正規化した。大会名、日付、種目、ラウンド、順位、記録、開催地、国、競技会カテゴリ、World Athletics競技会IDを保持している。同日の予選・決勝や複数種目は別レコードとした。

年別の件数は2020年4、2021年12、2022年14、2023年12、2024年9、2025年9、2026年7。3000m障害だけでなく、1500m、3000m、5000m、10000m、クロスカントリー、10マイル、ハーフマラソンを含む。国内の小規模な出走として、順天堂大学競技会、関東インカレ、織田幹雄記念、ホクレン・ディスタンスチャレンジ、日体大長距離競技会、箱根駅伝予選会などを含めた。

## 主な一次情報

- [World Athletics 選手プロフィール（Ryuji Miura、ID 14860379）](https://worldathletics.org/athletes/_/14860379)
- [日本陸上競技連盟 選手プロフィール](https://www.jaaf.or.jp/athletes/profile/ryuji_miura/)
- [READY STEADY TOKYO 2021（日本陸連）](https://www.jaaf.or.jp/gallery/article/14888/)
- [2024年織田幹雄記念（SUBARU公式レポート）](https://www.subaru.co.jp/sports/athletics/race/2024_04_29_164950/)
- [JOC 東京2020選手ページ](https://www.joc.or.jp/games/olympic/tokyo/sports/athletics/team/miuraryuji.html)

競技会IDが得られた行はWorld Athleticsの競技会結果ページへリンクし、IDがない国内結果は選手プロフィールを確認先として表示する。JAAFプロフィールの年間ベスト・主要大会欄と突き合わせ、記録表記と選手同定を確認した。

## 制限と更新方法

World Athleticsに登録されない大学・実業団の記録会、オープン参加、駅伝の区間記録、主催者が結果を公開していないローカルレースは、この一覧だけでは完全に拾えない。今後はJAAF、所属先SUBARU、大会主催者の公式リザルトをシーズンごとに確認し、同じ日付・種目・大会の重複を避けて追記する。SNSや報道のみで確認できる記録は、公式結果で照合できるまで「補足候補」として別管理する。
