const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');

require('../../src/config/env'); // load .env first so every check sees real values
const out = [];
const check = (label, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function walk(dir, files = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return files;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, files);
    else files.push(rel);
  }
  return files;
}

function envKeys(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => l.slice(0, l.indexOf('=')).trim())
    .sort();
}

function runNode(args, extraEnv, cwd = ROOT) {
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, output: stdout.trim() };
  } catch (error) {
    return { ok: false, output: `${error.stdout || ''}${error.stderr || ''}`.trim(), status: error.status };
  }
}

async function main() {
  /* --- 1. no duplicate/empty config structure left --- */
  check('server/config removed', !exists('server/config'));
  check('empty flat dirs removed (controllers/middleware/routes)', !exists('server/controllers') && !exists('server/middleware') && !exists('server/routes'));
  check('archived empty configs for audit trail', exists('archive/empty-config-duplicates-2026-10-06/server-config-env.js.0bytes') && exists('archive/empty-config-duplicates-2026-10-06/README.md'));
  check('real config still in place', exists('server/src/config/env.js') && exists('server/src/config/database.js'));

  /* --- 2. single source of truth (app code only - tests may load .env themselves) --- */
  const serverFiles = walk('server/src').filter((f) => f.endsWith('.js'));
  const dotenvLoaders = serverFiles.filter((f) => /require\(['"]dotenv['"]\)/.test(read(f)));
  check('dotenv is loaded in exactly one place (config/env.js)', dotenvLoaders.length === 1 && dotenvLoaders[0] === 'server/src/config/env.js', dotenvLoaders.join(', '));

  const envReaders = serverFiles.filter((f) => /process\.env\.DB_(HOST|PORT|NAME|USER|PASSWORD)/.test(read(f)));
  check('DB_* read only by config/env.js', envReaders.length === 1 && envReaders[0] === 'server/src/config/env.js', envReaders.join(', '));

  const appJs = read('server/src/app.js');
  check('app.js loads config instead of dotenv directly', /require\('\.\/config\/env'\)/.test(appJs) && !/require\(['"]dotenv['"]\)/.test(appJs));
  check('app.js no longer duplicates PORT/CLIENT_ORIGIN defaults', !/process\.env\.(PORT|CLIENT_ORIGIN)/.test(appJs));

  const dbJs = read('server/src/config/database.js');
  check('database.js builds pool from config/env values', /require\('\.\/env'\)/.test(dbJs) && /\bDB_HOST\b/.test(dbJs) && !/process\.env/.test(dbJs));

  /* --- 3. .env / .env.example alignment --- */
  const envKeysReal = envKeys(read('.env'));
  const envKeysExample = envKeys(read('.env.example'));
  check('.env.example has the same keys as .env', JSON.stringify(envKeysReal) === JSON.stringify(envKeysExample), `env=${envKeysReal.join(',')} example=${envKeysExample.join(',')}`);
  check('JWT_EXPIRES_IN key present in both', envKeysReal.includes('JWT_EXPIRES_IN') && envKeysExample.includes('JWT_EXPIRES_IN'));

  const example = read('.env.example');
  check('.env.example DB_NAME matches schema (smartclass)', /DB_NAME=smartclass/.test(example));
  check('.env.example ships no real secret (placeholder JWT_SECRET)', /JWT_SECRET=replace-with-a-long-random-secret/.test(example));
  check('.env.example ships no real DB password', /DB_PASSWORD=\s*$/m.test(example));
  check('.env is gitignored', read('.gitignore').split(/\r?\n/).some((l) => l.trim() === '.env'));
  check('setup script no longer recreates server/config', !/mkdir -p server\/config/.test(read('setup-lms.sh')));

  /* --- 4. config loads from any cwd --- */
  const envAbs = JSON.stringify(path.join(ROOT, 'server/src/config/env.js'));
  const fromOtherCwd = runNode(['-e', `const c = require(${envAbs}); console.log(c.DB_NAME)`], {}, path.dirname(ROOT));
  check('config resolves .env regardless of cwd', fromOtherCwd.ok && fromOtherCwd.output.split('\n').pop() === 'smartclass', fromOtherCwd.output);

  /* --- 5. app loads config without errors --- */
  const appLoad = runNode(['-e', "const app = require('./server/src/app.js'); console.log(typeof app)"]);
  check('app.js requires cleanly (no config errors)', appLoad.ok && appLoad.output.endsWith('function'), appLoad.output);

  const expected = JSON.stringify([
    Number(process.env.PORT || 3000),
    process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    process.env.DB_NAME || 'smartclass',
    process.env.DB_USER || 'root',
    process.env.JWT_EXPIRES_IN || '8h'
  ]);
  const envLoad = runNode(['-e', "const c = require('./server/src/config/env'); console.log(JSON.stringify([c.PORT, c.CLIENT_ORIGIN, c.DB_NAME, c.DB_USER, c.JWT_EXPIRES_IN]))"]);
  check('env exports every value the app uses', envLoad.ok && envLoad.output.endsWith(expected), `${envLoad.output} vs ${expected}`);

  /* --- 6. mysql2 pool uses the env values --- */
  const pool = require('../../src/config/database');
  const [[row]] = await pool.query('SELECT DATABASE() AS db');
  check('mysql2 pool connects to DB_NAME from config', row && row.db === 'smartclass', JSON.stringify(row));
  await pool.end();

  /* --- 7. JWT fail-fast in production --- */
  // A valid production baseline so the guard under test is the JWT secret only.
  // Phase 30 also fails fast on localhost origins, an empty DB password, and
  // disabled secure cookies, so those must be satisfied for these checks.
  const prodBase = {
    NODE_ENV: 'production',
    CLIENT_ORIGIN: 'https://learnova.example.com',
    APP_BASE_URL: 'https://learnova.example.com',
    DB_PASSWORD: 'a-strong-db-password',
    COOKIE_SECURE: 'true'
  };

  const insecure = runNode(['-e', "require('./server/src/config/env')"], { ...prodBase, JWT_SECRET: 'dev-secret-change-me' });
  check('production refuses default JWT_SECRET', !insecure.ok && /JWT_SECRET must be set/.test(insecure.output), insecure.output.split('\n')[0]);

  const missing = runNode(['-e', "require('./server/src/config/env')"], { ...prodBase, JWT_SECRET: '' });
  check('production refuses missing JWT_SECRET', !missing.ok && /JWT_SECRET must be set/.test(missing.output), missing.output.split('\n')[0]);

  const secure = runNode(['-e', "require('./server/src/config/env'); console.log('loaded')"], { ...prodBase, JWT_SECRET: 'a-real-random-secret-at-least-32-chars-long' });
  check('production loads with a real JWT_SECRET', secure.ok && secure.output.endsWith('loaded'), secure.output);

  // Phase 30 additions: production must also refuse localhost origins, an empty
  // DB password, and disabled secure cookies.
  const localOrigin = runNode(['-e', "require('./server/src/config/env')"], { ...prodBase, CLIENT_ORIGIN: 'http://localhost:3000', JWT_SECRET: 'a-real-random-secret-at-least-32-chars-long' });
  check('production refuses localhost CLIENT_ORIGIN', !localOrigin.ok && /CLIENT_ORIGIN still points at localhost/.test(localOrigin.output), localOrigin.output.split('\n')[0]);

  const noDbPass = runNode(['-e', "require('./server/src/config/env')"], { ...prodBase, DB_PASSWORD: '', JWT_SECRET: 'a-real-random-secret-at-least-32-chars-long' });
  check('production refuses empty DB_PASSWORD', !noDbPass.ok && /DB_PASSWORD is empty/.test(noDbPass.output), noDbPass.output.split('\n')[0]);

  const insecureCookie = runNode(['-e', "require('./server/src/config/env')"], { ...prodBase, COOKIE_SECURE: 'false', JWT_SECRET: 'a-real-random-secret-at-least-32-chars-long' });
  check('production refuses disabled secure cookies', !insecureCookie.ok && /COOKIE_SECURE is disabled/.test(insecureCookie.output), insecureCookie.output.split('\n')[0]);

  const devDefault = runNode(['-e', "const c = require('./server/src/config/env'); console.log(c.JWT_SECRET)"], { NODE_ENV: 'development', JWT_SECRET: 'dev-secret-change-me' });
  check('development still boots with the default secret', devDefault.ok && devDefault.output.endsWith('dev-secret-change-me'), devDefault.output);

  console.log(out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL'));
  console.log(`\n${out.length - failed.length}/${out.length} passed`);
  console.log(failed.length ? 'RESULT: FAILURES' : 'RESULT: ALL PASS');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); console.log(out.join('\n')); process.exit(1); });
