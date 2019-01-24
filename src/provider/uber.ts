
import fetch from 'node-fetch';
import { GenericMDSProvider, GenericMDSProviderAuth} from './generic';
import { MDSStatusChange } from '../data/mds';


class UberProviderAuth extends GenericMDSProviderAuth {

    // TODO add default urls to bootstraped config file..
    constructor(providerName) {
        super(providerName);
        
        this.loadCredentials();
    }

    async doAuth() {
        // TODO check uber token expiration and re-request
    }
}

export class UberMDSProvider extends GenericMDSProvider {

    providerName:string;
    auth:UberProviderAuth;

    constructor() {
        super();
        this.providerName = "uber";
        this.auth = new UberProviderAuth(this.providerName);
        this.auth.doAuth();
    }
    
    getStatusChangeQueryUrl(startTime:number,endTime:number):string {
        return this.auth.urls.status_changes + "?start_time=" + startTime + "&end_time=" + endTime; 
    }
    
    
    getTripQueryUrl(startTime:number,endTime:number):string {
        return this.auth.urls.trips;
    }
    
    async makeRequest(url):Promise<any> {

        var data = await fetch(url, { 
            method: 'GET',
            headers: {  'Content-Type': 'application/json',
                        'Authorization' : 'Bearer ' + this.auth.token
                     }
        });

        return data.json();
    }

}

