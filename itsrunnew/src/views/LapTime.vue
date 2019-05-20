<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <v-card class="mb-3">
          <v-container>
            <p class="display-1">{{ $t('pacetable.marathon_title') }}</p>
            <v-layout justify-center>
              <v-flex>
                <v-select
                :items="items"
                :label="$t('pacetable.personal_goal')"
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
    return [this.$t('pacetable.from_2hours').toString(), this.$t('pacetable.from_3hourshalf').toString(), this.$t('pacetable.from_5hours').toString()]
  }

  get targetTime() {
    return this.items[this.$store.state.targetTimeIndex];
  }

  set targetTime(value) {
    this.$store.dispatch('changeTargetTime', this.items.indexOf(value));
  }
}
</script>
