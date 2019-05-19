<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="display-1">織田フィールド 開放日</p>
        <p class="headline">織田フィールドの個人利用可能時間は以下の通りです。</p>
        <Adsense data-ad-client="ca-pub-7941378059940304" data-ad-slot="6879016191">
        </Adsense>
        <Pagination></Pagination>
        <v-layout>
          <v-flex hidden-sm-and-up>
            <SpScheduleTable></SpScheduleTable>
          </v-flex>
          <v-flex hidden-xs-only>
            <PcScheduleTable></PcScheduleTable>
          </v-flex>
        </v-layout>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import PcScheduleTable from '@/components/schedule/pc/PcScheduleTable.vue'; // @ is an alias to /src
import SpScheduleTable from '@/components/schedule/sp/SpScheduleTable.vue'; // @ is an alias to /src
import Pagination from '@/components/schedule/Pagination.vue';
import Ads from 'vue-google-adsense';

@Component({
  components: {
    SpScheduleTable,
    PcScheduleTable,
    Pagination,
    Ads,
  },
})
export default class Home extends Vue {
  mounted() {
    this.$store.dispatch('retrieveScheduleData', 'nVfuSmsj9cULg3712chv');
  }
}
</script>
