<template>
  <td>
    <img src="/img/not_loaded.svg" v-if="condstatus === -1">
    <img src="/img/unknown.svg" v-if="condstatus === 0">
    <img :src="availablePath" v-if="condstatus === 1">
    <img :src="unavailablePath" v-if="condstatus === 2">
  </td>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import i18n from '../../i18n';
  
@Component({
  props: {
    condstatus: Number
  }
})
export default class ConditionalStatusComponent extends Vue {
  get availablePath() {
    if (i18n.locale === 'ja') {
      return '/img/circle.svg';
    }
    return '/img/done.svg';
  }

  get unavailablePath() {
    if (i18n.locale === 'ja') {
      return '/img/remove.svg';
    }
    return '/img/border.svg';
  }
}
</script>
