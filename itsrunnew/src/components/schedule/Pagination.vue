<template>
  <v-container>
    <v-layout justify-center row wrap>
      <v-flex shrink>
        <div>
          <v-btn color="primary" fab small class="headline" @click="previous()">
            &lt;
          </v-btn>
          <v-btn color="primary" fab small class="headline" @click="next()">
            &gt;
          </v-btn>
        </div>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang="ts">
import Vue from 'vue'
import Component from 'vue-class-component'

@Component({
})
export default class Pagination extends Vue {
    previous() {
        this.$emit('previous-week-event');
    }
    next() {
        this.$emit('next-week-event');
    }
}
</script>
