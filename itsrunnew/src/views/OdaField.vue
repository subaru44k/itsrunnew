<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="h3"><a href="https://newyearscardlottery.link/">お年玉付き年賀はがきの当選確認サイト</a>を作りました！</p>
        <p class="h5">スマホで年賀状の写真を撮るだけで、年賀状が当選しているか複数枚同時に確認できます。登録不要で写真をとるだけなので、是非試してみてください。</p>
        <p class="h5 mb-4">ちなみに、2022年の引き換え期限は7/19(火)なので、当たってたらまだまだ交換可能です。</p>
        <p class="display-1">{{ $t("oda.open_title") }}</p>
        <p class="headline">{{ $t("oda.available") }}</p>
        <Adsense v-if="rendered" style="display:block" data-ad-client="ca-pub-7941378059940304" data-ad-slot="6879016191" data-ad-format="auto" data-full-width-responsive="true">
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
        <v-card class="mb-3">
          <v-container>
            <p class="display-1">{{ $t("oda.info_title") }}</p>
            <p class="headline">{{ $t("oda.official_name") }}</p>
            <v-layout v-if="rendered" justify-center row>
              <v-flex hidden-sm-and-up shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="330" height="300" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
              <v-flex hidden-xs-only shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="800" height="600" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
            </v-layout>
            <div class="headline mt-3 mb-2">{{ $t("oda.access_title") }}</div>
            <div class="subheading">{{ $t("oda.access_1") }}</div>
            <div class="subheading">{{ $t("oda.access_2") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("oda.contact") }}</div>
            <div class="subheading">{{ $t("oda.contact_1") }}</div>
            <div class="subheading">{{ $t("oda.tel") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("oda.opinion_title") }}</div>
            <div class="subheading">
              {{ $t("oda.opinion_1")}}
              <br>
              {{ $t("oda.opinion_2")}}
              <br>
              {{ $t("oda.opinion_3")}}
              <br>
              {{ $t("oda.opinion_4")}}
            </div>
          </v-container>
        </v-card>
        <Adsense v-if="rendered" style="display:block" data-ad-client="ca-pub-7941378059940304" data-ad-slot="6031307376" data-ad-format="auto" data-full-width-responsive="true">
        </Adsense>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import PcScheduleTable from '@/components/schedule/pc/PcScheduleTable.vue'; // @ is an alias to /src
import SpScheduleTable from '@/components/schedule/sp/SpScheduleTable.vue'; // @ is an alias to /src
import Pagination from '@/components/schedule/Pagination.vue';

@Component({
  components: {
    SpScheduleTable,
    PcScheduleTable,
    Pagination,
  },
})
export default class OdaField extends Vue {
  private rendered: boolean = false;
  mounted() {
    this.$store.commit('changeStadiumId', 'nVfuSmsj9cULg3712chv');
    this.$store.dispatch('retrieveScheduleData').then(() => {
      this.rendered = true;
    });
  }
}
</script>
