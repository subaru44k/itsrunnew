<template>
  <v-container class="archive py-4">
    <header class="hero">
      <p class="kicker">{{ athlete.nameEn.toUpperCase() }} RACE ARCHIVE</p>
      <h1>{{ athlete.name }}選手の記録集</h1>
      <p class="lead">{{ firstYear }}年から{{ latestYear }}年までの公開大会結果を、トラック・ロード・クロスカントリー・駅伝の種目別、年度別にたどる非公式アーカイブです。高校時代の県総体・地区予選・新人大会、国内の記録会や国際大会に加え、駅伝の区間記録・区間順位も収録しています。</p>
      <div class="stats">
        <div><strong>{{ results.length }}</strong><span>収録レース</span></div>
        <div><strong>{{ ekidenCount }}</strong><span>駅伝の出走</span></div>
        <div><strong>{{ firstYear }}–{{ latestYear }}</strong><span>収録期間</span></div>
      </div>
      <p class="updated">最終確認：2026年11月2日（最新の収録結果：{{ results[0]?.date }}）</p>
    </header>

    <AdsDisplay slot="6879016191" />

    <section class="panel">
      <h2>記録の見方</h2>
      <p>予選・決勝、同日の複数種目は別レースです。「地域・記録会」は、高校大会、大学競技会、記念大会などの国内大会をまとめています。大会名をクリックすると、確認できる大会公式結果やWorld Athleticsの結果ページを開けます。駅伝の順位は区間順位です。同タイムの同順位や区間新記録は公式結果の表記に従い、チームの通過順位・総合順位とは区別しています。</p>
      <div class="legend">
        <span class="tag tag-major">国際選手権</span><span class="tag tag-local">地域・記録会</span><span class="tag tag-road">ロード・クロカン</span><span class="tag tag-ekiden">駅伝</span><span class="tag tag-international">海外主要</span>
      </div>
    </section>

    <section class="panel filters">
      <h2>記録を探す</h2>
      <div class="filter-grid">
        <label>年度<select v-model="selectedYear" aria-label="年度"><option value="all">全年度</option><option v-for="year in years" :key="year" :value="String(year)">{{ year }}年</option></select></label>
        <label>種類<select v-model="selectedKind" aria-label="種類"><option value="all">すべて</option><option value="major">国際選手権</option><option value="local">地域・記録会</option><option value="road">ロード・クロカン</option><option value="ekiden">駅伝</option><option value="international">海外主要</option></select></label>
        <label>大会名・種目<input v-model.trim="query" type="search" placeholder="例：5000、駅伝、1区、学法石川"></label>
      </div>
      <p>{{ filteredResults.length }}件を表示</p>
    </section>

    <nav class="year-nav" aria-label="年度別リンク"><a v-for="year in years" :key="year" :href="`#${year}`">{{ year }}</a></nav>

    <div v-if="groups.length">
      <section v-for="group in groups" :id="String(group.year)" :key="group.year" class="year-section">
        <div class="year-heading"><h2>{{ group.year }}年</h2><span>{{ group.items.length }}レース</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>日付</th><th>大会・場所／所属</th><th>種目・区間</th><th>順位／区間順位</th><th>記録</th><th>区分</th></tr></thead>
            <tbody><tr v-for="race in group.items" :key="race.id" :data-ekiden="race.ekiden ? 'true' : undefined">
              <td class="nowrap">{{ formatDate(race.date) }}</td>
              <td class="meet"><a :href="race.sourceUrl" target="_blank" rel="noopener noreferrer">{{ competitionLabel(race.competition) }}</a><small>{{ locationLabel(race) }}</small><small v-if="race.ekiden">所属：{{ race.ekiden.team }}</small></td>
              <td>{{ eventLabel(race) }}<small v-if="!race.ekiden && roundLabel(race.round)">{{ roundLabel(race.round) }}</small></td>
              <td>{{ placeLabel(race) }}</td><td class="mark">{{ race.mark || '—' }}<small v-if="race.ekiden?.record" class="record-note">{{ race.ekiden.record }}</small></td>
              <td><span v-for="tag in tagsFor(race)" :key="tag.key" class="tag" :class="`tag-${tag.key}`">{{ tag.label }}</span></td>
            </tr></tbody>
          </table>
        </div>
      </section>
    </div>
    <p v-else class="empty">条件に合う記録がありません。</p>

    <section class="panel sources">
      <h2>出典と掲載方針</h2>
      <p>トラック・ロード・クロスカントリーはWorld Athleticsで選手本人の生年月日・選手IDを確認した年度別結果を基礎に、県総体・地区予選・新人大会などの主催者公式結果を補足しています。大会名は日本語の正式名や一般的な日本語・カタカナ表記で表示し、元の大会名でも検索できます。駅伝は大会主催者・陸上競技連盟・高体連等の公式結果を照合し、大会日・所属・区間・距離・区間記録・区間順位を掲載しています。駅伝のコースや距離は大会・年度で異なるため、同距離でもタイムだけの単純比較にはご注意ください。各大会名から公式結果を確認できます。大会結果への個別リンクが公開されていない記録は選手プロフィールへ案内します。順位は組別の場合があり、予選・決勝は別行です。タイムレースの組別結果と総合結果は同じ出走として1件にまとめています。DNSは欠場、DNFは途中棄権で、完走タイムとは区別しています。ロードとトラックの同じ距離は区別しています。</p>
      <ul><li><a :href="`https://worldathletics.org/athletes/_/${athlete.worldAthleticsId}`" target="_blank" rel="noopener noreferrer">World Athletics：{{ athlete.nameEn }} 選手プロフィール</a></li></ul>
      <p class="notice">このページは非公式で、完全性を保証するものではありません。主催者が公開していない記録や確認できていない大会・オープン参加などは未収録の可能性があります。誤りや未掲載情報はサイト下部の連絡先からお知らせください。</p>
    </section>
    <AdsDisplay slot="6031307376" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AdsDisplay from '@/components/AdsDisplay.vue';
