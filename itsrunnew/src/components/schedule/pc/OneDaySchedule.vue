<template>
  <tr>
    <td class="headline">{{ date }}</td>
    <ConditionalStatus v-bind:condstatus="onedaystatus[0]"/>
    <ConditionalStatus v-bind:condstatus="onedaystatus[1]"/>
    <ConditionalStatus v-bind:condstatus="onedaystatus[2]"/>
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
    onedaystatus: Array,
  }
})
export default class OneDaySchedule extends Vue {}
</script>
