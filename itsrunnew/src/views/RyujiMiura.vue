<template>
  <v-container class="archive py-4">
    <header class="hero">
      <p class="kicker">RYUJI MIURA RACE ARCHIVE</p>
      <h1>三浦龍司選手の記録集</h1>
      <p class="lead">2020年から現在までの出走を、3000m障害だけでなく1500m・3000m・5000m・10000m、クロスカントリー、ロードまで時系列で追う非公式アーカイブです。世界大会の結果だけでなく、大学競技会やホクレンなど国内の記録会も収録しています。</p>
      <div class="stats">
        <div><strong>{{ results.length }}</strong><span>収録レース</span></div>
        <div><strong>{{ steepleCount }}</strong><span>3000m障害</span></div>
        <div><strong>2020–{{ latestYear }}</strong><span>収録期間</span></div>
      </div>
      <p class="updated">最終確認：2026年8月23日（2026年シーズンは途中）</p>
    </header>

    <AdsDisplay slot="6879016191" />

    <section class="panel">
      <h2>記録の見方</h2>
      <p>予選・決勝、同日の複数種目は別レースです。「地域・記録会」は、大学競技会、ホクレン、記念大会など、競技生活の流れが見える国内大会をまとめています。大会名をクリックすると、確認できるWorld Athleticsの結果ページを開けます。</p>
      <div class="legend">
        <span class="tag tag-major">五輪・世界大会</span><span class="tag tag-local">地域・記録会</span><span class="tag tag-road">ロード・クロカン</span><span class="tag tag-international">海外主要</span>
      </div>
    </section>

    <section class="panel filters">
      <h2>記録を探す</h2>
      <div class="filter-grid">
        <label>年度<select v-model="selectedYear"><option value="all">全年度</option><option v-for="year in years" :key="year" :value="String(year)">{{ year }}年</option></select></label>
        <label>種類<select v-model="selectedKind"><option value="all">すべて</option><option value="major">五輪・世界大会</option><option value="local">地域・記録会</option><option value="road">ロード・クロカン</option><option value="international">海外主要</option></select></label>
        <label>大会名・種目<input v-model.trim="query" type="search" placeholder="例：ホクレン、5000、障害"></label>
      </div>
      <p>{{ filteredResults.length }}件を表示</p>
    </section>

    <nav class="year-nav" aria-label="年度別リンク"><a v-for="year in years" :key="year" :href="`#${year}`">{{ year }}</a></nav>

    <div v-if="groups.length">
      <section v-for="group in groups" :id="String(group.year)" :key="group.year" class="year-section">
        <div class="year-heading"><h2>{{ group.year }}年</h2><span>{{ group.items.length }}レース</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>日付</th><th>大会・場所</th><th>種目</th><th>順位</th><th>記録</th><th>区分</th></tr></thead>
            <tbody><tr v-for="race in group.items" :key="race.id">
              <td class="nowrap">{{ formatDate(race.date) }}</td>
              <td class="meet"><a :href="race.sourceUrl" target="_blank" rel="noopener noreferrer">{{ competitionLabel(race.competition) }}</a><small>{{ locationLabel(race) }}</small></td>
              <td>{{ eventLabel(race) }}<small v-if="roundLabel(race.round)">{{ roundLabel(race.round) }}</small></td>
              <td>{{ placeLabel(race) }}</td><td class="mark">{{ race.mark || '—' }}</td>
              <td><span v-for="tag in tagsFor(race)" :key="tag.key" class="tag" :class="`tag-${tag.key}`">{{ tag.label }}</span></td>
            </tr></tbody>
          </table>
        </div>
      </section>
    </div>
    <p v-else class="empty">条件に合う記録がありません。</p>

    <section class="panel sources">
      <h2>出典と掲載方針</h2>
      <p>基礎記録はWorld Athleticsの大会結果を中心に、日本陸連の選手プロフィールや大会公式結果で照合しました。統計DBに掲載される公認大会だけでなく、国内の大学競技会、ホクレン、記念大会、クロスカントリー、箱根駅伝予選会も含めています。公開結果の更新や訂正に応じて、今後も追記します。</p>
      <ul>
        <li><a href="https://worldathletics.org/athletes/_/14860379" target="_blank" rel="noopener noreferrer">World Athletics 選手プロフィール（ID 14860379）</a></li>
        <li><a href="https://www.jaaf.or.jp/athletes/profile/ryuji_miura/" target="_blank" rel="noopener noreferrer">日本陸上競技連盟 選手プロフィール</a></li>
        <li><a href="https://www.subaru.co.jp/sports/athletics/" target="_blank" rel="noopener noreferrer">SUBARU陸上競技部 公式サイト</a></li>
      </ul>
      <p class="notice">このページは非公式で、完全性を保証するものではありません。主催者が公開していない記録、オープン参加、駅伝の区間記録などは未収録の可能性があります。誤りや未掲載情報はサイト下部の連絡先からお知らせください。</p>
    </section>
    <AdsDisplay slot="6031307376" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AdsDisplay from '@/components/AdsDisplay.vue';
