import { EventType, MDSStatusChange } from "../data/mds";
import { StatusChangeEvent, StatusEventError, StatusEventErrorType } from "../data/status_changes";
import { GenericPeriodicMetric, FractionalCount, GenericMetricAggregator, GenericMetric } from "./generic_aggregator";

import * as fs from "fs";
import { Geometries } from "@turf/helpers/lib/geojson";
import { FeatureCollection } from "@turf/helpers";

const h3 = require("h3-js");

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


export class StatusMetric extends GenericMetric {

    statusEvent:StatusChangeEvent;
    statusType:StatusMetricType;

    constructor(statusEvent:StatusChangeEvent) {
        super()

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

export class H3AvailabilityStatusAggregator extends GenericMetricAggregator<StatusMetric, FractionalCount> {
    
    constructor() {
        super()
    }

    getMetricName():string {
        return "h3_availability";
    }

    defaultValue():FractionalCount {
        return new FractionalCount();
    }
    
    addData(data:StatusMetric) {

        if(data.statusType === StatusMetricType.AVAILABLE) {

            var h3status = data.statusEvent.getH3StatusChange();
            var h3index = h3status.initialH3Status.getH3Index();

            for(var period of data.statusEvent.getPeriods()) {
               this.getBin(period, h3index).add(period.fraction)
            }
        }
    }

    getGeoJson(weeks:string[], filterPeriod:string):{} {
        var h3sum:Map<string,FractionalCount> = new Map<string,FractionalCount>();
        for(var week of Object.keys(this.data)) {
            for(var period of Object.keys(this.data[week])) {
                if(filterPeriod && filterPeriod !== period)
                    continue;
                for(var h3index of Object.keys(this.data[week][period])) {

                    if(!h3sum.has(h3index)) {
                        h3sum.set(h3index, new FractionalCount());
                    }

                    var fractionalCount:FractionalCount = this.data[week][period][h3index];
                    h3sum.get(h3index).count += 1;
                    h3sum.get(h3index).fractionalCount += fractionalCount.fractionalCount;
                }
            }
        }
        var featureCollection = {type:"FeatureCollection", features:[]}
        for(var h3index of h3sum.keys()) {

            var averageFractionalCount = h3sum.get(h3index).fractionalCount / h3sum.get(h3index).count;
            var h3Coords = h3.h3ToGeoBoundary(h3index, true)
            var h3Feature = {type:"Feature", properties:{averageFractionalCount:averageFractionalCount}, geometry:{type:"Polygon", coordinates:[h3Coords]}};
            featureCollection.features.push(h3Feature);

        }

        return featureCollection;

    }
}

class ShStAvailabilityStatusAggregator extends GenericMetricAggregator<StatusMetric, FractionalCount> {

 
    getMetricName():string {
        return "shst_availability";
    }


    defaultValue():FractionalCount {
        return new FractionalCount();
    }
    
    addData(data:StatusMetric) {

        if(data.statusType === StatusMetricType.AVAILABLE) {

            var shStstatus = data.statusEvent.getShStStatusChange();

            // TODO implement (optional?) binned aggreagion -- this is just aggregating at segment level
            var shStReferenceId = shStstatus.initialShStStatus.shstLocationRef.referenceId;

            for(var period of data.statusEvent.getPeriods()) {
               this.getBin(period, shStReferenceId).add(period.fraction)
            }
        }
    }

}