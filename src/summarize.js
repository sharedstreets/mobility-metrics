const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const turf = require("@turf/turf");
const moment = require("moment");
const h3 = require("h3-js");
const cache = require("./cache");
const config = require("../config.json");

// import all providers
const providers = Object.keys(config.providers).filter(provider => {
  return config.providers[provider].enabled;
});
providers.push("all");

var Z = 9;
var privacyMinimum = config.privacyMinimum || 3;

const summarize = async function(day, shst, graph, pointMatcher) {
  return new Promise(async (resolve, reject) => {
    var cachePath = path.join(__dirname + "./../cache", day);
    if (!fs.existsSync(cachePath)) {
      console.log("  caching...");
      await cache(day);
    }

    console.log("  summarizing...");
    for (let provider of providers) {
      var cacheProviderPath = path.join(cachePath, provider);

      console.log("    " + provider + "...");

      fs.writeFileSync(path.join(cacheProviderPath, "trips.json"), "");
      fs.writeFileSync(path.join(cacheProviderPath, "changes.json"), "");

      var trips = fs
        .readFileSync(path.join(cacheProviderPath, "trips.json"))
        .toString()
        .split("\n")
        .filter(line => {
          return line.length;
        })
        .map(JSON.parse);
      var changes = fs
        .readFileSync(path.join(cacheProviderPath, "changes.json"))
        .toString()
        .split("\n")
        .filter(line => {
          return line.length;
        })
        .map(JSON.parse);

      var totalVehicles = new Set();
      var totalActiveVehicles = new Set();
      var stats = {
        totalVehicles: 0,
        totalActiveVehicles: 0,
        totalTrips: 0,
        totalDistance: 0,
        totalDuration: 0,
        geometry: {
          bins: {},
          streets: {},
          pairs: {}
        },
        tripVolumes: {
          bins: {
            day: {},
            hour: {},
            minute: {}
          },
          streets: {
            day: {},
            hour: {},
            minute: {}
          }
        },
        pickups: {
          bins: {
            day: {},
            hour: {},
            minute: {}
          },
          streets: {
            day: {},
            hour: {},
            minute: {}
          }
        },
        dropoffs: {
          bins: {
            day: {},
            hour: {},
            minute: {}
          },
          streets: {
            day: {},
            hour: {},
            minute: {}
          }
        },
        flows: {
          pairs: {
            day: {},
            hour: {},
            minute: {}
          }
        },
        availability: {
          bins: {
            day: {},
            hour: {},
            minute: {}
          },
          streets: {
            day: {},
            hour: {},
            minute: {}
          }
        },
        onstreet: {
          bins: {
            day: {},
            hour: {},
            minute: {}
          },
          streets: {
            day: {},
            hour: {},
            minute: {}
          }
        }
      };

      for (let trip of trips) {
        totalVehicles.add(trip.vehicle_id);
        totalActiveVehicles.add(trip.vehicle_id);

        // convert to miles
        trip.trip_distance = trip.trip_distance * 0.000621371;
        // convert to minutes
        trip.trip_duration = trip.trip_duration / 60;

        // summary stats
        stats.totalActiveVehicles = totalActiveVehicles.size;
        stats.totalTrips++;
        stats.totalDistance += trip.trip_distance;
        stats.totalDuration += trip.trip_duration;
        stats.averageVehicleDistance =
          stats.totalDistance / stats.totalActiveVehicles;
        stats.averageVehicleDuration =
          stats.totalDuration / stats.totalActiveVehicles;
        stats.averageTripDistance = stats.totalDistance / stats.totalTrips;
        stats.averageTripDuration = stats.totalDuration / stats.totalTrips;
        stats.averageTrips = stats.totalTrips / stats.totalActiveVehicles;
      }

      // build state histories for each vehicle
      var states = {};
      changes.forEach(change => {
        if (!states[change.vehicle_id]) {
          totalVehicles.add(change.vehicle_id);
          stats.totalVehicles = totalVehicles.size;
          states[change.vehicle_id] = [];
        }
        states[change.vehicle_id].push(change);
      });
      // sort by time
      Object.keys(states).forEach(id => {
        states[id] = states[id].sort((a, b) => {
          return a.event_time - b.event_time;
        });
      });

      console.log("      trip volumes...");
      await tripVolumes(stats, trips, graph);
      console.log("      pickups...");
      await pickups(stats, trips, pointMatcher);
      console.log("      dropoffs...");
      await dropoffs(stats, trips, pointMatcher);
      console.log("      flows...");
      flows(stats, trips);
      console.log("      availability...");
      await availability(stats, states, day, pointMatcher);
      console.log("      onstreet...");
      await onstreet(stats, states, day, pointMatcher);

      var summaryPath = path.join(__dirname + "./../data", day);
      mkdirp.sync(summaryPath);
      summaryFilePath = path.join(summaryPath, provider + ".json");

      fs.writeFileSync(summaryFilePath, JSON.stringify(stats));

      resolve();
    }
  });
};

