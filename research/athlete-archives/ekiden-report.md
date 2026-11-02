# 3選手の駅伝記録調査

確認日：2026-11-01。初回調査では公式結果から45出走を補足。2026年11月2日の[地域大会補足](regional-report.md)でさらに9件を加え、現在は54件。トラック等の91件とは別の `itsrunnew/src/data/ekiden-results.json` へ保存し、registryで統合する。

| 選手 | 駅伝件数 | トラック等を含む総数 |
|---|---:|---:|
| 本田桜二郎 | 14 | 46 |
| 増子陽太 | 15 | 36 |
| 新妻遼己 | 16 | 54 |

## 調査範囲と一次資料

- 全国高校駅伝：2023〜2025年の主催者の[歴代記録](https://koukouekiden-record.mainichi.jp/record/archive/m_76/all_record.html)を確認。区間順位は括弧の外、通過順位は括弧の中であり、混同しない。2023年の西脇工は全国大会の結果行に出走なし。
- 全国都道府県対抗男子駅伝：[公式選手別アーカイブ](https://www.hiroshima-ekiden.com/archive/)で3選手の全掲載出走を確認（本田1回、増子4回、新妻3回）。中学生時代の2023年を含む。
- 2026年の[出雲公式区間結果](https://www.izumo-ekiden.jp/record/)と[全日本大学公式結果](https://daigaku-ekiden.com/files/2026_result.pdf)。増子の全日本2区30:51は楠岡由浩選手と同タイムの区間1位で、同順位を保持。通過タイム58:38を個人の区間記録として使わない。
- [伊那公式の過去記録](https://www.ina-ekiden.jp/history/)で2024・2025年の3選手、2026年の出走なしを確認。2025年の増子は4区9.1km、30:53、区間75位。チーム通過46位・最終33位を区間順位に使わない。
- 兵庫県高校予選2023〜2025年と近畿高校2023〜2025年。兵庫高体連の結果と2025年近畿主催者のGoogle Drive公開原本を使用。2024年近畿PDFの表紙に「兵庫県」とある箇所は誤記で、大会コード・本文・日程・主催者・各府県の出場校から近畿大会であることを照合。県予選と別大会。
- 福島県高校予選2023〜2025年、福岡県予選2023・2024年、鳥取県予選2025年、全九州2024年、中国2025年。
- 全国中学校2022年の新妻、西日本中学2022年の本田。
- ふくしま駅伝2023・2024年の増子。自治体が公開した全記録の区間順位を確認し、町の部の順位を全体の区間順位として扱わない。

全ての採用行の出典URL、取得原本のSHA-256、照合した日付・区間・距離・記録・区間順位を [ekiden-source-evidence.json](ekiden-source-evidence.json) に保持する。各結果行から該当する公式結果へリンクし、長いPDFは確認ページへ案内する場合がある。原本PDFはローカル一時資料として照合し、サイトへ複製・公開しない。

## 掲載の判断

`ekiden.rank` は公式結果の区間順位、`mark` は区間の実測記録。区間と距離は別フィールドとし、大会・年度・コース間で距離を外挿しない。所属は出走当時の学校／都道府県／市町村を保持し、本田の大牟田→鳥取城北→早稲田、増子の鏡石町・福島県・学法石川、新妻の平岡中・兵庫県・西脇工を区別する。チームの総合順位・通過順位は個人順位へ変換しない。公式の区間新・同順位を表示し、他サイトだけにある新記録の主張は付けない。

補欠・エントリーだけでは出走行を作らず、出走を確認した行だけを採用する。確認できない大会や未公開の地方大会・中学地区大会は未収録の可能性があり、全出走の完全性は保証しない。ふくしま駅伝2025年は事前紹介で増子が2区だったが、[共催TUFの公式個人結果](https://newsdig.tbs.co.jp/articles/-/2291472?page=2)では鏡石町2区は村上正義選手（27位26:26）となっているため、事前エントリーだけで増子の出走を追加しない。未確認の日本海駅伝・一部地区大会は今回の45件に含まない。出走・区間順位・区間記録を同時に確認できる一次資料が得られたら追記する。東北2025年候補として見つかった `iwa-m/.../M-ALL.pdf` は実際には千葉県大会だったため不採用。

## 採用した結果

| 選手 | 日付 | 大会 | 所属 | 区間・距離 | 区間記録 | 区間順位 |
|---|---|---|---|---|---|---|
| 本田桜二郎 | 2026-11-01 | [第58回全日本大学駅伝対校選手権大会](https://daigaku-ekiden.com/files/2026_result.pdf#page=3) | 早稲田大学 | 1区・9.5km | 27:47 | 2位 |
| 本田桜二郎 | 2026-10-12 | [第38回出雲全日本大学選抜駅伝競走](https://www.izumo-ekiden.jp/assets/pdf/2b.pdf#page=1) | 早稲田大学 | 2区・5.8km | 15:42 | 1位 |
| 本田桜二郎 | 2026-01-18 | [第31回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/5279/) | 鳥取県 | 1区・7.0km | 20:11 | 19位 |
| 本田桜二郎 | 2025-12-21 | [第76回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_76/all_record.html) | 鳥取城北 | 1区・10km | 28:52 | 3位 |
| 本田桜二郎 | 2025-11-16 | [第67回中国高等学校駅伝競走大会](https://hiroshimatf.org/bkjmi4ujj4/wp-content/uploads/2025/11/リザルト-1.pdf) | 鳥取城北 | 1区・10km | 28:57 | 1位 |
| 本田桜二郎 | 2025-11-01 | [第76回全国高等学校男子駅伝競走大会鳥取県予選会](https://jaaf-tottori.com/cms/wp-content/uploads/2025/11/20251101koukoekiden_tottori_results.pdf) | 鳥取城北 | 3区・8.1075km | 23:28 | 1位 |
| 本田桜二郎 | 2025-03-23 | [第48回春の高校伊那駅伝](https://www.ina-ekiden.jp/wpnew/wp-content/uploads/2025/03/2025danshi.pdf) | 大牟田 | 2区・7.52km | 23:18 | 7位 |
| 本田桜二郎 | 2024-12-22 | [第75回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_75/all_record.html) | 大牟田 | 1区・10km | 29:12 | 2位 |
| 本田桜二郎 | 2024-11-16 | [第77回全九州高等学校駅伝競走大会](https://koukou-rikujou.info/data/2024/2024_ekiden_kyuushuu_result.pdf) | 大牟田 | 1区・10km | 29:50 | 1位 |
| 本田桜二郎 | 2024-11-03 | [第75回全国高等学校男子駅伝競走大会福岡県予選大会](https://www.fukuoka-koutairen.com/result/2024/r_01/ken/2024ekiden_ken_result.pdf) | 大牟田 | 7区・5km | 15:08 | 1位 |
| 本田桜二郎 | 2024-03-24 | [第47回春の高校伊那駅伝](https://www.ina-ekiden.jp/wpnew/wp-content/uploads/2024/03/2024danshi.pdf) | 大牟田 | 5区・5.1km | 15:14 | 6位 |
| 本田桜二郎 | 2023-12-24 | [第74回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_74/all_record.html) | 大牟田 | 2区・3km | 8:30 | 10位 |
| 本田桜二郎 | 2023-11-04 | [第74回全国高等学校男子駅伝競走大会福岡県予選大会](https://www.fukuoka-koutairen.com/result/2023/r_01/ken/2023ekiden_ken_result.pdf) | 大牟田 | 7区・5km | 15:15 | 1位 |
| 本田桜二郎 | 2022-12-11 | [第18回西日本中学駅伝](https://www.fukuriku.com/cms/wp-content/uploads/2022/10/2022.12.11NishiEkidenR.pdf) | 宅峰中学校 | 1区・3.9km | 11:53 | 1位 |
| 増子陽太 | 2026-11-01 | [第58回全日本大学駅伝対校選手権大会](https://daigaku-ekiden.com/files/2026_result.pdf#page=4) | 早稲田大学 | 2区・11.1km | 30:51 | 1位（同順位） |
| 増子陽太 | 2026-01-18 | [第31回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4674/) | 福島県 | 1区・7.0km | 19:08 | 2位 |
| 増子陽太 | 2025-12-21 | [第76回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_76/all_record.html) | 学法石川 | 1区・10km | 28:20 | 1位 |
| 増子陽太 | 2025-10-23 | [第70回福島県高等学校駅伝競走大会](https://gold.jaic.org/fukushima/kekka/2025/1023/rel001.html) | 学法石川 | 1区・10km | 28:20 | 1位 |
| 増子陽太 | 2025-03-23 | [第48回春の高校伊那駅伝](https://www.ina-ekiden.jp/wpnew/wp-content/uploads/2025/03/2025danshi.pdf) | 学法石川 | 4区・9.1km | 30:53 | 75位 |
| 増子陽太 | 2025-01-19 | [第30回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4674/) | 福島県 | 1区・7.0km | 19:47 | 3位 |
| 増子陽太 | 2024-12-22 | [第75回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_75/all_record.html) | 学法石川 | 3区・8.1075km | 24:13 | 4位 |
| 増子陽太 | 2024-11-17 | [第36回市町村対抗福島県縦断駅伝競走大会（ふくしま駅伝）](https://www.city.motomiya.lg.jp/uploaded/attachment/25630.pdf) | 鏡石町 | 2区・8.2km | 24:02 | 1位 |
| 増子陽太 | 2024-10-24 | [第69回福島県高等学校駅伝競走大会](https://gold.jaic.org/fukushima/kekka/2024/1024/rel001.html) | 学法石川 | 3区・8.1075km | 24:05 | 1位 |
| 増子陽太 | 2024-03-24 | [第47回春の高校伊那駅伝](https://www.ina-ekiden.jp/wpnew/wp-content/uploads/2024/03/2024danshi.pdf) | 学法石川 | 2区・7.52km | 22:28 | 1位 |
| 増子陽太 | 2024-01-21 | [第29回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4674/) | 福島県 | 4区・5.0km | 14:21 | 2位 |
| 増子陽太 | 2023-12-24 | [第74回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_74/all_record.html) | 学法石川 | 1区・10km | 29:06 | 5位 |
| 増子陽太 | 2023-11-19 | [第35回市町村対抗福島県縦断駅伝競走大会（ふくしま駅伝）](https://www.city.motomiya.lg.jp/uploaded/attachment/23140.pdf) | 鏡石町 | 6区・8.3km | 25:00 | 1位 |
| 増子陽太 | 2023-10-26 | [第68回福島県高等学校駅伝競走大会](https://gold.jaic.org/fukushima/kekka/2023/1026/rel001.html) | 学法石川 | 1区・10km | 30:22 | 2位 |
| 増子陽太 | 2023-01-22 | [第28回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4674/) | 福島県 | 6区・3.0km | 08:36 | 1位 |
| 新妻遼己 | 2026-11-01 | [第58回全日本大学駅伝対校選手権大会](https://daigaku-ekiden.com/files/2026_result.pdf#page=5) | 早稲田大学 | 3区・11.9km | 32:45 | 1位 |
| 新妻遼己 | 2026-10-12 | [第38回出雲全日本大学選抜駅伝競走](https://www.izumo-ekiden.jp/assets/pdf/4b.pdf#page=1) | 早稲田大学 | 4区・6.2km | 17:10 | 1位 |
| 新妻遼己 | 2026-01-18 | [第31回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4637/) | 兵庫県 | 1区・7.0km | 19:24 | 3位 |
| 新妻遼己 | 2025-12-21 | [第76回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_76/all_record.html) | 西脇工 | 1区・10km | 28:40 | 2位 |
| 新妻遼己 | 2025-11-16 | [第76回近畿高等学校駅伝競走大会](https://drive.google.com/file/d/1NryvuRrkJFsZT3evexCmhw2DKEUZUB3W/view) | 西脇工 | 7区・5km | 13:35 | 1位 |
| 新妻遼己 | 2025-11-03 | [第80回兵庫県高等学校駅伝競走大会](http://www.haaa.jp/~koukou/2025/eki/result.pdf) | 西脇工 | 1区・10km | 28:22 | 1位 |
| 新妻遼己 | 2025-03-23 | [第48回春の高校伊那駅伝](https://www.ina-ekiden.jp/wpnew/wp-content/uploads/2025/03/2025danshi.pdf) | 西脇工 | 2区・7.52km | 23:11 | 6位 |
| 新妻遼己 | 2025-01-19 | [第30回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4637/) | 兵庫県 | 1区・7.0km | 19:54 | 4位 |
| 新妻遼己 | 2024-12-22 | [第75回全国高等学校駅伝競走大会](https://koukouekiden-record.mainichi.jp/record/archive/m_75/all_record.html) | 西脇工 | 1区・10km | 29:30 | 10位 |
| 新妻遼己 | 2024-11-24 | [第75回近畿高等学校駅伝競走大会](https://www.koukou-rikujou.info/data/2024/2024_ekiden_kinki_result.pdf) | 西脇工 | 6区・5km | 14:13 | 1位 |
| 新妻遼己 | 2024-11-03 | [第79回兵庫県高等学校駅伝競走大会](http://www.haaa.jp/~koukou/2024/eki/itiran.pdf) | 西脇工 | 1区・10km | 29:47 | 1位 |
| 新妻遼己 | 2024-03-24 | [第47回春の高校伊那駅伝](https://www.ina-ekiden.jp/wpnew/wp-content/uploads/2024/03/2024danshi.pdf) | 西脇工 | 4区・9.1km | 26:49 | 4位 |
| 新妻遼己 | 2023-11-26 | [第74回近畿高等学校駅伝競走大会](http://www.haaa.jp/~koukou/2023/kinkieki/html/rel002.html) | 西脇工 | 1区・10km | 29:41 | 4位 |
| 新妻遼己 | 2023-11-05 | [第78回兵庫県高等学校駅伝競走大会](http://www.haaa.jp/~koukou/2023/eki/mresult.pdf) | 西脇工 | 1区・10km | 30:56 | 5位 |
| 新妻遼己 | 2023-01-22 | [第28回全国都道府県対抗男子駅伝競走大会](https://www.hiroshima-ekiden.com/archive/runner/4637/) | 兵庫県 | 2区・3.0km | 08:17 | 1位 |
| 新妻遼己 | 2022-12-18 | [第30回全国中学校駅伝大会](https://shigatf.com/wp/wp-content/uploads/2022data//20221218_全国駅伝_記録一覧.pdf) | 平岡中学校 | 1区・3km | 9:05 | 1位 |
