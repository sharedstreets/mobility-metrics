const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const queue = require("d3-queue").queue;
const through2 = require("through2");
const moment = require("moment");
const config = require("../config.json");

const cachePath = path.join(__dirname, "./../cache");

// import all enabled providers
const providersPath = path.join(__dirname, "./providers");
const providers = Object.keys(config.providers)
  .filter(provider => {
    return config.providers[provider].enabled;
  })
  .map(provider => {
    return {
      name: provider,
      query: require(path.join(providersPath, provider))
    };
  });

const cache = async function(dayString) {
  return new Promise((resolve, reject) => {
    var day = moment(dayString, "YYYY-MM-DD");

    const stop = Math.round(
      +day
        .clone()
        .add(1, "day")
        .format("X")
    );
    const start = Math.round(+day.format("X"));

    const cacheDayPath = path.join(cachePath, "./" + day.format("YYYY-MM-DD"));

    var providersQ = queue(1);
    providers.forEach(provider => {
      providersQ.defer(providersCb => {
        var cacheDayProviderPath = path.join(
          cacheDayPath,
          "./" + provider.name
        );
        var cacheDayProviderTripsPath = path.join(
          cacheDayProviderPath,
          "./trips.json"
        );
        var cacheDayProviderChangesPath = path.join(
          cacheDayProviderPath,
          "./changes.json"
        );

        mkdirp.sync(cacheDayProviderPath);

        var tripStream = through2.obj((trip, enc, next) => {
          fs.appendFileSync(
            cacheDayProviderTripsPath,
            JSON.stringify(trip) + "\n"
          );
          next();
        });
        var changeStream = through2.obj((change, enc, next) => {
          fs.appendFileSync(
            cacheDayProviderChangesPath,
            JSON.stringify(change) + "\n"
          );
          next();
        });

        tripStream.on("finish", () => {
          provider.query.changes(changeStream, start, stop);
        });

        changeStream.on("finish", () => {
          providersCb();
        });

        provider.query.trips(tripStream, start, stop);
      });
    });

    providersQ.awaitAll(() => {
      resolve();
    });
  });
};

module.exports = cache;
