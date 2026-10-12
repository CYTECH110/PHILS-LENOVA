const redis = require('redis');
const { REDIS_URL } = require('./env');

const redisClient = redis.createClient({ url: REDIS_URL });

// Redis is optional. Cache helpers below gate on the client's own readiness
// flag (`redisClient.isReady`) so there is a single source of truth, and an
// unreachable Redis is reported exactly once (the client keeps retrying in the
// background) instead of flooding the logs.
let reportedUnavailable = false;
function reportUnavailable(detail) {
  if (reportedUnavailable) return;
  reportedUnavailable = true;
  console.warn('Redis unavailable; caching disabled:', detail || 'connection failed');
}

redisClient.on('error', (err) => reportUnavailable(err.message));
redisClient.on('connect', () => {
  reportedUnavailable = false;
  console.log('Redis Client Connected');
});

// Connect eagerly so the cache is ready when the first request arrives. The
// `error` listener above reports failures, so the rejection is swallowed here.
redisClient.connect().catch((err) => reportUnavailable(err && err.message));

async function getCache(key) {
  if (!redisClient.isReady) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis GET Error:', err);
    return null;
  }
}

async function setCache(key, value, expiration = 3600) {
  if (!redisClient.isReady) return;
  try {
    await redisClient.setEx(key, expiration, JSON.stringify(value));
  } catch (err) {
    console.error('Redis SET Error:', err);
  }
}

async function invalidateCache(pattern) {
  if (!redisClient.isReady) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.error('Redis INVALIDATE Error:', err);
  }
}

module.exports = { redisClient, getCache, setCache, invalidateCache };

