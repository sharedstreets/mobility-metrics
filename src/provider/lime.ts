import fetch from "node-fetch";
import {
  GenericMDSProvider,
  GenericMDSProviderAuth,
  MDSStatusChangesDataPage
} from "./generic";
import { MDSStatusChange } from "../data/mds";

class LimeProviderAuth extends GenericMDSProviderAuth {
  // Lime urls appear to be market specific
  // TODO add mechanism for managing multiple URLs +  bootstraping config file

  async doAuth() {
    // noop for lime api
  }
}

export class LimeMDSProvider extends GenericMDSProvider {
  providerName: string;
  auth: LimeProviderAuth;

  constructor() {
    super();
    this.providerName = "lime";
    this.auth = new LimeProviderAuth(this.providerName);
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
        Authorization: "Bearer " + this.auth.token
      }
    });

    return data.json();
  }
}
