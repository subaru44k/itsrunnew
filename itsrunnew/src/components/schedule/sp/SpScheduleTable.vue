<template>
  <v-container>
    <table class="table table-bordered schedule-mobile">
      <colgroup><col class="date-column"><col class="time-column"><col class="status-column"></colgroup>
      <tbody>
        <template v-for="(date, dateIndex) in store.dateList" :key="date">
          <tr v-for="(slot, slotIndex) in store.timeRange" :key="`${date}-${slotIndex}`">
            <td v-if="slotIndex === 0" rowspan="3" class="align-middle title">{{ date }}</td>
            <td class="title">{{ slot }}</td>
            <ConditionalStatus :condstatus="store.statusArray[dateIndex][slotIndex]" />
          </tr>
        </template>
      </tbody>
    </table>
  </v-container>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store';
import ConditionalStatus from '@/components/schedule/ConditionalStatus.vue';
const store = useAppStore();
</script>
