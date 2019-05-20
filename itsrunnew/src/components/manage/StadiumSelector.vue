<template>
  <select class="custom-select" v-model="stadiumId" name="stadum" v-on:change="onOptionItemSelected">
    <option selected="selected" value="0">競技場を選択</option>
    <option v-for="stadiuminfo in stadiums" v-bind:value="stadiuminfo.getStadiumId()" v-bind:key="stadiuminfo.getStadiumId()">{{ stadiuminfo.getStadiumName() }}</option>
  </select>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

import { StadiumInfo } from '../../model/stadiuminfo';

@Component({
  props: {
    stadiums: Array
  }
})
export default class StadiumSelector extends Vue {
  stadiumId: string = '0';
  onOptionItemSelected() {
    console.log('onOptionItemSelected', this.stadiumId)
    this.$emit('item-selected', this.stadiumId)
  }
}
</script>