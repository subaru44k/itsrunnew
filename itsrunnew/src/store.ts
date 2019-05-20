import Vue from 'vue';
import Vuex from 'vuex';
import i18n from './i18n';
import router from './router';
import { TableVariableOperator } from './model/TableVariableOperator';
import TimeContainer from './model/TimeContainer';
import TimeContainerFactory from './model/TimeContainerFactory';
import { StadiumInfo } from './model/stadiuminfo';
declare const firebase: any;

Vue.use(Vuex);

const operator = new TableVariableOperator(firebase);
const containerFactory = new TimeContainerFactory();
interface StoreType {
    control: TableVariableOperator;
    stadiumId: string;
    stadiumInfoArray: StadiumInfo[],
    weekIndex: number;
    dateList: string[];
    timeRange: string[];
    statusArray: number[][];
    targetTimeIndex: number;
    targetTimes: TimeContainer[];
}
export default new Vuex.Store({
  state: {
    control: operator,
    stadiumId: 'nVfuSmsj9cULg3712chv',
    stadiumInfoArray: [],
    weekIndex: 0,
    dateList: [],
    timeRange: [],
    statusArray: [[]],
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
    yumenoshimaPage(state) {
      changeUrl('/yumenoshima', '/en/yumenoshima');
    },
    komazawaPage(state) {
      changeUrl('/komazawa', '/en/komazawa');
    },
    todorokiPage(state) {
      changeUrl('/todoroki', '/en/todoroki');
    },
    lapTimePage(state) {
      changeUrl('/pace/marathon', '/en/pace/marathon');
    }
  },
  actions: {
    retrieveStadiumInfo({commit, state}) {
      state.control.updateStadiumInfo(state.stadiumInfoArray);
    },
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
