const express = require('express');
const pool = require('../config/database');

const router = express.Router();

/** Liveness: the process is up and able to answer. */
router.get('/', (request, response) => {
  response.json({
    name: 'PHILS LEARNOVA',
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/** Explicit liveness alias for orchestrators (k8s, Render, etc.). */
router.get('/live', (request, response) => {
  response.json({ status: 'ok' });
});

/**
 * Readiness: the process can serve traffic (database reachable). Redis is
 * optional and reported but never fails readiness, since caching degrades
 * gracefully when it is down.
 */
router.get('/ready', async (request, response) => {
  const checks = { database: 'ok', redis: 'unknown' };
  try {
    // Loaded lazily so importing the app never opens a Redis connection.
    const { redisClient } = require('../config/redis');
    checks.redis = redisClient.isReady ? 'ok' : 'unavailable';
  } catch (error) {
    checks.redis = 'unavailable';
  }
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    checks.database = 'error';
    return response.status(503).json({ status: 'unavailable', checks });
  }
  return response.json({ status: 'ready', checks });
});

module.exports = router;
