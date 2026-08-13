<template>
  <header ref="header" class="site-header">
    <div class="toolbar">
      <NuxtLink class="brand" :to="localePath('/')" @click="closeAll">{{ $t('siteName') }}</NuxtLink>
      <button ref="menuButton" class="menu-toggle" type="button" :aria-expanded="drawerOpen" aria-controls="mobile-drawer" @click="toggleDrawer">☰<span class="sr-only">{{ $t('nav.menu') }}</span></button>
    </div>
    <nav class="primary-nav desktop-nav" aria-label="Primary navigation">
      <ul class="nav-groups">
        <li v-for="(group, index) in groups" :key="group.label" class="nav-group">
          <button class="group-trigger" type="button" :aria-expanded="openGroup === index" @click="toggleGroup(index, $event)">{{ $t(group.label) }}</button>
          <ul v-if="openGroup === index" class="group-links">
            <li v-for="item in group.links" :key="item.to"><NuxtLink :to="item.label === 'nav.records' ? recordsPath : localePath(item.to)" @click="closeAll">{{ $t(item.label) }}</NuxtLink></li>
          </ul>
        </li>
      </ul>
      <NuxtLink class="locale-action" :to="switchLocalePath(locale === 'ja' ? 'en' : 'ja')" @click="closeAll">{{ locale === 'ja' ? 'English' : '日本語' }}</NuxtLink>
    </nav>
    <div v-if="drawerOpen" id="mobile-drawer" class="mobile-drawer" role="dialog" aria-modal="true" :aria-label="$t('nav.menu')">
      <button class="drawer-backdrop" type="button" aria-label="Close menu" @click="closeDrawer" />
      <div class="drawer-panel">
        <NuxtLink class="brand" :to="localePath('/')" @click="closeDrawer">{{ $t('siteName') }}</NuxtLink>
        <nav aria-label="Primary navigation"><ul class="nav-groups">
          <li v-for="group in groups" :key="group.label" class="nav-group"><p class="drawer-group-label">{{ $t(group.label) }}</p><ul class="group-links"><li v-for="item in group.links" :key="item.to"><NuxtLink :to="item.label === 'nav.records' ? recordsPath : localePath(item.to)" @click="closeDrawer">{{ $t(item.label) }}</NuxtLink></li></ul></li>
        </ul></nav>
        <NuxtLink class="locale-action" :to="switchLocalePath(locale === 'ja' ? 'en' : 'ja')" @click="closeDrawer">{{ locale === 'ja' ? 'English' : '日本語' }}</NuxtLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const header = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const { locale, t: $t } = useI18n()
const openGroup = ref<number | null>(null)
const openTrigger = ref<HTMLButtonElement | null>(null)
const drawerOpen = ref(false)
const groups = [
  { label: 'nav.tokyo', links: [{ to: '/', label: 'nav.oda' }, { to: '/yumenoshima', label: 'nav.yumenoshima' }, { to: '/komazawa', label: 'nav.komazawa' }] },
  { label: 'nav.kanagawa', links: [{ to: '/todoroki', label: 'nav.todoroki' }] },
  { label: 'nav.lap', links: [{ to: '/pace/marathon', label: 'nav.pace' }] },
  { label: 'nav.recordsGroup', links: [{ to: '/nozomiantena/index', label: 'nav.records' }] },
]
const recordsPath = computed(() => locale.value === 'ja' ? '/nozomiantena/index' : '/en/nozomiantena/index')
const closeAll = () => { openGroup.value = null; openTrigger.value = null; drawerOpen.value = false }
const closeGroup = (restoreFocus = true) => { const trigger = openTrigger.value; openGroup.value = null; openTrigger.value = null; if (restoreFocus) setTimeout(() => trigger?.focus(), 0) }
const toggleGroup = (index: number, event: MouseEvent) => { if (openGroup.value === index) closeGroup(false); else { openGroup.value = index; openTrigger.value = event.currentTarget as HTMLButtonElement } }
const closeDrawer = () => { drawerOpen.value = false; nextTick(() => menuButton.value?.focus()) }
const toggleDrawer = () => { drawerOpen.value ? closeDrawer() : (drawerOpen.value = true) }
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (drawerOpen.value) closeDrawer(); else closeGroup() } }
const onPointer = (event: PointerEvent) => { if (openGroup.value !== null && header.value && !header.value.contains(event.target as Node)) closeGroup() }
onMounted(() => { window.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer) })
</script>
