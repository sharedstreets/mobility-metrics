const fs = require("fs");
const request = require("request");

async function trips(provider, stream, start, stop) {
  return new Promise((resolve, reject) => {
    var opts = {
      url: provider.trips + "?start_time=" + start + "&end_time=" + stop,
      headers: {
        "Content-Type": "application/json",
        Authorization: provider.token
      }
    };

    // recursive scan across
    function scan(opts, done) {
      request.get(opts, (err, res, body) => {
        if (err) throw err;

        var data = JSON.parse(body);

        // write any returned trips to stream
        for (let trip of data.data.trips) {
          stream.write(JSON.stringify(trip) + "\n");
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

    scan(opts, () => {
      resolve();
    });
  });
}

async function changes(provider, stream, start, stop) {
  return new Promise((resolve, reject) => {
    var opts = {
      url:
        provider.status_changes + "?start_time=" + start + "&end_time=" + stop,
      headers: {
        "Content-Type": "application/json",
        Authorization: provider.token
      }
    };

    // recursive scan across
    function scan(opts, done) {
      request.get(opts, (err, res, body) => {
        if (err) throw err;
        var data = JSON.parse(body);

        // write any returned changes to stream
        for (let change of data.data.status_changes) {
          stream.write(JSON.stringify(change) + "\n");
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

    scan(opts, () => {
      resolve();
    });
  });
}

module.exports.trips = trips;
module.exports.changes = changes;
