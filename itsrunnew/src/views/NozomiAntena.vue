<template>
  <v-container class="archive py-4">
    <header class="hero">
      <p class="kicker">NOZOMI TANAKA RACE ARCHIVE</p>
      <h1>田中希実選手の記録集</h1>
      <p class="lead">2020年から現在までの出走を、世界大会だけでなく記録会、地方大会、駅伝、ロード、ペースメーカー、ゲスト出走まで時系列で追う非公式アーカイブです。</p>
      <div class="stats">
        <div><strong>{{ results.length }}</strong><span>収録レース</span></div>
        <div><strong>{{ localCount }}</strong><span>国内小規模・地域大会</span></div>
        <div><strong>2020–{{ latestYear }}</strong><span>収録期間</span></div>
      </div>
      <p class="updated">最終確認：2026年8月29日（2026年シーズンは途中）</p>
    </header>

    <AdsDisplay slot="6879016191" />

    <section class="panel">
      <h2>記録の見方</h2>
      <p>予選・決勝、同日の複数種目は別レースです。「地域・記録会」は、競技生活の流れが見える国内の記録会、大学競技会、地方GPなどをまとめています。ペースメーカーやゲストランは役割を明記しました。</p>
      <div class="legend">
        <span class="tag tag-major">五輪・世界大会</span><span class="tag tag-local">地域・記録会</span><span class="tag tag-road">ロード・駅伝</span><span class="tag tag-special">ペース・ゲスト</span><span class="tag tag-indoor">室内</span>
      </div>
    </section>

    <section class="panel filters">
      <h2>記録を探す</h2>
      <div class="filter-grid">
        <label>年度<select v-model="selectedYear"><option value="all">全年度</option><option v-for="year in years" :key="year" :value="String(year)">{{ year }}年</option></select></label>
        <label>種類<select v-model="selectedKind"><option value="all">すべて</option><option value="major">五輪・世界大会</option><option value="local">地域・記録会</option><option value="road">ロード・駅伝</option><option value="special">ペース・ゲスト</option><option value="indoor">室内</option></select></label>
        <label>大会名・種目<input v-model.trim="query" type="search" placeholder="例：日体大、1500、駅伝"></label>
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
              <td class="meet"><a :href="race.sourceUrl" target="_blank" rel="noopener noreferrer">{{ competitionLabel(race.competition) }}</a><small>{{ locationLabel(race) }}<template v-if="race.note"> · {{ race.note }}</template></small></td>
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
      <p>基礎記録はWorld Athleticsの大会結果を中心に、日本陸連、大会主催者、公式プロフィールのリザルトで照合しました。大会名から確認可能な結果ページを開けます。駅伝・ペースメーカー・ゲスト出走など統計DBに載りにくいものは個別の公式結果や大会案内を補いました。</p>
      <ul>
        <li><a href="https://worldathletics.org/athletes/japan/nozomi-tanaka-14632538" target="_blank" rel="noopener noreferrer">World Athletics 選手プロフィール</a></li>
        <li><a href="https://www.jaaf.or.jp/athletes/profile/nozomi_tanaka/" target="_blank" rel="noopener noreferrer">日本陸上競技連盟 選手プロフィール</a></li>
        <li><a href="https://non-tanaka.jp/" target="_blank" rel="noopener noreferrer">田中希実オフィシャルサイト</a></li>
      </ul>
      <p class="notice">このページは非公式で、完全性を保証するものではありません。特にペースメーカー、公開記録を残さないゲスト出走、駅伝区間には未収録の可能性があります。誤りや未掲載情報はサイト下部の連絡先からお知らせください。</p>
    </section>
    <AdsDisplay slot="6031307376" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AdsDisplay from '@/components/AdsDisplay.vue';
import rawResults from '@/data/nozomi-results.json';

type Race = { id?: string; date: string; competition: string; event: string; round?: string; place?: number | null; mark?: string; city?: string; country?: string; indoor?: boolean; competitionId?: number; category?: string; kind?: 'major'|'local'|'road'|'special'; role?: 'pacer'|'guest'|'relay'; note?: string; sourceUrl?: string };

