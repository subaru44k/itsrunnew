import Vue from 'vue';
import Vuex from 'vuex';
import i18n from './i18n';
import router from './router';
import { TableVariableOperator } from './model/TableVariableOperator';
import TimeContainer from './model/TimeContainer';
import TimeContainerFactory from './model/TimeContainerFactory';
declare const firebase: any;

Vue.use(Vuex);

const operator = new TableVariableOperator(firebase);
const containerFactory = new TimeContainerFactory();
interface StoreType {
    control: TableVariableOperator;
    stadiumId: string;
    weekIndex: number;
    dateList: string[];
    timeRange: string[];
    statusArray: number[][];
    timeCandidate: string[];
    targetTimeIndex: number;
    targetTimes: TimeContainer[];
}
export default new Vuex.Store({
  state: {
    control: operator,
    stadiumId: 'nVfuSmsj9cULg3712chv',
    weekIndex: 0,
    dateList: [],
    timeRange: [],
    statusArray: [[]],
    timeCandidate: ['2時間〜3時間半', '3時間半〜5時間', '5時間〜6時間半'],
    targetTimeIndex: 0,
    targetTimes: containerFactory.getTimeContainerSet(0),
  } as StoreType,
  mutations: {
    changelang(state) {
      changeUrl('/en', '/');
    },
    rootPage(state) {
      changeUrl('/', '/en/');
    },
    lapTimePage(state) {
      changeUrl('/pace/marathon', '/en/pace/marathon');
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
    changeTargetTime({commit, state}, index) {
      containerFactory.getTimeContainerSet(index).forEach((container, index) => {
        state.targetTimes.splice(index, 1, container);
      });
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
