const path = require("path");
const moment = require("moment");
const rimraf = require("rimraf");
const shst = require("sharedstreets");
const summarize = require("./summarize");

var argv = require("minimist")(process.argv.slice(2));

const day = moment(argv.day, "YYYY-MM-DD");
var days = +argv.days;

const store = path.join(__dirname, "./../data");

const backfill = async function() {
  return new Promise(async (resolve, reject) => {
    // get graph
    graphOpts = {
      source: "osm/planet-181224",
      tileHierarchy: 6
    };
    var graph = new shst.Graph(
      {
        type: "Polygon",
        coordinates: [
          [
            [-83.17680358886719, 42.313369811689746],
            [-82.99072265625, 42.313369811689746],
            [-82.99072265625, 42.416359972082866],
            [-83.17680358886719, 42.416359972082866],
            [-83.17680358886719, 42.313369811689746]
          ]
        ]
      },
      graphOpts
    );

    await graph.buildGraph();

    while (days--) {
      const current = day.clone().subtract(days, "day");
      console.log("building: ", current.format("YYYY-MM-DD"));
      await summarize(current.format("YYYY-MM-DD"), graph);
    }
    resolve();
  });
};

const clearDir = async function(dir) {
  return new Promise((resolve, reject) => {
    rimraf(dir, () => {
      resolve();
    });
  });
};

backfill().then(() => {
  console.log("\ncompleted backfill");
});