import { competitionLabel } from '@/data/competition-label';
import { athletes, type AthleteId } from '@/data/athlete-archives';

const props = defineProps<{ athleteId: AthleteId }>();
const athlete = computed(() => athletes[props.athleteId]);
type Race = (typeof athletes)[AthleteId]['results'][number];
const results = computed(() => athlete.value.results.map((race, index) => ({
  ...race,
  id: `${race.date}-${race.event}-${race.round}-${index}`,
  sourceUrl: race.sourceUrl,
})));
const selectedYear = ref('all');
const selectedKind = ref('all');
const query = ref('');
watch(() => props.athleteId, () => { selectedYear.value = 'all'; selectedKind.value = 'all'; query.value = ''; });
const years = computed(() => [...new Set(results.value.map(race => Number(race.date.slice(0, 4))))].sort((a, b) => b - a));
const firstYear = computed(() => years.value[years.value.length - 1]);
const latestYear = computed(() => years.value[0]);
const isMajor = (race: Race) => /World.*Championships|Asian.*Championships|Olympic/.test(race.competition);
const isEkiden = (race: Race) => Boolean(race.ekiden);
const isRoad = (race: Race) => /Road|Cross Country|Kilometres|Mile Road/.test(`${race.event} ${race.competition}`);
const isLocal = (race: Race) => !isMajor(race) && !isRoad(race) && !isEkiden(race) && race.country === 'JPN';
const isInternational = (race: Race) => race.country !== 'JPN' && !isMajor(race);
const ekidenCount = computed(() => results.value.filter(isEkiden).length);
const matchesKind = (race: Race, kind: string) => kind === 'ekiden' ? isEkiden(race) : kind === 'major' ? isMajor(race) : kind === 'local' ? isLocal(race) : kind === 'road' ? isRoad(race) : kind === 'international' ? isInternational(race) : true;
const filteredResults = computed(() => results.value.filter(race => {
  const text = `${race.competition} ${competitionLabel(race.competition)} ${eventLabel(race)} ${race.venue} ${race.ekiden?.team ?? ''}`.toLocaleLowerCase('ja');
  return (selectedYear.value === 'all' || race.date.startsWith(selectedYear.value)) && matchesKind(race, selectedKind.value) && text.includes(query.value.toLocaleLowerCase('ja'));
}));
const groups = computed(() => years.value.map(year => ({ year, items: filteredResults.value.filter(race => race.date.startsWith(String(year))) })).filter(group => group.items.length));
function formatDate(date: string) { const [, month, day] = date.split('-'); return `${Number(month)}/${Number(day)}`; }
function eventLabel(race: Race) {
  if (race.ekiden) return `駅伝 ${race.ekiden.section}区（${race.ekiden.distanceKm}km）`;
  const labels: Record<string, string> = { '800 Metres': '800m', '1000 Metres': '1000m', '1500 Metres': '1500m', '3000 Metres': '3000m', '5000 Metres': '5000m', '10,000 Metres': '10000m', '5 Kilometres Road': '5km（ロード）', '10 Kilometres Road': '10km（ロード）', 'Mile Road': '1マイル（ロード）', 'Cross Country': 'クロスカントリー', 'Cross Country U20 Race': 'U20クロスカントリー' };
  return (labels[race.event] ?? race.event) + (race.indoor ? '（室内）' : '');
}
function roundLabel(round: string) { if (!round || round === 'F') return ''; if (round.startsWith('SF')) return `準決勝 ${round}`; if (round.startsWith('H')) return `予選 ${round}`; if (/^F\d+$/.test(round)) return `決勝・組 ${round.slice(1)}`; return round; }
function placeLabel(race: Race) {
  if (race.ekiden) return `区間${race.ekiden.rank}位${race.ekiden.rankTied ? '（同順位）' : ''}`;
  return /^\d+\.?$/.test(race.place) ? `${parseInt(race.place)}位` : race.place || '—'; }
