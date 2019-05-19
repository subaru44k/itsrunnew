export default class TimeContainer {
    private hour: number;
    private minute: number;
    private second: number;

    constructor(hour: number, minute: number, second: number) {
        this.hour = hour;
        this.minute = minute;
        this.second = second;

        if (this.second >= 60) {
            this.minute += Math.floor(this.second / 60);
            this.second = this.second % 60;
        }

        if (this.minute >= 60) {
            this.hour += Math.floor(this.minute/ 60);
            this.minute= this.minute % 60;
        }
    }

    public getTimeString() {
        if (this.hour != 0) {
            return this.hour + '\'' 
            + ('00' + this.minute).slice(-2) + '\'' 
            + ('00' + this.second).slice(-2) + '"';
        }

        if (this.minute != 0) {
            return this.minute + '\'' 
            + ('00' + this.second).slice(-2) + '"';
        }
        
        return ('00' + this.second).slice(-2) + '"';
    }

    public getSeconds() {
        let seconds = 0;
        if (this.hour != 0) {
            seconds += this.hour * 3600;
        }
        if (this.minute != 0) {
            seconds += this.minute * 60;
        }
        if (this.second != 0) {
            seconds += this.second;
        }
        return seconds;
    }
}