const extras: Race[] = [
  { date:'2026-07-04',competition:'ホクレン・ディスタンスチャレンジ2026 士別大会',event:'5000',place:1,mark:'15:00.61',city:'士別',country:'JPN',kind:'local',sourceUrl:'https://non-tanaka.jp/' },
  { date:'2026-07-04',competition:'ホクレン・ディスタンスチャレンジ2026 士別大会',event:'1500',place:1,mark:'4:08.53',city:'士別',country:'JPN',kind:'local',sourceUrl:'https://non-tanaka.jp/' },
  { date:'2026-05-30',competition:'MIDDLE DISTANCE CIRCUIT 東京',event:'1500',mark:'—',city:'東京',country:'JPN',kind:'special',role:'pacer',note:'ペースメーカー',sourceUrl:'https://non-tanaka.jp/' },
  { date:'2026-05-24',competition:'関西実業団陸上競技選手権',event:'1500',mark:'4:10.52',city:'鳴門',country:'JPN',kind:'local',note:'オープン',sourceUrl:'https://www.seiko.co.jp/sports/team_seiko/athlete/tanaka.html' },
  { date:'2026-05-23',competition:'関西実業団陸上競技選手権',event:'800',mark:'2:05.87',city:'鳴門',country:'JPN',kind:'local',note:'オープン',sourceUrl:'https://www.seiko.co.jp/sports/team_seiko/athlete/tanaka.html' },
  { date:'2026-01-11',competition:'皇后盃 第44回全国都道府県対抗女子駅伝',event:'2区 4km',place:1,mark:'12:14',city:'京都',country:'JPN',kind:'road',role:'relay',note:'兵庫・区間賞、チーム2位',sourceUrl:'https://www.womens-ekiden.com/' },
  { date:'2025-12-28',competition:'Isshin fuRUN 2025',event:'10km',mark:'33:02',city:'久喜',country:'JPN',kind:'special',role:'guest',note:'ゲストラン',sourceUrl:'https://runnet.jp/entry/runtes/user/pc/competitionDetailPrintAction.do?div=1&raceId=381314' },
  { date:'2025-05-18',competition:'セイコーゴールデングランプリ陸上2025東京',event:'3000',mark:'DNF',city:'東京',country:'JPN',kind:'special',role:'pacer',note:'ペースメーカー',sourceUrl:'https://worldathletics.org/competition/calendar-results/results/7216820/result' },
  { date:'2025-04-12',competition:'第33回金栗記念選抜陸上中長距離大会',event:'5000',mark:'—',city:'熊本',country:'JPN',kind:'special',role:'pacer',note:'ペースメーカー',sourceUrl:'https://www.rikujyokyogi.co.jp/archives/166594' },
  { date:'2025-01-12',competition:'皇后盃 第43回全国都道府県対抗女子駅伝',event:'9区 10km',place:6,mark:'32:28',city:'京都',country:'JPN',kind:'road',role:'relay',note:'兵庫・区間6位、チーム10位',sourceUrl:'https://gold.jaic.org/jaic/member/okayama/2025/43womens-ekiden/results.pdf' },
  { date:'2024-10-20',competition:'ナイタートライアルin屋島',event:'2000',place:1,mark:'5:40.89',city:'高松',country:'JPN',kind:'local',note:'日本記録',sourceUrl:'https://www.jaaf.or.jp/athletes/profile/nozomi_tanaka/' },
  { date:'2024-01-14',competition:'皇后盃 第42回全国都道府県対抗女子駅伝',event:'2区 4km',place:1,mark:'12:11',city:'京都',country:'JPN',kind:'road',role:'relay',note:'兵庫・19人抜き区間賞',sourceUrl:'https://www.womens-ekiden.com/42nd_result.pdf' },
  { date:'2022-11-27',competition:'クイーンズ駅伝 in 宮城',event:'1区 7.6km',place:2,mark:'23:50',city:'宮城',country:'JPN',kind:'road',role:'relay',note:'区間2位',sourceUrl:'https://www.tbs.co.jp/ekiden/' },
  { date:'2022-01-16',competition:'皇后盃 第40回全国都道府県対抗女子駅伝',event:'1区 6km',place:2,mark:'18:59',city:'京都',country:'JPN',kind:'road',role:'relay',note:'兵庫・区間2位',sourceUrl:'https://www.womens-ekiden.com/' },
  { date:'2020-01-12',competition:'皇后盃 第38回全国都道府県対抗女子駅伝',event:'1区 6km',place:2,mark:'19:13',city:'京都',country:'JPN',kind:'road',role:'relay',note:'兵庫・区間2位',sourceUrl:'https://toriku.or.jp/storage/kougouhai_result_2020.pdf' },
];