function locationLabel(race: Race) { return race.venue; }
function tagsFor(race: Race) {
  if (isEkiden(race)) return [{ key: 'ekiden', label: '駅伝' }];
  if (isMajor(race)) return [{ key: 'major', label: '国際選手権' }];
  if (isRoad(race)) return [{ key: 'road', label: /Cross Country/.test(race.event) ? 'クロカン' : 'ロード' }];
  if (isLocal(race)) return [{ key: 'local', label: '地域・記録会' }];
  return [{ key: isInternational(race) ? 'international' : 'domestic', label: isInternational(race) ? '海外主要' : '国内主要' }];
}
</script>

<style scoped>
.archive{max-width:1180px;color:#172133}.hero{padding:42px clamp(22px,5vw,64px);border-radius:22px;color:#fff;background:linear-gradient(135deg,#18284c,#245f76 64%,#167b70);box-shadow:0 16px 45px #1128482e}.kicker{margin:0 0 8px;color:#b4eee2;font-size:.78rem;font-weight:800;letter-spacing:.16em}.hero h1{margin:0;font-size:clamp(2rem,5vw,3.8rem);line-height:1.12}.lead{max-width:850px;margin:20px 0 28px;font-size:1.08rem;line-height:1.9}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-width:760px}.stats div{padding:16px;border:1px solid #ffffff40;border-radius:14px;background:#ffffff17}.stats strong,.stats span{display:block}.stats strong{font-size:1.55rem}.stats span{font-size:.78rem;color:#dcebf3}.updated{margin:18px 0 0;color:#c7dbe5;font-size:.8rem}.panel{margin-top:28px;padding:26px;border:1px solid #dce4e8;border-radius:18px;background:#fff}.panel h2{margin:0 0 14px;font-size:1.45rem}.panel p{line-height:1.85}.legend,.year-nav{display:flex;flex-wrap:wrap;gap:8px}.tag{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;font-size:.7rem;font-weight:700;white-space:nowrap}.tag-major{color:#8c2732;background:#fde5e8}.tag-local{color:#175c47;background:#dff3ea}.tag-road{color:#6a4b00;background:#fff0c7}.tag-international{color:#24517c;background:#deedfb}.tag-ekiden{color:#593a79;background:#eee4fa}.record-note{color:#8c5700}.tag-domestic{color:#425466;background:#e9eef2}.filter-grid{display:grid;grid-template-columns:160px 200px minmax(220px,1fr);gap:12px}.filter-grid label{font-size:.78rem;font-weight:700}.filter-grid select,.filter-grid input{width:100%;height:44px;margin-top:6px;padding:0 12px;border:1px solid #adbbc3;border-radius:9px;background:#fff;font:inherit}.filters>p{margin:12px 0 0;color:#53636d;font-size:.85rem}.year-nav{position:sticky;z-index:3;top:64px;margin:22px 0;padding:10px;border:1px solid #dce4e8;border-radius:13px;background:#fffffff0;backdrop-filter:blur(8px)}.year-nav a{padding:7px 11px;border-radius:8px;color:#155d67;font-weight:800;text-decoration:none}.year-nav a:hover{background:#e6f2f2}.year-section{scroll-margin-top:130px;margin:30px 0 44px}.year-section:last-child{padding-bottom:140px}.year-heading{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}.year-heading h2{margin:0;font-size:2rem}.year-heading span{color:#60717a}.table-wrap{overflow-x:auto;border:1px solid #d8e0e5;border-radius:15px;background:#fff}table{width:100%;min-width:850px;border-collapse:collapse}th{padding:12px 10px;color:#52616a;background:#eef3f5;font-size:.75rem;text-align:left}td{padding:13px 10px;border-top:1px solid #e4eaed;vertical-align:top;font-size:.86rem}tbody tr:hover{background:#f8fbfb}.nowrap,.mark{white-space:nowrap;font-variant-numeric:tabular-nums}.mark{font-weight:800}.meet{min-width:280px}.meet a,.sources a{color:#12616e;font-weight:700}small{display:block;margin-top:4px;color:#667780;font-size:.72rem}.notice{padding:14px;border-left:4px solid #d8a83f;background:#fff8e8;font-size:.86rem}.empty{padding:40px;text-align:center}@media(max-width:700px){.hero{padding:28px 20px;border-radius:16px}.stats,.filter-grid{grid-template-columns:1fr}.panel{padding:20px 16px}.year-nav{top:56px;overflow-x:auto;flex-wrap:nowrap}table{min-width:760px}}
</style>
