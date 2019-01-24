import {Feature, Point, LineString} from '@turf/helpers';
import { EncryptableData } from './crypto';

const uuidHash = require('uuid-by-string')

export enum VehicleType {
    BICYLCE = 'bicycle',
    SCOOTER = 'scooter'
}

export enum PropulsionType {
    HUMAN = 'human',
    ELECTRIC_ASSIST = 'electric_assist',
    ELECTRIC = 'electric',
    COMBUSTION = 'combustion'
}

export abstract class MDSData extends EncryptableData<MDSData> {

    provider_id:string;
    provider_name:string;
    device_id:string;
    vehicle_id:String;
    vehicle_type:VehicleType
    propulsion_type:PropulsionType[];

    constructor(data=null, getRecordSecret:string='') {
        
        super(data, getRecordSecret);

        if(data != null && typeof data === "object") {
            this.provider_id = data.provider_id;
            this.provider_name = data.provider_name;
            this.device_id = data.device_id;
            this.vehicle_id = data.vehicle_id;

            this.vehicle_type  = data.vehicle_type as VehicleType;
            
            this.propulsion_type = [];
            if(data.propulsion_type) {
                for(var propulsionType of data.propulsion_type) {
                    this.propulsion_type.push(propulsionType as PropulsionType);
                }
            }
        }
    }

    // generates local device ID from UUIDv5 hash for data item
    // We're doing this to mask both provider and provider supplied device IDs
    // TODO salt uuids hashes?
    getDeviceId():string {    
        return uuidHash(this.provider_id + ':' + this.device_id);
    }

    // returns a record-level secret to combine with shared local key -- 
    // means data can only be decrypted by users with access to MDS data source 
    // and records for specific device
    // the provider supplied device _id is never stored in an unencrpyted state 
    // so we use it as a secret for unlocking locally cached data
    getRecordSecret():string {
        return this.device_id;
    }
 
    // generates UUIDv5 hash for data item
    abstract getId():string;
}

export class MDSTrip extends MDSData {

    trip_id:string;
    trip_duration:number;
    trip_distance:number;
    route:Feature<LineString>;
    accuracy:number;
    start_time:number;	
    end_time:number;
    parking_verification_url:string;
    standard_cost:number;
    actual_cost:number;

    constructor(data=null, getRecordSecret:string='') {
        super(data, getRecordSecret);

        if(data != null && typeof data === "object") {
            this.trip_id = data.trip_id;
            this.trip_duration = data.trip_duration;
            this.trip_distance = data.trip_distance;

            // TODO validate route is Feature<LineString>
            this.route = data.route;
            this.accuracy = data.accuracy;
            this.start_time = data.start_time;
            this.end_time = data.end_time;
            this.parking_verification_url = data.parking_verification_url;
            this.standard_cost = data.standard_cost;
            this.actual_cost = data.actual_cost;
        }
    }

    getId():string {    
        return uuidHash(this.provider_id + ':' + this.trip_id);
    }
}

export enum EventType {
    AVAILABLE = "available",
    RESERVED = "reserved",
    UNAVAILABLE = "unavailable", 
    REMOVED = "removed"
}

export enum EventTypeReason {
    SERVICE_START = "service_start",
    USER_DROP_OFF = "user_drop_off",
    REBALANCE_DROP_OFF = "rebalance_drop_off",
    MAINTENANCE_DROP_OFF = "maintenance_drop_off",
    USER_PICK_UP = "user_pick_up",	
    MAINTENANCE = "maintenance",
    LOW_BATTERY = "low_battery",
    SERVICE_END = "service_end",
    REBALANECE = "rebalance_pick_up",
    MAINTENANCE_PICK_UP = "maintenance_pick_up"
}

export class MDSStatusChange extends MDSData {

    event_type:EventType;
    event_type_reason:EventTypeReason;
    event_time:number;
    event_location:Feature<Point>;	
    battery_pct:number;
    associated_trip:string[];

    constructor(data=null, getRecordSecret:string='') {
        super(data, getRecordSecret);

        if(data != null && typeof data === "object") {
            this.event_type  = data.event_type as EventType;
            this.event_type_reason  = data.event_type_reason as EventTypeReason;
        
            this.event_time = data.event_time;
            this.event_location = data.event_location;
            this.battery_pct = data.battery_pct        
            this.associated_trip = data.associated_trip;
        }
    }

    getId():string {
        return uuidHash(this.provider_id + ":" + this.device_id + ":" + this.event_type + ":" + this.event_type_reason + ":" + this.event_time);
    }
}

