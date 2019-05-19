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
    return [
    '9:00-12:00',
    '13:00-17:00',
    '18:00-21:00',
    ]
  }


  get dates() {
    return ['5/16', '5/17', '5/18', '5/19', '5/20', '5/21', '5/16']
  }

  get statuses() {
    return [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
    ]
  }
}
</script>