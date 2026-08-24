<template>
  <v-container>
    <div class="d-flex justify-center flex-wrap">
      <div class="flex-grow-1">
        <v-card class="mb-3">
          <v-container>
            <p class="display-1">{{ $t('pacetable.marathon_title') }}</p>
            <div class="d-flex justify-center">
              <div class="flex-grow-1">
                <v-select
                :items="items"
                :label="$t('pacetable.personal_goal')"
                v-model="targetTime"
                ></v-select>
              </div>
            </div>
            <div class="d-flex">
              <div class="d-sm-none flex-grow-1">
                <PhonePaceTable></PhonePaceTable>
              </div>
              <div class="d-none d-sm-block flex-grow-1">
                <PcPaceTable></PcPaceTable>
              </div>
            </div>
          </v-container>
        </v-card>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import PhonePaceTable from '@/components/laptime/PhonePaceTable.vue';
import PcPaceTable from '@/components/laptime/PcPaceTable.vue';
import { useAppStore } from '@/store';
const store = useAppStore();
const { t } = useI18n();
const items = computed(() => [t('pacetable.from_2hours'), t('pacetable.from_3hourshalf'), t('pacetable.from_5hours')]);
const targetTime = computed({
  get: () => items.value[store.targetTimeIndex],
  set: (value: string) => store.changeTargetTime(items.value.indexOf(value)),
});
</script>
