const test = require("tap").test;
const mem = require("level-mem");
const through2 = require("through2");
const bird = require("../src/providers/bird.js");
const Metrics = require("../src/metrics.js");

test("metrics - trips", t => {
  var provider = "bird";
  var store = mem();
  var metrics = new Metrics(store);

  t.ok(metrics.store, "has data store");
  t.ok(metrics.trip, "has trip function");

  var stream = through2
    .obj((trip, enc, next) => {
      metrics.trip(trip, provider, () => {
        next();
      });
    })
    .on("finish", () => {
      t.end();
    });

  var start = 1552351799 - 60 * 60;
  var stop = 1552351799;

  bird.trips(stream, start, stop);
});

test("metrics - changes", t => {
  var provider = "bird";
  var store = mem();
  var metrics = new Metrics(store);

  t.ok(metrics.change, "has change function");

  var stream = through2
    .obj((change, enc, next) => {
      metrics.change(change, provider, () => {
        next();
      });
    })
    .on("finish", () => {
      t.end();
    });

  var start = 1552351799 - 60 * 60;
  var stop = 1552351799;

  bird.changes(stream, start, stop);
});
