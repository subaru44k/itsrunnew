import { FirebaseContainer } from './FirebaseContainer';

export class AuthModule {
    container: FirebaseContainer;
    auth: firebase.auth.Auth | undefined;
    provider: firebase.auth.GoogleAuthProvider | undefined;

    constructor(container: FirebaseContainer) {
        this.container = container;
        this.auth = undefined;
        this.provider = undefined;
    }

    async getProvider() {
        if (this.provider !== undefined) {
            return this.provider;
        }
        const firebase = await this.container.getFirebase();
        this.provider = new firebase.auth.GoogleAuthProvider();
        return this.provider;
    }

    async getAuth() {
        if (this.auth !== undefined) {
            return this.auth;
        }
        const firebase = await this.container.getFirebase();
        this.auth = firebase.auth();
        return this.auth;
    }
}