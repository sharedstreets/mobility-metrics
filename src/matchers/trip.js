module.exports = function (trip, graph, zones) {
  const line = turf.lineString(
    trip.route.features.map(pt => {
      return pt.geometry.coordinates;
    })
  );

  // STREETS

  if (!trip.properties.matches) trip.properties.matches = {}

  const match = await graph.matchTrace(line);

  if (
    match &&
    match.segments &&
    match.matchedPath &&
    match.matchedPath.geometry &&
    match.matchedPath.geometry.coordinates &&
    match.matchedPath.geometry.coordinates.length === match.segments.length
  ) {
    trip.properties.matches.streets = match;
  }

  // HEXES

  var bins = new Set();
  trip.route.features.forEach(ping => {
    var bin = h3.geoToH3(
      ping.geometry.coordinates[1],
      ping.geometry.coordinates[0],
      Z
    );
    bins.add(bin);
  });

  change.properties.matches.bins = bins;

  // ZONES

  var zoneMatches = []

  for (let zone of zones.features) {
    if (turf.intersect(line, zone)) {
      zoneMatches.push(zone.properties.id);
    }
  }

  if(zoneMatches.length) {
    change.properties.matches.zones = zoneMatches;
  }

  return trip;
}
