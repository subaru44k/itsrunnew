<template>
  <v-container class="not-found-page">
    <h1>{{ isEnglish ? 'Page not found' : 'ページが見つかりません' }}</h1>
    <p>{{ isEnglish ? 'The address may be incorrect, or the page may have moved.' : 'URLが正しくないか、ページが移動した可能性があります。' }}</p>
    <v-btn color="indigo" variant="flat" :to="isEnglish ? '/en/' : '/'">
      {{ isEnglish ? 'Open Track Finder' : 'トラック検索へ戻る' }}
    </v-btn>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isEnglish = computed(() => route.path.startsWith('/en/'));
</script>

<style scoped>
.not-found-page { max-width: 720px; min-height: 55vh; padding-block: 72px; text-align: center; }
.not-found-page h1 { margin-bottom: 12px; font-size: clamp(28px, 5vw, 40px); }
</style>
