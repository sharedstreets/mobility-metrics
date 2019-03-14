const queue = require("d3-queue").queue;
const h3 = require("h3-js");
const moment = require("moment");

var Metrics = function(provider, store) {
  this.provider = provider;
  this.store = store;
};

// PROCESS EVENTS

Metrics.prototype.change = function(change, done) {
  var q = queue(1);

  q.defer(cb => {
    this.utilization(trip, null, cb);
  });
  q.defer(cb => {
    this.availability(trip, null, cb);
  });

  q.awaitAll(() => {
    done();
  });
};

Metrics.prototype.trip = function(trip, done) {
  var d = new Date(trip.start_time * 1000);
  var times = [day(d), hour(d), quarter(d)];

  var q = queue(1);

  q.defer(cb => {
    this.vehicles(trip, times, cb);
  });
  q.defer(cb => {
    this.pickups(trip, times, cb);
  });
  q.defer(cb => {
    this.dropoffs(trip, times, cb);
  });
  q.defer(cb => {
    this.pickupsvia(trip, times, cb);
  });
  q.defer(cb => {
    this.dropoffsvia(trip, times, cb);
  });

  q.awaitAll(() => {
    done();
  });
};

// AGGREGATORS

Metrics.prototype.utilization = function(change, times, done) {
  done();
};

Metrics.prototype.availability = function(change, times, done) {
  done();
};

Metrics.prototype.vehicles = function(trip, times, done) {
  var h3s = new Set();

  trip.route.features.forEach(ping => {
    var bin = h3.geoToH3(
      ping.geometry.coordinates[1],
      ping.geometry.coordinates[0],
      11
    );
    h3s.add(bin);
  });

  var qspace = queue(1);
  h3s.forEach(bin => {
    qspace.defer(spacecb => {
      var qtime = queue(1);
      times.forEach(time => {
        qtime.defer(timecb => {
          var id = "vehicles!" + bin + "!" + time;

          this.store.get(id, (err, record) => {
            if (!record) record = 1;
            else record++;

            this.store.put(id, record, err => {
              if (err) throw err;
              timecb();
            });
          });
        });
      });

      qtime.awaitAll(() => {
        spacecb();
      });
    });
  });

  qspace.awaitAll(() => {
    done();
  });
};

Metrics.prototype.pickups = function(trip, times, done) {
  var bin = h3.geoToH3(
    trip.route.features[0].geometry.coordinates[1],
    trip.route.features[0].geometry.coordinates[0],
    11
  );

  var qtime = queue(1);
  times.forEach(time => {
    qtime.defer(timecb => {
      var id = "pickups!" + bin + "!" + time;

      this.store.get(id, (err, record) => {
        if (!record) record = 1;
        else record++;

        this.store.put(id, record, err => {
          if (err) throw err;
          timecb();
        });
      });
    });
  });

  qtime.awaitAll(() => {
    done();
  });
};

Metrics.prototype.dropoffs = function(trip, times, done) {
  var bin = h3.geoToH3(
    trip.route.features[trip.route.features.length - 1].geometry.coordinates[1],
    trip.route.features[trip.route.features.length - 1].geometry.coordinates[0],
    11
  );

  var qtime = queue(1);
  times.forEach(time => {
    qtime.defer(timecb => {
      var id = "dropoffs!" + bin + "!" + time;

      this.store.get(id, (err, record) => {
        if (!record) record = 1;
        else record++;

        this.store.put(id, record, err => {
          if (err) throw err;
          timecb();
        });
      });
    });
  });

  qtime.awaitAll(() => {
    done();
  });
};

Metrics.prototype.pickupsvia = function(trip, times, done) {
  var binA = h3.geoToH3(
    trip.route.features[0].geometry.coordinates[1],
    trip.route.features[0].geometry.coordinates[0],
    11
  );
  var binB = h3.geoToH3(
    trip.route.features[trip.route.features.length - 1].geometry.coordinates[1],
    trip.route.features[trip.route.features.length - 1].geometry.coordinates[0],
    11
  );

  var qtime = queue(1);
  times.forEach(time => {
    qtime.defer(timecb => {
      var id = "dropoffs!" + binA + "!" + binB + "!" + time;

      this.store.get(id, (err, record) => {
        if (!record) record = 1;
        else record++;

        this.store.put(id, record, err => {
          if (err) throw err;
          timecb();
        });
      });
    });
  });

  qtime.awaitAll(() => {
    done();
  });
};

Metrics.prototype.dropoffsvia = function(trip, times, done) {
  var binA = h3.geoToH3(
    trip.route.features[0].geometry.coordinates[1],
    trip.route.features[0].geometry.coordinates[0],
    11
  );
  var binB = h3.geoToH3(
    trip.route.features[trip.route.features.length - 1].geometry.coordinates[1],
    trip.route.features[trip.route.features.length - 1].geometry.coordinates[0],
    11
  );

  var qtime = queue(1);
  times.forEach(time => {
    qtime.defer(timecb => {
      var id = "dropoffs!" + binB + "!" + binA + "!" + time;

      this.store.get(id, (err, record) => {
        if (!record) record = 1;
        else record++;

        this.store.put(id, record, err => {
          if (err) throw err;
          timecb();
        });
      });
    });
  });

  qtime.awaitAll(() => {
    done();
  });
};

function day(d) {
  return moment(d).format("YYYY-MM-DD");
}

function hour(d) {
  return moment(d).format("YYYY-MM-DD-HH");
}

function quarter(d) {
  var timeKey = moment(d).format("YYYY-MM-DD-HH-");
  var minutes = (Math.round((d.getMinutes() / 60) * 4) - 1) * 15;
  return timeKey + minutes;
}

module.exports = Metrics;
