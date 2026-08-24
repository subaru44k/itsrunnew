<template>
  <v-container class="pb-0">
    <div class="d-flex justify-center ga-2">
      <v-btn color="primary" icon="mdi-chevron-left" size="small" aria-label="Previous week" @click="store.previousWeek" />
      <v-btn color="primary" icon="mdi-chevron-right" size="small" aria-label="Next week" @click="store.nextWeek" />
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { useAppStore } from '@/store';
const store = useAppStore();
</script>
