const fs = require("fs");
const path = require("path");
const through2 = require("through2");
const byline = require("byline");
const tripMatch = require("../matchers/trip");
const changeMatch = require("../matchers/change");
const crypto = require("crypto");

async function trips(
  provider,
  stream,
  start,
  stop,
  graph,
  config,
  cacheDayProviderLogPath,
  version
) {
  return new Promise(resolve => {
    var input = fs.createReadStream(
      path.join(__dirname, "./../../" + provider.trips)
    );

    input
      .pipe(byline.createStream())
      .pipe(
        through2(async (chunk, enc, next) => {
          const data = chunk.toString();
          if (data.length) {
            var trip = JSON.parse(data);
            trip.start_time = trip.start_time;
            trip.end_time = trip.end_time;

            if (trip.start_time >= start && trip.start_time < stop) {
              trip = await tripMatch(trip, config, graph);
              if (trip) {
                const signature = crypto
                  .createHmac("sha256", version)
                  .update(JSON.stringify(trip))
                  .digest("hex");
                fs.appendFileSync(cacheDayProviderLogPath, signature + "\n");
                stream.write(JSON.stringify(trip) + "\n");
              }
            }
          }
          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

async function changes(
  provider,
  stream,
  start,
  stop,
  graph,
  config,
  cacheDayProviderLogPath,
  version
) {
  return new Promise(resolve => {
    var input = fs.createReadStream(
      path.join(__dirname, "./../../" + provider.status_changes)
    );

    input
      .pipe(byline.createStream())
      .pipe(
        through2(async (chunk, enc, next) => {
          const data = chunk.toString();
          if (data.length) {
            var change = JSON.parse(data);
            change.event_time = change.event_time;
            if (change.event_time >= start && change.event_time < stop) {
              change = await changeMatch(change, config, graph);
              if (change) {
                const signature = crypto
                  .createHmac("sha256", version)
                  .update(JSON.stringify(change))
                  .digest("hex");
                fs.appendFileSync(cacheDayProviderLogPath, signature + "\n");
                stream.write(JSON.stringify(change) + "\n");
              }
            }
          }
          next();
        })
      )
      .on("finish", () => {
        resolve();
      });
  });
}

module.exports.trips = trips;
module.exports.changes = changes;
