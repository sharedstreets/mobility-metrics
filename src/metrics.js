const queue = require("d3-queue").queue;
const h3 = require("h3-js");

var Metrics = function(provider, store) {
  this.provider = provider;
  this.store = store;
};

// PROCESS EVENTS

Metrics.prototype.change = function(change, done) {
  var q = queue(1);

  q.defer(cb => {
    this.utilization(trip, cb);
  });
  q.defer(cb => {
    this.availability(trip, cb);
  });

  q.awaitAll(() => {
    done();
  });
};

Metrics.prototype.trip = function(trip, done) {
  var q = queue(1);

  q.defer(cb => {
    this.vehicles(trip, cb);
  });
  q.defer(cb => {
    this.pickups(trip, cb);
  });
  q.defer(cb => {
    this.dropoffs(trip, cb);
  });
  q.defer(cb => {
    this.pickupsvia(trip, cb);
  });
  q.defer(cb => {
    this.dropoffsvia(trip, cb);
  });

  q.awaitAll(() => {
    done();
  });
};

// AGGREGATORS

Metrics.prototype.utilization = function(change, done) {
  done();
};

Metrics.prototype.availability = function(change, done) {
  done();
};

Metrics.prototype.vehicles = function(trip, done) {
  done();
};

Metrics.prototype.pickups = function(trip, done) {
  done();
};

Metrics.prototype.dropoffs = function(trip, done) {
  done();
};

Metrics.prototype.pickupsvia = function(trip, done) {
  done();
};

Metrics.prototype.dropoffsvia = function(trip, done) {
  done();
};

module.exports = Metrics;
