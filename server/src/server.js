const path = require('path');
const fs = require('fs');

const app = require('./app');
const pool = require('./config/database');
const { redisClient } = require('./config/redis');
const { PORT, NODE_ENV } = require('./config/env');

const clientIndex = path.join(__dirname, '../../client-react/dist/index.html');
const server = app.listen(PORT, () => {
  console.log(`PHILS LEARNOVA running at http://localhost:${PORT} (${NODE_ENV})`);

  if (!fs.existsSync(clientIndex)) {
    console.warn('[learnova] Frontend build missing (client-react/dist). Run "npm run build" to serve the SPA.');
  }

  // Fail loudly (but keep serving the API) if the database is unreachable.
  pool
    .query('SELECT 1')
    .then(() => console.log('[learnova] Database connection OK'))
    .catch((error) => console.error('[learnova] Database connection failed:', error.message));
});

let shuttingDown = false;

/**
 * Graceful shutdown: stop accepting connections, drain the HTTP server, then
 * close the MySQL pool and Redis client. Force-exits if that takes too long.
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[learnova] ${signal} received, shutting down...`);

  const forceExit = setTimeout(() => {
    console.error('[learnova] Shutdown timed out; forcing exit.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  server.close(async () => {
    try {
      await pool.end();
    } catch (error) {
      console.error('[learnova] Error closing MySQL pool:', error.message);
    }
    try {
      if (redisClient.isOpen) await redisClient.quit();
    } catch (error) {
      console.error('[learnova] Error closing Redis client:', error.message);
    }
    clearTimeout(forceExit);
    console.log('[learnova] Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[learnova] Unhandled promise rejection:', reason);
});

module.exports = server;
