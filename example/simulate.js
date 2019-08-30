const path = require("path");
const fs = require("fs");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");
const moment = require("moment");
const exec = require("child_process").execSync;

console.log("setting up data...");
const dir = path.join(__dirname, "data");
rimraf.sync(dir);
mkdirp.sync(dir);

console.log("generating graph...");
const graph = path.join(__dirname, "graph");
rimraf.sync(graph);
mkdirp.sync(graph);
exec(
  "curl https://s3.amazonaws.com/metro-extracts.nextzen.org/nashville_tennessee.osm.pbf -o graph/nashville.osm.pbf"
);
exec(
  'osmium extract -b "-86.79611206054688,36.14612299393171,-86.7575740814209,36.17460406472864" graph/nashville.osm.pbf -o graph/nash.osm.pbf -s "complete_ways"'
);
exec(
  "../node_modules/osrm/lib/binding/osrm-extract graph/nash.osm.pbf -p ../node_modules/osrm/profiles/foot.lua;"
);
exec("../node_modules/osrm/lib/binding/osrm-contract graph/nash.osrm");

const providers = ["Flipr", "Scoob", "BikeMe", "Spuun"];

const days = 7;

const start = 1563087600000; // Sunday, July 14, 2019 3:00:00 AM GMT-04:00

var cmd = "trip-simulator ";
cmd += "--config scooter ";
cmd += "--pbf graph/nash.osm.pbf ";
cmd += "--graph graph/nash.osrm ";
cmd += "--agents {agents} ";
cmd += "--start {start} ";
cmd += "--seconds 60000 ";
cmd += "--changes data/{provider}/changes.json ";
cmd += "--trips data/{provider}/trips.json ";
cmd += "--quiet ";

const minAgents = 100;
const maxAgents = 300;

console.log("running simulations...");

for (var day = 1; day <= days; day++) {
  console.log(day + " / " + days);
  console.log("- - -");
  const time = start + day * 86400000;

  for (let provider of providers) {
    console.log("  " + provider);
    mkdirp.sync(path.join(dir, provider));
    const agents = Math.round(
      Math.random() * (maxAgents - minAgents) + minAgents
    );

    var run = cmd;
    run = run.split("{agents}").join(agents);
    run = run.split("{start}").join(time.toString());
    run = run.split("{provider}").join(provider);
    exec(run);
  }
}
