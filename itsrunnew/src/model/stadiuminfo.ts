export class StadiumInfo {
    constructor(private stadiumId: string, private commonName: string) {
    }

    getStadiumName() {
        return this.commonName;
    }

    getStadiumId() {
        return this.stadiumId;
    }
}