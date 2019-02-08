import * as fs from "fs";
import { H3AvailabilityStatusAggregator } from "./src/metrics/status";

const { fork } = require('child_process');
const { join } = require('path');

var cors = require('cors')
const express = require('express');
const app = express();

app.use(cors())

// boot the mds data processor 
const childProcess = fork('mds_processor.ts');

var port = '8082';

app.get('/metric/:metric/:week/:period', async (req, res) => 
{
  if(req.params.week && req.params.period) {
        var weeks = [req.params.week];
        var period = req.params.period;

        if(req.params.metric === 'h3_availability') {
            
            var availabilityStatus = new H3AvailabilityStatusAggregator();  
            try {
                var geoJson = availabilityStatus.getGeoJson(weeks,period);
                res.send(geoJson);
            }
            catch(e) {
                console.log(e);
            }
        }
    }
});

app.listen(port, () => console.log(`app listening on port ${port}!`));