function getTimeBins(timestamp) {
  var time = moment(timestamp, "X");
  var minutes = +time.minutes();
  var formattedMinutes = "00";
  if (minutes >= 15) formattedMinutes = "15";
  if (minutes >= 30) formattedMinutes = "30";
  if (minutes >= 45) formattedMinutes = "45";

  return {
    day: time.format("YYYY-MM-DD"),
    hour: time.format("YYYY-MM-DD-HH"),
    minute: time.format("YYYY-MM-DD-HH-") + formattedMinutes
  };
}

async function tripVolumes(stats, trips, graph) {
  for (let trip of trips) {
    var bins = new Set();
    trip.route.features.forEach(ping => {
      var bin = h3.geoToH3(
        ping.geometry.coordinates[1],
        ping.geometry.coordinates[0],
        Z
      );
      bins.add(bin);
    });
    // store bin geometry
    bins.forEach(bin => {
      var geo = turf.polygon([h3.h3ToGeoBoundary(bin, true)], {
        bin: bin
      });
      stats.geometry.bins[bin] = geo;
    });

    var timeBins = getTimeBins(trip.start_time);
    // populate time bins
    if (!stats.tripVolumes.bins.day[timeBins.day]) {
      stats.tripVolumes.bins.day[timeBins.day] = {};
    }
    if (!stats.tripVolumes.bins.hour[timeBins.hour]) {
      stats.tripVolumes.bins.hour[timeBins.hour] = {};
    }
    if (!stats.tripVolumes.bins.minute[timeBins.minute]) {
      stats.tripVolumes.bins.minute[timeBins.minute] = {};
    }

    // aggregate stats
    bins.forEach(bin => {
      // populate hex bins
      if (!stats.tripVolumes.bins.day[timeBins.day][bin]) {
        stats.tripVolumes.bins.day[timeBins.day][bin] = 0;
      }
      if (!stats.tripVolumes.bins.hour[timeBins.hour][bin]) {
        stats.tripVolumes.bins.hour[timeBins.hour][bin] = 0;
      }
      if (!stats.tripVolumes.bins.minute[timeBins.minute][bin]) {
        stats.tripVolumes.bins.minute[timeBins.minute][bin] = 0;
      }
      // increment hex bins
      stats.tripVolumes.bins.day[timeBins.day][bin]++;
      stats.tripVolumes.bins.hour[timeBins.hour][bin]++;
      stats.tripVolumes.bins.minute[timeBins.minute][bin]++;
    });

    // sharedstreets aggregation
    var refs = new Set();

    var line = turf.lineString(
      trip.route.features.map(pt => {
        return pt.geometry.coordinates;
      })
    );

    var match = await graph.matchTrace(line);

    if (
      match &&
      match.segments &&
      match.matchedPath &&
      match.matchedPath.geometry &&
      match.matchedPath.geometry.coordinates &&
      match.matchedPath.geometry.coordinates.length === match.segments.length
    ) {
      match.segments
        .map((segment, s) => {
          return turf.lineString(match.matchedPath.geometry.coordinates[s], {
            ref: segment.geometryId
          });
        })
        .forEach(f => {
          refs.add(f.properties.ref);

          if (!stats.geometry.streets[f.properties.ref]) {
            stats.geometry.streets[f.properties.ref] = f;
          }
        });
      // populate time bins
      if (!stats.tripVolumes.streets.day[timeBins.day]) {
        stats.tripVolumes.streets.day[timeBins.day] = {};
      }
      if (!stats.tripVolumes.streets.hour[timeBins.hour]) {
        stats.tripVolumes.streets.hour[timeBins.hour] = {};
      }
      if (!stats.tripVolumes.streets.minute[timeBins.minute]) {
        stats.tripVolumes.streets.minute[timeBins.minute] = {};
      }

      // aggregate stats
      refs.forEach(ref => {
        // populate street refs
        if (!stats.tripVolumes.streets.day[timeBins.day][ref]) {
          stats.tripVolumes.streets.day[timeBins.day][ref] = 0;
        }
        if (!stats.tripVolumes.streets.hour[timeBins.hour][ref]) {
          stats.tripVolumes.streets.hour[timeBins.hour][ref] = 0;
        }
        if (!stats.tripVolumes.streets.minute[timeBins.minute][ref]) {
          stats.tripVolumes.streets.minute[timeBins.minute][ref] = 0;
        }
        // increment hex bins
        stats.tripVolumes.streets.day[timeBins.day][ref]++;
        stats.tripVolumes.streets.hour[timeBins.hour][ref]++;
        stats.tripVolumes.streets.minute[timeBins.minute][ref]++;
      });
    }
  }

  // filter
  // delete sparse day bins
  Object.keys(stats.tripVolumes.bins.day).forEach(day => {
    Object.keys(stats.tripVolumes.bins.day[day]).forEach(bin => {
      var val = stats.tripVolumes.bins.day[day][bin];
      if (val < privacyMinimum) {
        delete stats.tripVolumes.bins.day[day][bin];
      }
    });
  });
  // delete sparse bin days
  Object.keys(stats.tripVolumes.bins.day).forEach(day => {
    if (!Object.keys(stats.tripVolumes.bins.day[day]).length) {
      delete stats.tripVolumes.bins.day[day];
    }
  });
  // delete sparse hour bins
  Object.keys(stats.tripVolumes.bins.hour).forEach(hour => {
    Object.keys(stats.tripVolumes.bins.hour[hour]).forEach(bin => {
      var val = stats.tripVolumes.bins.hour[hour][bin];
      if (val < privacyMinimum) {
        delete stats.tripVolumes.bins.hour[hour][bin];
      }
    });
  });
  // delete sparse bin hours
  Object.keys(stats.tripVolumes.bins.hour).forEach(hour => {
    if (!Object.keys(stats.tripVolumes.bins.hour[hour]).length) {
      delete stats.tripVolumes.bins.hour[hour];
    }
  });
  // delete sparse minutes bins
  Object.keys(stats.tripVolumes.bins.minute).forEach(minute => {
    Object.keys(stats.tripVolumes.bins.minute[minute]).forEach(bin => {
      var val = stats.tripVolumes.bins.minute[minute][bin];
      if (val < privacyMinimum) {
        delete stats.tripVolumes.bins.minute[minute][bin];
      }
    });
  });
  // delete sparse bin minutes
  Object.keys(stats.tripVolumes.bins.minute).forEach(minute => {
    if (!Object.keys(stats.tripVolumes.bins.minute[minute]).length) {
      delete stats.tripVolumes.bins.minute[minute];
    }
  });

  // delete sparse day streets
  Object.keys(stats.tripVolumes.streets.day).forEach(day => {
    Object.keys(stats.tripVolumes.streets.day[day]).forEach(street => {
      var val = stats.tripVolumes.streets.day[day][street];
      if (val < privacyMinimum) {
        delete stats.tripVolumes.streets.day[day][street];
      }
    });
  });
  // delete sparse street days
  Object.keys(stats.tripVolumes.streets.day).forEach(day => {
    if (!Object.keys(stats.tripVolumes.streets.day[day]).length) {
      delete stats.tripVolumes.streets.day[day];
    }
  });
  // delete sparse hour streets
  Object.keys(stats.tripVolumes.streets.hour).forEach(hour => {
    Object.keys(stats.tripVolumes.streets.hour[hour]).forEach(street => {
      var val = stats.tripVolumes.streets.hour[hour][street];
      if (val < privacyMinimum) {
        delete stats.tripVolumes.streets.hour[hour][street];
      }
    });
  });
  // delete sparse street hours
  Object.keys(stats.tripVolumes.streets.hour).forEach(hour => {
    if (!Object.keys(stats.tripVolumes.streets.hour[hour]).length) {
      delete stats.tripVolumes.streets.hour[hour];
    }
  });
  // delete sparse minutes streets
  Object.keys(stats.tripVolumes.streets.minute).forEach(minute => {
    Object.keys(stats.tripVolumes.streets.minute[minute]).forEach(street => {
      var val = stats.tripVolumes.streets.minute[minute][street];
      if (val < privacyMinimum) {
        delete stats.tripVolumes.streets.minute[minute][street];
      }
    });
  });
  // delete sparse street minutes
  Object.keys(stats.tripVolumes.streets.minute).forEach(minute => {
    if (!Object.keys(stats.tripVolumes.streets.minute[minute]).length) {
      delete stats.tripVolumes.streets.minute[minute];
    }
  });
}

