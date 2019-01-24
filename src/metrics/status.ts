import { EventType, MDSStatusChange } from "../data/mds";
import { StatusChangeEvent, StatusEventError, StatusEventErrorType } from "../data/status_changes";
import { GenericPeriodicMetric } from "./generic_aggregator";

import * as fs from "fs";

const DEFAULT_DATA_DIRECTORY = './data/metrics/'

// tracks availability status by provider using H3 zones and ShSt referenced locations 
export enum StatusMetricType {
    INITIAL_STATUS = "initial_status",
    AVAILABLE = "available",
    IN_USE = "in_use",
    MAINTENANCE = "maintenance",
    REMOVED = "removed",
    OTHER = "other"
}

export class StatusMetric {

    statusEvent:StatusChangeEvent;
    statusType:StatusMetricType;

    constructor(statusEvent:StatusChangeEvent) {

        this.statusEvent = statusEvent;

        if(!this.statusEvent.newStatus.event_time)
            throw new StatusEventError(StatusEventErrorType.INCOMPLETE,  "Incomplete status data.");

        if(!this.statusEvent.initialStatus.event_time && this.statusEvent.newStatus.event_time) {
            this.statusType = StatusMetricType.INITIAL_STATUS;
        }
        else {
            if(this.statusEvent.initialStatus.event_type === EventType.AVAILABLE && this.statusEvent.newStatus.event_type !== EventType.AVAILABLE){
                this.statusType = StatusMetricType.AVAILABLE;       
            }
            else if(this.statusEvent.initialStatus.event_type === EventType.RESERVED && this.statusEvent.newStatus.event_type !== EventType.RESERVED){
                this.statusType = StatusMetricType.IN_USE;       
            }
            else if(this.statusEvent.initialStatus.event_type === EventType.UNAVAILABLE && this.statusEvent.newStatus.event_type !== EventType.UNAVAILABLE){
                this.statusType = StatusMetricType.MAINTENANCE; // TODO need to refine maintenance metric calc       
            }
            else {
                this.statusType = StatusMetricType.OTHER;       
            }
        }
    }
}

export class FactionalCount {
    count:number = 0;
    fractionalCount:number = 0;

    add(fractionalValue) {
        this.count = this.count + 1;
        this.fractionalCount = this.fractionalCount + fractionalValue
    }
}

export class H3AvailabilityStatusAggregator {

    metricName = "availability";
    data = {};

    constructor() {

        fs.mkdirSync(this.getPath(), {recursive:true});

        for(var dataFile in fs.readdirSync(this.getPath())) {
            var parts = dataFile.split('/');
            var week =  parts[parts.length -1];
            var content = fs.readFileSync(dataFile);
            this.data[week]  = JSON.parse(content.toString());
        }
    }

    getPath():string {
        return DEFAULT_DATA_DIRECTORY + this.metricName + '/';
    }

    save() {
        for(var week of Object.keys(this.data)){
            var weekObject = this.data[week];
            var jsonContent = JSON.stringify(weekObject);
            fs.writeFileSync(this.getPath() + week, jsonContent);
        }
    }

    addData(data:StatusMetric) {
        if(data.statusType === StatusMetricType.AVAILABLE) {
            var h3status = data.statusEvent.getH3StatusChange();
            var h3index = h3status.initialH3Status.getH3Index();

            for(var period of data.statusEvent.getPeriods()) {
                var week = period.week.toString();
                if(!this.data[week]){
                    var periodMap = {};
                    this.data[week] = periodMap;
                }

                if(!this.data[week][period.period]){
                    var h3Map = {};
                    this.data[week][period.period] = h3Map;
                }

                if(!this.data[week][period.period][h3index]){
                    var fracionalCount = new FactionalCount();
                    this.data[week][period.period][h3index] = fracionalCount;
                }

                this.data[week][period.period][h3index].add(period.fraction);
            }
        }
    }
}

class ShStAvailabilityStatusAggregator {

}