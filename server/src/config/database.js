const mysql = require('mysql2/promise');
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_CONNECTION_LIMIT } = require('./env');

/**
 * Shared connection pool. Values come from `config/env.js` (the only reader of
 * `.env`). Keep-alive avoids dropped sockets behind managed MySQL hosts.
 */
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: DB_CONNECTION_LIMIT,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

module.exports = pool;
