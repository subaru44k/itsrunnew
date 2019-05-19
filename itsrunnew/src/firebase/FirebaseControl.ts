import * as firebase from 'firebase/app';
import { StadiumInfo } from '../model/stadiuminfo';

export class FirebaseControl {
    private db: firebase.firestore.Firestore;
    private defaultCollectionName: string = 'default';
    private stadiumCollectionName: string = 'stadium_info';
    private availabilityCollectionName: string = 'availability';
    private dateCollectionName: string = 'date';
    constructor(firebase: any) {
        this.db = firebase.firestore()
    }

    getDefaultPageId(): Promise<string> {
        return this.db.collection(this.defaultCollectionName).doc('0').get().then(document => {
            if (document.exists) {
                let data = document.data();
                if (data !== undefined) {
                    return data['alias_id']
                }
            }
            console.warn('cannot find default id');
            return '0';
        })
    }

    getTimeRange(id: string): Promise<Array<string>> {
        return this.getStadiumDocument(id).get().then(document => {
            if (document.exists) {
                let data = document.data();
                if (data != undefined) {
                    return data['time_range'];
                }
            }
            console.warn('stadium not found. id: ' + id);
            return [];
        })
    }

    getStatus(id: string, dateId: string): Promise<number[]> {
        return this.getDateDocument(id).doc(dateId).get().then(document => {
            if (document.exists) {
                const data = document.data();
                if (data != undefined) {
                    return [Number(data['status'][0]), Number(data['status'][1]), Number(data['status'][2])];
                }
            }
            return [0, 0, 0];
        }).catch((err) => {
            console.warn(err);
            return [0, 0, 0];
        });
    }

    getStadiumInfo(): Promise<StadiumInfo[]> {
        return this.db.collection(this.stadiumCollectionName).get().then(querySnapShot => {
            let infoArray: StadiumInfo[] = [];
            querySnapShot.forEach(doc => {
               infoArray.push(new StadiumInfo(doc.id, doc.data()['common_name']));
            });
            return infoArray;
        })
    }

    putStatus(id: string, dateId: string, values: number[]): Promise<void> {
        if (values.length != 3) {
            return Promise.reject(new Error('Size of status value is not correct.'));
        }
        return this.getDateDocument(id).doc(dateId).set({
            status: [
                values[0],
                values[1],
                values[2]
            ]
        })
    }

    private getDateDocument(id: string) {
        return this.db.collection(this.availabilityCollectionName).doc(id).collection(this.dateCollectionName);
    }

    private getStadiumDocument(id: string) {
        return this.db.collection(this.stadiumCollectionName).doc(id);
    }
}