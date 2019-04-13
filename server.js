const Hapi = require("hapi");
const path = require("path");
const level = require("level");
const through2 = require("through2");
const h3 = require("h3-js");
const turf = require("@turf/turf");

function serve(store, done) {
  const server = Hapi.server({
    port: 5000,
    host: "localhost"
  });

  store = store || level(path.join(__dirname, "./data"));

  const init = async () => {
    await server.register(require("inert"));

    // ui
    server.route({
      method: "GET",
      path: "/",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./index.html"));
      }
    });

    // METRICS

    // events
    server.route({
      method: "GET",
      path: "/events/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = {};

          store
            .createReadStream({
              gte: provider + "!events",
              lt: provider + "!events?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyType = key[3];

                if (time === keyTime) {
                  data[keyType] = item.value;
                  next();
                } else next();
              })
            )
            .on("finish", () => {
              resolve(data);
            });
        });
      }
    });

    // streets
    server.route({
      method: "GET",
      path: "/streets/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = turf.featureCollection([]);

          store
            .createReadStream({
              gte: provider + "!streets",
              lt: provider + "!streets?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyRef = key[3];

                if (time === keyTime) {
                  // lookup from geometry cache
                  store.get("geo!" + keyRef, (err, geom) => {
                    geom = JSON.parse(geom);
                    var geo = turf.lineString(geom.coordinates, {
                      value: item.value,
                      bin: keyRef
                    });
                    // fuzz
                    if (item.value < 3) geo.properties.value = 3;
                    data.features.push(geo);
                    next();
                  });
                } else next();
              })
            )
            .on("finish", () => {
              resolve(data);
            });
        });
      }
    });

    // vehicles
    server.route({
      method: "GET",
      path: "/vehicles/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = turf.featureCollection([]);

          store
            .createReadStream({
              gte: provider + "!vehicles",
              lt: provider + "!vehicles?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyBin = key[3];

                if (time === keyTime) {
                  var geo = turf.polygon([h3.h3ToGeoBoundary(keyBin, true)], {
                    value: item.value,
                    bin: keyBin
                  });

                  // fuzz
                  if (geo.properties.value < 3) geo.properties.value = 3;
                  data.features.push(geo);
                }
                next();
              })
            )
            .on("finish", () => {
              resolve(data);
            });
        });
      }
    });

    // pickups
    server.route({
      method: "GET",
      path: "/pickups/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = turf.featureCollection([]);

          store
            .createReadStream({
              gte: provider + "!pickups",
              lt: provider + "!pickups?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyBin = key[3];

                if (time === keyTime) {
                  var geo = turf.polygon([h3.h3ToGeoBoundary(keyBin, true)], {
                    value: item.value,
                    bin: keyBin
                  });

                  // fuzz
                  if (geo.properties.value < 3) geo.properties.value = 3;
                  data.features.push(geo);
                }
                next();
              })
            )
            .on("finish", () => {
              resolve(data);
            });
        });
      }
    });

    // dropoffs
    server.route({
      method: "GET",
      path: "/dropoffs/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = turf.featureCollection([]);

          store
            .createReadStream({
              gte: provider + "!dropoffs",
              lt: provider + "!dropoffs?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyBin = key[3];

                if (time === keyTime) {
                  var geo = turf.polygon([h3.h3ToGeoBoundary(keyBin, true)], {
                    value: item.value,
                    bin: keyBin
                  });

                  // fuzz
                  if (geo.properties.value < 3) geo.properties.value = 3;
                  data.features.push(geo);
                }
                next();
              })
            )
            .on("finish", () => {
              resolve(data);
            });
        });
      }
    });

    // pickupsvia
    // todo: pickupsvia & dropsvia are in development as API changes
    //       to meet UI needs with respect to hex targeting
    server.route({
      method: "GET",
      path: "/pickupsvia/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = turf.featureCollection([]);
          var matrix = {};

          store
            .createReadStream({
              gt: provider + "!pickupsvia",
              lt: provider + "!pickupsvia?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const a = key[3];
                const b = key[4];

                if (time === keyTime) {
                  if (!matrix[a]) {
                    matrix[a] = turf.polygon([h3.h3ToGeoBoundary(a, true)], {
                      bin: a,
                      value: 0
                    });
                  }

                  if (!matrix[a].properties[b]) {
                    matrix[a].properties[b] = 1;
                  } else {
                    matrix[a].properties[b]++;
                  }
                }
                next();
              })
            )
            .on("finish", () => {
              Object.keys(matrix).forEach(a => {
                var f = matrix[a];
                // fuzz
                Object.keys(f.properties).forEach(b => {
                  if (b !== "bin" && f.properties[b] < 3) f.properties[b] = 3;
                  if (b !== "bin") f.properties.value++;
                });
                data.features.push(matrix[a]);
              });
              resolve(data);
            });
        });
      }
    });

    // dropoffsvia
    server.route({
      method: "GET",
      path: "/dropoffsvia/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          var data = turf.featureCollection([]);
          var matrix = {};

          store
            .createReadStream({
              gt: provider + "!dropoffsvia",
              lt: provider + "!dropoffsvia?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const a = key[3];
                const b = key[4];

                if (time === keyTime) {
                  if (!matrix[a]) {
                    matrix[a] = turf.polygon([h3.h3ToGeoBoundary(a, true)], {
                      bin: a,
                      value: 0
                    });
                  }

                  if (!matrix[a].properties[b]) {
                    matrix[a].properties[b] = 1;
                  } else {
                    matrix[a].properties[b]++;
                  }
                }
                next();
              })
            )
            .on("finish", () => {
              Object.keys(matrix).forEach(a => {
                var f = matrix[a];
                // fuzz
                Object.keys(f.properties).forEach(b => {
                  if (b !== "bin" && f.properties[b] < 3) f.properties[b] = 3;
                  if (b !== "bin") f.properties.value++;
                });
                data.features.push(matrix[a]);
              });
              resolve(data);
            });
        });
      }
    });

    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
    done(null, server);
  };

  process.on("unhandledRejection", err => {
    console.log(err);
    process.exit(1);
  });

  init();
}

if (require.main === module) {
  serve(null, () => {});
}

module.exports = serve;
