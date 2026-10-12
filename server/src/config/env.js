const path = require('path');
const dotenv = require('dotenv');

// Single place that loads .env. Resolve it relative to the project root first
// so the app works from any working directory, then fall back to the cwd.
const rootEnv = path.resolve(__dirname, '../../../.env');
const loaded = dotenv.config({ path: rootEnv });
if (loaded.error) dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

/** Parse a boolean-ish env value, falling back when it is empty/undefined. */
function readBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

/** Parse an integer env value, falling back when it is missing/NaN. */
function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * `trust proxy` for Express. Behind a reverse proxy this must be set so the
 * client IP (from X-Forwarded-For) is used for rate limiting and so secure
 * cookies are recognised. Production defaults to the first proxy hop; set
 * TRUST_PROXY to a number, `true`, or a subnet string to override.
 */
function readTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === '') return IS_PRODUCTION ? 1 : false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const asInt = Number.parseInt(raw, 10);
  return Number.isFinite(asInt) ? asInt : raw;
}

/**
 * JWT signing secret. Production refuses to boot with a missing or default
 * secret rather than silently signing tokens everyone can forge.
 */
function readJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isDefault = !secret || secret === 'dev-secret-change-me';

  if (isDefault && IS_PRODUCTION) {
    throw new Error(
      'JWT_SECRET must be set to a unique value in production (refusing to start with a missing/default secret).'
    );
  }

  return secret || 'dev-secret-change-me';
}

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const APP_BASE_URL = process.env.APP_BASE_URL || CLIENT_ORIGIN;

// Cookies are marked Secure in production so they are only sent over HTTPS.
// COOKIE_SECURE=false can override this (e.g. for local HTTPS-off smoke tests).
const COOKIE_SECURE = readBool(process.env.COOKIE_SECURE, IS_PRODUCTION);

// Request body size cap for the JSON/urlencoded parsers.
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';

// Database pool sizing.
const DB_CONNECTION_LIMIT = readInt(process.env.DB_CONNECTION_LIMIT, 10);

// Redis is optional; caching degrades gracefully when it is unreachable.
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Rate limiting (all mutation routes) and the stricter auth bucket.
const RATE_LIMIT_WINDOW_MS = readInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const RATE_LIMIT_MAX = readInt(process.env.RATE_LIMIT_MAX, 600);
const AUTH_RATE_LIMIT_MAX = readInt(process.env.AUTH_RATE_LIMIT_MAX, 100);

// Email delivery. Never read process.env outside this file. SMTP is treated as
// disabled unless host + credentials are present, and always disabled under NODE_ENV=test
// so the test suite never needs a live mail server.
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = readInt(process.env.SMTP_PORT, 587);
const SMTP_SECURE = readBool(process.env.SMTP_SECURE, false);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"PHILS LEARNOVA" <no-reply@learnova.example.com>';
const EMAIL_ENABLED = !IS_TEST && Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

/**
 * Fail fast when a production deployment is obviously misconfigured instead
 * of coming up half-broken (plaintext cookies, localhost origins, empty DB
 * password). Development and test never throw.
 */
function assertProductionEnv() {
  if (!IS_PRODUCTION) return;

  const problems = [];
  if (/localhost|127\.0\.0\.1/i.test(CLIENT_ORIGIN)) {
    problems.push('CLIENT_ORIGIN still points at localhost');
  }
  if (/localhost|127\.0\.0\.1/i.test(APP_BASE_URL)) {
    problems.push('APP_BASE_URL still points at localhost');
  }
  if (!process.env.DB_PASSWORD) {
    problems.push('DB_PASSWORD is empty (use a least-privilege database user)');
  }
  if (!COOKIE_SECURE) {
    problems.push('COOKIE_SECURE is disabled (auth cookies must be Secure over HTTPS)');
  }

  if (problems.length) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  }
}

assertProductionEnv();

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  IS_TEST,
  PORT: readInt(process.env.PORT, 3000),
  TRUST_PROXY: readTrustProxy(),
  CLIENT_ORIGIN,
  COOKIE_SECURE,
  REQUEST_BODY_LIMIT,
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: readInt(process.env.DB_PORT, 3306),
  DB_NAME: process.env.DB_NAME || 'smartclass',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_CONNECTION_LIMIT,
  JWT_SECRET: readJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  APP_BASE_URL,
  REDIS_URL,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
  EMAIL_ENABLED,
  EMAIL_FROM,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS
};
