const path = require("path");
const moment = require("moment");
const rimraf = require("rimraf");
const summarize = require("./summarize");

var argv = require("minimist")(process.argv.slice(2));

const day = moment(argv.day, "YYYY-MM-DD");
var days = +argv.days;

const store = path.join(__dirname, "./../data");

const backfill = async function() {
  return new Promise(async (resolve, reject) => {
    while (days--) {
      const current = day.clone().subtract(days, "day");
      console.log("building: ", current.format("YYYY-MM-DD"));
      await summarize(current.format("YYYY-MM-DD"));
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
