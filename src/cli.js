#!/usr/bin/env node

const path = require("path");
const moment = require("moment");
const rimraf = require("rimraf");
const shst = require("sharedstreets");
const turf = require("@turf/turf");
const summarize = require("./summarize");
const cover = require("@mapbox/tile-cover");

var argv = require("minimist")(process.argv.slice(2));

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

  console.log(help);
  process.exit(0);
} else {
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
const z = 19;
const zs = { min_zoom: z, max_zoom: z };
if (config.zones) {
  for (let zone of config.zones.features) {
    zone.properties.keys = {};
    const keys = cover.indexes(zone.geometry, zs);
    for (let key of keys) {
      zone.properties.keys[key] = 1;
    }
  }
}

const publicPath = path.resolve(argv.public);
const cachePath = path.resolve(argv.cache);

const debug = argv.debug;
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
    if (!debug) rimraf.sync(path.join(__dirname, cachePath));
    console.log("\ncompleted backfill");
  })
  .catch(err => {
    console.error(err.message);
  });
