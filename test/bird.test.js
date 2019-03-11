const test = require("tap").test;
const bird = require("../src/providers/bird.js");
const through2 = require("through2");

test("bird - trips stream", t => {
  var count = 0;
  var stream = through2
    .obj((chunk, enc, next) => {
      count++;
      next();
    })
    .on("finish", () => {
      t.equal(count, 5, "found trips");
      t.done();
    });

  bird.trips(stream);
});

test("bird - changes stream", t => {
  var count = 0;
  var stream = through2
    .obj((chunk, enc, next) => {
      count++;
      next();
    })
    .on("finish", () => {
      t.equal(count, 5, "found changes");
      t.done();
    });

  bird.changes(stream);
});
