const { httpError } = require('./error');

const AUTH_REQUIRED = 'Authentication required';

/**
 * Rejects unauthenticated requests with 401. Relies on `attachUser` having
 * run first (global middleware in app.js) and surfaces `req.authError` when
 * the cookie existed but failed verification.
 */
function requireAuth(request, response, next) {
  if (request.user) return next();
  return next(httpError(401, request.authError || AUTH_REQUIRED));
}

/**
 * Role gate. Unauthenticated callers get 401 (client redirects to login);
 * authenticated callers without the role get 403.
 */
function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !request.user.role) {
      return next(httpError(401, request.authError || AUTH_REQUIRED));
    }

    const userRole = String(request.user.role).toUpperCase();
    const allowed = roles.map((role) => String(role).toUpperCase());
    if (!allowed.includes(userRole)) {
      return next(httpError(403, 'Insufficient permissions'));
    }

    return next();
  };
}

module.exports = { requireAuth, requireRole };