async function pickups(stats, trips, pointMatcher) {
  // h3 aggregation
  for (let trip of trips) {
    var bins = new Set();
    [trip.route.features[0]].forEach(ping => {
      var bin = h3.geoToH3(
        ping.geometry.coordinates[1],
        ping.geometry.coordinates[0],
        Z
      );
      bins.add(bin);
    });
    // store bin geometry
    bins.forEach(bin => {
      var geo = turf.polygon([h3.h3ToGeoBoundary(bin, true)], {
        bin: bin
      });
      stats.geometry.bins[bin] = geo;
    });

    var timeBins = getTimeBins(trip.start_time);
    // populate time bins
    if (!stats.pickups.bins.day[timeBins.day]) {
      stats.pickups.bins.day[timeBins.day] = {};
    }
    if (!stats.pickups.bins.hour[timeBins.hour]) {
      stats.pickups.bins.hour[timeBins.hour] = {};
    }
    if (!stats.pickups.bins.minute[timeBins.minute]) {
      stats.pickups.bins.minute[timeBins.minute] = {};
    }

    // aggregate stats
    bins.forEach(bin => {
      // populate hex bins
      if (!stats.pickups.bins.day[timeBins.day][bin]) {
        stats.pickups.bins.day[timeBins.day][bin] = 0;
      }
      if (!stats.pickups.bins.hour[timeBins.hour][bin]) {
        stats.pickups.bins.hour[timeBins.hour][bin] = 0;
      }
      if (!stats.pickups.bins.minute[timeBins.minute][bin]) {
        stats.pickups.bins.minute[timeBins.minute][bin] = 0;
      }
      // increment hex bins
      stats.pickups.bins.day[timeBins.day][bin]++;
      stats.pickups.bins.hour[timeBins.hour][bin]++;
      stats.pickups.bins.minute[timeBins.minute][bin]++;
    });

    // sharedstreets aggregation
    var matches = await pointMatcher.getPointCandidates(
      trip.route.features[0],
      null,
      1
    );
    if (matches.length) {
      var ref = matches[0].geometryId;
      // cache geometry from ref
      var geo = JSON.parse(
        JSON.stringify(pointMatcher.tileIndex.featureIndex.get(ref))
      );
      geo.properties = {
        ref: ref
      };
      stats.geometry.streets[ref] = geo;

      // populate time bins
      if (!stats.pickups.streets.day[timeBins.day]) {
        stats.pickups.streets.day[timeBins.day] = {};
      }
      if (!stats.pickups.streets.hour[timeBins.hour]) {
        stats.pickups.streets.hour[timeBins.hour] = {};
      }
      if (!stats.pickups.streets.minute[timeBins.minute]) {
        stats.pickups.streets.minute[timeBins.minute] = {};
      }
      // populate streets
      if (!stats.pickups.streets.day[timeBins.day][ref]) {
        stats.pickups.streets.day[timeBins.day][ref] = 0;
      }
      if (!stats.pickups.streets.hour[timeBins.hour][ref]) {
        stats.pickups.streets.hour[timeBins.hour][ref] = 0;
      }
      if (!stats.pickups.streets.minute[timeBins.minute][ref]) {
        stats.pickups.streets.minute[timeBins.minute][ref] = 0;
      }
      // increment streets
      stats.pickups.streets.day[timeBins.day][ref]++;
      stats.pickups.streets.hour[timeBins.hour][ref]++;
      stats.pickups.streets.minute[timeBins.minute][ref]++;
    }
  }
}

