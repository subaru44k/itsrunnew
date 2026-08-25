<template>
  <v-container class="public-info-page">
    <article v-if="isEnglish">
      <p class="page-eyebrow">PRIVACY</p>
      <h1>Privacy policy</h1>
      <p>ItsRun is operated by the ItsRun operator. This policy explains how information is handled on this website.</p>

      <h2>Google Analytics</h2>
      <p>With your permission, ItsRun uses Google Analytics 4 to understand aggregate usage and improve the Track Finder. Google may collect cookie identifiers, device and browser information, approximate location derived from an IP address, and interaction data. ItsRun does not send your browser geolocation coordinates to Google Analytics.</p>
      <p>You can decline analytics without losing any Track Finder functionality, and change your choice at any time using “Analytics settings” in the footer. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a> for Google's processing.</p>

      <h2>Geolocation</h2>
      <p>Your browser asks permission before location access. Coordinates are used in the browser to calculate straight-line distances and move the map. ItsRun does not send or store those coordinates on its own server.</p>

      <h2>Advertising</h2>
      <p>Advertising is currently disabled. The site retains its AdSense publisher record and ads.txt file, but does not load advertising scripts or ad units. This policy and consent controls will be reviewed before advertising is enabled.</p>

      <h2>External services and links</h2>
      <p>The map uses OpenStreetMap tiles. Official facility pages and Google Maps directions open as external services and are governed by their respective policies.</p>

      <h2>Contact</h2>
      <p>For privacy questions or corrections, contact <a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">@itsrun_page on X</a>. No personal name is published.</p>
      <p class="updated">Last updated: 25 August 2026</p>
    </article>

    <article v-else>
      <p class="page-eyebrow">PRIVACY</p>
      <h1>プライバシーポリシー</h1>
      <p>いつラン運営者（以下「運営者」）は、いつランにおける情報の取扱いについて、以下のとおり定めます。</p>

      <h2>Google Analytics</h2>
      <p>いつランでは、利用者が同意した場合に限り、トラック検索の利用状況を集計し改善するためGoogle Analytics 4を使用します。GoogleはCookie識別子、端末・ブラウザ情報、IPアドレスから推定されるおおよその地域、操作情報等を取得する場合があります。ブラウザから取得した現在地の緯度・経度をGoogle Analyticsへ送信することはありません。</p>
      <p>アクセス解析を拒否しても、トラック検索の機能はすべて利用できます。選択はフッターの「アクセス解析の設定」からいつでも変更できます。Googleによる情報の取扱いは、<a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener">Googleプライバシーポリシー</a>をご確認ください。</p>

      <h2>現在地情報</h2>
      <p>現在地は利用者がブラウザ上で許可した場合のみ取得します。緯度・経度はブラウザ内で直線距離の計算と地図移動に利用し、いつラン独自のサーバーへ送信・保存しません。</p>

      <h2>広告</h2>
      <p>現在、広告配信は停止しています。AdSenseのサイト登録とads.txtは維持していますが、広告スクリプトおよび広告枠は読み込みません。広告を再開する場合は、本方針と同意管理をあらためて確認・更新します。</p>

      <h2>外部サービス・外部リンク</h2>
      <p>地図にはOpenStreetMapのタイルを使用します。施設公式サイトやGoogle Mapsの経路検索は外部サービスとして開き、それぞれのサービスの方針が適用されます。</p>

      <h2>お問い合わせ</h2>
      <p>プライバシーに関するお問い合わせや掲載情報の訂正は、<a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">Xの@itsrun_page</a>へご連絡ください。個人名は公開していません。</p>
      <p class="updated">制定・最終更新：2026年8月25日</p>
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
.updated { margin-top: 36px; color: #666; font-size: 13px; }
@media (max-width: 599px) { .public-info-page { padding: 24px 16px 40px; } }
</style>
