
import { MDSTrip } from "../data/mds";
import { H3Status } from "../data/h3";
import { ShStTrip } from "../data/sharedstreets";
import { Point, Feature } from "@turf/helpers";
import { getCoord } from "@turf/invariant";

export abstract class H3TripAggregator {

    startH3index:string;
    endH3index:string;

    constructor(trip:MDSTrip) {

    }
}

export abstract class ShStTripAggregator {

    initialH3index:number;
    newH3index:number;

    constructor(trip:MDSTrip) {

    }
}