async function dropoffs(stats, trips, pointMatcher) {
  // h3 aggregation
  for (let trip of trips) {
    var bins = new Set();
    [trip.route.features[trip.route.features.length - 1]].forEach(ping => {
      var bin = h3.geoToH3(
        ping.geometry.coordinates[1],
        ping.geometry.coordinates[0],
        Z
      );
      bins.add(bin);
    });
    // store bin geometry
    bins.forEach(bin => {
      var geo = turf.polygon([h3.h3ToGeoBoundary(bin, true)], {
        bin: bin
      });
      stats.geometry.bins[bin] = geo;
    });

    var timeBins = getTimeBins(trip.start_time);
    // populate time bins
    if (!stats.dropoffs.bins.day[timeBins.day]) {
      stats.dropoffs.bins.day[timeBins.day] = {};
    }
    if (!stats.dropoffs.bins.hour[timeBins.hour]) {
      stats.dropoffs.bins.hour[timeBins.hour] = {};
    }
    if (!stats.dropoffs.bins.minute[timeBins.minute]) {
      stats.dropoffs.bins.minute[timeBins.minute] = {};
    }

    // aggregate stats
    bins.forEach(bin => {
      // populate hex bins
      if (!stats.dropoffs.bins.day[timeBins.day][bin]) {
        stats.dropoffs.bins.day[timeBins.day][bin] = 0;
      }
      if (!stats.dropoffs.bins.hour[timeBins.hour][bin]) {
        stats.dropoffs.bins.hour[timeBins.hour][bin] = 0;
      }
      if (!stats.dropoffs.bins.minute[timeBins.minute][bin]) {
        stats.dropoffs.bins.minute[timeBins.minute][bin] = 0;
      }
      // increment hex bins
      stats.dropoffs.bins.day[timeBins.day][bin]++;
      stats.dropoffs.bins.hour[timeBins.hour][bin]++;
      stats.dropoffs.bins.minute[timeBins.minute][bin]++;
    });

    // sharedstreets aggregation
    var matches = await pointMatcher.getPointCandidates(
      trip.route.features[trip.route.features.length - 1],
      null,
      1
    );
    if (matches.length) {
      var ref = matches[0].geometryId;
      // cache geometry from ref
      var geo = JSON.parse(
        JSON.stringify(pointMatcher.tileIndex.featureIndex.get(ref))
      );
      geo.properties = {
        ref: ref
      };
      stats.geometry.streets[ref] = geo;

      // populate time bins
      if (!stats.dropoffs.streets.day[timeBins.day]) {
        stats.dropoffs.streets.day[timeBins.day] = {};
      }
      if (!stats.dropoffs.streets.hour[timeBins.hour]) {
        stats.dropoffs.streets.hour[timeBins.hour] = {};
      }
      if (!stats.dropoffs.streets.minute[timeBins.minute]) {
        stats.dropoffs.streets.minute[timeBins.minute] = {};
      }
      // populate streets
      if (!stats.dropoffs.streets.day[timeBins.day][ref]) {
        stats.dropoffs.streets.day[timeBins.day][ref] = 0;
      }
      if (!stats.dropoffs.streets.hour[timeBins.hour][ref]) {
        stats.dropoffs.streets.hour[timeBins.hour][ref] = 0;
      }
      if (!stats.dropoffs.streets.minute[timeBins.minute][ref]) {
        stats.dropoffs.streets.minute[timeBins.minute][ref] = 0;
      }
      // increment streets
      stats.dropoffs.streets.day[timeBins.day][ref]++;
      stats.dropoffs.streets.hour[timeBins.hour][ref]++;
      stats.dropoffs.streets.minute[timeBins.minute][ref]++;
    }
  }
}

