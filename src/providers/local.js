const fs = require("fs");
const path = require("path");
const through2 = require("through2");
const byline = require("byline");

async function trips(provider, stream, start, stop) {
  return new Promise(resolve => {
    var input = fs.createReadStream(
      path.join(__dirname, "./../../" + provider.trips)
    );

    input
      .pipe(byline.createStream())
      .pipe(
        through2((chunk, enc, next) => {
          const data = chunk.toString();
          if (data.length) {
            var trip = JSON.parse(data);
            trip.start_time = trip.start_time / 1000;
            trip.end_time = trip.end_time / 1000;

            if (trip.start_time >= start && trip.start_time < stop) {
              stream.write(JSON.stringify(trip) + "\n");
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

async function changes(provider, stream, start, stop) {
  return new Promise(resolve => {
    var input = fs.createReadStream(
      path.join(__dirname, "./../../" + provider.status_changes)
    );

    input
      .pipe(byline.createStream())
      .pipe(
        through2((chunk, enc, next) => {
          const data = chunk.toString();
          if (data.length) {
            var change = JSON.parse(data);
            change.event_time = change.event_time / 1000;
            if (change.event_time >= start && change.event_time < stop) {
              stream.write(JSON.stringify(change) + "\n");
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
