const Hapi = require("hapi");
const path = require("path");
const through2 = require("through2");
const h3 = require("h3-js");
const turf = require("@turf/turf");

function serve(done) {
  const server = Hapi.server({
    port: 5000,
    host: "localhost"
  });

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

    // streets
    server.route({
      method: "GET",
      path: "/streets/{provider}/{time}",
      handler: (request, h) => {
        return new Promise(function(resolve, reject) {
          const provider = request.params.provider;
          const time = request.params.time;

          // grab data for provider from day
          resolve(data);
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
