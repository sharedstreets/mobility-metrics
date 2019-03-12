const test = require("tap").test;
const path = require("path");
const fork = require("child_process").fork;
const request = require("request");

test("server", t => {
  var server = fork(path.join(__dirname, "./../server.js"));
  server.kill();
  t.end();
});
