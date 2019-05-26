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
            <img
              src="/img/icon.png"
              alt="Logo"
            >
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
          </v-list-tile>
        </v-list-group>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar color="indigo" dark="dark" dense>
      <v-toolbar-side-icon @click.stop="drawer = !drawer"
      class="hidden-sm-and-up"
      >
      </v-toolbar-side-icon>
      <v-toolbar-title><a class="white--text" @click="goToRootPage">{{ $t("title") }}</a></v-toolbar-title>
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
declare const document: any;

@Component({
  components: {
  },
})
export default class App extends Vue {
  private drawer: any = null;
  private fab: boolean = false;
  private tabs: any = null;

  mounted() {
    const nodeToHide = document.getElementById('beforeload');
    nodeToHide.parentNode.removeChild(nodeToHide);
  }

  get initial() {
    return this.$t('title').toString().charAt(0).toUpperCase();
  }

  get tokyoMenuItems() {
    return [
      { title: this.$t('menu.oda'), icon: 'dashboard', route: this.goToRootPage, },
      { title: this.$t('menu.yume'), icon: 'question_answer', route: this.goToYumenoshimaPage, },
      { title: this.$t('menu.komazawa'), icon: 'question_answer', route: this.goToKomazawaPage, },
    ];
  }

  get kanagawaMenuItems() {
    return [
      { title: this.$t('menu.todoroki'), icon: 'dashboard', route: this.goToTodorokiPage, },
    ];
  }

  get lapTimeItems() {
    return [
      { title: this.$t('menu.marathon'), icon: 'dashboard', route: this.goToLapTimePage },
    ]
  }

  private changelang() {
    this.$store.commit('changelang');
  }

  private goToRootPage() {
    this.$store.commit('rootPage');
  }

  private goToYumenoshimaPage() {
    this.$store.commit('yumenoshimaPage');
  }

  private goToKomazawaPage() {
    this.$store.commit('komazawaPage');
  }

  private goToTodorokiPage() {
    this.$store.commit('todorokiPage');
  }

  private goToLapTimePage() {
    this.$store.commit('lapTimePage');
  }
}
</script>

