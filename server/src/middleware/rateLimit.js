const rateLimit = require('express-rate-limit');
const { IS_TEST, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX } = require('../config/env');
const { httpError } = require('./error');

const handleLimit = (request, response, next) =>
  next(httpError(429, 'Too many requests. Please try again later.'));

/**
 * Stricter limiter for credential endpoints (login + password flows).
 * Disabled under NODE_ENV=test so the suite never hits it.
 */
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => IS_TEST,
  handler: handleLimit
});

/**
 * Applies to every mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) across
 * `/api`. Reads, HEADs, and CORS preflights are not counted.
 */
const mutationLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (request) => IS_TEST || ['GET', 'HEAD', 'OPTIONS'].includes(request.method),
  handler: handleLimit
});

module.exports = { authLimiter, mutationLimiter };
