const test = require("tap").test;
const bird = require("../src/providers/bird.js");
const through2 = require("through2");

test("bird - trips stream", t => {
  var count = 0;
  var stream = through2
    .obj((trip, enc, next) => {
      t.equal(trip.route.type, "FeatureCollection");
      count++;
      next();
    })
    .on("finish", () => {
      t.equal(count, 4, "found trips");
      t.done();
    });
  [];
  var start = 1552351799 - 60 * 60;
  var stop = 1552351799;

  bird.trips(stream, start, stop);
});

test("bird - changes stream", t => {
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
      t.equal(count, 4, "found changes");
      t.done();
    });

  var start = 1552351799 - 60 * 30; // 30 minutes before stop
  var stop = 1552351799; // console.log(Math.round((new Date()).getTime() / 1000))

  bird.changes(stream, start, stop);
});
