export class FirebaseContainer {
    private firebase: any;

    constructor() {
        this.firebase = undefined;
    }

    async getFirebase() {
        if (this.firebase !== undefined) {
              return this.firebase;
        }
        const firebase = await import('firebase/app');
        await import('firebase/firestore');
        await import('firebase/auth');
        const config = {
            apiKey: "AIzaSyCSsO3dn7qPHhGDt4MfXSeiPrk-pF51m-g",
            authDomain: "itsrun-aaf42.firebaseapp.com",
            databaseURL: "https://itsrun-aaf42.firebaseio.com",
            projectId: "itsrun-aaf42",
            storageBucket: "itsrun-aaf42.appspot.com",
            messagingSenderId: "337135752630"
        }
        
        firebase.initializeApp(config);
        this.firebase = firebase;
        return this.firebase;
    }
}