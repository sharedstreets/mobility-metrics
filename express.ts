import * as fs from "fs";
const h3 = require("h3-js");
const express = require('express')
const app = express()

var port = '8082';

app.get('/metric/availability/:week/:period', async (req, res) => 
{
  if(req.params.week && req.params.period) {
    
        var content = fs.readFileSync('data/metrics/availability/' + req.params.week);
        var data = JSON.parse(content.toString());

        var polygons = {type:"FeatureCollection", features:[]};
   

        if(data[req.params.period]) {
            var h3bins = data[req.params.period];
            for(var h3index of Object.keys(h3bins)) {
                var h3Coords = h3.h3ToGeoBoundary(h3index, true)
                var h3Feature = {type:"Feature", properties:{count:h3bins[h3index].fractionalCount}, geometry:{type:"Polygon", coordinates:[h3Coords]}};
                polygons.features.push(h3Feature);
            }
        }

        res.send(polygons);
    }
});

app.listen(port, () => console.log(`app listening on port ${port}!`));
