const fs = require("fs");
const request = require("request");
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
  return new Promise(async (resolve, reject) => {
    var opts = {};

    if (provider.version === "0.3") {
      opts = {
        url:
          provider.trips +
          "?min_end_time=" +
          start.toString() +
          "&max_end_time=" +
          stop.toString() +
          "&page[limit]=1000",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.mds.provider+json;version=0.3",
          Authorization: provider.token
        }
      };
    } else {
      opts = {
        url:
          provider.status_changes +
          "?start_time=" +
          start.toString() +
          "&end_time=" +
          stop.toString(),
        headers: {
          "Content-Type": "application/json",
          Authorization: provider.token
        }
      };
    }

    // recursive scan across
    async function scan(opts, done) {
      request.get(opts, async (err, res, body) => {
        if (err) throw err;

        var data = JSON.parse(body);

        // write any returned trips to stream
        for (let trip of data.data.trips) {
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

        // continue scan if another page is present
        if (data.links && data.links.next) {
          opts.url = data.links.next;
          scan(opts, done);
        } else {
          done();
        }
      });
    }

    await scan(opts, () => {
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
  return new Promise(async (resolve, reject) => {
    var opts = {};

    if (provider.version === "0.3") {
      opts = {
        url:
          provider.status_changes +
          "?start_time=" +
          start.toString() +
          "&end_time=" +
          stop.toString(),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.mds.provider+json;version=0.3",
          Authorization: provider.token
        }
      };
    } else {
      opts = {
        url:
          provider.status_changes +
          "?start_time=" +
          start.toString() +
          "&end_time=" +
          stop.toString(),
        headers: {
          "Content-Type": "application/json",
          Authorization: provider.token
        }
      };
    }

    // recursive scan across
    async function scan(opts, done) {
      request.get(opts, async (err, res, body) => {
        if (err) throw err;
        var data = JSON.parse(body);

        // write any returned changes to stream
        for (let change of data.data.status_changes) {
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

        // continue scan if another page is present
        if (data.links && data.links.next) {
          opts.url = data.links.next;
          scan(opts, done);
        } else {
          done();
        }
      });
    }

    await scan(opts, () => {
      resolve();
    });
  });
}

module.exports.trips = trips;
module.exports.changes = changes;