import rawResults from '@/data/ryuji-results.json';

type Race = {
  id?: string;
  date: string;
  competition: string;
  event: string;
  round?: string;
  place?: number | null;
  mark?: string;
  city?: string;
  country?: string;
  indoor?: boolean;
  competitionId?: number;
  category?: string;
};

const results = (rawResults as Race[]).map((race, index) => ({
  ...race,
  id: `${race.date}-${race.event}-${index}`,
  sourceUrl: race.competitionId ? `https://worldathletics.org/competition/calendar-results/results/${race.competitionId}` : 'https://worldathletics.org/athletes/_/14860379',
})).sort((a, b) => b.date.localeCompare(a.date));

const selectedYear = ref('all');
const selectedKind = ref('all');
const query = ref('');
const years = [...new Set(results.map(race => Number(race.date.slice(0, 4))))].sort((a, b) => b - a);
const latestYear = years[0];
const steepleCount = results.filter(race => race.event === '3KSC').length;

const isMajor = (race: Race) => race.category === 'OW' || race.category === 'GL' || /Olympic|World Athletics Championships|Asian Cross Country Championships/.test(race.competition);
const isRoad = (race: Race) => race.event === 'HMAR' || race.event === '10MR' || race.event === 'XSE' || /Road|Cross Country|Ekiden|駅伝/.test(race.competition);
const isLocal = (race: Race) => !isMajor(race) && !isRoad(race) && race.country === 'JPN' && ['C', 'D', 'E', 'F'].includes(race.category ?? 'F');
const isInternational = (race: Race) => race.country !== 'JPN' && !isMajor(race);
const matchesKind = (race: Race, kind: string) => kind === 'major' ? isMajor(race) : kind === 'local' ? isLocal(race) : kind === 'road' ? isRoad(race) : kind === 'international' ? isInternational(race) : true;
const filteredResults = computed(() => results.filter(race => {
  const needle = query.value.toLocaleLowerCase('ja');
  const text = `${race.competition} ${competitionLabel(race.competition)} ${race.event} ${race.city ?? ''}`.toLocaleLowerCase('ja');
  return (selectedYear.value === 'all' || race.date.startsWith(selectedYear.value)) && (selectedKind.value === 'all' || matchesKind(race, selectedKind.value)) && (!needle || text.includes(needle));
}));
const groups = computed(() => years.map(year => ({ year, items: filteredResults.value.filter(race => race.date.startsWith(String(year))) })).filter(group => group.items.length));

const names: Array<[RegExp, string]> = [
  [/Japanese Cross Country Championships/, '日本クロスカントリー選手権大会'],
  [/Asian Cross Country Championships/, 'アジアクロスカントリー選手権大会'],
  [/Japanese Championships|Japan Championships/, '日本陸上競技選手権大会'],
  [/The XXXIII Olympic Games/, 'パリ2024オリンピック'],
  [/The XXXII Olympic Games/, '東京2020オリンピック'],
  [/World Athletics Championships/, '世界陸上競技選手権大会'],
  [/HOKUREN Distance Challenge|Hokuren Distance Challenge/, 'ホクレン・ディスタンスチャレンジ'],
  [/Juntendo University Competition/, '順天堂大学競技会'],
  [/Kanto Inter-University|Kanto University/, '関東インカレ'],
  [/Mikio Oda Memorial|Oda Mikio Memorial/, '織田幹雄記念国際陸上'],
  [/Seiko Golden Grand Prix/, 'セイコーゴールデングランプリ'],
  [/Kanakuri Memorial/, '金栗記念選抜陸上中長距離大会'],
  [/NITTAIDAI Challenge Games/, '日体大長距離競技会'],
  [/BAUHAUS-Galan/, 'ストックホルムDL'],
  [/Meeting de Paris/, 'パリDL'],
  [/Meeting International.*Herculis/, 'モナコDL'],
  [/Meeting International Mohammed VI/, 'ラバトDL'],
  [/Seashore Group Doha Meeting/, 'ドーハDL'],
  [/Wanda Diamond League Xiamen/, '廈門DL'],
  [/Weltklasse Zürich/, 'チューリヒDL'],
  [/Athletissima Lausanne/, 'ローザンヌDL'],
  [/Prefontaine Classic/, 'プレフォンテーンクラシック'],
  [/Tokorozawa Games/, '所沢競技会'],
  [/READY STEADY TOKYO/, 'READY STEADY TOKYO'],
  [/Hakone Ekiden Qualifier/, '箱根駅伝予選会'],
];

