<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="display-1">{{ $t("komazawa.open_title") }}</p>
        <p class="headline">{{ $t("komazawa.available") }}</p>
        <Adsense data-ad-client="ca-pub-7941378059940304" data-ad-slot="6879016191" data-ad-format="auto" data-full-width-responsive="true">
        </Adsense>
        <v-card class="mt-3 mb-3">
          <Pagination></Pagination>
          <v-layout>
            <v-flex hidden-sm-and-up>
              <SpScheduleTable></SpScheduleTable>
            </v-flex>
            <v-flex hidden-xs-only>
              <PcScheduleTable></PcScheduleTable>
            </v-flex>
          </v-layout>
        </v-card>
        <v-card>
          <v-container>
            <p class="display-1">{{ $t("komazawa.info_title") }}</p>
            <p class="headline">{{ $t("komazawa.official_name") }}</p>
            <v-layout justify-center row>
              <v-flex hidden-sm-and-up shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339" width="330" height="300" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
              <v-flex hidden-xs-only shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339" width="800" height="600" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
            </v-layout>
            <div class="headline mt-3 mb-2">{{ $t("komazawa.access_title") }}</div>
            <div class="subheading">{{ $t("komazawa.access_1") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("komazawa.contact") }}</div>
            <div class="subheading">{{ $t("komazawa.contact_1") }}</div>
            <div class="subheading">{{ $t("komazawa.tel") }}</div>
          </v-container>
        </v-card>
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
export default class OdaField extends Vue {
  mounted() {
    this.$store.dispatch('retrieveScheduleData', 'WrrQXe67xvIkGfMtJ51E');
  }
}
</script>
