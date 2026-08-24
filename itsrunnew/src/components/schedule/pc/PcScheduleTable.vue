<template>
  <v-container>
    <table class="table table-bordered">
      <tbody>
        <tr><td /><td v-for="slot in store.timeRange" :key="slot" class="title">{{ slot }}</td></tr>
        <tr v-for="(date, index) in store.dateList" :key="date">
          <td class="title">{{ date }}</td>
          <ConditionalStatus v-for="column in 3" :key="column" :condstatus="store.statusArray[index][column - 1]" />
        </tr>
      </tbody>
    </table>
  </v-container>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store';
import ConditionalStatus from '@/components/schedule/ConditionalStatus.vue';
const store = useAppStore();
</script>
