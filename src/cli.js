#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const moment = require("moment");
const rimraf = require("rimraf");
const shst = require("sharedstreets");
const turf = require("@turf/turf");
const summarize = require("./summarize");
const cover = require("@mapbox/tile-cover");

var argv = require("minimist")(process.argv.slice(2));

if (argv.version || argv.v) {
  const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json"))
  ).version;
  console.log("v" + version);
  process.exit(0);
}

if (argv.help || argv.h || Object.keys(argv).length === 1) {
  var help = "";
  help += "\nmobility-metrics\n";
  help += "\n";
  help += "-h,--help     show help\n";
  help += "--config      path to config json file\n";
  help += "--public      path to public metric directory\n";
  help += "--cache       path to temporary data cache\n";
  help += "--startDay    start of query range (YYYY-MM-DD)\n";
  help += "--endDay      end of query range (YYYY-MM-DD)\n";
  help += "--reportDay   day of report listing (YYYY-MM-DD)\n";
  help += "--compareA    path to audit log A for comparison with B\n";
  help += "--compareAB   path to audit log B for comparison with A\n";

  console.log(help);
  process.exit(0);
} else if (argv.compareA) {
  if (!argv.compareB) throw new Error("must specify compareB for comparison");

  console.log('\u001b[37;1m  comparing audit logs... \u001b[0m')

  var compareA = {};
  var compareB = {};

  for(let file of fs.readdirSync(argv.compareA)){
    let data = JSON.parse(fs.readFileSync(path.join(argv.compareA, file)))

    if(data.provider === 'All')
      continue;

    if(!compareA[data.provider])
      compareA[data.provider] = {};
    if(!compareA[data.provider][data.day])
      compareA[data.provider][data.day] = {};

    compareA[data.provider][data.day] = data;
  }

  for(let file of fs.readdirSync(argv.compareB)){
    let data = JSON.parse(fs.readFileSync(path.join(argv.compareB, file)))

    if(data.provider === 'All')
      continue;

    if(!compareB[data.provider])
      compareB[data.provider] = {};
    if(!compareB[data.provider][data.day])
      compareB[data.provider][data.day] = {};

    compareB[data.provider][data.day] = data;
  }

  for(let provider of Object.keys(compareA)) {
    console.log("  \u001b[32m \u001b[1m " + provider + ":\u001b[0m");
    for(let day of Object.keys(compareA[provider])) {
      console.log("    \u001b[34;1m \u001b[1m " + day + ":\u001b[0m");
      if(!compareA[provider][day]){
        console.log("    \u001b[31;1m not found in data set B \u001b[0m");
      }

      // compare attributes

      if(compareA[provider][day].version !== compareB[provider][day].version){
        console.log("      \u001b[33;1m version difference: " +  compareA[provider][day].version + " <> " + compareB[provider][day].version  + " \u001b[0m");
      }
      else {
        console.log("      \u001b[37;1m version: \u001b[1m" +  compareA[provider][day].version + " \u001b[0m");
      }

      if(compareA[provider][day].totalTrips !== compareB[provider][day].totalTrips){
        console.log("      \u001b[33;1m totalTrips difference: " +  compareA[provider][day].totalTrips + " <> " + compareB[provider][day].totalTrips  + " \u001b[0m");
      }
      else {
        console.log("      \u001b[37;1m totalTrips: \u001b[1m" +  compareA[provider][day].totalTrips + " \u001b[0m");
      }

      if(compareA[provider][day].totalVehicles !== compareB[provider][day].totalVehicles){
        console.log("      \u001b[33;1m totalVehicles difference: " +  compareA[provider][day].totalVehicles + " <> " + compareB[provider][day].totalVehicles  + " \u001b[0m");
      }
      else {
        console.log("      \u001b[37;1m totalVehicles: \u001b[1m" +  compareA[provider][day].totalVehicles + " \u001b[0m");
      }

      if(compareA[provider][day].totalChanges !== compareB[provider][day].totalChanges){
        console.log("      \u001b[33;1m totalChanges difference: " +  compareA[provider][day].totalChanges + " <> " + compareB[provider][day].totalChanges  + " \u001b[0m");
      }
      else {
        console.log("      \u001b[37;1m totalChanges: \u001b[1m" +  compareA[provider][day].totalChanges + " \u001b[0m");
      }

      if(argv.compareHashes) {
        // compare trip hashes

        const tripHashesA = new Set(compareA[provider][day].tripHashes);
        const tripHashesB = new Set(compareB[provider][day].tripHashes);

        var firstLine = true;
        for(let tripHash of compareA[provider][day].tripHashes) {
          if(!tripHashesB.has(tripHash)) {
            if(firstLine) {
              console.log("      \u001b[33;1m tripHashes in A missing from B: \u001b[0m");
              firstLine = false;
            }
            console.log("          " + tripHash );
          }
        }

        for(let tripHash of compareB[provider][day].tripHashes) {
          if(!tripHashesA.has(tripHash)) {
            if(firstLine) {
              console.log("      \u001b[33;1m tripHashes in B missing from A: \u001b[0m");
              firstLine = false;
            }
            console.log("          " + tripHash );
          }
        }

        // compare change hashes

        const changeHashesA = new Set(compareA[provider][day].changeHashes);
        const changeHashesB = new Set(compareB[provider][day].changeHashes);

        var firstLine = true;
        for(let changeHash of compareA[provider][day].changeHashes) {
          if(!changeHashesB.has(changeHash)) {
            if(firstLine) {
              console.log("      \u001b[33;1m changeHash in A missing from B: \u001b[0m");
              firstLine = false;
            }
            console.log("          " + changeHash );
          }
        }

        var firstLine = true;
        for(let changeHash of compareB[provider][day].changeHashes) {
          if(!changeHashesA.has(changeHash)) {
            if(firstLine) {
              console.log("      \u001b[33;1m changeHash in A missing from B: \u001b[0m");
              firstLine = false;
            }
            console.log("          " + changeHash );
          }
        }
      }

    }
  }


  ///Users/kpw/workspace/sharedstreets/mobility-metrics/public/audits/2019-07-21/2020-12-01_14.27.36

  return;
}
else {
  if (!argv.config) throw new Error("specify config file");
  if (!argv.public) throw new Error("specify public metric directory");
  if (!argv.cache) throw new Error("specify temporary data cache");
  if (!argv.startDay)
    throw new Error("specify start of query range (YYYY-MM-DD)");
  if (!argv.endDay) throw new Error("specify end of query range (YYYY-MM-DD)");
  if (!argv.reportDay)
    throw new Error("specify day of report listing (YYYY-MM-DD)");
}

