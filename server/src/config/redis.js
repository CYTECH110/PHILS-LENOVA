const redis = require('redis');
const { REDIS_URL } = require('./env');

const redisClient = redis.createClient({ url: REDIS_URL });

// Redis is optional. Log an unreachable Redis once (the client retries) and
// stay quiet afterwards so a missing instance does not flood the logs.
let loggedError = false;
redisClient.on('error', (err) => {
  if (loggedError) return;
  loggedError = true;
  console.warn('Redis unavailable; caching disabled:', err.message || 'connection failed');
});
redisClient.on('connect', () => console.log('Redis Client Connected'));

// In tests, we might not have a Redis server running. Let's handle gracefully.
let isConnected = false;
redisClient.connect().then(() => {
  isConnected = true;
}).catch((err) => {
  console.warn('Redis connection failed, caching will be bypassed:', err.message);
});

async function getCache(key) {
  if (!isConnected) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis GET Error:', err);
    return null;
  }
}

async function setCache(key, value, expiration = 3600) {
  if (!isConnected) return;
  try {
    await redisClient.setEx(key, expiration, JSON.stringify(value));
  } catch (err) {
    console.error('Redis SET Error:', err);
  }
}

async function invalidateCache(pattern) {
  if (!isConnected) return;
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

