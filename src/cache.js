const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const queue = require("d3-queue").queue;
const through2 = require("through2");
const moment = require("moment");
const local = require("./providers/local");
const mds = require("./providers/mds");
//const all require('./all')
const config = require("../config.json");

const cachePath = path.join(__dirname, "./../cache");

const providers = Object.keys(config.providers);

const cache = async function(dayString) {
  var day = moment(dayString, "YYYY-MM-DD");
  const stop = Math.round(
    +day
      .clone()
      .add(1, "day")
      .format("X")
  );
  const start = Math.round(+day.format("X"));

  const cacheDayPath = path.join(cachePath, "./" + day.format("YYYY-MM-DD"));

  for (let name of providers) {
    const provider = config.providers[name];
    console.log("    " + name + "...");

    var cacheDayProviderPath = path.join(cacheDayPath, "./" + name);
    mkdirp.sync(cacheDayProviderPath);
    var cacheDayProviderTripsStream = fs.createWriteStream(
      path.join(cacheDayProviderPath, "./trips.json")
    );
    var cacheDayProviderChangesStream = fs.createWriteStream(
      path.join(cacheDayProviderPath, "./changes.json")
    );

    await mds.trips(provider, cacheDayProviderTripsStream, start, stop);
    await mds.changes(provider, cacheDayProviderChangesStream, start, stop);
  }
};

module.exports = cache;
