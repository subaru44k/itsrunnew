<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <p class="display-1">{{ $t("todoroki.open_title") }}</p>
        <p class="headline">{{ $t("todoroki.available") }}</p>
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
        <v-card class="mb-3">
          <v-container>
            <p class="display-1">{{ $t("todoroki.info_title") }}</p>
            <p class="headline">{{ $t("todoroki.official_name") }}</p>
            <v-layout justify-center row>
              <v-flex hidden-sm-and-up shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004" width="330" height="300" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
              <v-flex hidden-xs-only shrink>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004" width="800" height="600" frameborder="0" style="border:0" allowfullscreen=""></iframe>
              </v-flex>
            </v-layout>
            <div class="headline mt-3 mb-2">{{ $t("todoroki.access_title") }}</div>
            <div class="subheading">{{ $t("todoroki.access_1") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("todoroki.opinion_title") }}</div>
            <div class="subheading">
              {{ $t("todoroki.opinion_1")}}
              <br>
              {{ $t("todoroki.opinion_2")}}
            </div>
          </v-container>
        </v-card>
        <Adsense style="display:block" data-ad-client="ca-pub-7941378059940304" data-ad-slot="6031307376" data-ad-format="auto" data-full-width-responsive="true">
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
  mounted() {
    this.$store.dispatch('retrieveScheduleData', '67c7uxgRWDkxr1S4gPaR');
  }
}
</script>
