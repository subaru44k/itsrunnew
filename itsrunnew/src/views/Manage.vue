<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex>
        <div class="container pt-4">
          <h1></h1>
        </div>
        <div v-if="status.length !== 0" class="container pt-4">
          <StadiumSelector v-bind:stadiums="stadiums" v-on:item-selected="handleStadiumSelected"></StadiumSelector>
          <nav aria-label="Page navigation example">
            <Pagination v-on:previous-week-event="previous" v-on:next-week-event="next"></Pagination>
          </nav>
          <ManageSchedule v-bind:timeslots="timeSlots" v-bind:dates="dates" v-bind:status="status" v-on:schedule-changed="handleScheduleChanged"></ManageSchedule>
          <button class="btn btn-primary" type="button" v-on:click="handleSubmit">Update</button>
          <div class="alert alert-primary mt-3 md-3" role="alert">{{ statusMessage }}</div>
        </div>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import StadiumSelector from '@/components/manage/StadiumSelector.vue';
import Pagination from '@/components/schedule/Pagination.vue';
import ManageSchedule from '@/components/manage/ManageSchedule.vue';

@Component({
  components: {
    StadiumSelector,
    Pagination,
    ManageSchedule,
  },
})
export default class OdaField extends Vue {
  get stadiums() {
    return this.$store.state.stadiumInfoArray;
  }

  get timeSlots() {
    return this.$store.state.timeRange;
  }

  get dates() {
    return this.$store.state.dateList;
  }

  get status() {
    return this.$store.state.statusArray;
  }

  get statusMessage() {
    return this.$store.state.statusMessage; 
  }

  mounted() {
    this.$store.dispatch('checkAuthStatus', {
      onLoggedIn: () => {
        this.$store.dispatch('retrieveStadiumInfo');
      },
      onLoggedOut: () => {
        this.$store.dispatch('redirectToLogin');
      }
    })
  }

  previous() {
      this.$store.dispatch('previousWeekEvent');
  }

  next() {
      this.$store.dispatch('nextWeekEvent');
  }

  handleStadiumSelected(stadiumId: string) {
    this.$store.commit('changeStadiumId', stadiumId);
    this.$store.dispatch('retrieveScheduleData');
  }

  handleScheduleChanged(dateIndex: number, timeIndex: number, item: number) {
    this.$store.commit('handleScheduleChanged', {dateIndex: dateIndex, timeIndex: timeIndex, value: item});
  }

  handleSubmit() {
    this.$store.commit('handleSubmit');
  }
}
</script>
