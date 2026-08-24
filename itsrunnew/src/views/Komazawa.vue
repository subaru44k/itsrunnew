<template>
  <v-container>
    <div class="d-flex justify-center flex-wrap">
      <div class="flex-grow-1">
        <p class="display-1">{{ $t("komazawa.open_title") }}</p>
        <p class="headline">{{ $t("komazawa.available") }}</p>
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
            <p class="display-1">{{ $t("komazawa.info_title") }}</p>
            <p class="headline">{{ $t("komazawa.official_name") }}</p>
            <div v-if="rendered" class="d-flex justify-center">
              <div class="d-sm-none flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339" width="330" height="300" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
              <div class="d-none d-sm-block flex-shrink-0">
                <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d12972.346488110566!2d139.663655!3d35.625591!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x21788df8b6ff02d4!2z6aeS5rKi44Kq44Oq44Oz44OU44OD44Kv5YWs5ZySIOmZuOS4iuertuaKgOWgtA!5e0!3m2!1sja!2sus!4v1527932434339" width="800" height="600" class="map-frame" loading="lazy" allowfullscreen></iframe>
              </div>
            </div>
            <div class="headline mt-3 mb-2">{{ $t("komazawa.access_title") }}</div>
            <div class="subheading">{{ $t("komazawa.access_1") }}</div>
            <div class="headline mt-3 mb-2">{{ $t("komazawa.contact") }}</div>
            <div class="subheading">{{ $t("komazawa.contact_1") }}</div>
            <div class="subheading">{{ $t("komazawa.tel") }}</div>
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