const config = require(path.resolve(argv.config));
// add spatial indices to zones
if (!config.zones) {
  config.zones = turf.FeatureCollection([]);
}
const z = 19;
const zs = { min_zoom: z, max_zoom: z };
for (let zone of config.zones.features) {
  zone.properties.keys = {};
  const keys = cover.indexes(zone.geometry, zs);
  for (let key of keys) {
    zone.properties.keys[key] = 1;
  }
}
// build geographicFilter lookup
if (config.geographicFilter) {
  config.geographicFilterKeys = {};
  cover.indexes(config.geographicFilter.geometry, zs).forEach(qk => {
    config.geographicFilterKeys[qk] = 1;
  });
}

// check for valid vehicleFilter
if (
  config.vehicleFilter &&
  (config.vehicleFilter !== "car" &&
    config.vehicleFilter !== "bicycle" &&
    config.vehicleFilter !== "scooter")
) {
  throw new Error("detected invalid vehicle filter");
}

// defaults
if (!config.zoom) config.zoom = 12.5;
if (!config.lost) config.lost = 2;
if (!config.privacyMinimum || config.privacyMinimum < 3)
  config.privacyMinimum = 3;
if (!config.summary)
  config.summary = {
    "Unique Vehicles": true,
    "Active Vehicles": true,
    "Total Trips": true,
    "Total Trip Distance": true,
    "Distance Per Vehicle": true,
    "Vehicle Utilization": true,
    "Trips Per Active Vehicle": true,
    "Avg Trip Distance": true,
    "Avg Trip Duration": true
  };

const publicPath = path.resolve(argv.public);
const cachePath = path.resolve(argv.cache);

const startDay = moment(argv.startDay, "YYYY-MM-DD");
const endDay = moment(argv.endDay, "YYYY-MM-DD");
const reportDay = moment(argv.reportDay, "YYYY-MM-DD");

const backfill = async function() {
  return new Promise(async (resolve, reject) => {
    const envelope = turf.bboxPolygon(config.boundary).geometry;

    // get graph
    const graphOpts = {
      source: "osm/planet-181224",
      tileHierarchy: 6
    };
    var graph = new shst.Graph(envelope, graphOpts);
    await graph.buildGraph();

    await summarize(
      startDay,
      endDay,
      reportDay,
      shst,
      graph,
      publicPath,
      cachePath,
      config
    );

    resolve();
  });
};

backfill()
  .then(() => {
    rimraf.sync(cachePath);

    console.log("\ncompleted backfill");
  })
  .catch(err => {
    console.error(err.message);
  });
