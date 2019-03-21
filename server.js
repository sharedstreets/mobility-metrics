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
                  if (geo.properties.value < 2) geo.properties.value = 3;
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
                  if (geo.properties.value < 2) geo.properties.value = 3;
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
                  if (geo.properties.value < 2) geo.properties.value = 3;
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
      path: "/pickupsvia/{provider}/{time}/{bin}/",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;
          const bin = request.params.bin;

          var data = turf.featureCollection([]);

          store
            .createReadStream({
              gte: provider + "!pickupsvia!" + bin,
              lt: provider + "!pickupsvia!" + bin + "?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyBin = key[3];

                if (time === keyTime) {
                  var geo = turf.polygon([h3.h3ToGeoBoundary(keyBin, true)], {
                    value: item.value
                  });

                  // fuzz
                  if (geo.properties.value < 2) geo.properties.value = 3;
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

    // dropoffsvia
    server.route({
      method: "GET",
      path: "/dropoffsvia/{provider}/{time}/{bin}/",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;
          const bin = request.params.bin;

          var data = turf.featureCollection([]);

          store
            .createReadStream({
              gte: provider + "!dropoffsvia!" + bin,
              lt: provider + "!dropoffsvia!" + bin + "?"
            })
            .pipe(
              through2.obj((item, enc, next) => {
                const key = item.key.split("!");
                const keyTime = key[2];
                const keyBin = key[3];

                if (time === keyTime) {
                  var geo = turf.polygon([h3.h3ToGeoBoundary(keyBin, true)], {
                    value: item.value
                  });

                  // fuzz
                  if (geo.properties.value < 2) geo.properties.value = 3;
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
