import { BirdMDSProvider } from "./src/provider/bird";
import { LimeMDSProvider } from "./src/provider/lime";
import { UberMDSProvider } from "./src/provider/uber";
import { MDSStatusChange } from './src/data/mds'
import { MDSStatusChangeQuery } from "./src/provider/generic";
import { InMemoryMDSStatusMap, DiskBackedMDSStatusMap } from './src/data/status_map'
import { StatusChangeEvent } from "./src/data/status_changes";
import { StatusMetric, StatusMetricType, H3AvailabilityStatusAggregator } from './src/metrics/status'

const h3 = require("h3-js");

async function getStatusChanges() {

    const mdsProvider  = new BirdMDSProvider();

    // last two hours for testing...
    var now = Math.round(Date.now() / 1000);
    var startTime = now - (60 * 60 * 2); 
    var endTime = now;//startTime + (60 * 60 * 10) 
    

    var statusEventMap = new DiskBackedMDSStatusMap();

    var mdsQuery = new MDSStatusChangeQuery(mdsProvider, startTime, endTime);
    

    await mdsQuery.run(); // loads data pages for time range query 

    var h3AvailabilityAggregator = new H3AvailabilityStatusAggregator();

    // event generator loop
    var statusEvents = statusEventMap.processStatusEvents(mdsQuery);
    for await(var event of statusEvents) {
        
        if(event.error) {
            console.log("out of order...");

            // TODO QA logging for MDS data
        }
        else {
            var statusMetric = new StatusMetric(event)
            h3AvailabilityAggregator.addData(statusMetric);
        }

        h3AvailabilityAggregator.save();
    }

    
}

getStatusChanges();