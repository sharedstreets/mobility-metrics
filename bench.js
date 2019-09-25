const fs = require("fs");
const turf = require("@turf/turf");
const shst = require("sharedstreets");
const tripMatch = require("./src/matchers/trip");
const changeMatch = require("./src/matchers/change");
const config = require("./test/fixtures/cli/config.json");
const cover = require("@mapbox/tile-cover");

const z = 19;
const zs = { min_zoom: z, max_zoom: z };

async function bench() {
  config.zones.features = config.zones.features.map(zone => {
    zone.properties.keys = {};
    cover.indexes(zone.geometry, zs).forEach(key => {
      zone.properties.keys[key] = 1;
    });
    return zone;
  });

  const envelope = turf.bboxPolygon(config.boundary).geometry;
  const graphOpts = {
    source: "osm/planet-181224",
    tileHierarchy: 6
  };
  var graph = new shst.Graph(envelope, graphOpts);
  await graph.buildGraph();

  const trips = fs
    .readFileSync("./example/data/Spuun/trips.json")
    .toString()
    .split("\n")
    .filter(l => {
      return l.length;
    })
    .map(JSON.parse);

  const changes = fs
    .readFileSync("./example/data/Spuun/changes.json")
    .toString()
    .split("\n")
    .filter(l => {
      return l.length;
    })
    .map(JSON.parse);

  var start = new Date().getTime();

  var count = 0;

  for (let trip of trips) {
    count++;
    await tripMatch(trip, config, graph);
  }

  var stop = new Date().getTime();

  console.log("trip match avg: " + ((stop - start) / count).toFixed(4) + "ms");
  console.log("measured across " + count + " trips");
  count = 0;
  start = new Date().getTime();

  for (let change of changes) {
    count++;
    await changeMatch(change, config, graph);
  }

  stop = new Date().getTime();
  console.log(
    "change match avg: " + ((stop - start) / count).toFixed(4) + "ms"
  );
  console.log("measured across " + count + " changes");
}

bench();
