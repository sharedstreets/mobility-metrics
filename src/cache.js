const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const queue = require("d3-queue").queue;
const through2 = require("through2");
const moment = require("moment");
const local = require("./providers/local");
const mds = require("./providers/mds");

const cache = async function(
  startDay,
  endDay,
  reportDay,
  cachePath,
  graph,
  config
) {
  var version = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json")).toString()
  ).version;

  const providers = Object.keys(config.providers).filter(provider => {
    return config.providers[provider].enabled;
  });

  const start = Math.round(+startDay.subtract(config.lost, "days").format("x"));
  const stop = Math.round(+endDay.format("x"));

  const cacheDayPath = path.join(cachePath, reportDay.format("YYYY-MM-DD"));
  const cacheDayAllPath = path.join(cacheDayPath, "./All");
  const cacheDayAllTripsPath = path.join(cacheDayAllPath, "trips.json");
  const cacheDayAllChangesPath = path.join(cacheDayAllPath, "changes.json");
  mkdirp.sync(cacheDayAllPath);

  for (let name of providers) {
    const provider = config.providers[name];
    console.log("    " + name + "...");

    var cacheDayProviderPath = path.join(cacheDayPath, name);
    mkdirp.sync(cacheDayProviderPath);

    const cacheDayProviderLogPath = path.join(cacheDayProviderPath, "log.txt");
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
        graph,
        config,
        cacheDayProviderLogPath,
        version
      );
      await mds.changes(
        provider,
        cacheDayProviderChangesStream,
        start,
        stop,
        graph,
        config,
        cacheDayProviderLogPath,
        version
      );
    } else if (provider.type === "local") {
      await local.trips(
        provider,
        cacheDayProviderTripsStream,
        start,
        stop,
        graph,
        config,
        cacheDayProviderLogPath,
        version
      );
      await local.changes(
        provider,
        cacheDayProviderChangesStream,
        start,
        stop,
        graph,
        config,
        cacheDayProviderLogPath,
        version
      );
    }

    const tripsData = fs.readFileSync(cacheDayProviderTripsPath).toString();
    const changesData = fs.readFileSync(cacheDayProviderChangesPath).toString();

    fs.appendFileSync(cacheDayAllTripsPath, tripsData);
    fs.appendFileSync(cacheDayAllChangesPath, changesData);
  }
};

module.exports = cache;
