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

var Z = 9;
var min = 3;

const summarize = async function(day, graph) {
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
          }
        },
        dropoffs: {
          bins: {
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
          }
        },
        onstreet: {
          bins: {
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

      await tripVolumes(stats, trips, graph);
      pickups(stats, trips);
      dropoffs(stats, trips);
      flows(stats, trips);
      availability(stats, states, day);
      onstreet(stats, states, day);

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
  // h3 aggregation
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
    //var match = {"matchType":"hmm","score":0,"originalFeature":{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-83.03959666666667,42.336253333333325],[-83.03959666666667,42.336253333333325],[-83.039605,42.336253333333325],[-83.039605,42.336253333333325],[-83.039605,42.336253333333325],[-83.03961166666667,42.336253333333325],[-83.03961166666667,42.336253333333325],[-83.03961166666667,42.336253333333325],[-83.039695,42.33622333333333],[-83.03980333333332,42.336173333333335],[-83.03980333333332,42.336173333333335],[-83.03980333333332,42.336173333333335],[-83.039955,42.33610166666667],[-83.039955,42.33610166666667],[-83.039955,42.33610166666667],[-83.039955,42.33610166666667],[-83.03994833333333,42.33601],[-83.03994833333333,42.33601],[-83.03972666666665,42.33609],[-83.03972666666665,42.33609],[-83.03948999999999,42.33623166666666],[-83.03948999999999,42.33623166666666],[-83.03936,42.33634166666668],[-83.03936,42.33634166666668],[-83.03936,42.33634166666668],[-83.03915333333335,42.336409999999994],[-83.03910833333333,42.33641833333333],[-83.03915333333335,42.336409999999994],[-83.03910833333333,42.33641833333333],[-83.03897833333333,42.33640666666667],[-83.03897833333333,42.33640666666667],[-83.03897833333333,42.33640666666667],[-83.03897833333333,42.33640666666667],[-83.03897166666665,42.33642499999999],[-83.03897166666665,42.33642499999999],[-83.03897166666665,42.33642499999999],[-83.03897833333333,42.33643],[-83.03897833333333,42.33643],[-83.03895499999999,42.33642499999999],[-83.03895499999999,42.33642499999999],[-83.03886333333334,42.336486666666666],[-83.03886333333334,42.336486666666666],[-83.03900833333334,42.33651666666666],[-83.03900833333334,42.33651666666666],[-83.03900833333334,42.33651666666666],[-83.03891,42.336433333333325],[-83.038765,42.33648],[-83.038765,42.33648],[-83.038765,42.33648],[-83.038765,42.33648],[-83.03855833333334,42.336578333333335],[-83.03855833333334,42.336578333333335],[-83.03855833333334,42.336578333333335],[-83.03840666666669,42.33664],[-83.038155,42.336726666666664],[-83.03840666666669,42.33664],[-83.038155,42.336726666666664],[-83.03807833333333,42.336758333333336],[-83.03807833333333,42.336758333333336],[-83.03807833333333,42.336758333333336],[-83.03812333333332,42.336765],[-83.03812333333332,42.336765],[-83.03812333333332,42.336765],[-83.03824666666667,42.336711666666666],[-83.03824666666667,42.336711666666666],[-83.03824666666667,42.336711666666666],[-83.03844499999998,42.336634999999994],[-83.03839166666667,42.33663166666667],[-83.03844499999998,42.336634999999994],[-83.03844499999998,42.336634999999994],[-83.03824666666667,42.336681666666664],[-83.03824666666667,42.336681666666664],[-83.03824666666667,42.336681666666664],[-83.03824666666667,42.336681666666664],[-83.03824666666667,42.336681666666664],[-83.03813166666666,42.33674166666666],[-83.03813166666666,42.33674166666666],[-83.03813166666666,42.33674166666666],[-83.03808666666667,42.33677333333333],[-83.03808666666667,42.33677333333333],[-83.03807833333333,42.33678],[-83.03807833333333,42.33678],[-83.03807833333333,42.33677666666667],[-83.03805499999999,42.33677333333333],[-83.03805499999999,42.33677333333333],[-83.03797166666666,42.336806666666675],[-83.03805499999999,42.33677333333333],[-83.03788833333334,42.33685333333333],[-83.03788833333334,42.33685333333333],[-83.03788833333334,42.33685333333333],[-83.03784166666668,42.33682333333333],[-83.03784166666668,42.33682333333333],[-83.03780333333334,42.33676833333334],[-83.03780333333334,42.33676833333334],[-83.03780333333334,42.33676833333334],[-83.03777999999998,42.336735],[-83.03777999999998,42.336735],[-83.03774999999999,42.33667333333333],[-83.03774999999999,42.33667333333333],[-83.03774999999999,42.33667333333333],[-83.03774999999999,42.33667333333333],[-83.03774999999999,42.33667333333333],[-83.03767333333332,42.336555],[-83.03764333333332,42.336486666666666],[-83.03764333333332,42.336486666666666],[-83.03764333333332,42.336486666666666],[-83.03762833333333,42.33644833333333],[-83.03762833333333,42.33644833333333],[-83.03762833333333,42.33644833333333],[-83.03762,42.336441666666666],[-83.03762,42.336441666666666],[-83.03759,42.336398333333335],[-83.03759,42.336398333333335],[-83.03754499999998,42.33633499999999],[-83.03754499999998,42.33633499999999],[-83.03751333333334,42.33630333333334],[-83.03751333333334,42.33630333333334],[-83.03751333333334,42.33630333333334],[-83.03745333333333,42.336243333333336],[-83.03745333333333,42.336243333333336],[-83.03745333333333,42.336243333333336],[-83.037415,42.33618166666667],[-83.03738333333334,42.336151666666666],[-83.03738333333334,42.336151666666666],[-83.03738333333334,42.336151666666666],[-83.03724666666668,42.33618499999999],[-83.03724666666668,42.33618499999999],[-83.03711666666668,42.336253333333325],[-83.03711666666668,42.336253333333325],[-83.03692666666666,42.33638333333333],[-83.03692666666666,42.33638333333333],[-83.03692666666666,42.33638333333333],[-83.03692666666666,42.33638333333333],[-83.03668166666667,42.33648333333334],[-83.03668166666667,42.33648333333334],[-83.03652166666667,42.33655166666667],[-83.03652166666667,42.33655166666667],[-83.03652166666667,42.33655166666667],[-83.03652166666667,42.33655166666667],[-83.036415,42.33664333333333],[-83.036415,42.33664333333333],[-83.036415,42.33664333333333],[-83.03649833333333,42.33668833333333],[-83.03654499999999,42.336634999999994],[-83.03654499999999,42.336634999999994],[-83.03654499999999,42.336634999999994],[-83.03654499999999,42.336634999999994],[-83.03648333333334,42.33654833333333],[-83.03648333333334,42.33654833333333],[-83.03653666666666,42.336486666666666],[-83.03653666666666,42.336486666666666],[-83.03666,42.336433333333325],[-83.03666,42.336433333333325],[-83.03673500000001,42.336415],[-83.03673500000001,42.336415],[-83.03673500000001,42.336415],[-83.03674333333332,42.336409999999994],[-83.03674333333332,42.336409999999994],[-83.03673500000001,42.336415],[-83.03668166666667,42.33643666666667],[-83.03668166666667,42.33643666666667],[-83.03652166666667,42.33651],[-83.03652166666667,42.33651],[-83.03643833333332,42.336536666666674],[-83.03639166666666,42.33655999999999],[-83.03643833333332,42.336536666666674],[-83.03639166666666,42.33655999999999],[-83.03633166666665,42.33657],[-83.03633166666665,42.33657],[-83.03627,42.33664],[-83.03627,42.33664],[-83.03627,42.33664],[-83.03627,42.33664],[-83.03639166666666,42.336814999999994],[-83.03639166666666,42.336814999999994],[-83.03639166666666,42.336814999999994],[-83.036445,42.33689833333333],[-83.03649166666668,42.33697833333334],[-83.03649166666668,42.33697833333334],[-83.03649166666668,42.33697833333334],[-83.03649166666668,42.33697833333334],[-83.03649166666668,42.33697833333334],[-83.03649833333333,42.33700999999999],[-83.03649833333333,42.33700999999999],[-83.03649166666668,42.336998333333334],[-83.03648333333334,42.336998333333334],[-83.03648333333334,42.336998333333334],[-83.036515,42.33705499999999],[-83.036515,42.33705499999999],[-83.03656833333335,42.33712833333334],[-83.03656833333335,42.33712833333334],[-83.03656833333335,42.33712833333334],[-83.03662833333334,42.33721166666666],[-83.03662833333334,42.33721166666666],[-83.03669,42.33730333333333],[-83.03669,42.33730333333333],[-83.03669,42.33730333333333],[-83.03671333333332,42.337345000000006],[-83.03671333333332,42.337345000000006],[-83.03672,42.337345000000006],[-83.03672,42.33733666666667],[-83.03672,42.33733666666667],[-83.03673500000001,42.33736833333334],[-83.03673500000001,42.33736833333334],[-83.03670500000001,42.337425],[-83.03670500000001,42.337425],[-83.03660666666669,42.33745166666666],[-83.03660666666669,42.33745166666666],[-83.03646833333332,42.33751666666667],[-83.03646833333332,42.33751666666667],[-83.03646833333332,42.33751666666667],[-83.03646833333332,42.33751666666667],[-83.03645333333334,42.337555],[-83.03645333333334,42.337555],[-83.03645333333334,42.337555],[-83.03642333333333,42.33755833333333],[-83.03617833333334,42.33763833333334],[-83.03617833333334,42.33763833333334],[-83.03617833333334,42.33763833333334],[-83.03594166666666,42.33775000000001],[-83.03594166666666,42.33775000000001],[-83.03588166666665,42.33778333333333],[-83.03588166666665,42.33778333333333],[-83.03585,42.33779500000001],[-83.03588166666665,42.33778333333333],[-83.03587333333334,42.33779500000001],[-83.03587333333334,42.33779500000001],[-83.03588833333333,42.33778833333334],[-83.03588833333333,42.33778833333334],[-83.03590333333335,42.33778333333333],[-83.03588833333333,42.33778],[-83.03588833333333,42.33778],[-83.03588166666665,42.33777666666666],[-83.03588166666665,42.33777666666666],[-83.03588166666665,42.33777666666666],[-83.03588166666665,42.33777666666666],[-83.03568333333332,42.33781833333334],[-83.03568333333332,42.33781833333334],[-83.03568333333332,42.33781833333334],[-83.03568333333332,42.33781833333334],[-83.03540833333334,42.33795166666667],[-83.03521666666666,42.33800833333333],[-83.03521666666666,42.33800833333333],[-83.03521666666666,42.33800833333333],[-83.03501833333333,42.338085],[-83.03501833333333,42.338085],[-83.03492666666668,42.33811166666666],[-83.03501833333333,42.338085],[-83.03495833333334,42.338185],[-83.03495833333334,42.338185],[-83.03495833333334,42.338185],[-83.03503500000001,42.338165],[-83.03503500000001,42.338165],[-83.03494333333335,42.33807],[-83.03494333333335,42.33807],[-83.03494333333335,42.33807],[-83.03483499999999,42.33815833333333],[-83.03483499999999,42.33815833333333],[-83.03483499999999,42.33815833333333],[-83.03497333333334,42.338191666666674],[-83.03497333333334,42.338191666666674],[-83.03501833333333,42.33804],[-83.03501833333333,42.33804],[-83.03501833333333,42.33804],[-83.03489666666668,42.33806166666667],[-83.03497333333334,42.338191666666674],[-83.03497333333334,42.338191666666674],[-83.03497333333334,42.338191666666674],[-83.03497999999999,42.338268333333325],[-83.03497999999999,42.338268333333325],[-83.03485166666665,42.33832166666666],[-83.03497999999999,42.338268333333325],[-83.03485166666665,42.33832166666666],[-83.03485166666665,42.33832166666666],[-83.03466833333331,42.33838333333333],[-83.03466833333331,42.33838333333333],[-83.03456833333333,42.33843166666667],[-83.03456833333333,42.33843166666667],[-83.0345,42.338475],[-83.0345,42.338475],[-83.0345,42.338475],[-83.034485,42.33852],[-83.034485,42.33852],[-83.034485,42.33852],[-83.03444666666668,42.338588333333334],[-83.034485,42.33852],[-83.03446166666666,42.33866166666667],[-83.03446166666666,42.33866166666667],[-83.03446166666666,42.33866166666667],[-83.03449166666665,42.33865000000001],[-83.03449166666665,42.33865000000001],[-83.03450833333333,42.33856166666666],[-83.03450833333333,42.33856166666666],[-83.03450833333333,42.33856166666666],[-83.03450833333333,42.33856166666666],[-83.034485,42.33848166666667],[-83.034485,42.33848166666667],[-83.034485,42.33848166666667],[-83.03445500000001,42.338485000000006],[-83.03445500000001,42.338485000000006],[-83.03445500000001,42.33853166666666],[-83.03445500000001,42.33853166666666],[-83.03445500000001,42.33853166666666],[-83.03444666666668,42.33862666666667],[-83.03443833333334,42.338676666666665],[-83.03443833333334,42.338676666666665],[-83.03443833333334,42.338676666666665],[-83.03443833333334,42.338676666666665],[-83.03445500000001,42.33870666666667],[-83.03445500000001,42.33870666666667],[-83.03447666666668,42.338745],[-83.03445500000001,42.33870666666667],[-83.03447666666668,42.338745],[-83.03447666666668,42.338745],[-83.03438499999999,42.338854999999995],[-83.03438499999999,42.338854999999995],[-83.03438499999999,42.338854999999995],[-83.03431,42.33893666666666],[-83.03423333333333,42.33906166666667],[-83.03423333333333,42.33906166666667],[-83.03423333333333,42.33906166666667],[-83.03423333333333,42.33906166666667],[-83.03426333333333,42.33915333333333],[-83.03426333333333,42.33915333333333],[-83.03426333333333,42.33915333333333],[-83.03430166666666,42.33911499999999],[-83.03424000000001,42.339091666666675],[-83.03424000000001,42.339091666666675],[-83.03424000000001,42.339091666666675],[-83.03406500000001,42.339103333333334],[-83.03406500000001,42.339103333333334],[-83.03406500000001,42.339103333333334],[-83.03393499999999,42.339150000000004],[-83.03393499999999,42.339150000000004],[-83.03393499999999,42.339150000000004],[-83.03389,42.33918333333333],[-83.03389,42.33918333333333],[-83.03389,42.33918333333333],[-83.03382833333332,42.339214999999996],[-83.03382833333332,42.339214999999996],[-83.03382166666667,42.33924833333334],[-83.03382166666667,42.33924833333334],[-83.03382166666667,42.33924833333334],[-83.03385166666666,42.33935499999999],[-83.03385166666666,42.33935499999999],[-83.03389666666665,42.339435],[-83.03389666666665,42.339435],[-83.03389666666665,42.339435],[-83.03390499999999,42.339488333333335],[-83.03390499999999,42.339488333333335],[-83.03390499999999,42.339488333333335],[-83.03385166666666,42.339553333333335],[-83.03385166666666,42.339553333333335],[-83.033775,42.33953499999999],[-83.033775,42.33953499999999],[-83.033775,42.33953499999999],[-83.03368333333334,42.339515],[-83.03368333333334,42.339515],[-83.03359166666665,42.339511666666674],[-83.03359166666665,42.339511666666674],[-83.03359166666665,42.339511666666674],[-83.0335,42.33948166666667],[-83.0335,42.33948166666667],[-83.0335,42.33948166666667],[-83.0335,42.33948166666667],[-83.03334000000001,42.339496666666676],[-83.03334833333332,42.339621666666666],[-83.03334000000001,42.339496666666676],[-83.03334833333332,42.339621666666666],[-83.033425,42.339695],[-83.033425,42.339695],[-83.033425,42.339695],[-83.033425,42.339695],[-83.03353833333334,42.33979333333333],[-83.03353833333334,42.33979333333333],[-83.03362333333334,42.339756666666666],[-83.03362333333334,42.339756666666666],[-83.03353833333334,42.33972166666668],[-83.03353833333334,42.33972166666668],[-83.03344,42.33984333333333],[-83.03344,42.33984333333333],[-83.03344,42.33984333333333],[-83.03344666666665,42.33994333333333],[-83.03353166666666,42.34002999999999],[-83.03344666666665,42.33994333333333],[-83.03353166666666,42.34002999999999],[-83.03353166666666,42.34004166666667],[-83.03353166666666,42.34004166666667],[-83.03353166666666,42.34004166666667],[-83.03353166666666,42.34004166666667],[-83.03338666666666,42.33992],[-83.03338666666666,42.33992],[-83.03320333333335,42.33978666666667],[-83.03320333333335,42.33978666666667],[-83.03320333333335,42.33978666666667],[-83.03314999999999,42.33984],[-83.03314999999999,42.33984],[-83.03312,42.33985500000001],[-83.03312,42.33985500000001],[-83.033065,42.339875],[-83.033065,42.339875],[-83.033065,42.339875],[-83.03289000000001,42.339935],[-83.03289000000001,42.339935],[-83.03269999999999,42.34001166666667],[-83.03269999999999,42.34001166666667],[-83.03248666666666,42.340115],[-83.03248666666666,42.340115],[-83.03237166666668,42.34016833333333],[-83.03237166666668,42.34016833333333],[-83.03237166666668,42.34016833333333],[-83.03231,42.340115],[-83.03231,42.340115],[-83.03231,42.340115],[-83.03231,42.340115],[-83.03244833333335,42.340126666666656],[-83.03252333333333,42.340286666666664],[-83.03252333333333,42.340286666666664],[-83.03252333333333,42.340286666666664],[-83.03263833333334,42.34046166666667],[-83.03263833333334,42.34046166666667],[-83.03263833333334,42.34046166666667],[-83.03278333333334,42.34063333333334],[-83.03289000000001,42.34076333333334],[-83.03289000000001,42.34076333333334],[-83.03289000000001,42.34076333333334],[-83.03294333333334,42.34084666666666],[-83.03294333333334,42.34084666666666],[-83.03294333333334,42.34084666666666],[-83.03300499999999,42.340828333333334],[-83.03300499999999,42.340828333333334],[-83.03292833333334,42.34076666666667],[-83.03300499999999,42.340828333333334],[-83.032875,42.340736666666665],[-83.03292833333334,42.34076666666667],[-83.032875,42.340736666666665],[-83.03278333333334,42.34064166666667],[-83.03278333333334,42.34064166666667],[-83.03278333333334,42.34064166666667],[-83.03264666666668,42.340565],[-83.03264666666668,42.340565],[-83.03264666666668,42.340565],[-83.03264666666668,42.340565],[-83.03247000000002,42.34043499999999],[-83.03264666666668,42.340565],[-83.03247000000002,42.34043499999999],[-83.03247000000002,42.34043499999999],[-83.032455,42.340419999999995],[-83.032455,42.340419999999995]]}},"segments":[{"geometryId":"dff21c7d99cfa0ed9e78dd8c2eff4329"},{"geometryId":"678fe7abb8c24431490381c010501556"},{"geometryId":"06cf4e3be49957c90dffc33c5fa4752e"},{"geometryId":"fe1bb5f6aaab0ea980ed5f5dfb9f93d6"},{"geometryId":"1813081af5d8c55d0e37735a2fdde5ce"},{"geometryId":"dacbbd2d41b54a2f6e9590b7260ddc70"},{"geometryId":"dff21c7d99cfa0ed9e78dd8c2eff4329"}],"matchedPath":{"type":"Feature","properties":{},"geometry":{"type":"MultiLineString","coordinates":[[[-83.04096940000001,42.335590200000006],[-83.0408853,42.335626100000006],[-83.04005140000001,42.335980400000004],[-83.0399252,42.336034000000005],[-83.0394904,42.336218800000005],[-83.03922700000001,42.336330700000005],[-83.0389439,42.336451000000004]],[[-83.0389439,42.336451000000004],[-83.0384224,42.335667400000006],[-83.03835570000001,42.3355838]],[[-83.03835570000001,42.3355838],[-83.0384482,42.3355471],[-83.03855180000001,42.3355035]],[[-83.03855180000001,42.3355035],[-83.0386428,42.3354653],[-83.0389864,42.335320700000004],[-83.0393506,42.335167500000004],[-83.0395367,42.335089200000006]],[[-83.0395367,42.335089200000006],[-83.03990110000001,42.334936000000006],[-83.04027760000001,42.334777800000005],[-83.040391,42.33473]],[[-83.040391,42.33473],[-83.040456,42.334825300000006],[-83.04069270000001,42.335178500000005],[-83.0409401,42.3355466],[-83.04096940000001,42.335590200000006]],[[-83.04096940000001,42.335590200000006],[-83.0408853,42.335626100000006],[-83.04005140000001,42.335980400000004],[-83.0399252,42.336034000000005],[-83.0394904,42.336218800000005],[-83.03922700000001,42.336330700000005],[-83.0389439,42.336451000000004]]]}}}

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
      if (val < min) {
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
      if (val < min) {
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
      if (val < min) {
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
      if (val < min) {
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
      if (val < min) {
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
      if (val < min) {
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

function pickups(stats, trips) {
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
  }
}

function dropoffs(stats, trips) {
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
      if (val < min) {
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
      if (val < min) {
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
      if (val < min) {
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

function availability(stats, states, day) {
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
      }
    });

    current = current.add(15, "minutes");
  }

  // find max availability per hour
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

  // find max availability per day
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
}

function onstreet(stats, states, day) {
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
      }
    });

    current = current.add(15, "minutes");
  }

  // find max onstreet per hour
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

  // find max onstreet per day
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
}

module.exports = summarize;
