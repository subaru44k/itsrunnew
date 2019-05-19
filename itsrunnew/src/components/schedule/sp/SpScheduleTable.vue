<template>
  <v-container>
    <v-layout
      wrap
    >
      <v-flex grow>
        <table class="table table-bordered">
          <tbody>
            <template v-for="(date, index) in dates">
              <OneDayScheduleFirst v-bind:key="index + 10" v-bind:date="date" v-bind:timeSlot="timeSlots[0]" v-bind:status="statuses[index][0]"/>
              <OneDayScheduleSecond v-bind:key="index + 20" v-bind:date="date" v-bind:timeSlot="timeSlots[1]" v-bind:status="statuses[index][1]"/>
              <OneDayScheduleThird v-bind:key="index + 30" v-bind:date="date" v-bind:timeSlot="timeSlots[2]" v-bind:status="statuses[index][2]"/>
            </template>
          </tbody>
        </table>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component';
import OneDayScheduleFirst from '@/components/schedule/sp/OneDayScheduleFirst.vue';
import OneDayScheduleSecond from '@/components/schedule/sp/OneDayScheduleSecond.vue';
import OneDayScheduleThird from '@/components/schedule/sp/OneDayScheduleThird.vue';

@Component({
  components: {
    OneDayScheduleFirst,
    OneDayScheduleSecond,
    OneDayScheduleThird,
  },
})
export default class SpScheduleTable extends Vue {
  get timeSlots() {
    return this.$store.state.timeRange;
  }

  get dates() {
    return this.$store.state.dateList;
  }

  get statuses() {
    return this.$store.state.statusArray;
  }
}
</script>