function competitionLabel(name: string) { return names.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), name); }
function formatDate(date: string) { const [, month, day] = date.split('-'); return `${Number(month)}/${Number(day)}`; }
function eventLabel(race: Race) {
  const labels: Record<string, string> = { '3KSC': '3000m障害', HMAR: 'ハーフマラソン', '10MR': '10マイル（ロード）', '10K': '10000m', XSE: 'クロスカントリー' };
  return labels[race.event] ?? `${race.event}${/^\d+$/.test(race.event) ? 'm' : ''}`;
}
function roundLabel(round?: string) { if (!round || round === 'F' || /^F\d+$/.test(round)) return ''; if (round.startsWith('H')) return `予選 ${round}`; if (round.startsWith('SF')) return `準決勝 ${round}`; return round; }
function placeLabel(race: Race) { return race.place ? `${race.place}位` : '—'; }
function locationLabel(race: Race) { return [race.city, race.country && race.country !== 'JPN' ? race.country : ''].filter(Boolean).join(' / '); }
function tagsFor(race: Race) {
  const tags: Array<{ key: string; label: string }> = [];
  if (isMajor(race)) tags.push({ key: 'major', label: '世界大会' });
  if (isLocal(race)) tags.push({ key: 'local', label: '地域・記録会' });
  if (isRoad(race)) tags.push({ key: 'road', label: race.event === 'XSE' ? 'クロカン' : 'ロード' });
  if (!tags.length) tags.push({ key: isInternational(race) ? 'international' : 'domestic', label: isInternational(race) ? '海外主要' : '国内主要' });
  return tags;
}
</script>

<style scoped>
.archive{max-width:1180px;color:#172133}.hero{padding:42px clamp(22px,5vw,64px);border-radius:22px;color:#fff;background:linear-gradient(135deg,#18284c,#245f76 64%,#167b70);box-shadow:0 16px 45px #1128482e}.kicker{margin:0 0 8px;color:#b4eee2;font-size:.78rem;font-weight:800;letter-spacing:.16em}.hero h1{margin:0;font-size:clamp(2rem,5vw,3.8rem);line-height:1.12}.lead{max-width:850px;margin:20px 0 28px;font-size:1.08rem;line-height:1.9}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-width:760px}.stats div{padding:16px;border:1px solid #ffffff40;border-radius:14px;background:#ffffff17}.stats strong,.stats span{display:block}.stats strong{font-size:1.55rem}.stats span{font-size:.78rem;color:#dcebf3}.updated{margin:18px 0 0;color:#c7dbe5;font-size:.8rem}.panel{margin-top:28px;padding:26px;border:1px solid #dce4e8;border-radius:18px;background:#fff}.panel h2{margin:0 0 14px;font-size:1.45rem}.panel p{line-height:1.85}.legend,.year-nav{display:flex;flex-wrap:wrap;gap:8px}.tag{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;font-size:.7rem;font-weight:700;white-space:nowrap}.tag-major{color:#8c2732;background:#fde5e8}.tag-local{color:#175c47;background:#dff3ea}.tag-road{color:#6a4b00;background:#fff0c7}.tag-international{color:#24517c;background:#deedfb}.tag-domestic{color:#425466;background:#e9eef2}.filter-grid{display:grid;grid-template-columns:160px 200px minmax(220px,1fr);gap:12px}.filter-grid label{font-size:.78rem;font-weight:700}.filter-grid select,.filter-grid input{width:100%;height:44px;margin-top:6px;padding:0 12px;border:1px solid #adbbc3;border-radius:9px;background:#fff;font:inherit}.filters>p{margin:12px 0 0;color:#53636d;font-size:.85rem}.year-nav{position:sticky;z-index:3;top:64px;margin:22px 0;padding:10px;border:1px solid #dce4e8;border-radius:13px;background:#fffffff0;backdrop-filter:blur(8px)}.year-nav a{padding:7px 11px;border-radius:8px;color:#155d67;font-weight:800;text-decoration:none}.year-nav a:hover{background:#e6f2f2}.year-section{scroll-margin-top:130px;margin:30px 0 44px}.year-section:last-child{padding-bottom:140px}.year-heading{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}.year-heading h2{margin:0;font-size:2rem}.year-heading span{color:#60717a}.table-wrap{overflow-x:auto;border:1px solid #d8e0e5;border-radius:15px;background:#fff}table{width:100%;min-width:850px;border-collapse:collapse}th{padding:12px 10px;color:#52616a;background:#eef3f5;font-size:.75rem;text-align:left}td{padding:13px 10px;border-top:1px solid #e4eaed;vertical-align:top;font-size:.86rem}tbody tr:hover{background:#f8fbfb}.nowrap,.mark{white-space:nowrap;font-variant-numeric:tabular-nums}.mark{font-weight:800}.meet{min-width:280px}.meet a,.sources a{color:#12616e;font-weight:700}small{display:block;margin-top:4px;color:#667780;font-size:.72rem}.notice{padding:14px;border-left:4px solid #d8a83f;background:#fff8e8;font-size:.86rem}.empty{padding:40px;text-align:center}@media(max-width:700px){.hero{padding:28px 20px;border-radius:16px}.stats,.filter-grid{grid-template-columns:1fr}.panel{padding:20px 16px}.year-nav{top:56px;overflow-x:auto;flex-wrap:nowrap}table{min-width:760px}}
</style>
