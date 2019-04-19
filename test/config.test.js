const test = require("tap").test;
const config = require("../config.json");

test("config", t => {
  t.equal(config.boundary.length, 4, "has valid boundary bbox");

  Object.keys(config.providers).forEach(provider => {
    if (config.providers[provider].enabled) {
      t.ok(
        config.providers[provider].trips.length,
        provider + " has trips url"
      );
      t.ok(
        config.providers[provider].status_changes.length,
        provider + " has status_changes url"
      );
      t.ok(config.providers[provider].token.length, provider + " has token");
    }
  });

  t.end();
});
