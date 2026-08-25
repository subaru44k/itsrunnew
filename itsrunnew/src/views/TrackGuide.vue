<template>
  <v-container class="public-info-page">
    <article v-if="isEnglish">
      <p class="page-eyebrow">TRACK FINDER GUIDE</p>
      <h1>How to find a workout track</h1>
      <p class="lead">Choose when and where you want to train, then compare promising facilities without losing venues that simply need confirmation.</p>
      <h2>1. Choose a date</h2><p>Use Today, Tomorrow, Saturday, Sunday, or the date field. The map, facility list, details, and availability all use the selected date.</p>
      <h2>2. Choose a search origin</h2><p>Use your current location or choose a point on the map. Facilities are sorted by straight-line distance. The point is for comparison; directions open separately in Google Maps.</p>
      <h2>3. Read availability</h2>
      <dl class="status-explanation">
        <div><dt>Available</dt><dd>Official information confirms an individual-use period.</dd></div>
        <div><dt>Partly available</dt><dd>Only the displayed time or area is confirmed. Unlisted periods are not assumed unavailable.</dd></div>
        <div><dt>Needs confirmation</dt><dd>Individual use may be possible, but the selected date cannot be confirmed online. This does not mean unavailable.</dd></div>
        <div><dt>Unavailable</dt><dd>An official closure, exclusive-use, maintenance, or equivalent notice applies.</dd></div>
      </dl>
      <h2>4. Compare track conditions</h2><p>Check distance, track length, surface, individual-use rules, and spike information. “Not confirmed” means the official source did not provide enough evidence, not that the feature is unavailable.</p>
      <h2>5. Confirm before travelling</h2><p>Schedules and rules can change on the day. Open the official schedule or facility website before travelling.</p>
      <v-btn class="primary-page-action" color="indigo" variant="flat" to="/en/">Open Track Finder</v-btn>
    </article>
    <article v-else>
      <p class="page-eyebrow">TRACK FINDER GUIDE</p>
      <h1>トラック検索の使い方</h1>
      <p class="lead">走りたい日と場所を指定し、「要確認だが使える可能性がある施設」も残しながら練習場所を比較できます。</p>
      <h2>1. 利用日を選ぶ</h2><p>今日、明日、土曜、日曜、または日付入力から選びます。地図、施設一覧、詳細、利用状況はすべて選択日に連動します。</p>
      <h2>2. 検索の基準地点を選ぶ</h2><p>現在地を使うか、地図上の地点を指定します。施設は基準地点からの直線距離順になります。基準地点は比較用で、実際の経路はGoogle Mapsで確認できます。</p>
      <h2>3. 利用状況を読む</h2>
      <dl class="status-explanation">
        <div><dt>利用可能</dt><dd>公式情報から個人利用枠を確認できた状態です。</dd></div>
        <div><dt>一部利用可能</dt><dd>表示した時間帯や利用範囲だけを確認できた状態です。未記載時間を利用不可とは判断していません。</dd></div>
        <div><dt>要確認</dt><dd>個人利用できる可能性はありますが、選択日の状況をWebだけでは確定できない状態です。利用不可という意味ではありません。</dd></div>
        <div><dt>利用不可</dt><dd>公式情報で休場、専用利用、整備などを確認できた状態です。</dd></div>
      </dl>
      <h2>4. トラック条件を比べる</h2><p>距離、400mか、路面、個人利用条件、スパイク情報を確認します。「未確認」は公式根拠が不足している意味で、利用できないという意味ではありません。</p>
      <h2>5. 出発前に公式情報を確認する</h2><p>当日の予定や利用条件は変更されることがあります。施設の公式予定または公式サイトを確認してからお出かけください。</p>
      <v-btn class="primary-page-action" color="indigo" variant="flat" to="/">トラックを探す</v-btn>
    </article>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
const { locale } = useI18n();
const isEnglish = computed(() => locale.value === 'en');
</script>

<style scoped>
.public-info-page { max-width: 820px; padding-block: 36px 56px; }.page-eyebrow { margin-bottom: 4px; color: #3f51b5; font-size: 12px; font-weight: 800; letter-spacing: .14em; }h1 { margin: 0 0 14px; font-size: clamp(30px, 5vw, 42px); }h2 { margin: 30px 0 8px; font-size: 21px; }.lead { font-size: 17px; line-height: 1.7; }.status-explanation { margin: 0; border-top: 1px solid #d9dce8; }.status-explanation div { display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid #d9dce8; }.status-explanation dt { font-weight: 700; }.status-explanation dd { margin: 0; }.primary-page-action { min-height: 44px; color: white !important; }@media (max-width: 599px) { .public-info-page { padding: 24px 16px 40px; }.status-explanation div { grid-template-columns: 1fr; gap: 3px; } }
</style>
