const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const turf = require("@turf/turf");
const moment = require("moment");
const shst = require("sharedstreets");
const h3 = require("h3-js");
const cache = require("./cache");

// import all providers
const providersPath = path.join(__dirname, "./providers");
const providers = fs.readdirSync(providersPath).map(providerFile => {
  return providerFile.split(".js")[0];
});

graphOpts = {
  source: "osm/planet-181224",
  tileHierarchy: 6
};
var graph = new shst.Graph(
  {
    type: "Polygon",
    coordinates: [
      [
        [-83.17680358886719, 42.313369811689746],
        [-82.99072265625, 42.313369811689746],
        [-82.99072265625, 42.416359972082866],
        [-83.17680358886719, 42.416359972082866],
        [-83.17680358886719, 42.313369811689746]
      ]
    ]
  },
  graphOpts
);

var Z = 9;

const summarize = function(day, done) {
  return new Promise(async (resolve, reject) => {
    await graph.buildGraph();

    var cachePath = path.join(__dirname + "./../cache", day);
    if (!fs.existsSync(cachePath)) {
      console.log("  caching...");
      await cache(day);
    }

    console.log("  summarizing...");
    providers.forEach(async provider => {
      var cacheProviderPath = path.join(cachePath, provider);

      console.log("    " + provider + "...");

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
        availability: {},
        activity: {
          streets: {},
          bins: {}
        },
        geometry: {
          bins: {},
          streets: {}
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

        // h3 aggregation
        var bins = new Set();
        trip.route.features.forEach(ping => {
          var bin = h3.geoToH3(
            ping.geometry.coordinates[1],
            ping.geometry.coordinates[0],
            Z
          );
          bins.add(bin);
        });

        // sharedstreets aggregation
        var refs = new Set();
        try {
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
            match.matchedPath.geometry.coordinates.length ===
              match.segments.length
          ) {
            match.segments
              .map((segment, s) => {
                return turf.lineString(
                  match.matchedPath.geometry.coordinates[s],
                  {
                    geometryId: segment.geometryId
                  }
                );
              })
              .forEach(f => {
                stats.geometry.streets[f.geometryId] = f;
              });
          }
        } catch (e) {}
      }

      // build state intervals
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
        // availability stats
        stats.availability[
          current.format("YYYY-MM-DD-HH-mm")
        ] = turf.featureCollection([]);

        Object.keys(states).forEach(vehicle_id => {
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
            stats.availability[
              current.format("YYYY-MM-DD-HH-mm")
            ].features.push(lastAvailable.event_location);
          }
        });

        // activity stats
        stats.activity.streets[
          current.format("YYYY-MM-DD-HH-mm")
        ] = turf.featureCollection([]);
        stats.activity.bins[
          current.format("YYYY-MM-DD-HH-mm")
        ] = turf.featureCollection([]);

        current = current.add(15, "minutes");
      }

      var summaryPath = path.join(__dirname + "./../data", day);
      mkdirp.sync(summaryPath);
      summaryFilePath = path.join(summaryPath, provider + ".json");

      fs.writeFileSync(summaryFilePath, JSON.stringify(stats));

      resolve();
    });
  });
};

module.exports = summarize;