const results = ([...(rawResults as Race[]), ...extras] as Race[]).map((race,index) => ({ ...race, id:`${race.date}-${race.event}-${index}`, sourceUrl: race.sourceUrl ?? (race.competitionId ? `https://worldathletics.org/competition/calendar-results/results/${race.competitionId}` : 'https://worldathletics.org/athletes/japan/nozomi-tanaka-14632538') })).sort((a,b) => b.date.localeCompare(a.date));
const selectedYear=ref('all'), selectedKind=ref('all'), query=ref('');
const years=[...new Set(results.map(r=>Number(r.date.slice(0,4))))].sort((a,b)=>b-a), latestYear=years[0];
const isMajor=(r:Race)=>/Olympic|World Athletics Championships|World Athletics Indoor Championships|IAAF World Championships/.test(r.competition);
const isRoad=(r:Race)=>r.kind==='road'||['1MR','5RR'].includes(r.event)||/Road|Ekiden|駅伝|Cross Country/.test(r.competition);
const isLocal=(r:Race)=>r.kind==='local'||(!isMajor(r)&&!isRoad(r)&&r.country==='JPN'&&['C','D','E','F'].includes(r.category??'F'));
const matchesKind=(r:Race,k:string)=>k==='major'?isMajor(r):k==='local'?isLocal(r):k==='road'?isRoad(r):k==='special'?r.kind==='special':k==='indoor'?r.indoor===true:true;
const localCount=results.filter(isLocal).length;
const filteredResults=computed(()=>results.filter(r=>{const needle=query.value.toLocaleLowerCase('ja'), text=`${r.competition} ${competitionLabel(r.competition)} ${r.event} ${r.city??''}`.toLocaleLowerCase('ja');return(selectedYear.value==='all'||r.date.startsWith(selectedYear.value))&&(selectedKind.value==='all'||matchesKind(r,selectedKind.value))&&(!needle||text.includes(needle));}));
const groups=computed(()=>years.map(year=>({year,items:filteredResults.value.filter(r=>r.date.startsWith(String(year)))})).filter(g=>g.items.length));

const names:Array<[RegExp,string]>=[[/Japanese Championships|Japan Championships|Japan Championship/,'日本陸上競技選手権大会'],[/The XXXIII Olympic Games/,'パリ2024オリンピック'],[/The XXXII Olympic Games/,'東京2020オリンピック'],[/World Athletics Championships/,'世界陸上競技選手権大会'],[/World Athletics Indoor Championships/,'世界室内陸上競技選手権大会'],[/Hokuren Distance Challenge/,'ホクレン・ディスタンスチャレンジ'],[/Nittai.*Distance|Nippon Sport Science University Long Distance/,'日体大長距離競技会'],[/Two Laps Middle Distance Circuit/,'TWOLAPS ミドルディスタンスサーキット'],[/Night Game Trial/,'ナイタートライアルin屋島'],[/Golden Games/,'ゴールデンゲームズ'],[/SEIKO Golden Grand Prix/,'セイコーゴールデングランプリ'],[/Kanakuri Memorial/,'金栗記念'],[/Hyogo Relay Carnival/,'兵庫リレーカーニバル'],[/Shizuoka International Athletics Meet/,'静岡国際陸上'],[/Japanese Corporate Team Championships/,'全日本実業団対抗陸上競技選手権'],[/National Sports Festival/,'国民体育大会']];
function competitionLabel(name:string){return names.reduce((value,[pattern,replacement])=>value.replace(pattern,replacement),name)}
function formatDate(date:string){const [,m,d]=date.split('-');return `${Number(m)}/${Number(d)}`}
function eventLabel(r:Race){const labels:Record<string,string>={'1MR':'1マイル（ロード）','5RR':'5km（ロード）','10K':'10000m',XSE:'クロスカントリー'};return labels[r.event]??`${r.event}${/^\d+$/.test(r.event)?'m':''}`}
function roundLabel(round?:string){if(!round||round==='F'||/^F\d+$/.test(round))return '';if(round.startsWith('SF'))return `準決勝 ${round}`;if(round.startsWith('H'))return `予選 ${round}`;return round}
function placeLabel(r:Race){if(r.role==='pacer')return 'ペース';if(r.role==='guest')return 'ゲスト';return r.place?`${r.place}位`:'—'}
function locationLabel(r:Race){return [r.city,r.country&&r.country!=='JPN'?r.country:''].filter(Boolean).join(' / ')}
function tagsFor(r:Race){const tags:Array<{key:string,label:string}>=[];if(isMajor(r))tags.push({key:'major',label:'世界大会'});if(isLocal(r))tags.push({key:'local',label:'地域・記録会'});if(isRoad(r))tags.push({key:'road',label:r.role==='relay'?'駅伝':'ロード'});if(r.kind==='special')tags.push({key:'special',label:r.role==='pacer'?'ペース':'ゲスト'});if(r.indoor)tags.push({key:'indoor',label:'室内'});return tags.length?tags:[{key:'international',label:r.country==='JPN'?'国内主要':'海外'}]}
</script>

