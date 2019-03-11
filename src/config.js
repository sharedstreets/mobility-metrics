const fs = require("fs");
const path = require("path");
const untildify = require("untildify");

const BASE = untildify("~/.mds_shst_credentials");

module.exports = function(provider, done) {
  var file = path.join(BASE, provider + ".json");

  fs.readFile(file, (err, data) => {
    if (err) throw err;

    done(err, JSON.parse(data));
  });
};
