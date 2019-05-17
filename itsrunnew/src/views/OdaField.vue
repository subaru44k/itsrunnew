<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="display-1">織田フィールド 開放日</p>
        <p class="headline">織田フィールドの個人利用可能時間は以下の通りです。</p>
        <Adsense data-ad-client="ca-pub-7941378059940304" data-ad-slot="6879016191">
        </Adsense>
        <HelloWorld></HelloWorld>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import HelloWorld from '@/components/HelloWorld.vue'; // @ is an alias to /src
import Ads from 'vue-google-adsense';

@Component({
  components: {
    HelloWorld,
    Ads,
  },
})
export default class Home extends Vue {}
</script>
