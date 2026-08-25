<template>
  <v-container class="public-info-page">
    <article v-if="isEnglish">
      <p class="page-eyebrow">ABOUT ITSRUN</p><h1>About ItsRun</h1>
      <p class="lead">ItsRun is an independent site with practical tools and reference information for runners.</p>
      <h2>What you can use</h2>
      <ul>
        <li><strong>Track Finder:</strong> compare {{ tracks.length }} verified facilities by date, location, availability, and track conditions.</li>
        <li><strong>Venue guides:</strong> reference pages for Oda Field and other major athletics venues.</li>
        <li><strong>Marathon pace table:</strong> calculate target splits for a marathon.</li>
        <li><strong>Records:</strong> browse the site’s athletics results archive.</li>
      </ul>
      <p><router-link to="/en/tracks/guide">Read the Track Finder guide</router-link> for availability meanings and search instructions.</p>
      <h2>Editorial policy</h2><p>Facility data is checked against municipalities, venue operators, and other official primary sources. Unknown values are not guessed. ItsRun is not operated by a municipality or sports facility, and schedules can change after they are checked.</p>
      <h2>Corrections and requests</h2><p>To report outdated information or request an improvement, contact <a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">@itsrun_page on X</a>.</p>
      <v-btn class="primary-page-action" color="indigo" variant="flat" to="/en/">Open Track Finder</v-btn>
    </article>
    <article v-else>
      <p class="page-eyebrow">ABOUT ITSRUN</p><h1>いつランについて</h1>
      <p class="lead">いつランは、ランナーの練習や観戦に役立つツールと情報を提供する独立したWebサイトです。</p>
      <h2>主なコンテンツ</h2>
      <ul>
        <li><strong>トラック検索：</strong>公式情報を確認した{{ tracks.length }}施設を、日付、場所、利用状況、トラック条件から比較できます。</li>
        <li><strong>競技場情報：</strong>織田フィールドなど、主要な陸上競技場の案内を掲載しています。</li>
        <li><strong>マラソンペース表：</strong>目標タイムに応じたラップタイムを計算できます。</li>
        <li><strong>記録集：</strong>陸上競技の大会結果をまとめています。</li>
      </ul>
      <p>検索方法や「要確認」の意味は、<router-link to="/tracks/guide">トラック検索の使い方</router-link>をご覧ください。</p>
      <h2>情報掲載の方針</h2><p>施設情報は自治体、施設、指定管理者などの公式一次情報をもとに確認し、不明な値は推測しません。いつランは自治体や施設が運営する公式サービスではなく、確認後に予定が変更される場合もあります。</p>
      <h2>訂正・ご要望</h2><p>掲載情報の訂正やサイトへのご要望は、<a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">Xの@itsrun_page</a>までお寄せください。</p>
      <v-btn class="primary-page-action" color="indigo" variant="flat" to="/">トラックを探す</v-btn>
    </article>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { tracks } from '../model/tracks';
const { locale } = useI18n();
const isEnglish = computed(() => locale.value === 'en');
</script>

<style scoped>
.public-info-page { max-width: 820px; padding-block: 36px 56px; }.page-eyebrow { margin-bottom: 4px; color: #3f51b5; font-size: 12px; font-weight: 800; letter-spacing: .14em; }h1 { margin: 0 0 14px; font-size: clamp(30px, 5vw, 42px); }h2 { margin: 30px 0 8px; font-size: 21px; }.lead { font-size: 17px; line-height: 1.7; }li { margin-bottom: 8px; }.primary-page-action { min-height: 44px; color: white !important; }@media (max-width: 599px) { .public-info-page { padding: 24px 16px 40px; } }
</style>
