const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const queue = require("d3-queue").queue;
const through2 = require("through2");
const moment = require("moment");
const config = require("../../config.json");

const cachePath = path.join(__dirname, "../../cache");

// import all enabled providers
const providersPath = __dirname;
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

function trips(stream, start, stop) {
  var providersQ = queue(1);
  providers.forEach(provider => {
    providersQ.defer(providersCb => {
      var tripStream = through2.obj((trip, enc, next) => {
        stream.write(trip);
        next();
      });

      tripStream.on("finish", () => {
        providersCb();
      });

      provider.query.trips(tripStream, start, stop);
    });
  });

  providersQ.awaitAll(() => {
    stream.end();
  });
}

function changes(stream, start, stop) {
  var providersQ = queue(1);
  providers.forEach(provider => {
    providersQ.defer(providersCb => {
      var changeStream = through2.obj((change, enc, next) => {
        stream.write(change);
        next();
      });

      changeStream.on("finish", () => {
        providersCb();
      });

      provider.query.changes(changeStream, start, stop);
    });
  });

  providersQ.awaitAll(() => {
    stream.end();
  });
}

module.exports.trips = trips;
module.exports.changes = changes;
