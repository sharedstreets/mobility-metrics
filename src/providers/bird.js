const fs = require("fs");
const request = require("request");
const config = require("../config");

const PROVIDER = "bird";

function trips(stream, start, stop) {
  config(PROVIDER, (err, conf) => {
    if (err) throw err;

    console.log(conf.trips);
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });

    var opts = {
      url: conf.trips,
      headers: {
        "Content-Type": "application/json",
        "APP-Version": "3.0.0",
        Authorization: "Bird " + conf.token
      }
    };

    request.get(opts, (err, res, body) => {
      if (err) throw err;

      var data = JSON.parse(body);
      console.log(data.code);

      stream.end();
    });
  });
}

function changes(stream, start, stop) {
  config(PROVIDER, (err, conf) => {
    if (err) throw err;

    stream.write({ ok: 1 });
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });
    stream.write({ ok: 1 });

    stream.end();
  });
}

module.exports.trips = trips;
module.exports.changes = changes;
