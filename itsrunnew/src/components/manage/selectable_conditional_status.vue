<template>
  <td>
    <select class="custom-select" v-model="statusvalue" name="status" v-on:change="onOptionSelected">
      <option value="0" v-bind:selected="condstatus === 0">0</option>
      <option value="1" v-bind:selected="condstatus === 1">1</option>
      <option value="2" v-bind:selected="condstatus === 2">2</option>
    </select>
  </td>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
  
@Component<ConditionalStatusComponent>({
  props: {
    condstatus: Number,
    dateIndex: Number,
    timeIndex: Number
  },
})
export default class ConditionalStatusComponent extends Vue {
  private statusvalue: number = 0;

  updated() {
    this.statusvalue = this.$props.condstatus;
  }

  onOptionSelected() {
    console.log('selected: ' + this.$props.dateIndex, this.$props.timeIndex, this.statusvalue);
    this.$emit('item-selected', this.$props.dateIndex, this.$props.timeIndex, Number(this.statusvalue));
  }

}
</script>
