const turf = require('@turf/turf')

module.exports = function (change, Z, graph, zones) {
  // STREETS

  if (!change.properties.matches) change.properties.matches = {}

  const matches = await graph.matchPoint(change.route.features[0], null, 1);

  if (matches.length) {
    change.properties.matches.streets = matches;
  }

  // BINS

  const bin = h3.geoToH3(
    lastAvailable.event_location.geometry.coordinates[1],
    lastAvailable.event_location.geometry.coordinates[0],
    Z
  );

  change.properties.matches.bins = bin;

  // ZONES

  var zoneMatches = []

  for (let zone of zones.features) {
    if (turf.intersect(change.event_location, zone)) {
      zoneMatches.push(zone.properties.id);
    }
  }

  if(zoneMatches.length) {
    change.properties.matches.zones = zoneMatches;
  }

  return change;
}
