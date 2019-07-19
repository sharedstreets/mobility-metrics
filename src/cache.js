const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const queue = require("d3-queue").queue;
const through2 = require("through2");
const moment = require("moment");
const local = require("./providers/local");
const mds = require("./providers/mds");

const cache = async function(dayString, cachePath, config) {
  const providers = Object.keys(config.providers).filter(provider => {
    return config.providers[provider].enabled;
  });

  var day = moment(dayString, "YYYY-MM-DD");
  const stop = Math.round(
    +day
      .clone()
      .add(1, "day")
      .format("X")
  );
  const start = Math.round(+day.format("X"));

  const cacheDayPath = path.join(cachePath, day.format("YYYY-MM-DD"));
  const cacheDayAllPath = path.join(cacheDayPath, "./All");
  const cacheDayAllTripsPath = path.join(cacheDayAllPath, "trips.json");
  const cacheDayAllChangesPath = path.join(cacheDayAllPath, "changes.json");
  mkdirp.sync(cacheDayAllPath);

  for (let name of providers) {
    const provider = config.providers[name];
    console.log("    " + name + "...");

    var cacheDayProviderPath = path.join(cacheDayPath, name);
    mkdirp.sync(cacheDayProviderPath);

    const cacheDayProviderTripsPath = path.join(
      cacheDayProviderPath,
      "trips.json"
    );
    const cacheDayProviderChangesPath = path.join(
      cacheDayProviderPath,
      "changes.json"
    );

    var cacheDayProviderTripsStream = fs.createWriteStream(
      cacheDayProviderTripsPath
    );
    var cacheDayProviderChangesStream = fs.createWriteStream(
      cacheDayProviderChangesPath
    );

    if (provider.type === "mds") {
      await mds.trips(
        provider,
        cacheDayProviderTripsStream,
        start,
        stop,
        config
      );
      await mds.changes(
        provider,
        cacheDayProviderChangesStream,
        start,
        stop,
        config
      );
    } else if (provider.type === "local") {
      await local.trips(
        provider,
        cacheDayProviderTripsStream,
        start,
        stop,
        config
      );
      await local.changes(
        provider,
        cacheDayProviderChangesStream,
        start,
        stop,
        config
      );
    }

    const tripsData = fs.readFileSync(cacheDayProviderTripsPath).toString();
    const changesData = fs.readFileSync(cacheDayProviderChangesPath).toString();

    fs.appendFileSync(cacheDayAllTripsPath, tripsData);
    fs.appendFileSync(cacheDayAllChangesPath, changesData);
  }
};

module.exports = cache;
