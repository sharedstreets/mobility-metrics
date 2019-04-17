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
