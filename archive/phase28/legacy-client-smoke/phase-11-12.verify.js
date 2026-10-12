const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const ROOT = path.resolve(__dirname, '../../..');

require('dotenv').config({ path: path.join(ROOT, '.env') });
const db = require('../../src/config/database');

const BASE = 'http://localhost:3013';
const out = [];
const check = (label, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

async function api(pathname, { method = 'GET', cookie = '', csrf = '', body } = {}) {
  const headers = { cookie };
  if (method !== 'GET') {
    headers['x-csrf-token'] = csrf;
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(BASE + pathname, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data, setCookie: res.headers.get('set-cookie') || '' };
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, files);
    else files.push(rel);
  }
  return files;
}

async function main() {
  /* ---------- PHASE 11: static checks ---------- */
  const loginHtml = read('client/login.html');
  const apiJs = read('client/js/api.js');

  const homesMatch = /const homes = \{([^}]+)\}/.exec(loginHtml);
  const homes = {};
  if (homesMatch) {
    for (const [, role, p] of homesMatch[1].matchAll(/([A-Z]+):\s*'([^']+)'/g)) homes[role] = p;
  }
  check('login.html declares a role->page map', Object.keys(homes).length === 3, JSON.stringify(homes));

  const roleHomes = {};
  const roleBlock = /const ROLE_HOMES = \{([\s\S]*?)\};/.exec(apiJs);
  if (roleBlock) {
    for (const [, role, p] of roleBlock[1].matchAll(/([A-Z]+):\s*'([^']+)'/g)) roleHomes[role] = p;
  }
  check('api.js ROLE_HOMES matches login.html map', JSON.stringify(roleHomes) === JSON.stringify(homes), JSON.stringify(roleHomes));

  for (const [role, p] of Object.entries(homes)) {
    check(`redirect target exists for ${role} (${p})`, fs.existsSync(path.join(ROOT, 'client', p)));
    check(`${role} redirect is under /pages/`, p.startsWith('/pages/'), p);
  }

  const clientFiles = walk('client').filter((f) => /\.(html|js)$/.test(f));
  const wrongPath = [];
  for (const f of clientFiles) {
    const text = read(f);
    text.split('\n').forEach((line, i) => {
      if (/['"`]\/(?:admin|teacher|student)\/index\.html['"`]/.test(line)) wrongPath.push(`${f}:${i + 1}`);
    });
  }
  check('no root-level /admin|teacher|student/index.html refs remain', wrongPath.length === 0, wrongPath.join(', '));

  const loginJsRefs = clientFiles.filter((f) => /login\.js/.test(read(f)));
  check('stale login.js (wrong paths) removed and unreferenced', !fs.existsSync(path.join(ROOT, 'client/js/login.js')) && loginJsRefs.length === 0, loginJsRefs.join(', '));

  check('401 redirect is loop-proof (guards login page + login call)', /onLoginPage/.test(apiJs) && /isLoginCall/.test(apiJs) && /location\.replace\('\/login\.html'\)/.test(apiJs));
  check('no token_expired flag added to client contract', !/token_expired/.test(apiJs) && !/token_expired/.test(loginHtml));
  check('landing links use /pages/ paths', !/href="\/(?:admin|teacher|student)\//.test(read('client/index.html')));

  /* ---------- server boot checks ---------- */
  const csrfRes = await fetch(BASE + '/api/csrf-token');
  const csrfCookie = (csrfRes.headers.get('set-cookie') || '').split(';')[0];
  const csrf = (await csrfRes.json()).csrfToken;

  // PHASE 11: login with each role lands on the right page
  const password = 'phase11-verify-pw-123';
  const hash = await bcrypt.hash(password, 12);
  for (const role of ['ADMIN', 'TEACHER', 'STUDENT']) {
    const user = `__p11_${role}__`;
    await db.execute('DELETE FROM users WHERE username = ?', [user]);
    await db.execute('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)', [user, hash, 'Phase11', role]);

    const r = await api('/api/auth/login', { method: 'POST', cookie: csrfCookie, csrf, body: { username: user, password } });
    const gotRole = r.body && r.body.user && r.body.user.role;
    check(`${role} login -> 200`, r.status === 200, String(r.status));
    check(`${role} login returns uppercased role`, gotRole === role, String(gotRole));

    const target = homes[gotRole];
    check(`${role} redirects to correct page (${target})`, !!target && fs.existsSync(path.join(ROOT, 'client', target)));

    const flags = r.setCookie;
    check(`${role} cookie: name=jwt, HttpOnly, SameSite=Strict, Path=/`, /^jwt=/.test(flags) && /HttpOnly/i.test(flags) && /SameSite=Strict/i.test(flags) && /Path=\//.test(flags), flags.split(';')[1]);
    check(`${role} cookie flags unchanged (no Secure in dev)`, !/Secure/i.test(flags), flags);
    check(`${role} cookie has no stack/leak in body`, !('stack' in (r.body || {})), JSON.stringify(Object.keys(r.body || {})));

    await db.execute('DELETE FROM users WHERE username = ?', [user]);
  }
  const [left] = await db.execute("SELECT id FROM users WHERE username LIKE '__p11_%'");
  check('temp role users cleaned up', left.length === 0, String(left.length));

  /* ---------- PHASE 12: 401 / 403 / valid ---------- */
  let r = await api('/api/auth/me');
  check('unauthorized -> 401', r.status === 401, String(r.status));
  check('401 body minimal {success,error}', JSON.stringify(Object.keys(r.body).sort()) === '["error","success"]', JSON.stringify(r.body));
  check('401 has no stack', !('stack' in r.body));
  check('401 has no token_expired', !('token_expired' in r.body));

  r = await api('/api/auth/me', { cookie: 'jwt=garbage.token.here' });
  check('invalid token -> 401', r.status === 401 && !('stack' in r.body), JSON.stringify(r.body));

  const student = jwt.sign({ sub: 1, id: 1, role: 'student', username: 's1' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  const admin = jwt.sign({ sub: 2, id: 2, role: 'ADMIN', username: 'a1' }, process.env.JWT_SECRET, { expiresIn: '8h' });

  r = await api('/api/auth/me', { cookie: `jwt=${student}` });
  check('valid token -> 200', r.status === 200 && r.body.user.role === 'STUDENT', JSON.stringify(r.body));

  r = await api('/api/admin/dashboard', { cookie: `jwt=${student}` });
  check('wrong role -> 403', r.status === 403, String(r.status));
  check('403 body minimal {success,error}', JSON.stringify(Object.keys(r.body).sort()) === '["error","success"]', JSON.stringify(r.body));
  check('403 has no stack', !('stack' in r.body));

  r = await api('/api/admin/dashboard');
  check('unauthorized role route -> 401 (client redirects)', r.status === 401, String(r.status));

  r = await api('/api/admin/dashboard', { cookie: `jwt=${admin}` });
  check('valid + correct role -> passes', r.status !== 401 && r.status !== 403, String(r.status));

  r = await api('/api/admin/courses', { method: 'POST', cookie: `jwt=${admin}; ${csrfCookie}`, csrf: 'wrong-token', body: { name: 'csrf-check' } });
  check('bad CSRF -> 403 through error middleware', r.status === 403 && /csrf/i.test(r.body.error || ''), JSON.stringify(r.body));
  check('CSRF 403 body minimal', JSON.stringify(Object.keys(r.body).sort()) === '["error","success"]', JSON.stringify(r.body));

  r = await api('/api/admin/courses', { method: 'POST', cookie: `jwt=${admin}; ${csrfCookie}`, csrf, body: { name: '' } });
  check('validation error -> 400 (validator path unchanged)', r.status === 400, JSON.stringify(r.body));

  /* ---------- errorHandler unit checks ---------- */
  const { errorHandler, httpError } = require('../../src/middleware/error');
  const fakeRes = () => {
    const r = { statusCode: null, payload: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (p) => { r.payload = p; return r; };
    return r;
  };
  const originalEnv = process.env.NODE_ENV;
  const originalConsoleError = console.error;
  console.error = () => {}; // silence the handler's own 500 stack logging while we assert on it

  process.env.NODE_ENV = 'production';
  let res = fakeRes();
  errorHandler(new Error('SELECT * FROM users failed'), {}, res, () => {});
  check('500 in production: generic message, no stack', res.payload.error === 'An unexpected internal server error occurred' && !('stack' in res.payload), JSON.stringify(res.payload));

  res = fakeRes();
  errorHandler(httpError(403, 'Insufficient permissions'), {}, res, () => {});
  check('403 in production: message exposed, no stack', res.payload.error === 'Insufficient permissions' && !('stack' in res.payload), JSON.stringify(res.payload));

  process.env.NODE_ENV = 'development';
  res = fakeRes();
  errorHandler(new Error('SELECT failed'), {}, res, () => {});
  check('500 in development: message + stack for debugging', res.payload.error === 'SELECT failed' && 'stack' in res.payload, JSON.stringify(Object.keys(res.payload)));

  res = fakeRes();
  errorHandler(httpError(401, 'Authentication required'), {}, res, () => {});
  check('401 in development: no stack', !('stack' in res.payload), JSON.stringify(res.payload));
  console.error = originalConsoleError;
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;

  console.log(out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL'));
  console.log(`\n${out.length - failed.length}/${out.length} passed`);
  console.log(failed.length ? 'RESULT: FAILURES' : 'RESULT: ALL PASS');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); console.log(out.join('\n')); process.exit(1); });
