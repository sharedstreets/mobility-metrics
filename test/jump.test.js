const test = require("tap").test;
const jump = require("../src/providers/jump.js");
const through2 = require("through2");

test("jump - trips stream", t => {
  var count = 0;
  var stream = through2
    .obj((trip, enc, next) => {
      t.equal(trip.route.type, "FeatureCollection", "valid featurecollection");
      count++;
      next();
    })
    .on("finish", () => {
      t.equal(count, 12, "found trips");
      t.end();
    });

  var start = 1552351799 - 60 * 10; // 5 minutes before stop
  var stop = 1552351799;

  jump.trips(stream, start, stop);
});

test("jump - changes stream", t => {
  var count = 0;
  var stream = through2
    .obj((change, enc, next) => {
      t.ok(change.event_type, "event_type");
      t.ok(change.event_type_reason, "event_type_reason");
      t.ok(change.event_time, "event_time");
      count++;
      next();
    })
    .on("finish", () => {
      t.equal(count, 5, "found changes");
      t.end();
    });

  var start = 1552351799 - 60 * 1; // 1 minute before stop
  var stop = 1552351799; // console.log(Math.round((new Date()).getTime() / 1000))

  jump.changes(stream, start, stop);
});
