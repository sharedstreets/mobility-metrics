const { test } = require("tap");
const { exec } = require("child_process");
const path = require("path");
const rimraf = require("rimraf");

test("cli", { timeout: 1200000 }, async t => {
  const bin = path.join(__dirname, "../src/cli.js");
  const config = path.join(__dirname, "./fixtures/cli/config.json");
  const cache = path.join(__dirname, "./fixtures/cli/cache");
  const public = path.join(__dirname, "./fixtures/cli/public");

  rimraf.sync(cache);
  rimraf.sync(public);

  var cmd =
    "node " +
    bin +
    " --config " +
    config +
    " --public " +
    public +
    " --cache " +
    cache +
    " --day 2019-07-15";
  console.log(cmd);
  const { error, stdout, stderr } = await exec(cmd);

  /*
  //console.log(error);

  for await (let chunk of stderr) {
    //console.log(chunk.toString());
  }

  for await (let chunk of stdout) {
    //console.log(chunk.toString());
  }*/

  t.done();
});
