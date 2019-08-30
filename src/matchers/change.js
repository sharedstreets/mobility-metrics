const turf = require("@turf/turf");
const h3 = require("h3-js");

module.exports = async function(change, config, graph) {
  // STREETS

  if (!change.matches) change.matches = {};

  const matches = await graph.matchPoint(change.event_location, null, 1);

  if (matches.length) {
    change.matches.streets = matches;
  }

  // BINS

  const bin = h3.geoToH3(
    change.event_location.geometry.coordinates[1],
    change.event_location.geometry.coordinates[0],
    config.Z
  );

  change.matches.bins = bin;

  // ZONES

  var zoneMatches = [];

  for (let zone of config.zones.features) {
    if (turf.intersect(change.event_location, zone)) {
      zoneMatches.push(zone.properties.id);
    }
  }

  if (zoneMatches.length) {
    change.matches.zones = zoneMatches;
  }

  return change;
};
