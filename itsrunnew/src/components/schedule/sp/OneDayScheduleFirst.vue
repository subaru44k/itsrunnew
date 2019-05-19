<template>
  <tr>
    <td rowspan="3" class="align-middle headline">{{ date }}</td>
    <td class="title">{{ timeSlot }}</td>
    <ConditionalStatus v-bind:condstatus="status"/>
  </tr>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component';
import ConditionalStatus from '@/components/schedule/ConditionalStatus.vue';

@Component({
  components: {
    ConditionalStatus,
  },
  props: {
    date: String,
    timeSlot: String,
    status: Number,
  }
})
export default class OneDayScheduleFirst extends Vue {}
</script>
