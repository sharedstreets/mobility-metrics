import fetch from "node-fetch";
import {
  GenericMDSProvider,
  GenericMDSProviderAuth,
  MDSStatusChangesDataPage
} from "./generic";
import { MDSStatusChange } from "../data/mds";

class BirdProviderAuth extends GenericMDSProviderAuth {
  // TODO add default urls to bootstraped config file...

  async doAuth() {
    // noop for bird api?
  }
}

export class BirdMDSProvider extends GenericMDSProvider {
  providerName: string;
  auth: BirdProviderAuth;

  constructor() {
    super();
    this.providerName = "bird";
    this.auth = new BirdProviderAuth(this.providerName);
    this.auth.doAuth();
  }

  getStatusChangeQueryUrl(startTime: number, endTime: number): string {
    return (
      this.auth.urls.status_changes +
      "?start_time=" +
      startTime +
      "&end_time=" +
      endTime
    );
  }

  getTripQueryUrl(startTime: number, endTime: number): string {
    return this.auth.urls.trips;
  }

  async makeRequest(url): Promise<any> {
    var data = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "APP-Version": "3.0.0",
        Authorization: "Bird " + this.auth.token
      }
    });

    return data.json();
  }
}
