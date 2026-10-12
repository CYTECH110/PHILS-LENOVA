const crypto = require('crypto');
const { COOKIE_SECURE } = require('../config/env');
const { httpError } = require('./error');

function csrfToken(request, response) {
  let token = request.cookies && request.cookies.learnova_csrf;
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    response.cookie('learnova_csrf', token, {
      httpOnly: false,
      secure: COOKIE_SECURE,
      sameSite: 'lax'
    });
  }
  response.json({ csrfToken: token });
}

function requireCsrf(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const cookieToken = request.cookies && request.cookies.learnova_csrf;
  const headerToken = request.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(httpError(403, 'Invalid CSRF token'));
  }
  return next();
}

module.exports = { csrfToken, requireCsrf };
