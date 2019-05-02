const Hapi = require("hapi");
const path = require("path");
const through2 = require("through2");
const h3 = require("h3-js");
const turf = require("@turf/turf");
const config = require("./config.json");

function serve(done) {
  const server = Hapi.server({
    port: 5000,
    host: "localhost"
  });

  const init = async () => {
    await server.register(require("inert"));

    // FRONTEND

    // ui
    server.route({
      method: "GET",
      path: "/",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./index.html"));
      }
    });
    // logo
    server.route({
      method: "GET",
      path: "/shst-logo.jpg",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./shst-logo.jpg"));
      }
    });
    // src assets
    server.route({
      method: "GET",
      path: "/bulma.css",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./assets/bulma.css"));
      }
    });
    server.route({
      method: "GET",
      path: "/jquery.min.js",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./assets/jquery.min.js"));
      }
    });
    server.route({
      method: "GET",
      path: "/mapbox-gl.css",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./assets/mapbox-gl.css"));
      }
    });
    server.route({
      method: "GET",
      path: "/mapbox-gl.js",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./assets/mapbox-gl.js"));
      }
    });
    server.route({
      method: "GET",
      path: "/simple-statistics.min.js",
      handler: (request, h) => {
        return h.file(
          path.join(__dirname, "./assets/simple-statistics.min.js")
        );
      }
    });
    server.route({
      method: "GET",
      path: "/turf.min.js",
      handler: (request, h) => {
        return h.file(path.join(__dirname, "./assets/turf.min.js"));
      }
    });

    // boundary
    server.route({
      method: "GET",
      path: "/boundary",
      handler: (request, h) => {
        return config.boundary || [0, 0, 0, 0];
      }
    });

    // center
    server.route({
      method: "GET",
      path: "/center",
      handler: (request, h) => {
        return config.center || [0, 0];
      }
    });

    // providers
    server.route({
      method: "GET",
      path: "/providers",
      handler: (request, h) => {
        return Object.keys(config.providers || {}).filter(p => {
          return config.providers[p].enabled;
        });
      }
    });

    // METRICS

    // summary
    server.route({
      method: "GET",
      path: "/{time}/{provider}",
      handler: (request, h) => {
        const provider = request.params.provider;
        const time = request.params.time;

        var dataPath = path.join(
          __dirname,
          "./data/" + time + "/" + provider + ".json"
        );

        return h.file(dataPath);
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
  serve(() => {});
}

module.exports = serve;
