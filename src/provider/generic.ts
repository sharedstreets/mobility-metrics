

import * as fs from "fs";
import { MDSTrip, MDSStatusChange, MDSData } from "../data/mds";

const untildify = require('untildify');

const BASE_CREDENTIALS = untildify('~/.mds_shst_credentials');

function getCredentialsPath(providerName:string):string {
    return BASE_CREDENTIALS + '/' + providerName + '.json';
}

abstract class MDSQuery<T extends MDSData> {

    provider:GenericMDSProvider;
    startTime:number;
    endTime:number;

    abstract pages:MDSDataPage<T>[];    

    constructor(provider:GenericMDSProvider, startTime:number, endTime:number) {
        this.provider = provider;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    abstract async run();

    abstract getSortedResults():T[];
}

export class MDSStatusChangeQuery extends MDSQuery<MDSStatusChange> {
    
    pages:MDSDataPage<MDSStatusChange>[];
    
    async run() {
        this.pages = [];

        var url = this.provider.getStatusChangeQueryUrl(this.startTime, this.endTime);
        
        do {
            console.log('requesting: ' + url)
            var data = await this.provider.makeRequest(url);
            var dataPage = new MDSStatusChangesDataPage(data);
            this.pages.push(dataPage);
            console.log(dataPage.data.length + ' records loaded');
            url = dataPage.nextPage;

        } while(url)

    }

    getSortedResults():MDSStatusChange[] {

        var mergedResults:MDSStatusChange[] = [];
        
        for(var page of this.pages) {
            for(var item of page.data) {
                mergedResults.push(item);
            }
        }

        mergedResults.sort(function(a,b){
            return a.event_time > b.event_time ? 1 : -1;
        });
          
        return mergedResults;
    }
}

abstract class MDSDataPage<T extends MDSData> {

    nextPage:string;
    previousPage:string;
    lastPage:string;

    abstract data:T[];

    constructor(mdsResponse) {
        if(mdsResponse && mdsResponse.links) {
            this.nextPage = mdsResponse.links.next;
            this.previousPage = mdsResponse.links.prev;
            this.lastPage = mdsResponse.links.last;
        }
    }
}

export class MDSStatusChangesDataPage extends MDSDataPage<MDSStatusChange> {

    data:MDSStatusChange[];

    constructor(mdsResponse) {
        super(mdsResponse);
        this.data = [];

        for(var item of mdsResponse.data.status_changes) {
            var mdsStatusChange = new MDSStatusChange(item);
            this.data.push(mdsStatusChange);
        }
    }
}

// export class MDSTripsDataPage extends MDSDataPage<MDSTrip> {

//     data:MDSTrip[];

//     constructor(mdsResponse) {
//         super(mdsResponse);
//         this.data = [];
//         for(var item of mdsResponse.data.trips) {
//             var mdsTrip = new MDSTrip(item);
//             this.data.push(mdsTrip);
            
//         }
//     }
// }


abstract class GenericMDSProviderAuthUrls {
    trips:string;
    status_changes:string;
}
    
export abstract class GenericMDSProviderAuth {

    providerName:string;
    auth:{};
    
    urls:GenericMDSProviderAuthUrls;

    token:string;
    tokenExpiration:number;

    constructor(providerName) {
        this.providerName = providerName;
        this.loadCredentials()
    }

    loadCredentials() {

        var credentialsPath = getCredentialsPath(this.providerName);

        try {
            var content = fs.readFileSync(credentialsPath);
            var jsonContent = JSON.parse(content.toString());
        }
        catch(e) {
            throw new Error("Unable to load credentials file: " + credentialsPath);
        }
        
        if(jsonContent['auth']) {
            this.auth = jsonContent['auth'];
        }

        if(jsonContent['urls']) {
            this.urls = jsonContent['urls'];
        }

        if(jsonContent['token']) {
            this.token = jsonContent['token'];
        }

        if(jsonContent['tokenExpiration']) {
            this.tokenExpiration = jsonContent['tokenExpiration'];
        }

        if(this.token == null && this.auth == null && this.urls == null) {
            throw new Error("Credentials file does not contain 'auth' or 'token' data: " + credentialsPath);
        }

    }

    saveCredentials() {
        
        var credentialsPath = getCredentialsPath(this.providerName);

        try {
            var jsonContent = JSON.stringify(this);
            fs.writeFileSync(credentialsPath, jsonContent);            
        }
        catch(e) {
            throw new Error("Unable to save credentials file: " + credentialsPath);
        }
        
    }   

    abstract doAuth();
}

export abstract class GenericMDSProvider {

    abstract providerName:string;
    abstract auth:GenericMDSProviderAuth;

    abstract getStatusChangeQueryUrl(startTime:number,endTime:number):string;
    abstract getTripQueryUrl(startTime:number,endTime:number):string;

    abstract async makeRequest(url:string):Promise<any>

}