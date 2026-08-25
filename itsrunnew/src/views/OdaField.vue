<template>
  <v-container>
    <div class="d-flex justify-center flex-wrap">
      <div class="flex-grow-1">
        <p class="display-1">{{ $t("oda.open_title") }}</p>
        <p class="headline">{{ $t("oda.available") }}</p>
        <AdsDisplay slot="6879016191" />
        <v-card class="mt-3 mb-3">
          <Pagination></Pagination>
          <div class="d-flex">
            <div class="d-sm-none flex-grow-1">
              <SpScheduleTable></SpScheduleTable>
            </div>
            <div class="d-none d-sm-block flex-grow-1">
              <PcScheduleTable></PcScheduleTable>
            </div>
          </div>
        </v-card>
        <v-card class="mb-3">
          <v-container>
            <p class="display-1">{{ $t("oda.info_title") }}</p>
            <p class="headline">{{ $t("oda.official_name") }}</p>
            <div v-if="rendered" class="d-flex justify-center">
              <div class="d-sm-none flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="330" height="300" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
              <div class="d-none d-sm-block flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4061911644067!2d139.69173161501527!3d35.66699913836023!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188cad8ba1d227%3A0x8b5756b02932d0b1!2z5Luj44CF5pyo5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sjp!4v1526609293873" width="800" height="600" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
            </div>
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
        <AdsDisplay slot="6031307376" />
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import PcScheduleTable from '@/components/schedule/pc/PcScheduleTable.vue';
import SpScheduleTable from '@/components/schedule/sp/SpScheduleTable.vue';
import Pagination from '@/components/schedule/Pagination.vue';
import AdsDisplay from '@/components/AdsDisplay.vue';
const rendered = true;
</script>
