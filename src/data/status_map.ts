import { MDSStatusChange } from "../data/mds";
import { stat } from "fs";
import { StatusChangeEvent } from "./status_changes";
import { MDSStatusChangeQuery } from "../provider/generic";

const DEFAULT_DATA_DIRECTORY = './data/mds_status_map/';


// keeps track of processed status change events and caches (encryped!) 
// last status data for generating status transitions
export abstract class MDSStatusMap {

    abstract async getStatus(status:MDSStatusChange):Promise<MDSStatusChange>;
    abstract async setStatus(MDSStatusChange);
    abstract async checkStatus(MDSStatusChange, boolean):Promise<boolean>;

    async *processStatusEvents(data:MDSStatusChangeQuery):AsyncIterableIterator<StatusChangeEvent> {
        for(var newStatus of data.getSortedResults()) {

            // only generate events for new, previously unprocessed status changes
            if(await this.checkStatus(newStatus, true)){
                var oldStatus = await this.setStatus(newStatus);
                if(oldStatus) {
                    yield new StatusChangeEvent(oldStatus, newStatus);
                }
            }
            else {
                // TODO duplicate record QA?
            }
            
        }
    }   
}

export class InMemoryMDSStatusMap extends MDSStatusMap {

    data:Map<string, MDSStatusChange> = new Map<string, MDSStatusChange>();
    loggedStatusEvents:Map<string, true> = new Map<string, true>();

    constructor() {
        super();
    }

    async checkStatus(status:MDSStatusChange, logStatus:boolean):Promise<boolean> {
        if(this.loggedStatusEvents.has(status.getId()))
            return false;
        
        if(logStatus)
            this.loggedStatusEvents.set(status.getId(), true);
        return true;
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

// simple disk-backed data store -- uses node-persist to store MDS status to disk
// TODO switch to LevelDB/LevelUp: https://www.npmjs.com/package/levelup
export class DiskBackedMDSStatusMap extends MDSStatusMap {
    
    storage;
    encrypt:boolean

    // TODO add encryption to  MDSStatusChange methods for disk backed data storage
    constructor(directory=DEFAULT_DATA_DIRECTORY, encrypt:boolean=true) {
        super();
        this.storage = require('node-persist');
        this.storage.init({dir: directory});
        this.encrypt = encrypt;
    }

    async checkStatus(status:MDSStatusChange, logStatus:boolean):Promise<boolean> {
        var eventKey = 'event-id-' + status.getId();
        if(await this.storage.getItem(eventKey))
            return false;
        
        if(logStatus)
            await this.storage.setItem(eventKey, true);
            
        return true;
    }

    async getStatus(status:MDSStatusChange):Promise<MDSStatusChange> {
        var data = await this.storage.getItem(status.getDeviceId());

        if(this.encrypt)
            return new MDSStatusChange(data, status.getRecordSecret());
        else 
            return data;
            
    }

    async setStatus(status:MDSStatusChange):Promise<MDSStatusChange> {
        var data;

        if(this.encrypt)
            data = status.encrypt();
        else 
            data = status;

        var oldStatus = await this.getStatus(status);
        await this.storage.setItem(status.getDeviceId(), data);
        return oldStatus;

    }
}