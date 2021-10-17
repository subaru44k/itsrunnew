import Vue from 'vue';
import Vuex from 'vuex';
import i18n from './i18n';
import router from './router';
import { TableVariableOperator } from './model/TableVariableOperator';
import TimeContainer from './model/TimeContainer';
import TimeContainerFactory from './model/TimeContainerFactory';
import { StadiumInfo } from './model/stadiuminfo';
import { AuthModule } from './model/AuthModule';
import { FirebaseContainer } from './model/FirebaseContainer';

Vue.use(Vuex);

const container = new FirebaseContainer();
const operator = new TableVariableOperator(container);
const containerFactory = new TimeContainerFactory();
const authContainer = new AuthModule(container);
interface StoreType {
    control: TableVariableOperator;
    authContainer: AuthModule;
    stadiumId: string;
    stadiumInfoArray: StadiumInfo[],
    weekIndex: number;
    dateList: string[];
    timeRange: string[];
    statusArray: number[][];
    targetTimeIndex: number;
    targetTimes: TimeContainer[];
    statusMessage: string;
}
export default new Vuex.Store({
  state: {
    control: operator,
    authContainer: authContainer,
    stadiumId: 'nVfuSmsj9cULg3712chv',
    stadiumInfoArray: [],
    weekIndex: 0,
    dateList: [],
    timeRange: [],
    statusArray: [[]],
    targetTimeIndex: 0,
    targetTimes: containerFactory.getTimeContainerSet(0),
    statusMessage: '',
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
    },
    nozomiPage(store) {
      changeUrl('/nozomiantena/index', '/en/nozomiantena/index');
    },
    changeStadiumId(state, id: string) {
      state.stadiumId = id;
    },
    handleScheduleChanged(state, payload: {dateIndex: number, timeIndex: number, value: number}) {
      console.log('value[' + payload.dateIndex + '][' + payload.timeIndex  + ']=' + payload.value);
      operator.updateStatusArray(payload.dateIndex, payload.timeIndex, payload.value, state.statusArray);
    },
    handleSubmit(state) {
      operator.putStatusToDb(state.stadiumId, state.weekIndex, state.statusArray,
        () => {
          state.statusMessage = 'Success to update data.';
        },
        () => {
          state.statusMessage = 'Error on updating data. Maybe insufficient permission.';
        }
      );
    }
  },
  actions: {
    checkAuthStatus({commit, state}, payload: {onLoggedIn: Function, onLoggedOut: Function}) {
      state.authContainer.getAuth().then(auth => {
        if (auth) {
        auth.onAuthStateChanged((user) => {
          if (user) {
            console.log(user.displayName);
            payload.onLoggedIn();
            return;
          }
          payload.onLoggedOut();
          return;
        }) 
 
        }
     });
    },
    redirectToLogin({commit, state}) {
      state.authContainer.getAuth().then(async auth => {
        const provider = await state.authContainer.getProvider();
        if (auth && provider) {
        auth.signInWithRedirect(provider).then((result: any) => {
          }).catch((err: any) => {
            console.log(err);
          });
        }
     });
    },
    retrieveStadiumInfo({commit, state}) {
      state.control.updateStadiumInfo(state.stadiumInfoArray);
    },
    async retrieveScheduleData({commit, state}) {
      state.control.initializeTableData(
        state.weekIndex, state.timeRange, state.dateList, state.statusArray);
      await state.control.updateTableContent(
        state.stadiumId, state.weekIndex, state.timeRange, state.dateList, state.statusArray, i18n.locale);
      return;
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
