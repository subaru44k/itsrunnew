<template>
  <td>
    <img src="/img/not_loaded.svg" v-if="condstatus === -1">
    <img src="/img/unknown.svg" v-if="condstatus === 0">
    <img src="/img/circle.svg" v-if="condstatus === 1">
    <img src="/img/remove.svg" v-if="condstatus === 2">
  </td>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
  
@Component({
  props: {
    condstatus: Number
  }
})
export default class ConditionalStatusComponent extends Vue {
}
</script>
