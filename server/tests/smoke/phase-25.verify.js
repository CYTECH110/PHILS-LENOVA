const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const ROOT = path.resolve(__dirname, '../../..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const app = require('../../src/app');
const pool = require('../../src/config/database');

const out = [];
const check = (label, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const tag = crypto.randomBytes(3).toString('hex');
const PASSWORD = '__Phase25-verify-pw-123';
const USERNAME = `__p25_user_${tag}`;
const USERNAME2 = `__p25_other_${tag}`;
const EMAIL = `__p25_${tag}@example.com`;
const TAKEN_EMAIL = `__p25_taken_${tag}@example.com`;

let server;
let base;
let csrfCookie;
let csrf;
let userId;
let otherId;
let jarCookie;

async function requestWith(pathname, { method = 'GET', cookie = '', csrfHeader = '', json } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (method !== 'GET' && method !== 'HEAD') headers['x-csrf-token'] = csrfHeader;
  let body;
  if (json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(base + pathname, { method, headers, body });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: res.status, body: data, setCookie: res.headers.get('set-cookie') || '' };
}

function auth(cookie) {
  return { cookie: `${cookie}; ${csrfCookie}`, csrfHeader: csrf };
}

async function tryLogin(username, password) {
  const res = await requestWith('/api/auth/login', { cookie: csrfCookie, csrfHeader: csrf, method: 'POST', json: { username, password } });
  return { status: res.status, cookie: (res.setCookie || '').split(';')[0] };
}

async function staticChecks() {
  check('ProfilePanel.jsx exists', fs.existsSync(path.join(ROOT, 'client-react/src/pages/ProfilePanel.jsx')));
  const profile = read('client-react/src/pages/ProfilePanel.jsx');
  check('ProfilePanel has account + password forms', /Account details/.test(profile) && /Change password/.test(profile));

  check('ForgotPassword.jsx exists', fs.existsSync(path.join(ROOT, 'client-react/src/pages/ForgotPassword.jsx')));
  check('ResetPassword.jsx exists', fs.existsSync(path.join(ROOT, 'client-react/src/pages/ResetPassword.jsx')));

  const appShell = read('client-react/src/App.jsx');
  check('App routes /forgot-password + /reset-password', appShell.includes('/forgot-password') && appShell.includes('/reset-password'));

  const login = read('client-react/src/pages/Login.jsx');
  check('Login links to /forgot-password', /\/forgot-password/.test(login));

  const api = read('client-react/src/lib/api.js');
  check('api.js exposes account wrappers', ['updateProfile', 'changePassword', 'forgotPassword', 'resetPassword'].every((name) => api.includes(name)));

  const dashboards = ['AdminDashboard', 'TeacherDashboard', 'StudentDashboard'].map((name) => read(`client-react/src/pages/${name}.jsx`));
  check('all dashboards render ProfilePanel', dashboards.every((src) => src.includes('ProfilePanel')));

  const distIndex = path.join(ROOT, 'client-react/dist/index.html');
  if (fs.existsSync(distIndex)) {
    const html = fs.readFileSync(distIndex, 'utf8');
    const asset = /src="([^"]*assets\/[^"]+\.js)"/.exec(html);
    if (asset) {
      const bundle = fs.readFileSync(path.join(ROOT, 'client-react/dist', asset[1].replace(/^\//, '')), 'utf8');
      check('built bundle ships account routes', bundle.includes('/forgot-password') && bundle.includes('/reset-password'));
    } else {
      check('built bundle references an assets js file', false, html);
    }
  } else {
    check('client-react/dist built', false, 'run npm --prefix client-react run build');
  }
}

async function main() {
  await staticChecks();

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const csrfRes = await fetch(base + '/api/csrf-token');
  csrfCookie = (csrfRes.headers.get('set-cookie') || '').split(';')[0];
  csrf = (await csrfRes.json()).csrfToken;

  const hash = await bcrypt.hash(PASSWORD, 12);
  const [created] = await pool.execute(
    'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
    [USERNAME, hash, 'Phase25 User', 'STUDENT', null]
  );
  userId = created.insertId;
  const [created2] = await pool.execute(
    'INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)',
    [USERNAME2, hash, 'Phase25 Other', 'STUDENT', TAKEN_EMAIL]
  );
  otherId = created2.insertId;

  const login = await tryLogin(USERNAME, PASSWORD);
  check('temp user login -> 200', login.status === 200, String(login.status));
  jarCookie = login.cookie;

  /* ---------- profile ---------- */
  let r = await requestWith('/api/auth/me', auth(jarCookie));
  check('me -> 200 with email field + role', r.status === 200 && r.body.user.role === 'STUDENT' && 'email' in r.body.user, `${r.status} ${JSON.stringify(r.body)}`);

  r = await requestWith('/api/auth/profile', { ...auth(jarCookie), method: 'PUT', json: { full_name: '  ', email: EMAIL } });
  check('updateProfile missing full_name -> 400 envelope', r.status === 400 && r.body.success === false && typeof r.body.error === 'string', JSON.stringify(r.body));

  r = await requestWith('/api/auth/profile', { ...auth(jarCookie), method: 'PUT', json: { full_name: 'Phase25 User', email: 'bad-email' } });
  check('updateProfile bad email -> 400', r.status === 400, String(r.status));

  r = await requestWith('/api/auth/profile', { ...auth(jarCookie), method: 'PUT', json: { full_name: 'Phase25 Renamed', email: EMAIL } });
  check('updateProfile -> 200 + saved values', r.status === 200 && r.body.user.full_name === 'Phase25 Renamed' && r.body.user.email === EMAIL, `${r.status} ${JSON.stringify(r.body)}`);

  r = await requestWith('/api/auth/me', auth(jarCookie));
  check('me reflects updated profile', r.body.user.full_name === 'Phase25 Renamed' && r.body.user.email === EMAIL, JSON.stringify(r.body));

  r = await requestWith('/api/auth/profile', { ...auth(jarCookie), method: 'PUT', json: { full_name: 'Phase25 Renamed', email: TAKEN_EMAIL } });
  check('updateProfile duplicate email -> 409', r.status === 409 && r.body.success === false, `${r.status} ${JSON.stringify(r.body)}`);

  /* ---------- change password ---------- */
  r = await requestWith('/api/auth/change-password', { ...auth(jarCookie), method: 'POST', json: { current_password: 'wrong', new_password: 'NewPass123!' } });
  check('changePassword wrong current -> 400', r.status === 400, String(r.status));

  r = await requestWith('/api/auth/change-password', { ...auth(jarCookie), method: 'POST', json: { current_password: PASSWORD, new_password: 'short' } });
  check('changePassword too short -> 400', r.status === 400, String(r.status));

  r = await requestWith('/api/auth/change-password', { ...auth(jarCookie), method: 'POST', json: { current_password: PASSWORD, new_password: 'NewPass123!' } });
  check('changePassword -> 200', r.status === 200, String(r.status));
  check('old password now rejected', (await tryLogin(USERNAME, PASSWORD)).status === 401);
  const relogin = await tryLogin(USERNAME, 'NewPass123!');
  check('new password accepted', relogin.status === 200, String(relogin.status));
  jarCookie = relogin.cookie;

  /* ---------- forgot / reset ---------- */
  const unknown = await requestWith('/api/auth/forgot-password', { ...auth(jarCookie), method: 'POST', json: { email: `nobody_${tag}@example.com` } });
  const known = await requestWith('/api/auth/forgot-password', { ...auth(jarCookie), method: 'POST', json: { email: EMAIL } });
  check('forgot-password known -> 200 generic', known.status === 200 && known.body.success === true, JSON.stringify(known.body));
  check('forgot-password does not enumerate (same body)', JSON.stringify(unknown.body) === JSON.stringify(known.body), `${JSON.stringify(unknown.body)} vs ${JSON.stringify(known.body)}`);

  const [tokenRows] = await pool.execute('SELECT id, token, expires_at, used FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  check('reset token stored, unused, ~1h expiry', tokenRows.length === 1 && Number(tokenRows[0].used) === 0 && (new Date(tokenRows[0].expires_at).getTime() - Date.now()) > 55 * 60000, JSON.stringify(tokenRows[0] || {}));
  const resetToken = tokenRows[0]?.token;

  r = await requestWith('/api/auth/reset-password', { ...auth(jarCookie), method: 'POST', json: { token: 'nope', new_password: 'ResetPass123!' } });
  check('reset-password bad token -> 400', r.status === 400, String(r.status));

  r = await requestWith('/api/auth/reset-password', { ...auth(jarCookie), method: 'POST', json: { token: resetToken, new_password: 'short' } });
  check('reset-password too short -> 400', r.status === 400, String(r.status));

  r = await requestWith('/api/auth/reset-password', { ...auth(jarCookie), method: 'POST', json: { token: resetToken, new_password: 'ResetPass123!' } });
  check('reset-password -> 200', r.status === 200, String(r.status));
  check('password reset takes effect', (await tryLogin(USERNAME, 'ResetPass123!')).status === 200);

  r = await requestWith('/api/auth/reset-password', { ...auth(jarCookie), method: 'POST', json: { token: resetToken, new_password: 'AnotherPass123!' } });
  check('reset-password token is single-use -> 400', r.status === 400, String(r.status));

  const expiredToken = `p25_expired_${tag}`;
  await pool.execute('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR))', [userId, expiredToken]);
  r = await requestWith('/api/auth/reset-password', { ...auth(jarCookie), method: 'POST', json: { token: expiredToken, new_password: 'AnotherPass123!' } });
  check('reset-password expired token -> 400', r.status === 400, String(r.status));

  /* ---------- auth / CSRF matrix ---------- */
  r = await requestWith('/api/auth/me');
  check('me without cookie -> 401', r.status === 401, String(r.status));
  r = await requestWith('/api/auth/profile', { cookie: csrfCookie, csrfHeader: csrf, method: 'PUT', json: { full_name: 'x' } });
  check('updateProfile without auth cookie -> 401', r.status === 401, String(r.status));
  r = await requestWith('/api/auth/change-password', { cookie: csrfCookie, csrfHeader: csrf, method: 'POST', json: { current_password: 'a', new_password: 'bbbbbbbb' } });
  check('changePassword without auth cookie -> 401', r.status === 401, String(r.status));
  r = await requestWith('/api/auth/profile', { cookie: jarCookie, method: 'PUT', json: { full_name: 'x' } });
  check('updateProfile without csrf -> 403', r.status === 403, String(r.status));
  r = await requestWith('/api/auth/forgot-password', { cookie: jarCookie, method: 'POST', json: { email: EMAIL } });
  check('forgot-password without csrf -> 403', r.status === 403, String(r.status));

  console.log(out.join('\n'));
  const failed = out.filter((line) => line.startsWith('FAIL'));
  console.log(`\n${out.length - failed.length}/${out.length} passed`);
  console.log(failed.length ? 'RESULT: FAILURES' : 'RESULT: ALL PASS');
}

async function cleanup() {
  try {
    await pool.execute('DELETE FROM password_reset_tokens WHERE user_id IN (?, ?)', [userId, otherId]);
    await pool.execute('DELETE FROM audit_logs WHERE user_id IN (?, ?)', [userId, otherId]);
    await pool.execute('DELETE FROM users WHERE username IN (?, ?)', [USERNAME, USERNAME2]);
  } catch (error) {
    console.error('cleanup warning:', error.message);
  }
}

main()
  .catch((error) => { console.error(error); console.log(out.join('\n')); process.exitCode = 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    if (server) server.close();
    process.exit(out.some((line) => line.startsWith('FAIL')) ? 1 : 0);
  });
