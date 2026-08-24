<template>
  <td class="status-cell">
    <img :src="iconPath" :alt="altText">
  </td>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ condstatus: number }>();
const { locale } = useI18n();
const iconPath = computed(() => {
  if (props.condstatus === 1) return locale.value === 'ja' ? '/img/circle.svg' : '/img/done.svg';
  if (props.condstatus === 2) return locale.value === 'ja' ? '/img/remove.svg' : '/img/border.svg';
  return '/img/unknown.svg';
});
const altText = computed(() => props.condstatus === 1 ? 'available' : props.condstatus === 2 ? 'unavailable' : 'no data');
</script>

<style scoped>
.status-cell { text-align: center; vertical-align: middle; }
.status-cell img { width: 24px; height: 24px; }
</style>
