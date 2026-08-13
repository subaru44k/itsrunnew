<template><header class="site-header"><div class="toolbar"><NuxtLink class="brand" :to="localePath('/')">{{ $t('siteName') }}</NuxtLink><button class="menu-toggle" type="button" :aria-expanded="open" aria-controls="primary-nav" @click="toggle">☰<span class="sr-only">{{ $t('nav.menu') }}</span></button></div><nav id="primary-nav" :class="['primary-nav', { 'is-open': open }]" aria-label="Primary navigation"><ul class="nav-groups"><li v-for="group in groups" :key="group.label" class="nav-group"><details><summary>{{ $t(group.label) }}</summary><ul><li v-for="item in group.links" :key="item.to"><NuxtLink :to="localePath(item.to)" @click="close">{{ $t(item.label) }}</NuxtLink></li></ul></details></li></ul></nav><div class="language-switcher" aria-label="Language"><NuxtLink class="locale-action" :to="switchLocalePath(locale === 'ja' ? 'en' : 'ja')" @click="close">{{ locale === 'ja' ? 'English' : '日本語' }}</NuxtLink></div></header></template>

<script setup lang="ts">
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale, t: $t } = useI18n()
const open = ref(false)
const groups = [
  { label: 'nav.tokyo', links: [{ to: '/', label: 'nav.home' }, { to: '/yumenoshima', label: 'nav.yumenoshima' }, { to: '/komazawa', label: 'nav.komazawa' }] },
  { label: 'nav.kanagawa', links: [{ to: '/todoroki', label: 'nav.todoroki' }] },
  { label: 'nav.lap', links: [{ to: '/pace/marathon', label: 'nav.pace' }] },
  { label: 'nav.recordsGroup', links: [{ to: '/nozomiantena', label: 'nav.records' }] },
]
const close = () => { open.value = false }
const toggle = () => { open.value = !open.value }
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
