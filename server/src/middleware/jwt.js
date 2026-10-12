const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

/**
 * Decode and normalize a JWT payload.
 * Older tokens may carry `id` instead of `sub`, and roles may be stored in
 * lower case; every consumer expects `sub` + an upper-case `role`.
 */
function decodeToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded) return null;

  if (!decoded.sub && decoded.id) decoded.sub = decoded.id;
  if (!decoded.id && decoded.sub) decoded.id = decoded.sub;
  if (decoded.role) decoded.role = String(decoded.role).toUpperCase();

  return decoded;
}

/**
 * Populates `req.user` from the HttpOnly `jwt` cookie for every request.
 * When the cookie is present but unusable, the reason is stored on
 * `req.authError` so `requireAuth` can return an accurate 401 message.
 */
function attachUser(req, res, next) {
  req.user = null;
  req.authError = null;

  const token = req.cookies && req.cookies.jwt;
  if (!token) return next();

  try {
    req.user = decodeToken(token);
  } catch (error) {
    req.authError = 'Invalid or expired session. Please sign in again.';
  }

  return next();
}

module.exports = { attachUser };
