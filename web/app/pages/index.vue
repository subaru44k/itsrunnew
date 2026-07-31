<script setup lang="ts">
useSeoMeta({ title: () => $t('homeTitle'), description: () => $t('homeDescription') })
const { t: $t } = useI18n()
</script>

<template>
  <section class="hero" aria-labelledby="home-title">
    <p class="eyebrow">{{ $t('siteName') }}</p>
    <h1 id="home-title">{{ $t('homeTitle') }}</h1>
    <p>{{ $t('homeDescription') }}</p>
    <NuxtLink class="button" :to="useLocalePath()('/yumenoshima')">{{ $t('nav.yumenoshima') }}</NuxtLink>
  </section>
</template>