<style scoped>
.archive{max-width:1180px;color:#172133}.hero{padding:42px clamp(22px,5vw,64px);border-radius:22px;color:#fff;background:linear-gradient(135deg,#112848,#174f72 64%,#177d78);box-shadow:0 16px 45px #1128482e}.kicker{margin:0 0 8px;color:#a7eee1;font-size:.78rem;font-weight:800;letter-spacing:.16em}.hero h1{margin:0;font-size:clamp(2rem,5vw,3.8rem);line-height:1.12}.lead{max-width:800px;margin:20px 0 28px;font-size:1.08rem;line-height:1.9}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-width:760px}.stats div{padding:16px;border:1px solid #ffffff40;border-radius:14px;background:#ffffff17}.stats strong,.stats span{display:block}.stats strong{font-size:1.55rem}.stats span{font-size:.78rem;color:#dcebf3}.updated{margin:18px 0 0;color:#c7dbe5;font-size:.8rem}.panel{margin-top:28px;padding:26px;border:1px solid #dce4e8;border-radius:18px;background:#fff}.panel h2{margin:0 0 14px;font-size:1.45rem}.panel p{line-height:1.85}.legend,.year-nav{display:flex;flex-wrap:wrap;gap:8px}.tag{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;font-size:.7rem;font-weight:700;white-space:nowrap}.tag-major{color:#8c2732;background:#fde5e8}.tag-local{color:#175c47;background:#dff3ea}.tag-road{color:#6a4b00;background:#fff0c7}.tag-special{color:#653c86;background:#f0e3fa}.tag-indoor{color:#24517c;background:#deedfb}.tag-international{color:#425466;background:#e9eef2}.filter-grid{display:grid;grid-template-columns:160px 200px minmax(220px,1fr);gap:12px}.filter-grid label{font-size:.78rem;font-weight:700}.filter-grid select,.filter-grid input{width:100%;height:44px;margin-top:6px;padding:0 12px;border:1px solid #adbbc3;border-radius:9px;background:#fff;font:inherit}.filters>p{margin:12px 0 0;color:#53636d;font-size:.85rem}.year-nav{position:sticky;z-index:3;top:64px;margin:22px 0;padding:10px;border:1px solid #dce4e8;border-radius:13px;background:#fffffff0;backdrop-filter:blur(8px)}.year-nav a{padding:7px 11px;border-radius:8px;color:#155d67;font-weight:800;text-decoration:none}.year-nav a:hover{background:#e6f2f2}.year-section{scroll-margin-top:130px;margin:30px 0 44px}.year-heading{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}.year-heading h2{margin:0;font-size:2rem}.year-heading span{color:#60717a}.table-wrap{overflow-x:auto;border:1px solid #d8e0e5;border-radius:15px;background:#fff}table{width:100%;min-width:850px;border-collapse:collapse}th{padding:12px 10px;color:#52616a;background:#eef3f5;font-size:.75rem;text-align:left}td{padding:13px 10px;border-top:1px solid #e4eaed;vertical-align:top;font-size:.86rem}tbody tr:hover{background:#f8fbfb}.nowrap,.mark{white-space:nowrap;font-variant-numeric:tabular-nums}.mark{font-weight:800}.meet{min-width:280px}.meet a,.sources a{color:#12616e;font-weight:700}small{display:block;margin-top:4px;color:#667780;font-size:.72rem}.notice{padding:14px;border-left:4px solid #d8a83f;background:#fff8e8;font-size:.86rem}.empty{padding:40px;text-align:center}@media(max-width:700px){.hero{padding:28px 20px;border-radius:16px}.stats,.filter-grid{grid-template-columns:1fr}.panel{padding:20px 16px}.year-nav{top:56px;overflow-x:auto;flex-wrap:nowrap}table{min-width:760px}}
</style>
