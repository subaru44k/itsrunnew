<template>
  <svg
    class="link-icon"
    :class="`link-icon--${kind}`"
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="kind === 'external'">
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M14 4h6v6M20 4l-9 9" />
    </template>
    <path v-else d="m9 5 7 7-7 7" />
  </svg>
</template>

<script setup lang="ts">
// Original geometric SVG artwork for ItsRun; no third-party assets or fonts.
withDefaults(defineProps<{ kind?: 'external' | 'next' }>(), { kind: 'external' });
</script>

<style scoped>
.link-icon {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  flex: 0 0 auto;
  margin-inline-start: .35em;
  vertical-align: -.18em;
}
</style>