function flows(stats, trips) {
  for (let trip of trips) {
    var a = h3.geoToH3(
      trip.route.features[0].geometry.coordinates[1],
      trip.route.features[0].geometry.coordinates[0],
      Z
    );
    var b = h3.geoToH3(
      trip.route.features[trip.route.features.length - 1].geometry
        .coordinates[1],
      trip.route.features[trip.route.features.length - 1].geometry
        .coordinates[0],
      Z
    );

    // store pair geometry
    var pair = turf.lineString(
      [
        turf.centroid(turf.polygon([h3.h3ToGeoBoundary(a, true)])).geometry
          .coordinates,
        turf.centroid(turf.polygon([h3.h3ToGeoBoundary(b, true)])).geometry
          .coordinates
      ],
      { pair: a + ">" + b }
    );
    stats.geometry.pairs[pair.properties.pair] = pair;

    var timeBins = getTimeBins(trip.start_time);
    // populate time bins
    if (!stats.flows.pairs.day[timeBins.day]) {
      stats.flows.pairs.day[timeBins.day] = {};
    }
    if (!stats.flows.pairs.hour[timeBins.hour]) {
      stats.flows.pairs.hour[timeBins.hour] = {};
    }
    if (!stats.flows.pairs.minute[timeBins.minute]) {
      stats.flows.pairs.minute[timeBins.minute] = {};
    }

    // aggregate stats
    // populate flow pairs
    if (!stats.flows.pairs.day[timeBins.day][pair.properties.pair]) {
      stats.flows.pairs.day[timeBins.day][pair.properties.pair] = 0;
    }
    if (!stats.flows.pairs.hour[timeBins.hour][pair.properties.pair]) {
      stats.flows.pairs.hour[timeBins.hour][pair.properties.pair] = 0;
    }
    if (!stats.flows.pairs.minute[timeBins.minute][pair.properties.pair]) {
      stats.flows.pairs.minute[timeBins.minute][pair.properties.pair] = 0;
    }
    // increment flow pairs
    stats.flows.pairs.day[timeBins.day][pair.properties.pair]++;
    stats.flows.pairs.hour[timeBins.hour][pair.properties.pair]++;
    stats.flows.pairs.minute[timeBins.minute][pair.properties.pair]++;
  }

  // filter
  // delete sparse day pairs
  Object.keys(stats.flows.pairs.day).forEach(day => {
    Object.keys(stats.flows.pairs.day[day]).forEach(pair => {
      var val = stats.flows.pairs.day[day][pair];
      if (val < privacyMinimum) {
        delete stats.flows.pairs.day[day][pair];
      }
    });
  });
  // delete sparse pair days
  Object.keys(stats.flows.pairs.day).forEach(day => {
    if (!Object.keys(stats.flows.pairs.day[day]).length) {
      delete stats.flows.pairs.day[day];
    }
  });
  // delete sparse hour pairs
  Object.keys(stats.flows.pairs.hour).forEach(hour => {
    Object.keys(stats.flows.pairs.hour[hour]).forEach(pair => {
      var val = stats.flows.pairs.hour[hour][pair];
      if (val < privacyMinimum) {
        delete stats.flows.pairs.hour[hour][pair];
      }
    });
  });
  // delete sparse pair hours
  Object.keys(stats.flows.pairs.hour).forEach(hour => {
    if (!Object.keys(stats.flows.pairs.hour[hour]).length) {
      delete stats.flows.pairs.hour[hour];
    }
  });
  // delete sparse minutes pairs
  Object.keys(stats.flows.pairs.minute).forEach(minute => {
    Object.keys(stats.flows.pairs.minute[minute]).forEach(pair => {
      var val = stats.flows.pairs.minute[minute][pair];
      if (val < privacyMinimum) {
        delete stats.flows.pairs.minute[minute][pair];
      }
    });
  });
  // delete sparse pair minutes
  Object.keys(stats.flows.pairs.minute).forEach(minute => {
    if (!Object.keys(stats.flows.pairs.minute[minute]).length) {
      delete stats.flows.pairs.minute[minute];
    }
  });

  var fc = turf.featureCollection([]);
  Object.keys(stats.geometry.pairs).forEach(pair => {
    fc.features.push(stats.geometry.pairs[pair]);
  });
}

