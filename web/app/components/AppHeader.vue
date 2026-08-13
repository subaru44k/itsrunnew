<template><header class="site-header"><div class="toolbar"><NuxtLink class="brand" :to="localePath('/')">{{ $t('siteName') }}</NuxtLink><button class="menu-toggle" type="button" :aria-expanded="open" aria-controls="primary-nav" @click="open = !open">☰<span class="sr-only">{{ $t('nav.menu') }}</span></button></div><nav id="primary-nav" :class="['primary-nav', { 'is-open': open }]" aria-label="Primary navigation"><ul class="nav-list"><li v-for="item in links" :key="item.to"><NuxtLink :to="localePath(item.to)" @click="open = false">{{ $t(item.label) }}</NuxtLink></li></ul></nav><div class="language-switcher" aria-label="Language"><NuxtLink class="locale-action" :to="switchLocalePath('ja')">日本語</NuxtLink><NuxtLink class="locale-action" :to="switchLocalePath('en')">English</NuxtLink></div></header></template>

<script setup lang="ts">
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const open = ref(false)
const links = [
  { to: '/', label: 'nav.home' },
  { to: '/yumenoshima', label: 'nav.yumenoshima' },
  { to: '/komazawa', label: 'nav.komazawa' },
  { to: '/todoroki', label: 'nav.todoroki' },
  { to: '/pace/marathon', label: 'nav.pace' },
  { to: '/nozomiantena', label: 'nav.records' },
]
onMounted(() => window.addEventListener('keydown', (event) => { if (event.key === 'Escape') open.value = false }))
</script>
