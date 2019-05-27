import Vue from 'vue';
import Vuex from 'vuex';
import i18n from './i18n';
import router from './router';
import { TableVariableOperator } from './model/TableVariableOperator';
import TimeContainer from './model/TimeContainer';
import TimeContainerFactory from './model/TimeContainerFactory';
import { StadiumInfo } from './model/stadiuminfo';
import firebaseNative from 'firebase'
const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");

const config = {
  apiKey: "AIzaSyCSsO3dn7qPHhGDt4MfXSeiPrk-pF51m-g",
  authDomain: "itsrun-aaf42.firebaseapp.com",
  databaseURL: "https://itsrun-aaf42.firebaseio.com",
  projectId: "itsrun-aaf42",
  storageBucket: "itsrun-aaf42.appspot.com",
  messagingSenderId: "337135752630"
}
firebase.initializeApp(config);

Vue.use(Vuex);

const operator = new TableVariableOperator(firebase);
const containerFactory = new TimeContainerFactory();
const provider: firebaseNative.auth.GoogleAuthProvider = new firebase.auth.GoogleAuthProvider();
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
    statusMessage: string;
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
      firebase.auth().onAuthStateChanged((user: firebase.User) => {
        if (user) {
          console.log(user.displayName);
          payload.onLoggedIn();
          return;
        }
        payload.onLoggedOut();
     }) 
    },
    redirectToLogin({commit, state}) {
      firebase.auth().signInWithRedirect(provider).then((result: any) => {
      }).catch((err: any) => {
        console.log(err);
      });
    },
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
