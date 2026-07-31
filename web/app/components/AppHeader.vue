<template>
  <header class="site-header">
    <NuxtLink class="brand" :to="localePath('/')">{{ $t('siteName') }}</NuxtLink>
    <nav aria-label="Primary navigation">
      <ul class="nav-list">
        <li v-for="item in links" :key="item.to"><NuxtLink :to="localePath(item.to)">{{ $t(item.label) }}</NuxtLink></li>
      </ul>
    </nav>
    <div class="language-switcher" aria-label="Language">
      <NuxtLink :to="switchLocalePath('ja')">日本語</NuxtLink>
      <NuxtLink :to="switchLocalePath('en')">English</NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const links = [
  { to: '/', label: 'nav.home' },
  { to: '/yumenoshima', label: 'nav.yumenoshima' },
  { to: '/komazawa', label: 'nav.komazawa' },
  { to: '/todoroki', label: 'nav.todoroki' },
  { to: '/pace/marathon', label: 'nav.pace' },
]
</script>
