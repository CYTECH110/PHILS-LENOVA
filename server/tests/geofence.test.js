const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceMeters, checkLocation } = require('../src/services/geofence.service');

test('geofence accepts a point inside the configured radius', () => {
  const classroom = { latitude: 5.6037, longitude: -0.1870, radius_meters: 100 };
  const result = checkLocation({ latitude: 5.6037, longitude: -0.1870 }, classroom);
  assert.equal(result.allowed, true);
  assert.equal(result.distance, 0);
});

test('geofence rejects a point outside the configured radius', () => {
  const classroom = { latitude: 5.6037, longitude: -0.1870, radius_meters: 100 };
  const distance = distanceMeters({ latitude: 5.6037, longitude: -0.1870 }, { latitude: 5.6057, longitude: -0.1870 });
  const result = checkLocation({ latitude: 5.6057, longitude: -0.1870 }, classroom);
  assert.equal(result.allowed, false);
  assert.ok(distance > classroom.radius_meters);
});