async function availability(stats, states, day, pointMatcher) {
  // playback times
  // foreach 15 min:
  // foreach vehicle state:
  // find last state before current
  // if available, increment availability stat
  var date = moment(day, "YYYY-MM-DD");
  var current = moment(date.format("YYYY-MM-DD"), "YYYY-MM-DD");
  var start = date.format("X");
  var stop = date
    .clone()
    .add(1, "day")
    .format("X");
  while (current.format("YYYY-MM-DD") === date.format("YYYY-MM-DD")) {
    var vehicle_ids = Object.keys(states);
    for (let vehicle_id of vehicle_ids) {
      var lastAvailable;
      states[vehicle_id].forEach(state => {
        if (state.event_type === "available") {
          var timestamp = moment(state.event_time, "X");

          if (timestamp.diff(current) <= 0) {
            lastAvailable = state;
          }
        }
      });

      if (lastAvailable) {
        // availability hex bins
        var bin = h3.geoToH3(
          lastAvailable.event_location.geometry.coordinates[1],
          lastAvailable.event_location.geometry.coordinates[0],
          Z
        );

        // store geo
        var geo = turf.polygon([h3.h3ToGeoBoundary(bin, true)], {
          bin: bin
        });
        stats.geometry.bins[bin] = geo;

        // bootstrap bin
        if (
          !stats.availability.bins.minute[current.format("YYYY-MM-DD-HH-mm")]
        ) {
          stats.availability.bins.minute[
            current.format("YYYY-MM-DD-HH-mm")
          ] = {};
        }
        if (
          !stats.availability.bins.minute[current.format("YYYY-MM-DD-HH-mm")][
            bin
          ]
        ) {
          stats.availability.bins.minute[current.format("YYYY-MM-DD-HH-mm")][
            bin
          ] = 1;
        } else {
          stats.availability.bins.minute[current.format("YYYY-MM-DD-HH-mm")][
            bin
          ]++;
        }

        // availability street refs
        var matches = await pointMatcher.getPointCandidates(
          lastAvailable.event_location,
          null,
          1
        );
        if (matches.length) {
          var ref = matches[0].geometryId;
          // cache geometry from ref
          var geo = JSON.parse(
            JSON.stringify(pointMatcher.tileIndex.featureIndex.get(ref))
          );
          geo.properties = {
            ref: ref
          };
          stats.geometry.streets[ref] = geo;

          // bootstrap ref
          if (
            !stats.availability.streets.minute[
              current.format("YYYY-MM-DD-HH-mm")
            ]
          ) {
            stats.availability.streets.minute[
              current.format("YYYY-MM-DD-HH-mm")
            ] = {};
          }
          if (
            !stats.availability.streets.minute[
              current.format("YYYY-MM-DD-HH-mm")
            ][ref]
          ) {
            stats.availability.streets.minute[
              current.format("YYYY-MM-DD-HH-mm")
            ][ref] = 1;
          } else {
            stats.availability.streets.minute[
              current.format("YYYY-MM-DD-HH-mm")
            ][ref]++;
          }
        }
      }
    }

    current = current.add(15, "minutes");
  }

  // find max availability per hour
  // hex
  Object.keys(stats.availability.bins.minute).forEach(minute => {
    var hour = minute.slice(0, minute.length - 3);
    if (!stats.availability.bins.hour[hour]) {
      stats.availability.bins.hour[hour] = {};
    }

    Object.keys(stats.availability.bins.minute[minute]).forEach(bin => {
      var val = stats.availability.bins.minute[minute][bin];

      if (
        !stats.availability.bins.hour[hour][bin] ||
        stats.availability.bins.hour[hour][bin] < val
      ) {
        stats.availability.bins.hour[hour][bin] = val;
      }
    });
  });
  // streets
  Object.keys(stats.availability.streets.minute).forEach(minute => {
    var hour = minute.slice(0, minute.length - 3);
    if (!stats.availability.streets.hour[hour]) {
      stats.availability.streets.hour[hour] = {};
    }

    Object.keys(stats.availability.streets.minute[minute]).forEach(ref => {
      var val = stats.availability.streets.minute[minute][ref];

      if (
        !stats.availability.streets.hour[hour][ref] ||
        stats.availability.streets.hour[hour][ref] < val
      ) {
        stats.availability.streets.hour[hour][ref] = val;
      }
    });
  });

  // find max availability per day
  // hex
  Object.keys(stats.availability.bins.hour).forEach(hour => {
    var day = hour.slice(0, hour.length - 3);
    if (!stats.availability.bins.day[day]) {
      stats.availability.bins.day[day] = {};
    }

    Object.keys(stats.availability.bins.hour[hour]).forEach(bin => {
      var val = stats.availability.bins.hour[hour][bin];

      if (
        !stats.availability.bins.day[day][bin] ||
        stats.availability.bins.day[day][bin] < val
      ) {
        stats.availability.bins.day[day][bin] = val;
      }
    });
  });
  // streets
  Object.keys(stats.availability.streets.hour).forEach(hour => {
    var day = hour.slice(0, hour.length - 3);
    if (!stats.availability.streets.day[day]) {
      stats.availability.streets.day[day] = {};
    }

    Object.keys(stats.availability.streets.hour[hour]).forEach(ref => {
      var val = stats.availability.streets.hour[hour][ref];

      if (
        !stats.availability.streets.day[day][ref] ||
        stats.availability.streets.day[day][ref] < val
      ) {
        stats.availability.streets.day[day][ref] = val;
      }
    });
  });
}

