
import { MDSStatusChange } from "./mds";
import { Point, Feature } from "@turf/helpers";
import { getCoord } from "@turf/invariant";
import { IShStPeriodicDataStore } from "./sharedstreets";
import { PeriodSize, Week } from "./periodicity";

const h3 = require("h3-js");

const BASE_H3_INDEX_LEVEL = 8;

function pointToH3(point:Feature<Point>):string {
    var lnglat = getCoord(point);
    return h3.geoToH3( lnglat[1], lnglat[0], BASE_H3_INDEX_LEVEL);
}

export class H3Status {

    h3index:string;
    status:MDSStatusChange;

    constructor(status:MDSStatusChange) {
        this.status = status;
    }

    // lazy load/cache H3 index
    getH3Index():string {
        if(this.h3index)
            return this.h3index;

        this.h3index = pointToH3(this.status.event_location)
       
        return this.h3index;
    }
}

export class H3DataStore   {
    
    periodSize = PeriodSize.OneHour; // data store using defualt OneHour period

    getDataForPeriod(week:Week, periodSize:number) {

    }
}