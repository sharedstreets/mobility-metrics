import { MDSStatusChange } from "./mds";
import { Point, Feature } from "@turf/helpers";
import { getCoord } from "@turf/invariant";

import fetch from 'node-fetch';
import { Week, PeriodSize } from "./periodicity";

const SHST_API_KEY = "bdd23fa1-7ac5-4158-b354-22ec946bb575";
const SHST_API_SEARCH_RADIUS = 50; // meters 

//const SHST_API_DATASOURCE = 'planet-181029';
//const SHST_API_STREET_LEVEL = 6;


export class SharedStreetsLocationRef {
    referenceId:string;
    location:number;
}

async function pointToShStLocationRef(point:Feature<Point>):Promise<SharedStreetsLocationRef> {
    var lnglat = getCoord(point);

    // request 
    var url = 'https://api.sharedstreets.io/v0.1.0/match/point/' + 
        lnglat[0] + ',' + 
        lnglat[1] + 
        '?&searchRadius=' + SHST_API_SEARCH_RADIUS + 
        '&maxCandidates=1&authKey=' + SHST_API_KEY;

    try {
        var response = await fetch(url, { 
            method: 'GET'
        });
    
        var data = await response.json();
        var locationRef = new SharedStreetsLocationRef();

        if( data.features.length > 0) {
            locationRef.referenceId = data.features[0].properties.referenceId;
            locationRef.location = data.features[0].properties.location;
            
            return locationRef;
        }

    }
    catch(e) {
        // TODO -- handle retry on failed API call
    }

    return null;
}

export class ShStStatus {

    shstLocationRef:SharedStreetsLocationRef;

    status:MDSStatusChange;

    constructor(status:MDSStatusChange) {
        this.status = status;
    }

     // lazy load/cache ShSt location ref
    async getLocationReference():Promise<SharedStreetsLocationRef> {

        if(this.shstLocationRef)
            return this.shstLocationRef;

        this.shstLocationRef = await pointToShStLocationRef(this.status.event_location);

        return this.shstLocationRef;
    }
}

export class ShStTrip { 
    // TODO
}


export abstract class ShStPeriodicData {
    week:Week;
    periodOffset:number;

    data; // un-typed for time being...
}

export interface IShStPeriodicDataStore {

    periodSize:PeriodSize;

    getDataForPeriod(week:Week, periodOffset:number):ShStPeriodicData
}