<template>
  <table class="table table-bordered">
    <tbody v-if="timeslots.length !== 0 && dates.length !== 0 && status.length !== 0">
        <tr>
            <td> </td>
            <td>{{ timeslots[0] }}</td>
            <td>{{ timeslots[1] }}</td>
            <td>{{ timeslots[2] }}</td>
        </tr>
        <tr>
            <td>{{ dates[0] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[0][0]" v-bind:dateIndex="0" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[0][1]" v-bind:dateIndex="0" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[0][2]" v-bind:dateIndex="0" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
        <tr>
            <td>{{ dates[1] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[1][0]" v-bind:dateIndex="1" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[1][1]" v-bind:dateIndex="1" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[1][2]" v-bind:dateIndex="1" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
        <tr>
            <td>{{ dates[2] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[2][0]" v-bind:dateIndex="2" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[2][1]" v-bind:dateIndex="2" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[2][2]" v-bind:dateIndex="2" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
        <tr>
            <td>{{ dates[3] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[3][0]" v-bind:dateIndex="3" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[3][1]" v-bind:dateIndex="3" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[3][2]" v-bind:dateIndex="3" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
        <tr>
            <td>{{ dates[4] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[4][0]" v-bind:dateIndex="4" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[4][1]" v-bind:dateIndex="4" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[4][2]" v-bind:dateIndex="4" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
        <tr>
            <td>{{ dates[5] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[5][0]" v-bind:dateIndex="5" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[5][1]" v-bind:dateIndex="5" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[5][2]" v-bind:dateIndex="5" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
        <tr>
            <td>{{ dates[6] }}</td>
            <selectable-conditional-status v-bind:condstatus="status[6][0]" v-bind:dateIndex="6" v-bind:timeIndex="0" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[6][1]" v-bind:dateIndex="6" v-bind:timeIndex="1" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
            <selectable-conditional-status v-bind:condstatus="status[6][2]" v-bind:dateIndex="6" v-bind:timeIndex="2" v-on:item-selected="handleItemSelected"></selectable-conditional-status>
        </tr>
    </tbody>
  </table>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'
import SelectableConditionalStatusComponent from '@/components/manage/selectable_conditional_status.vue';
  
@Component({
  props: {
    timeslots: Array,
    dates: Array,
    status: Array
  },
  components: {
    'selectable-conditional-status': SelectableConditionalStatusComponent
  }
})
export default class ManageSchedule extends Vue {

  handleItemSelected(dateIndex: number, timeIndex: number, item: number) {
    console.log('item selected: ' + dateIndex, timeIndex, item);
    this.$emit('schedule-changed', dateIndex, timeIndex, item);
  }
}
</script>
