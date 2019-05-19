<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="display-1">{{ $t("oda.open_title") }}</p>
        <p class="headline">{{ $t("oda.available") }}</p>
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
        <p class="display-1">{{ $t("oda.info_title") }}</p>
        <p class="title">{{ $t("oda.official_name") }}</p>
        <v-layout justify-center row>
          <v-flex hidden-sm-and-up shrink>
            <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="330" height="300" frameborder="0" style="border:0" allowfullscreen=""></iframe>
          </v-flex>
          <v-flex hidden-xs-only shrink>
            <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="800" height="600" frameborder="0" style="border:0" allowfullscreen=""></iframe>
          </v-flex>
        </v-layout>
        <div class="title mt-3 mb-2">{{ $t("oda.access_title") }}</div>
        <div class="subheading">{{ $t("oda.access_1") }}</div>
        <div class="subheading">{{ $t("oda.access_2") }}</div>
        <div class="title mt-3 mb-2">{{ $t("oda.contact") }}</div>
        <div class="subheading">{{ $t("oda.contact_1") }}</div>
        <div class="subheading">{{ $t("oda.tel") }}</div>
        <div class="title mt-3 mb-2">{{ $t("oda.opinion_title") }}</div>
        <div class="subheading">
          {{ $t("oda.opinion_1")}}
          <br>
          <br>
          {{ $t("oda.opinion_2")}}
          <br>
          <br>
          {{ $t("oda.opinion_3")}}
          <br>
          <br>
          {{ $t("oda.opinion_4")}}
        </div>
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
