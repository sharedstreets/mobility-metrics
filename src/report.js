const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");
const copy = require("recursive-copy");

async function report(config, providers, publicPath, day) {
  const reportsPath = path.join(publicPath, "reports");
  rimraf.sync(path.join(reportsPath, day));
  mkdirp.sync(path.join(reportsPath, day));

  const dataPath = path.join(publicPath, "data", day);
  const assetsPath = path.join(__dirname, "../assets");

  await copy(assetsPath, path.join(reportsPath, day, "assets"));

  const reportsTemplate = fs
    .readFileSync(path.join(__dirname, "../templates/reports.html"))
    .toString();
  const dayTemplate = fs
    .readFileSync(path.join(__dirname, "../templates/day.html"))
    .toString();

  var report = dayTemplate;
  report = report.split("{{day}}").join(day);
  report = report.split("{{zoom}}").join(config.zoom || 12);
  report = report.split("{{center}}").join(JSON.stringify(config.center));
  report = report
    .split("{{style}}")
    .join(config.style || "mapbox://styles/mapbox/light-v9");

  for (let provider of providers) {
    const reportPath = path.join(reportsPath, day, provider);
    const metricsPath = path.join(dataPath, provider + ".json");
    const metrics = fs.readFileSync(metricsPath).toString();

    var html = report;
    html = html.split("{{provider}}").join(provider);
    html = html.split("{{data}}").join(metrics);

    fs.writeFileSync(reportPath, html);
  }
}

module.exports = report;
