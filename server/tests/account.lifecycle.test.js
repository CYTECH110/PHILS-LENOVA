process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '9';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const pool = require('../src/config/database');
const { hashPassword } = require('../src/services/password.service');

const USERNAME = 'acct_test_user';
const OTHER_USERNAME = 'acct_test_other';
const EMAIL = 'acct_test@example.com';
const TAKEN_EMAIL = 'acct_taken@example.com';
let PASSWORD = 'AcctTest123!';

let server, baseUrl, jar, csrf, userId, otherUserId;

function makeJar() {
  const store = new Map();
  return {
    setFrom(res) {
      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const c of cookies) {
        const [p] = c.split(';');
        const idx = p.indexOf('=');
        if (idx > 0) store.set(p.slice(0, idx).trim(), p.slice(idx + 1).trim());
      }
    },
    header() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
  };
}

async function ensureCsrf(j) {
  const res = await fetch(baseUrl + '/api/csrf-token');
  j.setFrom(res);
  const b = await res.json();
  return b.csrfToken;
}

async function mutating(j, c, method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': c, cookie: j.header() },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  j.setFrom(res);
  const t = await res.text();
  let json = null;
  try { json = JSON.parse(t); } catch (e) { /* non-JSON */ }
  return { status: res.status, json, text: t };
}

async function getMe() {
  const res = await fetch(baseUrl + '/api/auth/me', { headers: { cookie: jar.header() } });
  return res.json();
}

async function tryLogin(username, password) {
  const j = makeJar();
  const c = await ensureCsrf(j);
  const res = await mutating(j, c, 'POST', '/api/auth/login', { username, password });
  return res.status;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  await pool.execute('DELETE FROM users WHERE username IN (?, ?)', [USERNAME, OTHER_USERNAME]);

  const hash = await hashPassword(PASSWORD);
  const [r] = await pool.execute(
    'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
    [USERNAME, hash, 'Acct Test', 'STUDENT', null]
  );
  userId = r.insertId;
  const [r2] = await pool.execute(
    'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
    [OTHER_USERNAME, hash, 'Other User', 'STUDENT', TAKEN_EMAIL]
  );
  otherUserId = r2.insertId;

  jar = makeJar();
  csrf = await ensureCsrf(jar);
  const login = await mutating(jar, csrf, 'POST', '/api/auth/login', { username: USERNAME, password: PASSWORD });
  assert.equal(login.status, 200);
});

test.after(async () => {
  await pool.execute('DELETE FROM password_reset_tokens WHERE user_id IN (?, ?)', [userId, otherUserId]).catch(() => {});
  await pool.execute('DELETE FROM users WHERE id IN (?, ?)', [userId, otherUserId]).catch(() => {});
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await pool.end();
});

test('me returns profile including email', async () => {
  const data = await getMe();
  assert.equal(data.user.username, USERNAME);
  assert.equal(data.user.email, null);
});

test('updateProfile requires full_name (400 envelope)', async () => {
  const res = await mutating(jar, csrf, 'PUT', '/api/auth/profile', { full_name: '   ', email: EMAIL });
  assert.equal(res.status, 400);
  assert.equal(res.json.success, false);
  assert.ok(res.json.error);
});

test('updateProfile rejects malformed email', async () => {
  const res = await mutating(jar, csrf, 'PUT', '/api/auth/profile', { full_name: 'Acct Updated', email: 'not-an-email' });
  assert.equal(res.status, 400);
});

test('updateProfile saves full_name and email', async () => {
  const res = await mutating(jar, csrf, 'PUT', '/api/auth/profile', { full_name: 'Acct Updated', email: EMAIL });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.full_name, 'Acct Updated');
  assert.equal(res.json.user.email, EMAIL);
  const data = await getMe();
  assert.equal(data.user.full_name, 'Acct Updated');
  assert.equal(data.user.email, EMAIL);
});

test('updateProfile rejects a duplicate email (409)', async () => {
  const res = await mutating(jar, csrf, 'PUT', '/api/auth/profile', { full_name: 'Acct Updated', email: TAKEN_EMAIL });
  assert.equal(res.status, 409);
  assert.equal(res.json.success, false);
});

test('change-password wrong current password returns 400', async () => {
  const res = await mutating(jar, csrf, 'POST', '/api/auth/change-password', { current_password: 'wrong', new_password: 'NewPass123!' });
  assert.equal(res.status, 400);
});

test('change-password enforces minimum length', async () => {
  const res = await mutating(jar, csrf, 'POST', '/api/auth/change-password', { current_password: PASSWORD, new_password: 'short' });
  assert.equal(res.status, 400);
});

test('change-password success swaps the login password', async () => {
  const res = await mutating(jar, csrf, 'POST', '/api/auth/change-password', { current_password: PASSWORD, new_password: 'NewPass123!' });
  assert.equal(res.status, 200);
  assert.equal(await tryLogin(USERNAME, PASSWORD), 401);
  assert.equal(await tryLogin(USERNAME, 'NewPass123!'), 200);
  PASSWORD = 'NewPass123!';
});

test('forgot-password is generic for unknown and malformed emails', async () => {
  const unknown = await mutating(jar, csrf, 'POST', '/api/auth/forgot-password', { email: 'nobody@example.com' });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.json.success, true);
  assert.match(unknown.json.message, /if an account exists/i);

  const malformed = await mutating(jar, csrf, 'POST', '/api/auth/forgot-password', { email: 'nope' });
  assert.equal(malformed.status, 200);
  assert.equal(malformed.json.message, unknown.json.message);
});

test('forgot-password issues a single-use token with ~1h expiry', async () => {
  const res = await mutating(jar, csrf, 'POST', '/api/auth/forgot-password', { email: EMAIL });
  assert.equal(res.status, 200);
  const [rows] = await pool.execute(
    'SELECT token, expires_at, used FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [userId]
  );
  assert.ok(rows[0]);
  assert.equal(Number(rows[0].used), 0);
  const ttlMinutes = (new Date(rows[0].expires_at).getTime() - Date.now()) / 60000;
  assert.ok(ttlMinutes > 55 && ttlMinutes <= 60, `ttl was ${ttlMinutes}`);
});

test('reset-password rejects unknown and short tokens/passwords', async () => {
  const bad = await mutating(jar, csrf, 'POST', '/api/auth/reset-password', { token: 'does-not-exist', new_password: 'ResetPass123!' });
  assert.equal(bad.status, 400);

  const [rows] = await pool.execute('SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  const short = await mutating(jar, csrf, 'POST', '/api/auth/reset-password', { token: rows[0].token, new_password: 'short' });
  assert.equal(short.status, 400);
});

test('reset-password succeeds once, then the token is single-use and expiry-bound', async () => {
  const [rows] = await pool.execute('SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  const token = rows[0].token;

  const ok = await mutating(jar, csrf, 'POST', '/api/auth/reset-password', { token, new_password: 'ResetPass123!' });
  assert.equal(ok.status, 200);
  assert.equal(await tryLogin(USERNAME, 'ResetPass123!'), 200);
  assert.equal(await tryLogin(USERNAME, PASSWORD), 401);

  const reuse = await mutating(jar, csrf, 'POST', '/api/auth/reset-password', { token, new_password: 'AnotherPass123!' });
  assert.equal(reuse.status, 400);

  const expiredToken = 'expired_token_for_test_' + Date.now();
  await pool.execute(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR))',
    [userId, expiredToken]
  );
  const expired = await mutating(jar, csrf, 'POST', '/api/auth/reset-password', { token: expiredToken, new_password: 'AnotherPass123!' });
  assert.equal(expired.status, 400);
});
