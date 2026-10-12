const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_SECURE } = require('../config/env');
const { verifyPassword, hashPassword } = require('../services/password.service');
const { sendPasswordResetEmail } = require('../services/email.service');
const crypto = require('crypto');
const { httpError } = require('../middleware/error');

const COOKIE_PATH = '/';

const parseLifetimeMs = () => {
  const match = /^(\d+)\s*([smhd])$/i.exec(String(JWT_EXPIRES_IN || ''));
  if (!match) return 8 * 60 * 60 * 1000;
  const units = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return Number(match[1]) * units[match[2].toLowerCase()];
};

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'strict',
  path: COOKIE_PATH
});

const getCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: parseLifetimeMs()
});

const login = async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return next(httpError(400, 'Username and password are required.'));
    }

    const [rows] = await db.execute(
      'SELECT * FROM users WHERE username = ? AND status = ? LIMIT 1',
      [username, 'ACTIVE']
    );
    const user = rows[0];

    if (!user) {
      return next(httpError(401, 'Invalid username or password.'));
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return next(httpError(401, 'Invalid username or password.'));
    }

    const payload = {
      sub: user.id,
      id: user.id,
      role: String(user.role).toUpperCase(),
      username: user.username
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const safeUser = { ...user };
    delete safeUser.password_hash;

    res.cookie('jwt', token, getCookieOptions());
    return res.status(200).json({ message: 'Login successful', user: safeUser });
  } catch (error) {
    next(error);
  }
};

const logout = (req, res) => {
  res.clearCookie('jwt', baseCookieOptions());
  return res.status(200).json({ message: 'Logged out successfully' });
};

const me = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(httpError(401, req.authError || 'Authentication required'));
    }
    // Attach fresh profile fields from the DB; auth claims (sub/role) stay token-sourced.
    const [rows] = await db.execute('SELECT full_name, email FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    const user = rows.length ? { ...req.user, full_name: rows[0].full_name, email: rows[0].email } : req.user;
    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a reset link has been sent.';

const updateProfile = async (req, res, next) => {
  try {
    if (!req.user) return next(httpError(401, req.authError || 'Authentication required'));
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (!fullName) return next(httpError(400, 'full_name is required'));
    if (fullName.length > 160) return next(httpError(400, 'full_name must be at most 160 characters'));
    if (email && !EMAIL_REGEX.test(email)) return next(httpError(400, 'Invalid email format'));
    if (email.length > 255) return next(httpError(400, 'email must be at most 255 characters'));

    try {
      await db.execute('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [fullName, email || null, req.user.sub]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return next(httpError(409, 'Email already in use'));
      throw e;
    }

    const [rows] = await db.execute('SELECT id, username, full_name, role, email, status, created_at FROM users WHERE id = ?', [req.user.sub]);
    return res.json({ user: rows[0] });
  } catch (e) { next(e); }
};


const changePassword = async (req, res, next) => {
  try {
    if (!req.user) return next(httpError(401, req.authError || 'Authentication required'));
    const currentPassword = typeof req.body.current_password === 'string' ? req.body.current_password : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    if (!currentPassword || !newPassword) return next(httpError(400, 'Current and new password are required'));
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return next(httpError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`));
    }
    const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.sub]);
    const user = rows[0];
    if (!user) return next(httpError(401, 'Authentication required'));
    const isMatch = await verifyPassword(currentPassword, user.password_hash);
    if (!isMatch) return next(httpError(400, 'Current password is incorrect'));
    const hash = await hashPassword(newPassword);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.sub]);
    return res.json({ success: true, message: 'Password updated.' });
  } catch (e) { next(e); }
};


const forgotPassword = async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    // Always return the same response so the endpoint cannot be used to enumerate accounts.
    if (email && EMAIL_REGEX.test(email)) {
      const [rows] = await db.execute('SELECT id, username, full_name, email FROM users WHERE email = ? LIMIT 1', [email]);
      const user = rows[0];
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        await db.execute('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt]);
        // Best-effort: the service logs and swallows failures so the request never throws.
        await sendPasswordResetEmail(user, token);
      }
    }
    return res.json({ success: true, message: GENERIC_RESET_MESSAGE });
  } catch (e) { next(e); }
};


const resetPassword = async (req, res, next) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';
    if (!token || !newPassword) return next(httpError(400, 'Token and new password are required'));
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return next(httpError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`));
    }
    const [rows] = await db.execute('SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?', [token]);
    const reset = rows[0];
    if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
      return next(httpError(400, 'Invalid or expired token'));
    }
    // Mark used first (WHERE used = 0) so a concurrent request cannot reuse the same token.
    const [claim] = await db.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ? AND used = 0', [reset.id]);
    if (!claim.affectedRows) return next(httpError(400, 'Invalid or expired token'));
    const hash = await hashPassword(newPassword);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, reset.user_id]);
    return res.json({ success: true, message: 'Password has been reset.' });
  } catch (e) { next(e); }
};

module.exports = { login, logout, me, updateProfile, changePassword, forgotPassword, resetPassword };


