const fs = require("fs");
const path = require("path");

const tripsData = fs
  .readFileSync(path.join(__dirname, "../../sac/trips.json"))
  .toString()
  .split("\n")
  .filter(line => {
    return line.length;
  })
  .map(JSON.parse);
const changesData = fs
  .readFileSync(path.join(__dirname, "../../sac/changes.json"))
  .toString()
  .split("\n")
  .filter(line => {
    return line.length;
  })
  .map(JSON.parse);

function trips(stream, start, stop) {
  tripsData
    .map(trip => {
      trip.start_time = trip.start_time / 1000;
      trip.end_time = trip.end_time / 1000;
      return trip;
    })
    .filter(trip => {
      return trip.start_time >= start && trip.start_time < stop;
    })
    .forEach(trip => {
      stream.write(trip);
    });

  stream.end();
}

function changes(stream, start, stop) {
  changesData
    .map(change => {
      change.event_time = change.event_time / 1000;
      return change;
    })
    .filter(change => {
      return change.event_time >= start && change.event_time < stop;
    })
    .forEach(change => {
      stream.write(change);
    });

  stream.end();
}

module.exports.trips = trips;
module.exports.changes = changes;
