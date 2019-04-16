const test = require("tap").test;
const path = require("path");
const fork = require("child_process").fork;
const request = require("request");
const serve = require("../server.js");

test("server", t => {
  var server = fork(path.join(__dirname, "./../server.js"));
  server.kill();
  t.end();
});

test("server module", t => {
  serve(async (err, server) => {
    await server.stop();
    t.end();
  });
});
