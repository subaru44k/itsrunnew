<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      absolute
      temporary
    >
      <v-list class="pt-3 pa-0">
        <v-list-tile avatar>
          <v-list-tile-avatar color="teal">
            <span class="white--text headline">initial</span>
          </v-list-tile-avatar>
          <v-list-tile-content>
            <v-list-tile-title>name</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
        <v-list-tile
          avatar>
            <v-list-tile-action>
            <v-icon>person_add_disabled</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>Sign Out</v-list-tile-title>
          </v-list-tile-content> 
        </v-list-tile>
      </v-list>

      <v-list class="pt-0" dense>
        <v-divider></v-divider>
        <v-list-tile
          v-for="item in menuItems"
          :key="item.title"
          @click="$router.push(item.route); drawer = false;"
        >
          <v-list-tile-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-tile-action>

          <v-list-tile-content>
            <v-list-tile-title>{{ item.title }}</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar color="indigo" dark="dark" dense>
      <v-toolbar-side-icon @click.stop="drawer = !drawer"
      class="hidden-sm-and-up"
      ></v-toolbar-side-icon>
      <v-toolbar-title><a class="white--text" href="/">いつラン</a></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items class="hidden-xs-only">
        <v-menu offset-y>
          <template v-slot:activator="{ on }">
            <v-btn
              flat
              v-on="on"
            >
              Dropdown
            <v-icon>
              arrow_drop_down
            </v-icon>

            </v-btn>
          </template>
          <v-list>
        <v-list-tile
          v-for="item in menuItems"
          :key="item.title"
          @click="$router.push(item.route)"
        >
          <v-list-tile-title>{{ item.title }}</v-list-tile-title>
        </v-list-tile>
      </v-list>
        </v-menu>
        <v-btn
          v-for="item in menuItems"
          :key="item.title"
          flat
          :to="item.route"
        >{{ item.title }}
        </v-btn>

      </v-toolbar-items>
      <v-btn color="success">
        Signin
      </v-btn>
      <v-speed-dial
        v-model="fab"
        class="hidden-xs-only ml-1 mr-2"
        direction="bottom"
        transition="slide-y-transition"
      >
        <template v-slot:activator>
          <v-btn
            v-model="fab"
            color="blue darken-2"
            dark
            small
            fab
          >
            <v-icon>account_circle</v-icon>
            <v-icon>close</v-icon>
          </v-btn>
        </template>
        <v-btn
          fab
          dark
          small
          color="indigo"
        >
          <v-icon>person_add_disabled</v-icon>
        </v-btn>
      </v-speed-dial>

      <v-toolbar-title 
        class="hidden-xs-only ml-1 mr-2">
        name
      </v-toolbar-title>

    </v-toolbar>

    <v-content>
      <router-view/>
    </v-content>
  </v-app>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import HelloWorld from './components/HelloWorld.vue';

@Component({
  components: {
    HelloWorld,
  },
})
export default class App extends Vue {
  private drawer: any = null;
  private fab: boolean = false;
  private tabs: any = null;

  get menuItems() {
    return [
      { title: 'Home', icon: 'dashboard', route: '/', },
      { title: 'Select Quiz', icon: 'question_answer', route: '/about', },
    ];
  }
}
</script>

