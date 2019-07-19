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
  rimraf.sync(path.join(publicPath, "assets"));
  await copy(assetsPath, path.join(publicPath, "assets"));

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
    const reportPath = path.join(reportsPath, day, provider + '.html');
    const metricsPath = path.join(dataPath, provider + ".json");
    const metrics = fs.readFileSync(metricsPath).toString();

    var html = report;
    html = html.split("{{provider}}").join(provider);
    html = html.split("{{data}}").join(metrics);

    fs.writeFileSync(reportPath, html);
  }

  var listing = "";
  var days = fs.readdirSync(path.join(publicPath, "data"));

  for (let d of days) {
    listing += '<h2 class="title is-5">' + d + "</h2><ul>";
    var reports = fs.readdirSync(dataPath);
    for (let r of reports) {
      const name = r
        .split(".")
        .slice(0, -1)
        .join(".");
      listing +=
        '<li><a href="/reports/' + d + "/" + name + '">' + name + "</a></li>";
    }
    listing += "</ul>";
  }
  listing = reportsTemplate.split("{{reports}}").join(listing);
  fs.writeFileSync(path.join(publicPath, "index.html"), listing);
}

module.exports = report;
