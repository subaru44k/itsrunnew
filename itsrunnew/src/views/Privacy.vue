<template>
  <v-container class="public-info-page">
    <article v-if="isEnglish">
      <p class="page-eyebrow">PRIVACY</p>
      <h1>Privacy policy</h1>
      <p>ItsRun is operated by the ItsRun operator. This policy explains how information is handled on this website.</p>

      <h2>Google Analytics</h2>
      <p>With your permission, ItsRun uses Google Analytics 4 to understand aggregate usage and improve the Track Finder. Google may collect cookie identifiers, device and browser information, approximate location derived from an IP address, and interaction data. ItsRun does not send your browser geolocation coordinates to Google Analytics.</p>
      <p>You can decline analytics without losing any Track Finder functionality, and change your choice at any time using “Analytics settings” in the footer. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a> for Google's processing.</p>

      <h2>Pace table settings</h2>
      <p>The pace table saves the last valid finish time or pace in this browser's localStorage. No account is needed. Use “Reset settings” on the pace table to remove the saved value. Shared links contain the selected time or pace; anyone with the link can view that plan. Images are generated in your browser.</p>

      <h2>On-site reports</h2>
      <p>Anonymous reports publish the facility, Japan date, use outcome, optional comment and submission time. Please do not include personal information. Reports are retained for up to one year to improve facility information; inappropriate reports may be hidden. Contact the operator below with the facility, date and submission time to request removal.</p>
      <p>To limit abuse, a random browser ID is stored in localStorage. The API receives your IP address but stores only daily keyed hashes of the IP and browser ID in short-lived rate-limit records (about two days, followed by database expiry processing). These identifiers are not attached to public reports. AWS processes API traffic. With analytics consent, form views, starts and successful submissions are measured without comments or anonymous identifiers.</p>

      <h2>Geolocation</h2>
      <p>Your browser asks permission before location access. Coordinates are used in the browser to calculate straight-line distances and move the map. ItsRun does not send or store those coordinates on its own server.</p>

      <h2>Advertising</h2>
      <p>ItsRun uses Google AdSense. Google and its advertising partners may use cookies or similar technologies and process device, browser, approximate location, and interaction information to select, deliver, and measure personalized or non-personalized advertising.</p>
      <p>Google's consent management platform (CMP) manages advertising and cookie choices where applicable. It is separate from the ItsRun analytics preference above. You can revisit advertising consent from “Privacy and cookie settings” in the footer. See <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">how Google uses information from sites that use its services</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a>.</p>

      <h2>External services and links</h2>
      <p>The search map uses OpenStreetMap tiles. The map provider receives your IP address and requests corresponding to the area shown. Official facility pages and Google Maps directions open as external services and are governed by their respective policies.</p>

      <h2>Contact</h2>
      <p>For privacy questions or corrections, contact <a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">@itsrun_page on X</a>. No personal name is published.</p>
      <p class="updated">Last updated: 16 September 2026</p>
    </article>

    <article v-else>
      <p class="page-eyebrow">PRIVACY</p>
      <h1>プライバシーポリシー</h1>
      <p>いつラン運営者（以下「運営者」）は、いつランにおける情報の取扱いについて、以下のとおり定めます。</p>

      <h2>Google Analytics</h2>
      <p>いつランでは、利用者が同意した場合に限り、トラック検索の利用状況を集計し改善するためGoogle Analytics 4を使用します。GoogleはCookie識別子、端末・ブラウザ情報、IPアドレスから推定されるおおよその地域、操作情報等を取得する場合があります。ブラウザから取得した現在地の緯度・経度をGoogle Analyticsへ送信することはありません。</p>
      <p>アクセス解析を拒否しても、トラック検索の機能はすべて利用できます。選択はフッターの「アクセス解析の設定」からいつでも変更できます。Googleによる情報の取扱いは、<a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener">Googleプライバシーポリシー</a>をご確認ください。</p>

      <h2>ペース表の設定</h2>
      <p>ペース表では、最後に入力した有効な目標タイムまたはペースを、このブラウザのlocalStorageに保存します。会員登録は不要で、ペース表の「設定をリセット」から保存値を削除できます。共有リンクには選択したタイムまたはペースが含まれ、リンクを知る人が同じ表を表示できます。画像はブラウザ内で生成します。</p>

      <h2>現地レポート</h2>
      <p>匿名の現地レポートでは、施設、対象日（日本時間）、利用結果、任意コメント、投稿時刻を公開します。個人情報は記入しないでください。施設情報の改善のため最長1年間保存し、不適切な投稿は非表示にする場合があります。削除のご希望は、施設・対象日・投稿時刻を添えて下記窓口へご連絡ください。</p>
      <p>不正投稿の防止のため、このブラウザのlocalStorageにランダムな匿名IDを保存します。APIはIPアドレスを受信しますが、投稿制限用にはIPと匿名IDを日ごとの鍵付きハッシュに変換した値のみを約2日間（その後、データベースの期限切れ処理まで）保存し、公開レポートには付けません。API通信はAWSが処理します。アクセス解析に同意した場合、投稿フォームの表示・操作開始・投稿完了を計測しますが、コメントや匿名識別子は解析へ送りません。</p>

      <h2>現在地情報</h2>
      <p>現在地は利用者がブラウザ上で許可した場合のみ取得します。緯度・経度はブラウザ内で直線距離の計算と地図移動に利用し、いつラン独自のサーバーへ送信・保存しません。</p>

      <h2>広告</h2>
      <p>いつランではGoogle AdSenseを利用します。Googleおよび広告配信事業者は、パーソナライズ広告または非パーソナライズ広告の選定、配信、効果測定のため、Cookie等の技術を使用し、端末・ブラウザ情報、IPアドレスから推定されるおおよその地域、操作情報等を取り扱う場合があります。</p>
      <p>広告・Cookieに関する選択が必要な地域では、Googleの同意管理プラットフォーム（CMP）を使用します。この選択は、上記のいつラン独自のアクセス解析設定とは別に管理されます。フッターの「プライバシーとCookieの設定」から広告の同意内容を再確認・変更できます。Googleによる情報の利用については、<a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener">Googleのサービスを使用するサイトやアプリから収集した情報の利用</a>および<a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener">Googleプライバシーポリシー</a>をご確認ください。</p>

      <h2>外部サービス・外部リンク</h2>
      <p>検索地図にはOpenStreetMapのタイルを使用します。地図配信元にはIPアドレスと表示範囲に対応するリクエストが届きます。施設公式サイトやGoogle Mapsの経路検索は外部サービスとして開き、それぞれのサービスの方針が適用されます。</p>

      <h2>お問い合わせ</h2>
      <p>プライバシーに関するお問い合わせや掲載情報の訂正は、<a href="https://twitter.com/itsrun_page" target="_blank" rel="noopener">Xの@itsrun_page</a>へご連絡ください。個人名は公開していません。</p>
      <p class="updated">制定・最終更新：2026年9月16日</p>
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
