import { Week } from "../data/periodicity";
import { SharedStreetsLocationRef } from "../data/sharedstreets";



const DEFAULT_DATA_DIRECTORY = './data/metrics/';

export class PeriodicValue {
    week:Week;
    period:number;
    count:number;
    fractionalCount:number;
}

export class PeriodicH3Value extends PeriodicValue {
    h3index:string;
}

export class PeriodicShStValue extends PeriodicValue {
    shstLocation:SharedStreetsLocationRef;
}

export abstract class GenericMetric {

}

export abstract class GenericPeriodicMetric {

    abstract getPeriodicCounts(metricLabel:string):PeriodicValue[];
}

export abstract class GenericMetricAggregator<T extends GenericMetric> {

    abstract metricGroupName:string;

    constructor(directory=DEFAULT_DATA_DIRECTORY) {
    }

    getPath():string {
        return DEFAULT_DATA_DIRECTORY + this.metricGroupName;
    }

    abstract addData(data:T);
    abstract save(data:T);

}
