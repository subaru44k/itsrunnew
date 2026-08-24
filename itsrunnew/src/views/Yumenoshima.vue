<template>
  <v-container>
    <div class="d-flex justify-center flex-wrap">
      <div class="flex-grow-1">
        <p class="display-1">{{ $t("yume.open_title") }}</p>
        <p class="headline">{{ $t("yume.available") }}</p>
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
            <p class="display-1">{{ $t("yume.info_title") }}</p>
            <p class="headline">{{ $t("yume.official_name") }}</p>
            <div v-if="rendered" class="d-flex justify-center">
              <div class="d-sm-none flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.198853620734!2d139.82042951502805!3d35.6474720394305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188830ec82b0eb%3A0x38e551d88d939e11!2z44CSMTM2LTAwODEg5p2x5Lqs6YO95rGf5p2x5Yy65aSi44Gu5bO277yR5LiB55uu77yR4oiS77yS!5e0!3m2!1sja!2sjp!4v1527175702727" width="330" height="300" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
              <div class="d-none d-sm-block flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.198853620734!2d139.82042951502805!3d35.6474720394305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188830ec82b0eb%3A0x38e551d88d939e11!2z44CSMTM2LTAwODEg5p2x5Lqs6YO95rGf5p2x5Yy65aSi44Gu5bO277yR5LiB55uu77yR4oiS77yS!5e0!3m2!1sja!2sjp!4v1527175702727" width="800" height="600" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
            </div>
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
