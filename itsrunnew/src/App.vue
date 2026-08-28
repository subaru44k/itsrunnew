<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" temporary>
      <v-list class="pt-3 pa-0">
        <v-list-item prepend-avatar="/img/icon.png" :title="t('title')" />
      </v-list>
      <v-list density="compact">
        <v-list-group v-for="group in menuGroups" :key="group.title" :value="group.title">
          <template #activator="{ props }">
            <v-list-item v-bind="props" :title="group.title" />
          </template>
          <v-list-item
            v-for="item in group.items"
            :key="item.path"
            :title="item.title"
            @click="navigate(item.path)"
          />
        </v-list-group>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar color="indigo" density="compact">
      <v-app-bar-nav-icon class="d-sm-none" aria-label="メニュー" @click="drawer = !drawer" />
      <v-toolbar-title class="site-title">
        <a class="brand-link" href="/" @click.prevent="navigate('')">{{ t('title') }}</a>
      </v-toolbar-title>
      <v-spacer />
      <div class="d-none d-sm-flex align-center fill-height">
        <v-menu v-for="group in menuGroups" :key="group.title">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" append-icon="mdi-menu-down">{{ group.title }}</v-btn>
          </template>
          <v-list>
            <v-list-item
              v-for="item in group.items"
              :key="item.path"
              :title="item.title"
              @click="navigate(item.path)"
            />
          </v-list>
        </v-menu>
      </div>
      <v-btn color="success" variant="flat" class="language-button mr-2" @click="changeLanguage">
        <span class="d-none d-sm-inline">{{ t('menu.changelang') }}</span>
        <span class="d-sm-none">{{ locale === 'ja' ? 'English' : '日本語' }}</span>
      </v-btn>
    </v-app-bar>

    <v-main>
      <PrivacyConsent />
      <router-view />
    </v-main>

    <footer class="site-footer">
      <div class="footer-request">
        <strong class="subheading">{{ t('footer_1') }}<a href="https://twitter.com/itsrun_page">{{ t('footer_2') }}</a>{{ t('footer_3') }}</strong>
        <nav class="footer-links" :aria-label="t('footer_links.label')">
          <router-link :to="localizedPath('about')">{{ t('footer_links.about') }}</router-link>
          <router-link :to="localizedPath('privacy')">{{ t('footer_links.privacy') }}</router-link>
          <button type="button" @click="openPrivacySettings">{{ t('footer_links.analytics') }}</button>
          <button v-if="advertisingReady" type="button" @click="openGooglePrivacySettings">
            {{ t('footer_links.advertising') }}
          </button>
        </nav>
      </div>
      <div class="footer-copyright">&copy; 2019–{{ currentYear }} <strong>{{ t('title') }}</strong></div>
    </footer>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PrivacyConsent from '@/components/PrivacyConsent.vue';
import { openPrivacySettings } from '@/services/privacy-consent';
import { advertisingReady, openGooglePrivacySettings } from '@/services/advertising';

const drawer = ref(false);
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const currentYear = new Date().getFullYear();

const menuGroups = computed(() => [
  { title: t('menu.tokyo'), items: [
    { title: t('menu.oda'), path: 'oda-field' },
    { title: t('menu.yume'), path: 'yumenoshima' },
    { title: t('menu.komazawa'), path: 'komazawa' },
  ] },
  { title: t('menu.kanagawa'), items: [{ title: t('menu.todoroki'), path: 'todoroki' }] },
  { title: t('menu.find'), items: [{ title: t('menu.tracks'), path: '' }] },
  { title: t('menu.laptime'), items: [{ title: t('menu.marathon'), path: 'pace/marathon' }] },
  { title: t('menu.records'), items: [{ title: t('menu.tanaka'), path: 'nozomiantena/index' }] },
]);

function localizedPath(path: string, targetLocale = locale.value) {
  return targetLocale === 'en' ? `/en/${path}` : `/${path}`;
}

function navigate(path: string) {
  drawer.value = false;
  void router.push(localizedPath(path));
}

function changeLanguage() {
  const withoutLanguage = route.path.replace(/^\/en\/?/, '').replace(/^\//, '');
  const nextLocale = locale.value === 'ja' ? 'en' : 'ja';
  void router.push(localizedPath(withoutLanguage, nextLocale));
}
</script>
