<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="display-1">{{ $t("yume.open_title") }}</p>
        <p class="headline">{{ $t("yume.available") }}</p>
        <Adsense data-ad-client="ca-pub-7941378059940304" data-ad-slot="6879016191">
        </Adsense>
        <v-card class="mb-3">
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
            <p class="display-1">{{ $t("yume.info_title") }}</p>
            <p class="headline">{{ $t("yume.official_name") }}</p>
            <v-layout justify-center row>
              <v-flex hidden-sm-and-up shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="330" height="300" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
              <v-flex hidden-xs-only shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="800" height="600" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
            </v-layout>
            <div class="headline mt-3 mb-2">{{ $t("yume.access_title") }}</div>
            <div class="subheading">{{ $t("yume.access_1") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("yume.contact") }}</div>
            <div class="subheading">{{ $t("yume.contact_1") }}</div>
            <div class="subheading">{{ $t("yume.tel") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("yume.opinion_title") }}</div>
            <div class="subheading">
              {{ $t("yume.opinion_1")}}
              <br>
              {{ $t("yume.opinion_2")}}
              <br>
              {{ $t("yume.opinion_3")}}
            </div>
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
    this.$store.dispatch('retrieveScheduleData', 'VFurPbbeejEbtu1JNTzF');
  }
}
</script>
