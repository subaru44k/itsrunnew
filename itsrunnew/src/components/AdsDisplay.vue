<template>
  <ins
    class="adsbygoogle"
    style="display:block"
    data-ad-client="ca-pub-7941378059940304"
    :data-ad-slot="slot"
    data-ad-format="auto"
    data-full-width-responsive="true"
  />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
defineProps<{ slot: string }>();
onMounted(() => {
  if (!document.querySelector('script[data-itsrun-adsense]')) {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7941378059940304';
    script.dataset.itsrunAdsense = 'true';
    document.head.appendChild(script);
  }
  try {
    ((window as Window & { adsbygoogle?: unknown[] }).adsbygoogle ??= []).push({});
  } catch {
    // Ad blockers and unapproved preview domains can reject ad initialization.
  }
});
</script>
