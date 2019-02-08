import { Week, PeriodicTimestamp } from "../data/periodicity";
import { SharedStreetsLocationRef } from "../data/sharedstreets";

import * as fs from "fs";
import { join } from 'path';
import { FeatureCollection } from "@turf/helpers/lib/geojson";

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

export class Count extends GenericMetric {
    count:number = 0;
    increment() {
        this.count = this.count + 1;
    }
}

export class FractionalCount extends GenericMetric {
    count:number = 0;
    fractionalCount:number = 0;

    add(fractionalValue) {
        this.count = this.count + 1;
        this.fractionalCount = this.fractionalCount + fractionalValue;
    }
}

export class Sum  extends GenericMetric {
    count:number = 0;
    sum:number = 0;
    add(value) {
        this.count = this.count + 1;
        this.sum = this.sum + value;
    }

    avg():number {
        if(this.count > 0)
            return this.sum / this.count;
        else 
            return 0;
    }
}


export abstract class GenericPeriodicMetric {

    abstract getPeriodicCounts(metricLabel:string):PeriodicValue[];
}


export abstract class GenericMetricAggregator<T extends GenericMetric, V> {

    data = {};

    constructor(directory=DEFAULT_DATA_DIRECTORY) {
        fs.mkdirSync(this.getPath(), {recursive:true});

        for(var week of fs.readdirSync(this.getPath())) {
            var content = fs.readFileSync(join(this.getPath(), week));
            this.data[week]  = JSON.parse(content.toString());
        }
    }

    abstract getMetricName():string;

    getPath():string {
        return DEFAULT_DATA_DIRECTORY + this.getMetricName();
    }

    abstract defaultValue():V

    getBin(period:PeriodicTimestamp, binIndex:string ):V {
        var week = period.week.toString();
        if(!this.data[week]){
            var periodMap = {};
            this.data[week] = periodMap;
        }

        if(!this.data[week][period.period]){
            var dataMap = {};
            this.data[week][period.period] = dataMap;
        }

        if(!this.data[week][period.period][binIndex]){
            this.data[week][period.period][binIndex] = this.defaultValue();
        }

        return this.data[week][period.period][binIndex];
    }

    abstract addData(data:T);
    
    save() {

        for(var week of Object.keys(this.data)){
            var weekObject = this.data[week];
            var jsonContent = JSON.stringify(weekObject);
            fs.writeFileSync(join(this.getPath(), week), jsonContent);
        }
        
    }

}

