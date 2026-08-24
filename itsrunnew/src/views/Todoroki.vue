<template>
  <v-container>
    <div class="d-flex justify-center flex-wrap">
      <div class="flex-grow-1">
        <p class="display-1">{{ $t("todoroki.open_title") }}</p>
        <p class="headline">{{ $t("todoroki.available") }}</p>
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
            <p class="display-1">{{ $t("todoroki.info_title") }}</p>
            <p class="headline">{{ $t("todoroki.official_name") }}</p>
            <div v-if="rendered" class="d-flex justify-center">
              <div class="d-sm-none flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004" width="330" height="300" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
              <div class="d-none d-sm-block flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3244.666567187979!2d139.64847281502654!3d35.58662084276266!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018f50ab35bb61b%3A0xb861571ec1e0f177!2z44CSMjExLTAwNTIg56We5aWI5bed55yM5bed5bSO5biC5Lit5Y6f5Yy6562J44CF5Yqb77yR4oiS77yR!5e0!3m2!1sja!2sjp!4v1527175366004" width="800" height="600" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
            </div>
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
