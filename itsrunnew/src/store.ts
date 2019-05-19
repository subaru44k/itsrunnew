import Vue from 'vue';
import Vuex from 'vuex';
import i18n from './i18n';
import router from './router';
import { TableVariableOperator } from './model/TableVariableOperator';
declare const firebase: any;

Vue.use(Vuex);

const operator = new TableVariableOperator(firebase);
interface StoreType {
    control: TableVariableOperator;
    stadiumId: string;
    weekIndex: number;
    dateList: string[];
    timeRange: string[];
    statusArray: number[][];
}
export default new Vuex.Store({
  state: {
    control: operator,
    stadiumId: 'nVfuSmsj9cULg3712chv',
    weekIndex: 0,
    dateList: [],
    timeRange: [],
    statusArray: [[]],
  } as StoreType,
  mutations: {
    changelang(state) {
      changeUrl('/en', '/');
    },
    rootPage(state) {
      changeUrl('/', '/en/');
    },
    aboutPage(state) {
      changeUrl('/about', '/en/about');
    }
  },
  actions: {
    retrieveScheduleData({commit, state}, stadiumId) {
      state.control.initializeTableData(
        state.weekIndex, state.timeRange, state.dateList, state.statusArray);
      state.control.updateTableContent(
        stadiumId, state.weekIndex, state.timeRange, state.dateList, state.statusArray, i18n.locale);
    },
    previousWeekEvent({commit, state}) {
      state.weekIndex = state.weekIndex - 1;
      state.control.updateStatusToInitialValue(state.statusArray);
      state.control.updateTableContent(state.stadiumId, state.weekIndex, state.timeRange, state.dateList, state.statusArray, i18n.locale);
    },
    nextWeekEvent({commit, state}) {
      state.weekIndex = state.weekIndex + 1;
      state.control.updateStatusToInitialValue(state.statusArray);
      state.control.updateTableContent(state.stadiumId, state.weekIndex, state.timeRange, state.dateList, state.statusArray, i18n.locale);
    },
  },
});

function changeUrl(jaUrl: string, enUrl: string) {
  if (i18n.locale === 'ja') {
    router.push(jaUrl);
  } else {
    router.push(enUrl);
  }
}
