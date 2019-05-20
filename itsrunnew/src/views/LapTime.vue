<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <v-card class="mb-3">
          <v-container>
            <p class="display-1">マラソンのラップタイム</p>
            <v-layout justify-center>
              <v-flex>
                <v-select
                :items="items"
                label="目標タイム"
                v-model="targetTime"
                ></v-select>
              </v-flex>
            </v-layout>
            <v-layout>
              <v-flex hidden-sm-and-up>
                <PhonePaceTable></PhonePaceTable>
              </v-flex>
              <v-flex hidden-xs-only>
                <PcPaceTable></PcPaceTable>
              </v-flex>
            </v-layout>
          </v-container>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import PhonePaceTable from '@/components/laptime/PhonePaceTable.vue';
import PcPaceTable from '@/components/laptime/PcPaceTable.vue';

@Component({
  components: {
    PhonePaceTable,
    PcPaceTable,
  },
})
export default class OdaField extends Vue {
  get items(): string[] {
    return ['2時間〜3時間半', '3時間半〜5時間', '5時間〜6時間半']
  }

  get targetTime() {
    return this.items[this.$store.state.targetTimeIndex];
  }

  set targetTime(value) {
    this.$store.dispatch('changeTargetTime', this.items.indexOf(value));
  }
}
</script>
