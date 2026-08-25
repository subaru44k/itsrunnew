<template>
  <v-container class="public-info-page">
    <article v-if="isEnglish">
      <p class="page-eyebrow">ABOUT ITSRUN</p>
      <h1>About ItsRun</h1>
      <p class="lead">ItsRun helps runners find a promising athletics track for a specific workout date.</p>

      <h2>What you can find</h2>
      <p>The Track Finder combines verified facility details with date-specific schedules from official municipalities, facility operators, and venue websites. It currently covers 33 tracks mainly in Tokyo and southern Saitama.</p>

      <h2>How to read availability</h2>
      <dl class="status-explanation">
        <div><dt>Available</dt><dd>Official information confirms an individual-use period.</dd></div>
        <div><dt>Partly available</dt><dd>Only the displayed time or area is confirmed. Unlisted periods are not assumed unavailable.</dd></div>
        <div><dt>Needs confirmation</dt><dd>Individual use may be possible, but the selected date cannot be confirmed online. This does not mean unavailable.</dd></div>
        <div><dt>Unavailable</dt><dd>An official closure, exclusive-use, maintenance, or equivalent notice applies.</dd></div>
      </dl>

      <h2>Before visiting</h2>
      <p>Schedules can change on the day. Check the linked official source and the venue's latest rules before travelling. ItsRun is an independent service and is not operated by a municipality or sports facility.</p>

      <h2>Corrections and requests</h2>
      <p>To report outdated information or request an improvement, contact <a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">@itsrun_page on X</a>.</p>
      <v-btn class="primary-page-action" color="indigo" variant="flat" to="/en/">Open Track Finder</v-btn>
    </article>

    <article v-else>
      <p class="page-eyebrow">ABOUT ITSRUN</p>
      <h1>いつランについて</h1>
      <p class="lead">いつランは、ランナーが「走りたい日に使えそうなトラック」を探すためのサイトです。</p>

      <h2>掲載している情報</h2>
      <p>自治体、施設、指定管理者などの公式情報をもとに、施設情報と日付ごとの利用予定を組み合わせて表示しています。現在は東京と埼玉南部を中心に33施設を掲載しています。</p>

      <h2>利用状況の見方</h2>
      <dl class="status-explanation">
        <div><dt>利用可能</dt><dd>公式情報から個人利用枠を確認できた状態です。</dd></div>
        <div><dt>一部利用可能</dt><dd>表示した時間帯や利用範囲だけを確認できた状態です。未記載の時間を利用不可とは判断していません。</dd></div>
        <div><dt>要確認</dt><dd>個人利用できる可能性はありますが、選択日の状況をWebだけでは確定できない状態です。利用不可という意味ではありません。</dd></div>
        <div><dt>利用不可</dt><dd>公式情報で休場、専用利用、整備などを確認できた状態です。</dd></div>
      </dl>

      <h2>利用前の確認</h2>
      <p>当日の予定や利用条件は変更されることがあります。お出かけ前に、各施設に表示している公式情報をご確認ください。いつランは自治体や施設が運営する公式サービスではありません。</p>

      <h2>訂正・ご要望</h2>
      <p>掲載情報の訂正やサイトへのご要望は、<a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">Xの@itsrun_page</a>までお寄せください。</p>
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
.public-info-page { max-width: 820px; padding-block: 36px 56px; }
.page-eyebrow { margin-bottom: 4px; color: #3f51b5; font-size: 12px; font-weight: 800; letter-spacing: .14em; }
h1 { margin: 0 0 14px; font-size: clamp(30px, 5vw, 42px); }
h2 { margin: 30px 0 8px; font-size: 21px; }
.lead { font-size: 17px; line-height: 1.7; }
.status-explanation { margin: 0; border-top: 1px solid #d9dce8; }
.status-explanation div { display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid #d9dce8; }
.status-explanation dt { font-weight: 700; }.status-explanation dd { margin: 0; }
.primary-page-action { min-height: 44px; color: white !important; }
@media (max-width: 599px) { .public-info-page { padding: 24px 16px 40px; }.status-explanation div { grid-template-columns: 1fr; gap: 3px; } }
</style>
