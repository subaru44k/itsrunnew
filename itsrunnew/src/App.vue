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
            <span class="white--text headline">{{ initial }}</span>
          </v-list-tile-avatar>
          <v-list-tile-content>
            <v-list-tile-title>{{ $t('title') }}</v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>

      <v-list class="pt-0" dense>
        <v-list-group
          no-action
          sub-group
        >
          <template v-slot:activator>
            <v-list-tile>
              <v-list-tile-title>{{ $t('menu.tokyo') }}</v-list-tile-title>
            </v-list-tile>
          </template>

          <v-list-tile
            v-for="item in tokyoMenuItems"
            :key="item.title"
            @click="item.route(); drawer = false;"
          >
            <v-list-tile-title v-text="item.title"></v-list-tile-title>
            <v-list-tile-action>
              <v-icon v-text="item.icon"></v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </v-list-group>

        <v-list-group
          no-action
          sub-group
        >
          <template v-slot:activator>
            <v-list-tile>
              <v-list-tile-title>{{ $t('menu.kanagawa') }}</v-list-tile-title>
            </v-list-tile>
          </template>

          <v-list-tile
            v-for="item in kanagawaMenuItems"
            :key="item.title"
            @click="item.route(); drawer = false;"
          >
            <v-list-tile-title v-text="item.title"></v-list-tile-title>
            <v-list-tile-action>
              <v-icon v-text="item.icon"></v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </v-list-group>

        <v-list-group
          no-action
          sub-group
        >
          <template v-slot:activator>
            <v-list-tile>
              <v-list-tile-title>{{ $t('menu.laptime') }}</v-list-tile-title>
            </v-list-tile>
          </template>

          <v-list-tile
            v-for="item in lapTimeItems"
            :key="item.title"
            @click="item.route(); drawer = false;"
          >
            <v-list-tile-title v-text="item.title"></v-list-tile-title>
            <v-list-tile-action>
              <v-icon v-text="item.icon"></v-icon>
            </v-list-tile-action>
          </v-list-tile>
        </v-list-group>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar color="indigo" dark="dark" dense>
      <v-toolbar-side-icon @click.stop="drawer = !drawer"
      class="hidden-sm-and-up"
      >
      </v-toolbar-side-icon>
      <v-toolbar-title><a class="white--text" href="/">{{ $t("title") }}</a></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items class="hidden-xs-only">
        <v-menu offset-y>
          <template v-slot:activator="{ on }">
            <v-btn
              flat
              v-on="on"
            >
             {{ $t("menu.tokyo") }} 
            <v-icon>
              arrow_drop_down
            </v-icon>

            </v-btn>
          </template>
          <v-list>
            <v-list-tile
              v-for="item in tokyoMenuItems"
              :key="item.title"
              @click="item.route()"
            >
              <v-list-tile-title>{{ item.title }}</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-menu offset-y>
          <template v-slot:activator="{ on }">
            <v-btn
              flat
              v-on="on"
            >
              {{ $t("menu.kanagawa") }} 
            <v-icon>
              arrow_drop_down
            </v-icon>

            </v-btn>
          </template>
          <v-list>
            <v-list-tile
              v-for="item in kanagawaMenuItems"
              :key="item.title"
              @click="item.route()"
            >
              <v-list-tile-title>{{ item.title }}</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-menu offset-y>
          <template v-slot:activator="{ on }">
            <v-btn
              flat
              v-on="on"
            >
             {{ $t("menu.laptime") }} 
            <v-icon>
              arrow_drop_down
            </v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-tile
              v-for="item in lapTimeItems"
              :key="item.title"
              @click="item.route()"
            >
              <v-list-tile-title>{{ item.title }}</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
      </v-toolbar-items>
      <v-btn color="success" @click="changelang()">
        {{ $t("menu.changelang") }}
      </v-btn>

    </v-toolbar>

    <v-content>
      <router-view/>
    </v-content>
    <v-footer
      dark
      height="auto"
    >
      <v-card
        class="flex"
        flat
        tile
      >
        <v-card-title class="teal">
          <strong class="subheading">{{ $t("footer_1") }}<a href="https://twitter.com/itsrun_page">{{ $t("footer_2") }}</a>{{ $t("footer_3") }}</strong>
    
          <v-spacer></v-spacer>
    
          <v-btn
            v-for="icon in icons"
            :key="icon"
            class="mx-3"
            dark
            icon
          >
            <v-icon size="24px">{{ icon }}</v-icon>
          </v-btn>
        </v-card-title>
    
        <v-card-actions class="grey darken-3 justify-center">
          &copy;2019 — <strong>{{ $t("title") }}</strong>
        </v-card-actions>
      </v-card>
    </v-footer>
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

  get initial() {
    return this.$t('title').toString().charAt(0).toUpperCase();
  }

  get tokyoMenuItems() {
    return [
      { title: this.$t('menu.oda'), icon: 'dashboard', route: this.goToRootPage, },
      { title: this.$t('menu.yume'), icon: 'question_answer', route: this.goToAboutPage, },
    ];
  }

  get kanagawaMenuItems() {
    return [
      { title: this.$t('menu.todoroki'), icon: 'dashboard', route: this.goToRootPage, },
      { title: this.$t('menu.nissan'), icon: 'question_answer', route: this.goToAboutPage, },
    ];
  }

  get lapTimeItems() {
    return [
      { title: this.$t('menu.marathon'), icon: 'dashboard', route: this.goToRootPage },
    ]
  }

  private changelang() {
    this.$store.commit('changelang');
  }

  private goToRootPage() {
    this.$store.commit('rootPage');
  }

  private goToAboutPage() {
    this.$store.commit('aboutPage');
  }
}
</script>

