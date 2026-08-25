<template>
  <ins
    v-if="advertisingReady"
    class="adsbygoogle"
    style="display:block"
    data-ad-client="ca-pub-7941378059940304"
    :data-ad-slot="slot"
    data-ad-format="auto"
    data-full-width-responsive="true"
  />
</template>

<script setup lang="ts">
import { nextTick, watch } from 'vue';
import { advertisingReady } from '@/services/advertising';
defineProps<{ slot: string }>();
watch(advertisingReady, async ready => {
  if (!ready) return;
  await nextTick();
  try {
    ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle ??= []).push({});
  } catch {
    // Ad blockers and unapproved preview domains can reject ad initialization.
  }
}, { immediate: true });
</script>
