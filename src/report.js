const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");
const copy = require("recursive-copy");
const crypto = require("crypto");
const moment = require("moment");

async function report(
  config,
  providers,
  publicPath,
  startDay,
  endDay,
  reportDay
) {
  var version = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../package.json")).toString()
  ).version;

  const reportsPath = path.join(publicPath, "reports");
  rimraf.sync(path.join(reportsPath, reportDay));
  mkdirp.sync(path.join(reportsPath, reportDay));

  const dataPath = path.join(publicPath, "data", reportDay);
  const assetsPath = path.join(__dirname, "../assets");

  await copy(assetsPath, path.join(reportsPath, reportDay, "assets"));
  rimraf.sync(path.join(publicPath, "assets"));
  await copy(assetsPath, path.join(publicPath, "assets"));

  const reportsTemplate = fs
    .readFileSync(path.join(__dirname, "../templates/reports.html"))
    .toString();
  const dayTemplate = fs
    .readFileSync(path.join(__dirname, "../templates/report.html"))
    .toString();

  var report = dayTemplate;
  var queryDay = "";
  if (startDay === endDay)
    queryDay = moment(reportDay, "YYYY-MM-DD").format("M/D/YYYY");
  else
    queryDay =
      moment(startDay, "YYYY-MM-DD").format("M/D/YYYY") +
      "  -  " +
      moment(endDay, "YYYY-MM-DD").format("M/D/YYYY");
  report = report.split("$date$").join(queryDay);
  report = report.split("$startDay$").join(startDay);
  report = report.split("$endDay$").join(endDay);
  report = report.split("$reportDay$").join(reportDay);
  report = report.split("$zoom$").join(config.zoom || 12);
  report = report.split("$center$").join(JSON.stringify(config.center));
  report = report
    .split("$style$")
    .join(config.style || "mapbox://styles/mapbox/light-v9");
  report = report.split("$summary$").join(JSON.stringify(config.summary));

  for (let provider of providers) {
    const reportPath = path.join(reportsPath, reportDay, provider + ".html");
    const metricsPath = path.join(dataPath, provider + ".json");
    const metrics = fs.readFileSync(metricsPath).toString();

    const signature = crypto
      .createHmac("sha256", version)
      .update(metrics)
      .digest("hex");

    var html = report;
    html = html.split("$provider$").join(provider);
    html = html.split("$data$").join(metrics);
    html = html.split("$signature$").join(signature);

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
  listing = reportsTemplate.split("$reports$").join(listing);
  fs.writeFileSync(path.join(publicPath, "index.html"), listing);
}

module.exports = report;
