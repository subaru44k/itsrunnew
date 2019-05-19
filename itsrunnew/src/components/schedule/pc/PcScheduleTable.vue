<template>
  <v-container>
    <v-layout
      wrap
    >
      <v-flex grow>
        <table class="table table-bordered">
          <tbody>
            <tr><td></td><td class="title">{{ timeSlots[0] }}</td><td class="title">{{ timeSlots[1] }}</td><td class="title">{{ timeSlots[2] }}</td></tr>
            <OneDaySchedule v-for="(date, index) in dates" v-bind:key="index" v-bind:date="date" v-bind:onedaystatus="statuses[index]"/>
          </tbody>
        </table>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component';
import OneDaySchedule from '@/components/schedule/pc/OneDaySchedule.vue';

@Component({
  components: {
    OneDaySchedule,
  },
})
export default class PcScheduleTable extends Vue {
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