async function onstreet(stats, states, day, pointMatcher) {
  // playback times
  // foreach 15 min:
  // foreach vehicle state:
  // find last state before current
  // if available, increment onstreet stat
  var date = moment(day, "YYYY-MM-DD");
  var current = moment(date.format("YYYY-MM-DD"), "YYYY-MM-DD");
  var start = date.format("X");
  var stop = date
    .clone()
    .add(1, "day")
    .format("X");
  while (current.format("YYYY-MM-DD") === date.format("YYYY-MM-DD")) {
    var vehicle_ids = Object.keys(states);
    for (let vehicle_id of vehicle_ids) {
      var lastAvailable;
      states[vehicle_id].forEach(state => {
        if (
          state.event_type === "available" ||
          state.event_type === "unavailable"
        ) {
          var timestamp = moment(state.event_time, "X");

          if (timestamp.diff(current) <= 0) {
            lastAvailable = state;
          }
        }
      });

      if (lastAvailable) {
        // onstreet hex bins
        var bin = h3.geoToH3(
          lastAvailable.event_location.geometry.coordinates[1],
          lastAvailable.event_location.geometry.coordinates[0],
          Z
        );

        // store geo
        var geo = turf.polygon([h3.h3ToGeoBoundary(bin, true)], {
          bin: bin
        });
        stats.geometry.bins[bin] = geo;

        // bootstrap bin
        if (!stats.onstreet.bins.minute[current.format("YYYY-MM-DD-HH-mm")]) {
          stats.onstreet.bins.minute[current.format("YYYY-MM-DD-HH-mm")] = {};
        }
        if (
          !stats.onstreet.bins.minute[current.format("YYYY-MM-DD-HH-mm")][bin]
        ) {
          stats.onstreet.bins.minute[current.format("YYYY-MM-DD-HH-mm")][
            bin
          ] = 1;
        } else {
          stats.onstreet.bins.minute[current.format("YYYY-MM-DD-HH-mm")][bin]++;
        }

        // onstreet street refs
        var matches = await pointMatcher.getPointCandidates(
          lastAvailable.event_location,
          null,
          1
        );
        if (matches.length) {
          var ref = matches[0].geometryId;
          // cache geometry from ref
          var geo = JSON.parse(
            JSON.stringify(pointMatcher.tileIndex.featureIndex.get(ref))
          );
          geo.properties = {
            ref: ref
          };
          stats.geometry.streets[ref] = geo;

          // bootstrap ref
          if (
            !stats.onstreet.streets.minute[current.format("YYYY-MM-DD-HH-mm")]
          ) {
            stats.onstreet.streets.minute[
              current.format("YYYY-MM-DD-HH-mm")
            ] = {};
          }
          if (
            !stats.onstreet.streets.minute[current.format("YYYY-MM-DD-HH-mm")][
              ref
            ]
          ) {
            stats.onstreet.streets.minute[current.format("YYYY-MM-DD-HH-mm")][
              ref
            ] = 1;
          } else {
            stats.onstreet.streets.minute[current.format("YYYY-MM-DD-HH-mm")][
              ref
            ]++;
          }
        }
      }
    }

    current = current.add(15, "minutes");
  }

  // find max onstreet per hour
  // hex
  Object.keys(stats.onstreet.bins.minute).forEach(minute => {
    var hour = minute.slice(0, minute.length - 3);
    if (!stats.onstreet.bins.hour[hour]) {
      stats.onstreet.bins.hour[hour] = {};
    }

    Object.keys(stats.onstreet.bins.minute[minute]).forEach(bin => {
      var val = stats.onstreet.bins.minute[minute][bin];

      if (
        !stats.onstreet.bins.hour[hour][bin] ||
        stats.onstreet.bins.hour[hour][bin] < val
      ) {
        stats.onstreet.bins.hour[hour][bin] = val;
      }
    });
  });
  // streets
  Object.keys(stats.onstreet.streets.minute).forEach(minute => {
    var hour = minute.slice(0, minute.length - 3);
    if (!stats.onstreet.streets.hour[hour]) {
      stats.onstreet.streets.hour[hour] = {};
    }

    Object.keys(stats.onstreet.streets.minute[minute]).forEach(ref => {
      var val = stats.onstreet.streets.minute[minute][ref];

      if (
        !stats.onstreet.streets.hour[hour][ref] ||
        stats.onstreet.streets.hour[hour][ref] < val
      ) {
        stats.onstreet.streets.hour[hour][ref] = val;
      }
    });
  });

  // find max onstreet per day
  // hex
  Object.keys(stats.onstreet.bins.hour).forEach(hour => {
    var day = hour.slice(0, hour.length - 3);
    if (!stats.onstreet.bins.day[day]) {
      stats.onstreet.bins.day[day] = {};
    }

    Object.keys(stats.onstreet.bins.hour[hour]).forEach(bin => {
      var val = stats.onstreet.bins.hour[hour][bin];

      if (
        !stats.onstreet.bins.day[day][bin] ||
        stats.onstreet.bins.day[day][bin] < val
      ) {
        stats.onstreet.bins.day[day][bin] = val;
      }
    });
  });
  // streets
  Object.keys(stats.onstreet.streets.hour).forEach(hour => {
    var day = hour.slice(0, hour.length - 3);
    if (!stats.onstreet.streets.day[day]) {
      stats.onstreet.streets.day[day] = {};
    }

    Object.keys(stats.onstreet.streets.hour[hour]).forEach(ref => {
      var val = stats.onstreet.streets.hour[hour][ref];

      if (
        !stats.onstreet.streets.day[day][ref] ||
        stats.onstreet.streets.day[day][ref] < val
      ) {
        stats.onstreet.streets.day[day][ref] = val;
      }
    });
  });
}

module.exports = summarize;
