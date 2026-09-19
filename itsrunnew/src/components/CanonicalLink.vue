<template>
  <RouterLink :to="to" custom v-slot="{ route, navigate }">
    <component :is="button ? VBtn : 'a'" v-bind="$attrs" :href="route.path" @click="navigate">
      <slot />
    </component>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { VBtn } from 'vuetify/components';

defineOptions({ inheritAttrs: false });
// The document link is stable. Ordinary in-app navigation carries the user's
// selected date/origin; copying/opening the link natively opens the canonical
// page. The resulting address-bar URL still supports sharing the selected state.
defineProps<{ to: RouteLocationRaw; button?: boolean }>();
</script>
