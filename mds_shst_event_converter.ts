
import fetch from 'node-fetch';
import { watch } from 'fs';

const apiEndpoint = 'https://{mds endpoint url}';

async function doRequest(url) {
    const res = await fetch(url, { 
        method: 'GET',
        headers: {  'Content-Type': 'application/json',
                    'Authorization' : 'Bearer {mds api token}'
                 }
    });

    const json = await res.json();
    
    //console.log(json);
    for(var trip of json.data.trips) {
        //console.log(trip);
        var pointCount = 1;
        for(var point of trip.route.features) {
            //console.log(point);

            var tripPoint = trip.trip_id + ',' + point.properties.timestamp * 1000 + ',' +  point.geometry.coordinates[1]  + ',' +  point.geometry.coordinates[0];

            if(pointCount == 1) 
                tripPoint = tripPoint + ',START,1';
            if(pointCount == trip.route.features.length) 
                tripPoint = tripPoint + ',END,1';
            console.log(tripPoint);

            pointCount++;
        }
    }

    if(json.links.next)
        return json.links.next;
    else 
        return null;
}

async function runTripQuery() {
   var queryUrl = apiEndpoint;

    while(apiEndpoint) {
        queryUrl = await doRequest(queryUrl);
    }
}

runTripQuery();
