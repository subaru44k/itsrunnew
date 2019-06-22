import Vue from 'vue'
import moment from 'moment';
import { FirebaseControl } from '../firebase/FirebaseControl';
import { StadiumInfo } from './stadiuminfo';
import { FirebaseContainer } from './FirebaseContainer';

export class TableVariableOperator {
  private container: FirebaseContainer;
  private firebaseControl: FirebaseControl | undefined;

  constructor(container: FirebaseContainer) {
    this.container = container;
    this.firebaseControl = undefined;
  }

  async getControl() {
    if (this.firebaseControl !== undefined) {
      return this.firebaseControl;
    }
    const firebase = await this.container.getFirebase();
    this.firebaseControl = new FirebaseControl(firebase);
    return this.firebaseControl;
  }

  updateStadiumInfo(stadiumInfoArray: StadiumInfo[]) {
    this.getControl().then((control) => {
      stadiumInfoArray.splice(0, stadiumInfoArray.length);
      control.getStadiumInfo().then(stadiumArray => {
        stadiumArray.forEach(stadium => {
          stadiumInfoArray.push(stadium);
        })
      })
    })
  }
  
  updateStatusArray(dateIndex: number, timeIndex: number, value: number, statusArray: number[][]) {
    let timeArray: number[] = statusArray[dateIndex];
    Vue.set(timeArray, timeIndex, value);
  }
  
  initializeTableData(weekIndex: number, timeRange: string[], dateList: string[], statusArray: number[][]) {
    this.initializeDateList(weekIndex, dateList);
    this.initializeTimeRange(timeRange);
    this.initializeStatus(statusArray);
  }
  
  updateTableContent(stadiumId: string, weekIndex: number, timeRange: string[], dateList: string[], statusArray: number[][], locale: string) {
    return new Promise((resolve, reject) => {
      this.getControl().then((control) => {
        this.updateDateList(weekIndex, dateList, locale);
        if (stadiumId === '0') {
          control.getDefaultPageId().then((id) => {
            Promise.all([
              this.updateTimeRange(id, timeRange),
              this.updateStatus(id, weekIndex, statusArray),
            ]).then(() => {
              resolve();
            });
            return;
          })
        } else {
          Promise.all([
            this.updateTimeRange(stadiumId, timeRange),
            this.updateStatus(stadiumId, weekIndex, statusArray),
          ]).then(() => {
            resolve();
          })
          return;
        }
      });
    });
  }
  
  initializeTimeRange(timeRange: string[]) {
    timeRange.splice(0, timeRange.length)
    timeRange.push('00:00');
    timeRange.push('00:00');
    timeRange.push('00:00');
  }
 
  initializeStatus(statusArray: number[][]) {
    statusArray.splice(0, statusArray.length)
    if (statusArray.length !== 0) {
      return;
    }
    statusArray.push([-1, -1, -1]);
    statusArray.push([-1, -1, -1]);
    statusArray.push([-1, -1, -1]);
    statusArray.push([-1, -1, -1]);
    statusArray.push([-1, -1, -1]);
    statusArray.push([-1, -1, -1]);
    statusArray.push([-1, -1, -1]);
  }

  updateStatusToInitialValue(statusArray: number[][]) {
    statusArray.forEach((statusInADay, index) => {
      statusArray.splice(index, 1, [-1, -1, -1]);
    });
  }
 
  updateTimeRange(id: string, timeRange: string[]) {
    return new Promise((resolve, reject) => {
      this.getControl().then((control) => {
        control.getTimeRange(id).then((ranges) => {
            ranges.forEach((range, index) => {
                timeRange.splice(index, 1, range);
            });
            resolve();
        });
      });
    })
  }
 
  updateStatus(id: string, weekIndex: number, statusArray: number[][]): Promise<void> {
    return Promise.all(
      this.getDateListForFirebaseId(weekIndex).map(dateId => {
        return this.getControl().then((control) => {
          return control.getStatus(id, dateId);
        }
      );
    })).then((statuses) => {
      statusArray.forEach((statusInADay, index) => {
        statusArray.splice(index, 1, statuses[index]);
      });
      return;
    });
  }

  putStatusToDb(id: string, weekIndex: number, statusArray: number[][], successCallback: Function, errorCallback: Function) {
    let dateMomentList = this.getDateMomentList(weekIndex);
    return Promise.all(
      statusArray.map((statudInADay, index) => {
        return this.getControl().then((control) => {
          return control.putStatus(id, dateMomentList[index].format('YYYYMMDD'), statudInADay);
        });
      })
    ).then(() => {
      console.log('update completed')
      successCallback();
    }).catch((err) => {
      console.warn('error on update');
      console.warn(err);
      errorCallback();
    });
  }
  
  initializeDateList(weekIndex: number, dateList: string[]) {
    dateList.splice(0, dateList.length)
    return this.getDateMomentList(weekIndex).forEach((date) => {
      dateList.push(date.format('MM/DD(ddd)'));
    });
  }
  
  updateDateList(weekIndex: number, dateList: string[], locale: string) {
    if (locale === 'ja') {
      moment.locale('ja')
    } else {
      moment.locale('en')
    }
    return this.getDateMomentList(weekIndex).forEach((date, index) => {
      dateList.splice(index, 1, date.format('MM/DD(ddd)'));
    })
  }
  
  getDateListForFirebaseId(weekIndex: number) {
    return this.getDateMomentList(weekIndex).map((date) => {
      return date.format('YYYYMMDD');
    })
  }
  
  getDateMomentList(weekIndex: number) {
    return [
      moment().add(7 * weekIndex, 'days'),
      moment().add(7 * weekIndex + 1, 'days'),
      moment().add(7 * weekIndex + 2, 'days'),
      moment().add(7 * weekIndex + 3, 'days'),
      moment().add(7 * weekIndex + 4, 'days'),
      moment().add(7 * weekIndex + 5, 'days'),
      moment().add(7 * weekIndex + 6, 'days'),
    ];
  }

}