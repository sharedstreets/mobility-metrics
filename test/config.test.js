const test = require("tap").test;
const config = require("../src/config.js");

test("config - bird", t => {
  config("bird", (err, conf) => {
    t.notOk(err, "loaded config without error");
    t.ok(conf, "loaded config");
    t.ok(conf.token, "has token");
    t.ok(conf.trips, "has trips url");
    t.ok(conf.changes, "has changes url");

    t.end();
  });
});
