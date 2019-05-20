import TimeContainer from './TimeContainer';

export default class TimeContainerFactory {
    
    public getTimeContainerSet(index: number) {
        if (index === 0) {
            return [
                new TimeContainer(2, 0, 0),
                new TimeContainer(2, 5, 0),
                new TimeContainer(2, 10, 0),
                new TimeContainer(2, 15, 0),
                new TimeContainer(2, 20, 0),
                new TimeContainer(2, 25, 0),
                new TimeContainer(2, 30, 0),
                new TimeContainer(2, 35, 0),
                new TimeContainer(2, 40, 0),
                new TimeContainer(2, 45, 0),
                new TimeContainer(2, 50, 0),
                new TimeContainer(2, 55, 0),
                new TimeContainer(3, 0, 0),
                new TimeContainer(3, 5, 0),
                new TimeContainer(3, 10, 0),
                new TimeContainer(3, 15, 0),
                new TimeContainer(3, 20, 0),
                new TimeContainer(3, 25, 0),
                new TimeContainer(3, 30, 0),
            ]
        } else if (index === 1) {
            return [
                new TimeContainer(3, 30, 0),
                new TimeContainer(3, 35, 0),
                new TimeContainer(3, 40, 0),
                new TimeContainer(3, 45, 0),
                new TimeContainer(3, 50, 0),
                new TimeContainer(3, 55, 0),
                new TimeContainer(4, 0, 0),
                new TimeContainer(4, 5, 0),
                new TimeContainer(4, 10, 0),
                new TimeContainer(4, 15, 0),
                new TimeContainer(4, 20, 0),
                new TimeContainer(4, 25, 0),
                new TimeContainer(4, 30, 0),
                new TimeContainer(4, 35, 0),
                new TimeContainer(4, 40, 0),
                new TimeContainer(4, 45, 0),
                new TimeContainer(4, 50, 0),
                new TimeContainer(4, 55, 0),
                new TimeContainer(5, 0, 0),
            ];
        } else {
            return [
                new TimeContainer(5, 0, 0),
                new TimeContainer(5, 5, 0),
                new TimeContainer(5, 10, 0),
                new TimeContainer(5, 15, 0),
                new TimeContainer(5, 20, 0),
                new TimeContainer(5, 25, 0),
                new TimeContainer(5, 30, 0),
                new TimeContainer(5, 35, 0),
                new TimeContainer(5, 40, 0),
                new TimeContainer(5, 45, 0),
                new TimeContainer(5, 50, 0),
                new TimeContainer(5, 55, 0),
                new TimeContainer(6, 0, 0),
                new TimeContainer(6, 5, 0),
                new TimeContainer(6, 10, 0),
                new TimeContainer(6, 15, 0),
                new TimeContainer(6, 20, 0),
                new TimeContainer(6, 25, 0),
                new TimeContainer(6, 30, 0),
            ];
        }
    }
}