import { MDSStatusChange } from "../data/mds";
import { stat } from "fs";
import { StatusChangeEvent } from "./status_changes";
import { MDSStatusChangeQuery } from "../provider/generic";
import { LevelDB } from "./leveldb";

const DEFAULT_DATA_DIRECTORY = './data/mds_status_map/';

// keeps track of processed status change events and caches (encryped!) 
// last status data for generating status transitions
export abstract class MDSStatusMap {

    abstract async getStatus(status:MDSStatusChange):Promise<MDSStatusChange>;
    abstract async setStatus(MDSStatusChange);
    abstract async alreadyLogged(MDSStatusChange, boolean):Promise<boolean>;

    async *processStatusEvents(data:MDSStatusChangeQuery):AsyncIterableIterator<StatusChangeEvent> {
        var alreadyProcessedRecords = 0;
        
        for(var newStatus of data.getSortedResults()) {

            // only generate events for new, previously unprocessed status changes
            if(! await this.alreadyLogged(newStatus, true)){
                var oldStatus = await this.setStatus(newStatus);
                if(oldStatus)
                    yield new StatusChangeEvent(oldStatus, newStatus);
            }
            else {
                alreadyProcessedRecords++;
                // TODO duplicate record QA?
            }
            
        }

        if(alreadyProcessedRecords > 0)
        console.log(alreadyProcessedRecords + " already processed records (skipping)")
    }   
}

export class InMemoryMDSStatusMap extends MDSStatusMap {

    data:Map<string, MDSStatusChange> = new Map<string, MDSStatusChange>();
    loggedStatusEvents:Map<string, true> = new Map<string, true>();

    constructor() {
        super();
    }

    async alreadyLogged(status:MDSStatusChange, logStatus:boolean):Promise<boolean> {
        if(this.loggedStatusEvents.has(status.getId()))
            return true;
        
        if(logStatus)
            this.loggedStatusEvents.set(status.getId(), true);

        return false;
    }

    async getStatus(status:MDSStatusChange):Promise<MDSStatusChange> {
        return this.data.get(status.getDeviceId());
    }

    async setStatus(status:MDSStatusChange):Promise<MDSStatusChange> {
        var oldStatus = this.getStatus(status);
        this.data.set(status.getDeviceId(), status);
        return oldStatus;
    }
    
}

// Levelup disk-backed data store 
export class DiskBackedMDSStatusMap extends MDSStatusMap {
    
    db:LevelDB;
    encrypt:boolean

    // TODO add encryption to  MDSStatusChange methods for disk backed data storage
    constructor(directory=DEFAULT_DATA_DIRECTORY, encrypt:boolean=true) {
        super();
        this.db = new LevelDB(directory);
        this.encrypt = encrypt;
    }

    async alreadyLogged(status:MDSStatusChange, logStatus:boolean):Promise<boolean> {
        var eventKey = 'event-id-' + status.getId();

        var exists = await this.db.has(eventKey);
        if(!exists && logStatus)
                await this.db.put(eventKey, true);

        return exists;
    }

    async getStatus(status:MDSStatusChange):Promise<MDSStatusChange> {
        
        var data = await this.db.get(status.getDeviceId());

        if(data && this.encrypt)
            return new MDSStatusChange(data, status.getRecordSecret());
        else 
            return JSON.parse(data);
    
    }

    async setStatus(status:MDSStatusChange):Promise<MDSStatusChange> {
        
        var data;

        if(this.encrypt)
            data = status.encrypt();
        else 
            data = JSON.stringify(status);

        var oldStatus = await this.getStatus(status);
        await this.db.put(status.getDeviceId(), data);

        return oldStatus;

    }
}