import TimeContainer from "./TimeContainer";

export default class LapTimeCalculator {
    constructor(private goalTime: TimeContainer) {}

    public getLapTime() {
        const goalSeconds = this.goalTime.getSeconds();

        return [
            this.goalTime.getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds / 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 5 / 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 10/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 15/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 20/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 21.098/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 25/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 30/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 35/ 42.195))).getTimeString(),
            (new TimeContainer(0, 0, Math.floor(goalSeconds * 40/ 42.195))).getTimeString(),
            this.goalTime.getTimeString(),
        ]
    }
}