# FIX_PLAN.md - Phils Learnova LMS
**Date:** Mon Oct 05 2026
**Last updated:** Mon Oct 12 2026
**Phase:** 30 - Production hardening, git baseline, deployment (COMPLETE)

## Known Blockers (from analysis)

| Issue | Severity | Area | Status |
|---|---|---|---|
| Double /api/api prefix | HIGH | Frontend-Backend Integration | ✅ RESOLVED - normalization guard in client/js/api.js:35-43 |
| JWT payload key mismatch | HIGH | Auth/RBAC | ✅ RESOLVED - sub/id + role normalization in server/src/middleware/jwt.js:15-22,47-55 |
| quiz.html has + diff markers | HIGH | Student Quiz Page | ✅ RESOLVED - no diff markers remain; malformed `<script src=\/js/student.js\>` tag fixed 2026-10-06 |
| startQuiz bug (answer_data) | HIGH | Student Controller | ✅ RESOLVED - guarded JSON.parse at student.controller.js:86,138 |
| Dual DB models (MySQL vs PostgreSQL) | MEDIUM-HIGH | Database/Architecture | ✅ RESOLVED - Postgres files moved to archive/postgres-conflict-2026-10-05/ |
| course.routes.js not mounted | MEDIUM | Routing | ✅ RESOLVED - moved to archive/ (dead code removed from src/routes) |
| Missing client/js/student.js | MEDIUM | Frontend | ✅ RESOLVED - created (Phase 9) |
| Client/server endpoint mismatches | MEDIUM | Integration | ✅ RESOLVED 2026-10-06 - Phase 10 alignment (see below) |
| 401 handler ate login errors + reload loop | HIGH | Auth Flow | ✅ RESOLVED 2026-10-06 - Phase 11 (see below) |
| No client-side role guard on dashboards | HIGH | Auth/RBAC | ✅ RESOLVED 2026-10-06 - Phase 11 `LearnovaApi.requireRole()` |
| Login redirect case-sensitive, unknown role → student | MEDIUM | Login/Redirects | ✅ RESOLVED 2026-10-06 - Phase 11 normalized role map |
| Landing page had no sign-in link | LOW | Login UX | ✅ RESOLVED 2026-10-06 - Phase 11 added "Sign in" nav link |
| Duplicate requireRole + verifyToken | MEDIUM | Auth/RBAC | ✅ RESOLVED 2026-10-06 - Phase 12, single impl in middleware/auth.js |
| 401 vs 403 semantics inconsistent | MEDIUM | Auth/RBAC | ✅ RESOLVED 2026-10-06 - Phase 12 (unauth 401 / wrong role 403) |
| logout did not delete the JWT cookie | MEDIUM | Auth Flow | ✅ RESOLVED 2026-10-06 - Phase 12 clearCookie carried maxAge |
| Two bcrypt costs (10 vs 12) | MEDIUM | Auth/Security | ✅ RESOLVED 2026-10-06 - Phase 12 password.service only (cost 12) |
| Divergent JWT issue/verify path | MEDIUM | Auth/Security | ✅ RESOLVED 2026-10-06 - Phase 12 removed services/auth.service.js |
| register wrote non-existent columns | MEDIUM | Auth/API | ✅ RESOLVED 2026-10-06 - Phase 12 dead endpoint removed |
| Empty config files | LOW-MEDIUM | Config | ✅ RESOLVED 2026-10-06 - Phase 13: archived `server/config/*`, env/database aligned (see below) |
| CSS corruption (max-OPEOKwidth) | LOW | UI | ✅ RESOLVED 2026-10-06 - Phase 14: `client/css/styles.css:15` → `max-width: 660px` |
| Dead client JS + 0-byte doc/placeholders | LOW | Housekeeping | ✅ RESOLVED 2026-10-06 - Phase 16: moved to `archive/phase16/`, redundant `.gitkeep` removed |

## Phase Checklist (1-20)

- [x] Phase 1: Project Baseline & Safety Lock-In - `FIX_PLAN.md`, `TODO_NOW.md`, `archive/postgres-conflict-2026-10-05/`
- [x] Phase 2: Fix API URL Double Prefix - guard in `client/js/api.js` `request()` (lines 41-49)
- [x] Phase 3: Fix JWT Payload Key Mismatch - `server/src/middleware/jwt.js` normalizes sub↔id, uppercases role
- [x] Phase 4: Fix Quiz.html Syntax Errors & Clean Diff Markers - `client/pages/student/quiz.html` script tag repaired 2026-10-06
- [x] Phase 5: Fix Student.Controller StartQuiz Crash - guarded `JSON.parse` in `server/src/controllers/student.controller.js:86,138`
- [x] Phase 6: Enforce Quiz Rules (attempt_limit, pass_mark, time window) - `server/src/controllers/student.controller.js:45-69,128-130,150-152`
- [x] Phase 7: Pick Single Data Model - Postgres conflict archived (`archive/postgres-conflict-2026-10-05/`); `database/schema.sql` is the only active schema
- [x] Phase 8: Clean Routes & Dead Client Files - `client`/`server` route cleanup (remaining dead client JS finished in Phase 16)
- [x] Phase 9: Create Missing client/js/student.js - dashboard + quiz flow
- [x] Phase 10: Align Client/Server Contract for Existing Routes - completed 2026-10-06 (details below)
- [x] Phase 11: Login/Role Consistency & Redirects - `client/js/api.js`, `client/login.html`, `client/index.html` (details below)
- [x] Phase 12: Harden Auth Middleware & 401/403 Flow - `server/src/middleware/{auth,jwt,error,csrf}.js` (details below)
- [x] Phase 13: Cleanup Config Duplicates & Env Alignment - `server/src/config/{env,database}.js`, `.env.example`, `setup-lms.sh` (details below)
- [x] Phase 14: Fix CSS Minor Bug & UI Safety - `client/css/styles.css:15` (details below)
- [x] Phase 15: Add Minimal Tooling Configs (eslint + prettier) - `eslint.config.js`, `.prettierrc`, `.prettierignore`, `package.json` (details below)
- [x] Phase 16: Audit & Remove Remaining Dead Code - `archive/phase16/` (details below)
- [x] Phase 17: Integration Smoke Tests for Critical Flows - `server/tests/smoke.auth.test.js` (details below)
- [x] Phase 18: End-to-End Manual Verification Script - `VERIFY.md`, `scripts/smoke-check.ps1` (details below)
- [x] Phase 19: Final Code Review & Tightening - `server/src/middleware/jwt.js` (dead export), `package.json` (`format:check`) (details below)
- [x] Phase 20: Finalization, Summary & Ready-to-Run State - `FINAL_SUMMARY.md`, `README.md`, `FIX_PLAN.md` (details below)

**Phases 1-20 complete (2026-10-06).** Second series (21-30) targets the React frontend + feature gaps:

- [x] Phase 21: React Admin completion - `client-react/src/pages/admin/*`, `AdminDashboard.jsx` tabs, `lib/api.js` wrappers, `usePagedList` reload, shared `components/{Modal,Panel,Field,ConfirmDialog}` (details below)
- [x] Phase 22: React Teacher dashboard - `client-react/src/pages/{TeacherDashboard.jsx,teacher/*}`, `App.jsx` `/teacher` route, interim `TeacherPlaceholder.jsx` removed (details below)
- [x] Phase 23: React Student dashboard + quiz-taking flow - `client-react/src/pages/{StudentDashboard.jsx,student/*}`, `App.jsx` `/student` route (details below)
- [x] Phase 24: Quiz & question lifecycle endpoints (details below)
- [x] Phase 25: Account lifecycle (email column + password/profile) (details below)
- [x] Phase 26: Real email delivery (details below)
- [x] Phase 27: Excel/PDF exports + richer reports (details below)
- [x] Phase 28: Frontend unification + build pipeline (details below)
- [x] Phase 29: Test hardening + CI (details below)
- [x] Phase 30: Production hardening, git baseline, deployment (details below)

## Phase 10 Details (completed 2026-10-06)

Contract mismatches found by tracing every client call against mounted routes in server/src/app.js:

| Fix | File | Detail |
|---|---|---|
| Removed api helpers with no server route | client/js/api.js | `getUsers()` (GET /admin/users), `deleteUser()` (DELETE /admin/users/:id) - routes never existed |
| Repointed helpers to real routes | client/js/api.js | `getCourses` → /admin/courses, `getTeacherCourses` → /teacher/dashboard, `createCourse` → /admin/courses with `{name, description}` (server expects `name`, not `title`), `getStudentCourses` → /student/dashboard |
| Rebuilt corrupted student dashboard page | client/pages/student/index.html | file was 67 bytes of garbage (`-NoNewline` + broken script tag); now a valid page with #quizzes, #history, #logout hooks that student.js expects |
| Fixed quiz.html script tag | client/pages/student/quiz.html | `<script src=\/js/student.js\></script></script>` → `<script src="/js/student.js"></script>` |
| Quiz form now sends class_ids | client/pages/teacher/index.html | server requires quiz_classes rows for students to see a quiz; form had no class picker - added multi-select populated from /teacher/dashboard classes |
| Geolocation made best-effort | client/js/student.js | client previously hard-failed without geolocation; server only requires coordinates when a geofence is configured (student.controller.js:53-62) and returns a clear 400/403 otherwise - client now proceeds and surfaces the server's error |

Verified aligned (call → route → response shape): login redirect by role, admin dashboard/courses/classes, teacher dashboard/quizzes/question-bank/publish, student quizzes/history/start/submit, CSRF token flow, 401 → /login.html redirect.

## Phase 11 Details (completed 2026-10-06)

Login/role/redirect audit across client pages vs. `/api/auth/*`:

| Fix | File | Detail |
|---|---|---|
| 401 no longer swallows login errors | client/js/api.js:67-76 | Old code redirected to `/login.html` on *any* 401 before reading the body, so a wrong password reloaded the login page instead of showing the server message. Now the error body is read first; redirect is skipped when already on `/login.html` or when the failing call is `/auth/login`, and the real server error is surfaced. |
| Role guard added | client/js/api.js:96-121 | New `getSession()` (raw `/api/auth/me`, no side effects) + `requireRole(role)` → redirects to `/login.html` when unauthenticated, to the caller's own dashboard when the role mismatches, returns the user otherwise. Exposed as `LearnovaApi.requireRole`. |
| Dashboards guarded | client/pages/admin/index.html, client/pages/teacher/index.html, client/js/student.js:8,74-78,176-180 | Each portal now awaits `requireRole('ADMIN'/'TEACHER'/'STUDENT')` before the first data load, so a logged-out or wrong-role visitor is bounced instead of rendering "Insufficient permissions" into the page. Student guard covers both dashboard and quiz.html. |
| Login redirect normalized | client/login.html:10-13 | Role compared case-insensitively against an explicit role→home map; unknown/missing role raises an error instead of silently falling through to the student dashboard. Redirect uses `location.replace` (no back-button to a stale login page). |
| Landing gained a sign-in link | client/index.html:15 | Portal links were the only nav; a signed-out user had no way to reach `/login.html` except a failed API call. |
| Wrong-path redirect refs removed | client/js/login.js (deleted) | Only file still pointing at root-level `/admin/index.html`, `/teacher/index.html`, `/student/index.html` (those files do not exist) and comparing lower-case roles the server never sends. Unreferenced by every HTML file, superseded by the inline `login.html` script - deleted rather than patched. |

Verified: `node --check` on all client/server JS, `npm test` 3/3, live server smoke test on port 3010 — `/`, `/login.html`, `/pages/admin/index.html` all 200; `/api/auth/me` 401 (drives the guard redirect); `/api/csrf-token` 200. Full scripted check: `server/tests/smoke/phase-11-12.verify.js` (50/50).

## Phase 12 Details (completed 2026-10-06)

Auth-layer inconsistencies found by tracing token → middleware → route → response:

| Fix | File | Detail |
|---|---|---|
| Single `requireAuth`/`requireRole` | server/src/middleware/auth.js | Removed the competing copy in `middleware/jwt.js` (array-signature variant, never imported). Unauthenticated → **401**, authenticated-but-wrong-role → **403** (previously the missing-role branch returned 403, so the client never triggered its login redirect). |
| Single token decode path | server/src/middleware/jwt.js | Extracted `decodeToken()` (sub↔id + role uppercasing) used by `attachUser`; deleted the unused `verifyToken` duplicate. Failed verification now records `req.authError` instead of silently nulling the user, so the 401 says *why*. |
| Consistent error envelope | middleware/auth.js, middleware/csrf.js, controllers/auth.controller.js | All auth-layer failures now return `{ success: false, error }`, matching the global `errorHandler` shape; client still reads `data.error`. |
| Logout actually deletes the cookie | server/src/controllers/auth.controller.js | `clearCookie('jwt', getCookieOptions())` passed `maxAge: 24h`, which Express turns back into a **future** expiry - the cookie survived logout. Clear options now omit `maxAge` (`baseCookieOptions()`). |
| Cookie lifetime = token lifetime | server/src/controllers/auth.controller.js | Cookie `maxAge` was a hard-coded 24h while `JWT_EXPIRES_IN` is 8h, leaving a dead cookie for 16h. `parseLifetimeMs()` derives it from `JWT_EXPIRES_IN` (verified: `Max-Age=28800`, `exp - iat = 28800`). |
| One password hasher | server/src/controllers/auth.controller.js, server/src/controllers/admin.controller.js | Controller hashed with `bcrypt.hash(pw, 10)` while the service used cost 12 (and the seed file ships `$2b$12$` hashes). Both now import `hashPassword`/`verifyPassword` from `services/password.service.js`. |
| Removed divergent token service | server/src/services/auth.service.js (deleted) | Exported an unused `issueToken`/`verifyToken` pair signing a *different* payload (`name`, no `id`, no role uppercasing, hard-coded 8h) plus an `authenticate()` querying `full_name` - a second, incompatible auth path. `admin.controller.js` now imports `password.service` directly. |
| Removed broken `register` | server/src/controllers/auth.controller.js | Never mounted, and it inserted `first_name/last_name/email` - columns that do not exist in `database/schema.sql` (users has `username/full_name`). Account creation goes through `/api/admin/users`. Also dropped the `email` login fallback and `email` JWT claim (no email column). |
| 401/403 centralized in error middleware | server/src/middleware/error.js, middleware/auth.js, middleware/csrf.js, controllers/auth.controller.js | Added `httpError(status, message)`; auth/CSRF/validation failures now `next(err)` instead of hand-rolling `res.status().json()`, so every response comes from the one `errorHandler` (same shape as `notFound`, which already worked this way). |
| No stack leakage | server/src/middleware/error.js | Previously sent `stack` for **every** non-production env and logged stacks for 4xx too. Now: stack logged/sent only for 5xx **and** `NODE_ENV=development`; 5xx messages replaced with a generic string outside development; 4xx messages (written by us) always exposed. |
| Rate-limit responses standardized | server/src/app.js:31-36 | 429 from `express-rate-limit` returned `{message}`, which the client cannot read (`data.error`) → generic "An API error occurred". Custom `handler` now routes a 429 through `httpError` → `{success:false, error}`. |
| `token_expired` flag | - | Deliberately **not** added - nothing in the client consumes it, and the 401 message already covers it. |

Cookie contract unchanged: name `jwt`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` only in production (verified in the smoke run; `path` is the Express default, made explicit). Only `maxAge` changed, as described above.

**Verification:** `node --check` all JS, `npm test` 3/3, and the in-repo smoke script **50/50 PASS**:

```
node server/tests/smoke/phase-11-12.verify.js   # start the server on PORT=3013 first
```

- no cookie → `401 {success:false,"error":"Authentication required"}`
- garbage cookie → `401 "Invalid or expired session. Please sign in again."`
- valid token → `/api/auth/me` 200 with `role: "STUDENT"` (uppercased)
- student token on `/api/admin/dashboard` → `403 {success:false,"error":"Insufficient permissions"}`
- wrong password → `401 "Invalid username or password."` (no redirect)
- good password → 200, no `password_hash` in response, cookie `Max-Age=28800` + HttpOnly + SameSite=Strict
- logout → `Set-Cookie: jwt=; Expires=Thu, 01 Jan 1970` (cookie gone)
- temp test user inserted for the login test and deleted afterwards (0 rows left)

Checks covered by the script (44 HTTP + 4 static + 4 `errorHandler` unit): role→page map in `login.html` and `ROLE_HOMES` in `api.js` agree and all 3 targets exist; no root-level `/admin|teacher|student/index.html` refs; `login.js` gone; 401 redirect loop-proof; `ADMIN`/`TEACHER`/`STUDENT` each log in, return an upper-cased role and map to an existing `/pages/...` page; cookie name/flags unchanged; 401/403/400 bodies are exactly `{success,error}` with no `stack`/`token_expired`; valid token passes; CSRF 403; 500s generic in production and full in development.

## Phase 13 Details (completed 2026-10-06)

| Fix | File | Detail |
|---|---|---|
| Removed 0-byte duplicate configs | `server/config/{env,database}.js` → `archive/empty-config-duplicates-2026-10-06/` | Nothing ever required them (`server/src/*` resolves `../config/*` to `server/src/config/*`); they were a trap for any file placed one level too high, which would have silently loaded an empty module. Also removed the empty `server/controllers`, `server/middleware`, `server/routes` directories. |
| Root cause fixed | setup-lms.sh:7,11 | The script created the obsolete flat layout (`server/config`, `client/admin`, ...). It now creates the real `server/src/{config,controllers,middleware,routes,services,validators}` + `client/pages/*` structure, so re-running it cannot resurrect the duplicates. |
| One dotenv load, cwd-independent | server/src/app.js:1, server/src/config/env.js:1-7 | `app.js` now does `require('./config/env')` instead of its own `require('dotenv').config()`. `env.js` resolves `.env` relative to the project root (falls back to cwd), so config loads from any working directory. |
| Config consumed, not re-defaulted | server/src/app.js:20,23 | `PORT`/`CLIENT_ORIGIN` come from `config/env` instead of a second copy of `process.env.PORT \|\| 3000`. |
| mysql2 pool reads config | server/src/config/database.js | Was reading `process.env.DB_*` directly - correct only if dotenv had already run in that process. Now destructures `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` from `./env`, guaranteeing load order. |
| `.env.example` aligned | .env.example | Same key set as `.env` (added `JWT_EXPIRES_IN`), `DB_NAME=smartclass` to match `database/schema.sql` + `setup-smartclass-db.ps1`, placeholder `JWT_SECRET`, blank `DB_PASSWORD` - no secrets committed (`.env` is gitignored). |
| `.env` key parity | .env | Added `JWT_EXPIRES_IN=8h` (same value as the implicit default) so both files carry identical keys. |
| `JWT_SECRET` fail-fast | server/src/config/env.js:20-26 | Production now refuses to boot with a missing or `dev-secret-change-me` secret instead of silently signing forgeable tokens; development still boots with the default. |

**Verification:** `npm test` 3/3, `node --check` clean, and `server/tests/smoke/phase-13.verify.js` — **24/24 PASS** (server on `PORT=3014`):

```
server/config + empty flat dirs gone, archive present
dotenv loaded in exactly one file; process.env.DB_* read in exactly one file
app.js first line = require('./config/env'); no duplicated PORT/CLIENT_ORIGIN defaults
.env and .env.example key sets identical; DB_NAME=smartclass; no secrets in example
config resolves .env from a different cwd  →  smartclass
app.js requires cleanly; env exports PORT/CLIENT_ORIGIN/DB_*/JWT_EXPIRES_IN
mysql2 pool: SELECT DATABASE()  →  smartclass   (pool really uses the config)
production + default/missing JWT_SECRET → refuses to start; + real secret → loads; dev + default → loads
```

Phase 11/12 regression re-run after the config change: **50/50 PASS**.

## Phase 14 Details (completed 2026-10-06)

| Fix | File | Detail |
|---|---|---|
| Corrupted declaration | client/css/styles.css:15 | `h1 { max-OPEOKwidth: 660px; ... }` → `h1 { max-width: 660px; ... }`. The unknown property made the browser drop the whole declaration, so the main heading was never capped at 660px. |

Scan of the whole file (no other restyling, per spec):

- **typo patterns searched:** 3+ upper-case runs (`[A-Z]{3,}`), `[a-z]-[A-Z]{2,}[a-z]*:` mixed-case property names, `importan`/`widht`/`heigth`/`lenght`/`backgound`/`dispaly`/`marign`/`paddign`, diff markers (`+`/`---`/`<<<<<<<`), stray quotes/backslashes — **all clear**, and no `<style>` blocks exist in the HTML to corrupt.
- **structure:** 28/28 braces, 27/27 parens, 27 rules, 93 declarations, every declaration parses as `property: value;`, all property names are real CSS properties.

**Verification:** `npm test` 3/3 and `server/tests/smoke/phase-14.verify.js` — **12/12 PASS** (no server needed, runs standalone). Only `styles.css` was touched: the fix un-breaks one declaration, nothing else was rewritten, so no visual regression is expected beyond the `h1` width cap now applying.

## Phase 15 Details (completed 2026-10-06)

**New files** (config only - no source code reformatted):

| File | Contents |
|---|---|
| `eslint.config.js` | ESLint 10 **flat config**, CommonJS (`module.exports`) to match `"type": "commonjs"`. No `@eslint/js`/`globals` packages (neither is installed) - hand-rolled minimal rule set (`no-undef`, `no-dupe-keys`, `no-dupe-args`, `no-redeclare`, `no-unreachable`, `no-constant-condition`, `no-empty`, `no-func-assign`, `no-self-assign`, `valid-typeof`, `use-isnan`, `no-unused-vars` as **warn**) plus explicit global maps for Node (`*.js` root + `server/**/*.js`, `sourceType: commonjs`) and browser (`client/js/**/*.js`, `sourceType: script`). Ignores: `node_modules`, `archive`, `coverage`, `*.min.js`. |
| `.prettierrc` | `printWidth: 120`, `singleQuote: true`, `semi: true`, `trailingComma: all`, `arrowParens: always`, `endOfLine: auto` (repo has mixed CRLF/LF). |
| `.prettierignore` | `node_modules`, `package-lock.json`, `archive`, `coverage`, `*.min.js`, `*.md` (hand-written docs stay as-is). |

**`package.json` diff:**

```diff
   "scripts": {
     "dev": "node --watch server/src/app.js",
     "start": "node server/src/app.js",
-    "test": "node --test server/tests/*.test.js"
+    "test": "node --test server/tests/*.test.js",
+    "lint": "eslint .",
+    "lint:fix": "eslint . --fix",
+    "format": "prettier --check .",
+    "format:write": "prettier --write ."
   },
```

**Verification:**

```
npx eslint --version   → v10.11.0
npx prettier --version → 3.9.9
npm run lint           → exit 0, 0 problems, no hang (no --fix was ever run)
npm run format         → runs to completion, exit 1: "Code style issues found in 30 files"
                         (expected - repo intentionally NOT auto-formatted this phase)
npm test               → 3/3
```

One lint error surfaced during wiring and was resolved **in the config, not the code**: `client/js/api.js:152` does `typeof module !== 'undefined'` for the UMD guard, so `module: 'readonly'` was added to the browser globals.

## Phase 16 Details (completed 2026-10-06)

**Targeted greps** (`auth.service`, `course.controller`, `assessment`, `enrollment`) → only `assessment`/`enrollment`/`course.controller` hits were inside the Phase 1 archive stash; nothing live. **Zero** hits for `auth.service` anywhere (already deleted in Phase 12). No `*.bak` / `*.old` / `*.orig` / `*.tmp` anywhere.

**Dead files moved to `archive/phase16/`** (not deleted - repo still has no git history):

| Moved | Bytes | Why dead |
|---|---|---|
| `client/js/admin.js` → `client-js-admin.js` | 3599 | No `<script src="/js/admin.js">` in any HTML; calls removed `getUsers`/`deleteUser` and renders non-existent schema columns. Admin page has its own inline script. |
| `client/js/teacher.js` → `client-js-teacher.js` | 3895 | No `<script src="/js/teacher.js">` in any HTML; teacher page has its own inline script. |
| `20-Phase-LMS-Development-Procedure.md` → `*.0bytes` | 0 | 0-byte placeholder, never written. |

**0-byte placeholders removed** (dirs now contain real files): `server/src/controllers/.gitkeep`, `server/src/services/.gitkeep`, `server/src/validators/.gitkeep`, `database/seeders/.gitkeep`. The archived `archive/postgres-conflict-2026-10-05/migrations/.gitkeep` was left alone.

**Audited and confirmed LIVE** (kept): `validators/common.js` (used by 3 controllers); all 4 services (`audit`, `geofence`, `password`, `quiz`); all 6 route files (mounted in `app.js`); all 5 controllers; `client/js/{api,app,student}.js` (referenced by HTML, no orphans). `tests/` untouched per spec.

`archive/phase16/README.md` records the full audit trail.

**Verification:**

```
node --check (server/ + client/, all js) → 0 failures
node -e "require('./server/src/app.js')" → app loaded OK
npm run lint                            → exit 0, 0 problems
npm test                                → 3/3
phase-11-12.verify.js (PORT=3013)       → 50/50  (real logins for all 3 roles, cookies, 401/403/CSRF)
phase-13.verify.js (PORT=3014)          → 24/24
phase-14.verify.js (standalone)         → 12/12
referenced /js/*.js all exist           → 3/3, 0 orphan files remaining
```

## Phase 17 Details (completed 2026-10-06)

**Deps:** `supertest` is **not** installed and was NOT added. Tests use `node:test` + `node:assert/strict` + the built-in global `fetch` (Node 24).

**New file:** `server/tests/smoke.auth.test.js` (CommonJS).

> Deviation from spec: the task said `server/src/tests/smoke.auth.test.js`, but `npm test` is `node --test server/tests/*.test.js`, so that path would never run. Placed it at `server/tests/smoke.auth.test.js` (existing convention, same folder as `health.test.js`/`geofence.test.js`) so `npm test` includes it. No existing test was modified.

| # | Test | Assertion(s) | DB? |
|---|---|---|---|
| 1 | `GET /api/health` | `status === 200`, body `status === 'ok'` | no |
| 2 | `POST /api/auth/login` invalid creds | `status === 401`, `success === false`, `error` present | 1 indexed SELECT |
| 3 | `GET /api/admin/dashboard` no cookie | `status === 401`, `success === false`, `error === 'Authentication required'` | no |

Implementation notes:

- Boots the app with `app.listen(0)` (ephemeral port) in `test.before`, so it cannot collide with 3013/3014 or a running dev server.
- `test.after` calls `server.closeAllConnections()` then `server.close()` and `await pool.end()` - without closing the mysql2 pool the test process would hang on the open socket.
- Login needs a CSRF token (double-submit): `GET /api/csrf-token`, then POST with `x-csrf-token` header + the `learnova_csrf` cookie.
- App boots via the existing `require.main === module` guard; **no production code changed**.
- Bogus username `__phase17_missing_user__` is never inserted, so no test data is written.

**Verification:**

```
npm test → 6/6 pass (was 3/3; +3 tests, +8 assertions), exit 0
run 1: pass=6 fail=0 665.9ms
run 2: pass=6 fail=0 652.3ms
run 3: pass=6 fail=0 669.3ms     (no flakiness, no hang)
npm run lint → exit 0, 0 problems
```

## Phase 18 Details (completed 2026-10-06)

**New files** (no app code touched):

| File | Purpose |
|---|---|
| `VERIFY.md` | Repeatable checklist: prerequisites, automated checks, per-role browser walkthrough, cross-cutting sanity checks (no `/api/api`, no `quiz.html` SyntaxError, no dashboard console errors), endpoint/auth reference table. Grounded in the real routes - e.g. it documents that there is **no user-list endpoint** (admin only `POST /api/admin/users`) and maps "view courses/quizzes" to the actual `GET /api/{teacher,student}/...` calls. |
| `scripts/smoke-check.ps1` | PowerShell 5.1-safe runner. Boots `server/src/app.js` on port `3016` (`-Port` to override), polls `/api/health` for up to 20s, probes health / CSRF / 401 guards / 404, prints `PASS`/`FAIL`, stops the server (`-KeepRunning` to keep it), exits `0`/`1`. Uses `Invoke-WebRequest -UseBasicParsing`; no `curl` alias dependency. |

Script checks (7): server boots; `GET /api/health` 200; body `status=ok`; `GET /api/csrf-token` 200 + token; `/api/admin/dashboard` 401; `/api/student/dashboard` 401; unknown route 404.

**Verification:**

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-check.ps1        → ALL PASS, exit 0
powershell ... -File .\scripts\smoke-check.ps1 -Port 3017                            → ALL PASS, exit 0
no listeners left on 3016/3017 after run (clean teardown)
npm test → 6/6, exit 0        npm run lint → 0 problems, exit 0
```

`VERIFY.md` notes `npm run format` is the prettier *check* command (`format:check` was the spec's name; the project script is `format`, with `format:write` to apply).

## Phase 19 Details (completed 2026-10-06)

**Targeted review greps — all clean:**

| Check | Result |
|---|---|
| `/api/api` in `client/` | **0** |
| `+const` / `^+ ` diff markers in `client/pages/student/quiz.html` | **0** (single-line file, no markers) |
| `$1` / `RETURNING` / `result.rows` in `server/src` | **0** |
| `max-OPEOKwidth` in `client/` | **0** |
| `course.routes` in `server/src/app.js` | **not mounted** (absence is correct) |
| `/js/student.js` referenced by `client/pages/**` | **present** (`student/index.html`, `student/quiz.html`) |
| `answer_data: undefined` in `student.controller.js` | **0** |
| `TODO`/`FIXME`/`XXX`/`HACK` in server+client | **0** |
| stray `console.log` in `server/src` | only the intentional startup line (`app.js:47`) |
| `req.user.sub` in controllers | 30+ uses, all behind `router.use(requireAuth, requireRole(...))`; `attachUser`→`decodeToken` backfills `sub` from legacy `id`; `recordAudit` is `userId \|\| null` safe — **no undefined reachable** |
| `JSON.parse(question.answer_data)` | 2 sites, **both guarded**: `startQuiz` (`:86`, try/catch + ternary) and `submitQuiz` (`:138`, try/catch + ternary) |

**True issues found & fixed (2):**

1. `server/src/middleware/jwt.js` — `decodeToken` was exported but has no external consumer (only used internally by `attachUser`). Dropped it from `module.exports` (`{ attachUser }`). Function unchanged.
2. `package.json` — the phase/verification specs call `npm run format:check`, but only `format` existed. Added `"format:check": "prettier --check ."` (alias; `format`/`format:write` untouched).

Review note (not changed): `student.controller.js` returns raw `{ error }` for some 4xx/409/403 cases instead of the `{success:false,error}` envelope used by the auth layer. The client reads `body.error` (`api.js:75,79`), so behavior is correct; leaving as-is avoids churn for no functional gain.

**Verification:**

```
node -e "require('./server/src/app.js')"  → OK
npm test                                  → 6/6, exit 0
npm run lint                              → exit 0, 0 problems
npm run format:check                      → runs, exit 1 (intentional unformatted baseline, 29 files)
phase-11-12.verify.js (PORT=3013)         → 50/50
phase-13.verify.js (PORT=3014)            → 24/24
phase-14.verify.js                        → 12/12
scripts\smoke-check.ps1                   → ALL PASS, exit 0
```

## Phase 20 Details (completed 2026-10-06)

- `FIX_PLAN.md` checklist rewritten with file paths + commit-style notes for all 20 phases; all marked done.
- `README.md` refreshed: added **Test / Lint / Format** commands, pointed to `VERIFY.md` + `scripts/smoke-check.ps1`, removed stale `database/migrations` references, corrected the "known limitations" list.
- `.env.example` confirmed safe (placeholder `JWT_SECRET`, blank `DB_PASSWORD`, no secrets, key parity with `.env`).
- Confirmed `database/schema.sql` is the only active schema (Postgres migrations live under `archive/`).
- `server/src/app.js` middleware stack re-verified: helmet → cors → cookieParser → json → urlencoded → attachUser → static → routes → notFound → errorHandler.
- `FINAL_SUMMARY.md` added (fixes, files, verification, limitations, ready-to-run steps).

**Full verification run (final):**

```
node --check (all server + client js)   → 0 failures
node -e "require('./server/src/app.js')" → OK
npm test                                → 6/6, exit 0
npm run lint                            → exit 0, 0 problems
npm run format:check                    → runs, exit 1 (intentional unformatted baseline)
phase-11-12.verify.js (PORT=3013)       → 50/50
phase-13.verify.js (PORT=3014)          → 24/24
phase-14.verify.js                      → 12/12
scripts\smoke-check.ps1                 → ALL PASS, exit 0
```

## Phase 21 Details (completed 2026-10-08)

**Scope:** full admin CRUD in the React app (the app served by `server/src/app.js:30-51` is `client-react/dist`, which previously had only a read-only user/course list).

| Area | Files | Detail |
|---|---|---|
| API wrappers | `client-react/src/lib/api.js` | Added `createUser`, `updateUser`, `deleteUser`, `createCourse`, `updateCourse`, `deleteCourse`, `getClasses`, `createClass`, `assignStudent`, `assignTeacher`, `assignCourse`, `getAuditLogs` (all mapped to routes that already existed in `server/src/routes/admin.routes.js`) |
| List refresh | `client-react/src/lib/usePagedList.js` | New `reload()` (version bump) so panels refetch after mutations; existing callers unaffected |
| Shared UI | `client-react/src/components/{Modal,Panel,Field,ConfirmDialog}.jsx` | Dialog w/ ESC + backdrop close, section wrapper, labelled field + class tokens, async confirm with inline error |
| Users screen | `client-react/src/pages/admin/UsersPanel.jsx` | Table (ID/username/name/role/status badge) + create modal (username, name, role, password ≥12), edit modal (name, role, **status toggle**), delete confirm |
| Courses screen | `client-react/src/pages/admin/CoursesPanel.jsx` | CRUD + inline Activate/Deactivate toggle; delete = server-side deactivate (204) |
| Classes screen | `client-react/src/pages/admin/ClassesPanel.jsx` | List + create with geofence fields (lat/lng/radius, "Use my location" helper). *API has no class edit endpoint — create/list only* |
| Allocations | `client-react/src/pages/admin/AllocationsPanel.jsx` + `lib/fetchOptions.js` | Three forms (student→class, teacher→class, teacher→course) with dropdowns paged through `GET /api/admin/users|classes|courses` (limit 100, up to 20 pages), success/error banner per form |
| Audit logs | `client-react/src/pages/admin/AuditLogsPanel.jsx` | Paginated table (when, user, action chip, expandable JSON details) |
| Shell | `client-react/src/pages/AdminDashboard.jsx` | Tab nav: Overview / Users / Courses / Classes / Allocations / Audit logs; metric cards moved to Overview |
| Server (additive) | `server/src/controllers/admin.controller.js` | `listUsers` now returns `status`; `updateUser` accepts optional `status` (`ACTIVE`/`INACTIVE`) — needed for the requested toggle; login already gates on `status='ACTIVE'` (`auth.controller.js:38`). Also `auditLogs` ordered `created_at DESC, id DESC` (same-second ties previously returned ascending, breaking the viewer + pagination stability) |

**Verification (2026-10-08, MariaDB 10.4 via XAMPP at `c:\xamp`, seeded `smartclass` DB):**

```
cd client-react && npm run lint   → oxlint exit 0
cd client-react && npm run build  → exit 0 (index-*.js 297 kB)
npm run lint (root)               → exit 0, 0 problems
npm test                          → 7/7 (all pass with MySQL up)
API + bundle walkthrough (PORT=3021, temp admin, 39 checks) → 39/39 PASS
  - SPA: / and /admin → 200, bundle contains all 5 panels
  - users: create → list (status field) → update INACTIVE → inactive login 401 → reactivate → delete 204 → gone
  - courses: create → list → status toggle → delete (deactivate) 204
  - classes: create w/ geofence → list shows radius
  - allocations: 3 assignments 201, duplicate rejected
  - audit: 5 action types recorded, ordered DESC
DB restored afterwards: 3 users / 1 course / 1 class / 0 audit rows (verification artifacts removed)
```

**Known limitations surfaced (deferred):** class editing has no endpoint; allocations are create-only (no list/unassign endpoints); `DELETE /api/admin/users/:id` returns 500 if the user has audit history (FK `audit_logs.user_id`); root `format:check` baseline grows with the new `client-react` files (same intentional policy as Phase 15).


## Phase 22 Details (completed 2026-10-08)

**Scope:** teacher portal in the React app — dashboard metrics, question bank CRUD, quiz create/publish/close, add-question picker, statistics. Interim `TeacherPlaceholder.jsx` deleted.

| Area | Files | Detail |
|---|---|---|
| Route | `client-react/src/App.jsx` | `/teacher` behind `ProtectedRoute role="TEACHER"` now renders `TeacherDashboard` (placeholder import removed) |
| Shell | `pages/TeacherDashboard.jsx` | Tabs Overview / Question bank / Quizzes; header + sign-out mirrors `AdminDashboard` |
| Overview | `pages/teacher/OverviewPanel.jsx` | metrics (assigned courses/classes) from `GET /api/teacher/dashboard`, course + class lists, hint that publishing requires ≥1 question |
| Question bank | `pages/teacher/QuestionBankPanel.jsx` | paginated table (type, text, difficulty chip, answer preview incl. correct answer, image flag) + create modal: type select, dynamic MC option rows with correct-option radio (min 2 non-empty), TF true/false select, short/fill expected-answer input (case-insensitive grading note), difficulty, **optional image via `FormData`** (`POST /api/teacher/question-bank`, `multer` 5 MB image-only) |
| Quizzes | `pages/teacher/QuizzesPanel.jsx` | paginated table (status chip DRAFT/PUBLISHED/CLOSED, duration, pass mark, access code, schedule) + create modal: title, course select (teacher's assigned courses), class checkboxes (teacher's assigned classes), duration / attempt limit / pass mark, optional access code, randomize questions/options, `datetime-local` schedule window (converted to SQL datetime); row actions Publish / Close / Questions / Stats with inline error banner |
| Question picker | same (`QuizQuestionsModal`) | `GET /api/teacher/quizzes/:id` shows attached questions in position order; bank list (limit 50) with per-question Add → `POST /quizzes/:id/questions`; already-attached disabled; server 404 "no questions" on empty publish mapped to "Attach at least one question first." |
| Statistics | same (`QuizStatsModal`) | summary cards (submitted attempts, average, best) + **per-question breakdown** (position, text, correct answer, type, correct/answered, accuracy %) + per-student results list |
| Server (additive) | `server/src/controllers/teacher.controller.js`, `routes/teacher.routes.js` | (1) new `GET /api/teacher/quizzes/:id` → `{quiz, questions}` with `creator_id` ownership check (404 otherwise) — the picker had no detail endpoint; (2) `GET .../statistics` now also returns `questions` (LEFT JOIN `quiz_attempt_answers` over this quiz's SUBMITTED attempts → `answered_count`/`correct_count` per question) + explicit 404 for non-owned quizzes — there was no per-question data anywhere |
| API wrapper | `client-react/src/lib/api.js` | `getTeacherQuiz(quizId)` added; `getQuizStatistics` now returns `{results, questions}` |

**Verification (2026-10-08, XAMPP MariaDB, seeded `smartclass`, PORT=3022):**

```
root eslint 0 · oxlint 0 · vite build OK · npm test 7/7 · smoke-check ALL PASS
phase22.verify.js (fixtures: temp teacher + teacher2 + student, allocations to course/class 1, known bcrypt hash) → 67/67 PASS
  - SPA: /teacher → index 200, bundle has "Learnova Teacher", tabs, TEACHER guard, create/publish/stats UI strings
  - role matrix: anon → 401; student → teacher API 403; teacher → admin/student API 403; teacher2 → foreign quiz detail/publish/statistics 404
  - question bank: MC+TF+SHORT+FILL created via multipart (MC with PNG image → /uploads/ path), bad type → 400, list shows answer_data + difficulty
  - quiz: unassigned course → 403; create → DRAFT listed; empty-quiz publish → 404 "no questions"; attach ×4 → detail positions 1-4, no answer_data
  - publish → PUBLISHED; student sees it; wrong access code 403; start inside seeded geofence → 200 (4 questions, sanitized)
  - submit 4/4 (case-insensitive short+fill) → score 4 passed (pass_mark=3)
  - statistics: 0 rows before attempt → after: 1 result (score 4) + 4 breakdown rows all answered×1 correct×1 100%
  - close → CLOSED, leaves student list, statistics survive
DB restored after run: 3 users / 0 quizzes / 0 questions / 0 attempts / 0 logs / 0 allocations; uploads/ left empty (temp image removed)
```

**Deviations / notes:** the phase spec's "per-question breakdown" did not exist server-side — added as an additive field on `statistics` (existing `{results}` consumers unaffected). No question edit/delete endpoints exist yet (Phase 24), so the bank table has no row actions. `pass_mark` is still compared against raw score count (Phase 24 fix) — fixture sets `pass_mark=3` on a 4-question quiz. Re-attach of an already-attached question hits a DB duplicate-key 500 (UI prevents it via the attached set; endpoint hardening deferred to Phase 24).


## Phase 23 Details (completed 2026-10-08)

**Scope:** student portal in the React app — dashboard, geofenced quiz start, timed quiz runner, history. (Phase 22 replaced the interim teacher placeholder the next session — see below.)

| Area | Files | Detail |
|---|---|---|
| Route | `client-react/src/App.jsx` | `/student` behind `ProtectedRoute role="STUDENT"` (401 → `/login`, wrong role → own home) + `/teacher` placeholder (see below) |
| Shell | `pages/StudentDashboard.jsx` | Tabs Overview / Quizzes / History; owns the active quiz session (full-screen runner replaces tabs while an attempt is live) |
| Overview | `pages/student/OverviewPanel.jsx` | metrics (courses, attempts, average, passed) from `GET /api/student/dashboard`, course list, recent attempts; refreshes after each attempt |
| Quizzes | `pages/student/QuizzesPanel.jsx` | available list (start window, duration) + start dialog: optional access code (list endpoint strips `access_code`), `navigator.geolocation` prompt, `POST /start`, best-effort `POST /attempts/:id/location` re-check shown as "Location verified (N m)" |
| Geofence messaging | same | browser denied/absent + server says location required → explicit "allow location access" message; server 403 → server's classroom message surfaced verbatim |
| Runner | `pages/student/QuizRunner.jsx` | countdown from `attempt.started_at + duration_minutes` (turns red ≤30 s, auto-submits at 0 via `doSubmitRef` so the interval never reads stale answers), renders all 4 types: MC radios (`options`), TRUE/FALSE buttons (`TRUE`/`FALSE`), short/fill text inputs, optional `image_path`; answers ref-backed; exit requires confirm; result card (score / total / passed) |
| History | `pages/student/HistoryPanel.jsx` | paginated: title, course, score, status chip (IN_PROGRESS/SUBMITTED/EXPIRED), passed, submitted_at |
| Login copy | `pages/Login.jsx` | stale "only includes the admin dashboard" message replaced |
| Interim | `pages/TeacherPlaceholder.jsx` | temporary teacher UI so logins didn't loop; **removed in Phase 22** (replaced by `TeacherDashboard.jsx`) |

**Verification (2026-10-08, XAMPP MariaDB, seeded `smartclass`, PORT=3022):**

```
oxlint 0 (no warnings) · vite build OK · root eslint 0 · npm test 7/7
phase23.verify.js (fixtures: geofenced class, PUBLISHED quiz + 4 question types, temp student) → 37/37 PASS
  - role matrix: anon → 401; admin→student API → 403; student→teacher/admin API → 403; SPA /student 200 + bundle guards
  - start: wrong access code 403 · no coords 400 "location required" · outside radius 403 · inside 200
  - payload: 4 questions, no answer_data/correct_answer, MC options present
  - mid-attempt verifyLocation: outside 403 allowed:false · inside 200 allowed:true
  - submit: 3/4 correct (case-insensitive short answer accepted, blank counted wrong) → score 3 total 4 passed true
  - re-start 409/403; history row score 3 SUBMITTED passed 1; quiz leaves available list; dashboard history updates
DB restored after run: 3 users / 1 class / 0 quizzes / 0 logs
```

**Deferred / found:** TRUE/FALSE grading is exact-match server-side (`student.controller.js:154-156`) so the UI sends `TRUE`/`FALSE`; teacher-side storage format must match (recommend case-insensitive in Phase 24). `passed` compares absolute score to `pass_mark` percentage (`:160-161`) — fixtures set `pass_mark=2` to exercise it; a 4-question quiz with the default 50 can never pass (Phase 24 fix). Redis-cached quiz list (`:38`) has no invalidation on submit — latent stale-list up to 5 min only when Redis runs (it didn't here).


## Phase 24 Details (completed 2026-10-12)

**Scope:** close the deferred lifecycle gaps — question/quiz edit + delete, detach, empty-publish guard, percentage-based grading with case/whitespace-insensitive text answers, class edit, and allocation list/unassign. Session started with a preflight repair of a red tree (see below).

**Preflight repairs (tree was red, now green):**

| Fix | File | Detail |
|---|---|---|
| Stripped SQL restored | `server/src/controllers/auth.controller.js:107` | `UPDATE users SET ...` lost its interpolated column list; restored `` `UPDATE users SET ${updates.join(', ')} WHERE id = ?` `` |
| TDZ crash | `server/src/controllers/auth.controller.js` | `updateProfile` was referenced before initialization; `module.exports` moved to end of file, `crypto`/`hashPassword` requires hoisted to top |
| Interpolation bugs | `server/tests/account.lifecycle.test.js:25,48` | template-literal join and base URL corrected |
| Duplicate schema blocks | `database/schema.sql` | removed 4 duplicated `password_reset_tokens` blocks + bogus `courses.email`; rewrote clean |
| Missing live column | `database/migrations/002_users_email.sql` | applied to the live `smartclass` DB (`users.email` + `password_reset_tokens`) |

**Server changes:**

| Area | File | Detail |
|---|---|---|
| Question/quiz guards | `server/src/controllers/teacher.controller.js` | `publishQuiz` → 404 when not found/owned, **409** `'Quiz has no questions; attach at least one before publishing'` at 0 questions; `getQuizDetail` also returns `class_ids` |
| Grading | `server/src/controllers/student.controller.js` | new `normalizeTextAnswer()` (trim + collapse whitespace + lowercase) applied to TRUE_FALSE / SHORT_ANSWER / FILL_BLANK; pass uses percentage `(score / total) * 100 >= pass_mark`; Redis `student_quizzes:*` invalidated on submit |
| Class + allocations | `server/src/controllers/admin.controller.js` | added `getClass`, `updateClass`, `listAllocations`, `unassignStudent`, `unassignTeacher`, `unassignCourse`, `parseCoordinate()`; `ER_DUP_ENTRY` → 409 in create/updateClass; exports updated |
| Routes | `server/src/routes/admin.routes.js` | mounted `GET/PUT /classes/:id`, `GET /allocations`, `DELETE /allocations/{students,teachers,courses}/...` |

**Client changes:**

| Area | File | Detail |
|---|---|---|
| API wrappers | `client-react/src/lib/api.js` | added `getClass`, `updateClass`, `getAllocations`, `unassignStudent/Teacher/Course`, `updateQuestion`, `deleteQuestion`, `updateQuiz`, `deleteQuiz`, `detachQuestion` |
| Question bank | `client-react/src/pages/teacher/QuestionBankPanel.jsx` | rewritten: edit/delete row actions + edit-modal mode |
| Quizzes | `client-react/src/pages/teacher/QuizzesPanel.jsx` | rewritten: edit/delete/detach/publish/close/stats; `QuizFormModal` edit mode with `class_ids` |
| Classes | `client-react/src/pages/admin/ClassesPanel.jsx` | rewritten: edit mode via `api.getClass` |
| Allocations | `client-react/src/pages/admin/AllocationsPanel.jsx` | rewritten: current-allocation tables (student→class, teacher→class, teacher→course) with Remove rows behind `ConfirmDialog`, reload after assign/unassign |

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · vite build OK · npm test 15/15
phase-24.verify.js (boots app.listen(0); fixtures: temp admin + teacher + teacher2 + student, course, class, allocations; known bcrypt hash) → 53/53 PASS
  - questions: create 4 types · edit text/difficulty persisted · type change without answer_data 400 · image attach via FormData → /uploads/ path · clear image (file unlinked) · foreign teacher 404
  - quiz: empty publish 409 "no questions" · attach 201 · re-attach 409 · delete attached question 409 · detach 200 · delete detached 200 · update + class_ids on detail · delete draft (no attempts) 200 · foreign publish 404
  - grading: 2/4 @ pass_mark 50 → passed (TRUE answered "   true " proves case/whitespace-insensitive) · 3/4 @ pass_mark 80 → failed
  - immutability: edit/delete answered question 409 · edit/delete quiz with attempts 409
  - classes: getClass 200 · updateClass + geofence 200 · lat-only 400 · duplicate code 409
  - allocations: list contains all 3 · unassign 204 · repeat 404 · list reflects removal
  - auth matrix: anon 401 · student/teacher on admin 403 · admin on teacher 403 · bad CSRF 403
DB restored after run: 0 leftover __p24 users/courses/classes (temp fixtures removed on success and on failure)
```

**Deviations / notes:** the verify script deletes temp `audit_logs` rows before temp users because `audit_logs.user_id` has no `ON DELETE CASCADE` (the same FK that makes `DELETE /api/admin/users/:id` fail for a user with history — deferred to Phase 25). The manual `phase22/23.verify.js` scripts referenced in the Phase 22/23 notes were absent from `server/tests/smoke/`; Phase 24 adds the first lifecycle script for this series. Redis is not running locally, so `invalidateCache` is a graceful no-op (caching bypassed).


## Phase 25 Details (completed 2026-10-12)

**Scope:** finish the half-built account lifecycle — unique/validated email, profile view/edit, change-password, and a non-enumerating single-use forgot/reset password flow — plus the React account UI (Profile tab, forgot/reset pages).

**Server changes:**

| Area | File | Detail |
|---|---|---|
| Account endpoints | `server/src/controllers/auth.controller.js` | `EMAIL_REGEX`, `MIN_PASSWORD_LENGTH=8`, `RESET_TOKEN_TTL_MS=1h`, `GENERIC_RESET_MESSAGE`; unique-email 409 (`ER_DUP_ENTRY`); email-format + full_name-length validation; current-password verify; generic forgot-password (no enumeration); reset token single-use via `UPDATE ... WHERE id=? AND used=0` claim before hashing; responses `{success:true,message}` |
| `/me` freshness | `server/src/controllers/auth.controller.js` | `me` overlays fresh `full_name`/`email` from the DB onto the token payload so the Profile panel is populated after a page refresh; auth claims (`sub`/`role`/`username`) stay token-sourced |
| Routes | `server/src/routes/auth.routes.js` | moved `/profile`, `/change-password`, `/forgot-password`, `/reset-password` ABOVE `module.exports` (they were unreachable after the module-exports move) |
| Migration | `database/migrations/002_users_email.sql` | rewritten idempotent (information_schema checks + `PREPARE`/`EXECUTE`); verified to run twice, exit 0 |
| Seeder | `database/seeders/001_development_seed.sql` | users now insert `email` (`admin`/`teacher.demo`/`student.demo`@example.com) |

**Client changes:**

| Area | File | Detail |
|---|---|---|
| API wrappers | `client-react/src/lib/api.js` | added `updateProfile`, `changePassword`, `forgotPassword`, `resetPassword` |
| Auth context | `client-react/src/context/AuthProvider.jsx` | added `updateUser(next)` so the header/profile refresh after a save |
| Account UI | `client-react/src/pages/ProfilePanel.jsx` | Account-details form (full name + email) + Change-password form |
| Password flow | `client-react/src/pages/{ForgotPassword.jsx,ResetPassword.jsx}` | request-link page + token page (reads `?token=`) |
| Wiring | `client-react/src/App.jsx`, `pages/Login.jsx`, `pages/{Admin,Teacher,Student}Dashboard.jsx` | `/forgot-password` + `/reset-password` routes; Login "Forgot password?" link; Profile tab on all three dashboards |

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · vite build OK · npm test 25/25
phase-25.verify.js (boots app.listen(0); fixtures: two temp students, known bcrypt hash) → 35/35 PASS
  - static: ProfilePanel/Forgot/Reset pages exist · App routes · Login link · api wrappers · all dashboards render ProfilePanel · built dist bundle ships the account routes
  - profile: me (email field, role) · missing full_name 400 envelope · malformed email 400 · save 200 + persisted · me reflects save · duplicate email 409
  - password: wrong current 400 · too short 400 · change 200 · old password 401 · new password 200
  - forgot/reset: unknown vs known identical generic body (no enumeration) · token stored unused ~1h · bad token 400 · too short 400 · reset 200 + login works · token reuse 400 · expired 400
  - auth/CSRF matrix: me without cookie 401 · PUT/POST with valid CSRF but no jwt 401 · mutating without CSRF 403
DB restored after run: 0 leftover users, 0 password_reset_tokens (temp fixtures removed on success and on failure)
```

**Deviations / notes:** `/me` keeps JWT claims as the source of truth and only overlays `full_name`/`email`, which preserves the legacy `phase-11-12.verify.js` fabricated-token check (role comes from the token). CSRF runs before auth, so a mutating request carrying neither auth nor CSRF yields 403 — the 401 matrix in the verify sends a valid CSRF token without a jwt to exercise the auth layer. Reset tokens are claimed with a single conditional `UPDATE ... WHERE used=0` before hashing, so a token cannot be consumed twice. `DELETE /api/admin/users/:id` with audit history remains a known FK limitation (still deferred).


## Phase 26 Details (completed 2026-10-12)

**Scope:** real (but never request-fatal) email delivery — route the mailer through `config/env.js`, send a real password-reset link (Phase 25 tokens) and a welcome email on admin user-create, and guarantee the test suite never needs SMTP.

**Server changes:**

| Area | File | Detail |
|---|---|---|
| Config | `server/src/config/env.js` | added `SMTP_HOST/PORT/SECURE/USER/PASS`, `EMAIL_FROM`, `APP_BASE_URL` (defaults to `CLIENT_ORIGIN`), and derived `EMAIL_ENABLED = NODE_ENV !== 'test' && host+user+pass present` |
| Mailer | `server/src/services/email.service.js` | rewritten: reads config **only** from `config/env.js` (no `process.env`); `getTransporter()` returns `null` when disabled so `sendEmail` logs-and-skips; every path is wrapped so failures swallow to `null` and never throw; added `sendPasswordResetEmail(user, token)` + `buildResetLink()`; `sendWelcomeEmail` uses the real `email` column and skips when absent; `setEmailTransport()` allows tests to inject a capturing transport |
| Forgot password | `server/src/controllers/auth.controller.js` | `forgotPassword` now selects `id, username, full_name, email` and `await`s `sendPasswordResetEmail` (service swallows failures) |
| Admin create user | `server/src/controllers/admin.controller.js` | accepts optional `email` (`requireOptionalEmail`), stores it, maps `ER_DUP_ENTRY` → 409, and sends the welcome email via the real address (best-effort, awaited) |
| Validators | `server/src/validators/common.js` | added `requireOptionalEmail()` (format check, max 255) |
| Env files | `.env`, `.env.example` | added `APP_BASE_URL`, `SMTP_*` (empty placeholders), `EMAIL_FROM`; no secrets |

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · vite build OK · npm test 31/31
email.service.test.js (injected capturing transport, no SMTP) → 6/6 PASS
  - delivers with From header · skips empty recipient · swallows transport failure · welcome uses real email / skips when absent · reset link = APP_BASE_URL + /reset-password?token=... in text+html · skips reset when no email
phase-26.verify.js (boots app.listen(0); injected transport; temp admin+student, known bcrypt hash) → 21/21 PASS
  - static: env.js declares SMTP_*/EMAIL_FROM/APP_BASE_URL/EMAIL_ENABLED · email.service has no process.env · .env.example documents SMTP · admin/createUser + forgotPassword wired
  - create: with email 201 + stores email + welcome email to real address + configured From · without email 201 + welcome skipped · duplicate email 409 · invalid email 400
  - reset: forgot-password 200 generic + reset email to account email + body carries `${APP_BASE_URL}/reset-password?token=<db token>`
  - matrix: createUser without auth 401 · as student 403 · without CSRF 403
DB restored after run: 0 leftover __p26 users, 0 password_reset_tokens, 0 audit_logs
```

**Deviations / notes:** `EMAIL_ENABLED` is computed in `config/env.js` and forced off under `NODE_ENV=test`; with the shipped `.env` (no SMTP_HOST) delivery is a logged no-op in development too, so nothing in `npm test` touches the network. Tests prove composition/delivery by injecting a capturing transport via `setEmailTransport()` (the `transportOverride` also bypasses the enabled check, so the exact reset link and welcome recipient are asserted end-to-end through the HTTP endpoints). `sendQuizSubmissionAlert` stays best-effort (no await, swallowed failures) and still uses the placeholder teacher recipient until a teacher-recipient lookup is added. No SMTP secrets are committed — `.env`/`.env.example` carry empty placeholders only.


## Phase 27 Details (completed 2026-10-12)

**Scope:** replace the lone admin-only CSV export with a scoped reporting stack: a new `report.service.js`, three report types (attempts / quiz summary / student summary) in three formats (CSV / XLSX / PDF), admin-wide or teacher-scoped, plus a React Reports tab for both dashboards.

**Server changes:**

| Area | File | Detail |
|---|---|---|
| Report service | `server/src/services/report.service.js` | new: ownership-scoped `fetchAttempts({teacherId})` (`LIMIT MAX_REPORT_ROWS+1` to detect truncation), pure `summarizeByQuiz`/`summarizeByStudent`, `toAttemptRows`, CSV builders (`csvHeader`/`csvRow`/`toCsv`), `buildXlsxBuffer` (ExcelJS), `buildPdfBuffer` (PDFKit). `MAX_REPORT_ROWS=5000` caps every export |
| Controller | `server/src/controllers/report.controller.js` | rewritten around a `download(report, format)` factory; central format table (CSV content-type + streamed `res.write` rows, XLSX buffer, PDF buffer), `Content-Disposition` filename, `Cache-Control: no-store`, `X-Report-Truncated` header when capped, `reportScope()` maps TEACHER→own quizzes, errors after headers-sent end the stream instead of double-sending |
| Routes | `server/src/routes/report.routes.js` | `requireRole('ADMIN','TEACHER')` (students now 403); declarative 3×3 route table: `/{attempts,quizzes,students}.{csv,xlsx,pdf}` |

**Client changes:**

| Area | File | Detail |
|---|---|---|
| Download helper | `client-react/src/lib/api.js` | `downloadReport(report, format)` fetches the blob, parses `Content-Disposition`, triggers a temporary `<a download>`; 401 reuses the `auth:unauthorized` event; exported on `api` |
| Reports UI | `client-react/src/pages/ReportsPanel.jsx` | new shared panel: three report cards, each with CSV / Excel / PDF buttons, per-card busy + error state |
| Wiring | `client-react/src/pages/{AdminDashboard,TeacherDashboard}.jsx` | added a Reports tab (admin: between Allocations and Audit logs; teacher: between Quizzes and Profile) |

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · vite build OK (56 modules) · npm test 38/38
report.service.test.js (no DB) → 7/7 PASS (row cap, quiz/student aggregation math, CSV quoting, xlsx 'PK' magic, pdf '%PDF-' magic, column headers)
phase-27.verify.js (boots app.listen(0); temp admin + 2 teachers + student, 2 courses, 2 quizzes, 2 attempts) → 14/14 PASS
  - admin: attempts.csv text/csv with both quizzes + filename; attempts.xlsx xlsx magic+type; attempts.pdf pdf magic+type; quizzes.csv per-quiz summary; students.csv per-student summary
  - teacher A: export 200, contains own quiz, excludes teacher B's quiz (quizzes.csv also scoped)
  - matrix: no auth 401 · student 403 · unsupported format 404
DB restored after run: 0 leftover __p27 users/courses/quizzes, 0 attempts (fixtures removed on success and on failure)
```

**Deviations / notes:** reports are exported from at most `MAX_REPORT_ROWS = 5000` attempts (the query fetches one extra row to set the `X-Report-Truncated` header); teacher scope is `quizzes.creator_id = teacher` so it works even without `teacher_courses` rows. CSV is streamed row-by-row to the response; XLSX uses ExcelJS `writeBuffer` and PDF uses a buffered PDFKit document (landscape A4, manual table with page breaks). If an error occurs after a CSV stream has started, the controller ends the response instead of attempting a JSON error envelope. The legacy `GET /api/reports/attempts.csv` URL is preserved by the new route table.


## Phase 28 Details (completed 2026-10-12)

**Scope:** retire the last vanilla frontend so there is exactly one UI (the React SPA), and give the project a first-class, root-level build/verify pipeline instead of ad-hoc `npm --prefix` invocations.

**Unification (frontend):**

| Area | File | Detail |
|---|---|---|
| Legacy UI retired | `client/` → `archive/phase28/legacy-client/` | The vanilla HTML/CSS/JS app was already unserved by `app.js`; moved to the archive (with its `uploads/`) so only `client-react/` remains. Legacy smoke scripts that read those files moved to `archive/phase28/legacy-client-smoke/` (`phase-11-12.verify.js`, `phase-14.verify.js`); `archive/phase28/README.md` records the reference audit |
| Lint config | `eslint.config.js` | Dropped the now-dead `client/js/**` browser config block and `browserGlobals` map (the archive is already ignored) |
| Scaffolding | `setup-lms.sh` | No longer creates the flat `client/{pages,js,css}` layout; frontend is `client-react/` only |
| Ignore rules | `.gitignore` | Added `client-react/dist/` (build output) and `uploads/` (runtime data) ahead of the Phase 30 git baseline |

**Build pipeline (root scripts):**

| Script | Command | Purpose |
|---|---|---|
| `npm run build` | `npm --prefix client-react run build` | Produce `client-react/dist` for `app.js` to serve |
| `npm run client:install` | `npm --prefix client-react install` | Install SPA deps from the repo root |
| `npm run client:dev` | `npm --prefix client-react run dev` | Vite HMR dev server (`:5173`, proxies `/api` → `:3000`) |
| `npm run client:lint` | `npm --prefix client-react run lint` | oxlint the SPA |
| `npm run verify` | `lint && client:lint && build && test` | One-command gate used for release checks |

`server/src/app.js` now prints a startup warning when `client-react/dist/index.html` is missing, pointing at `npm run build`, so a fresh clone never silently serves a 404 shell.

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · npm run build OK (56 modules → dist/index.html + hashed js/css) · npm test 38/38
phase-28.verify.js (boots app.listen(0); creates one temp user per role) → 27/27 PASS
  - unification: client/ gone from root; archived (+ README) under archive/phase28/; no live static mount imports it
  - build present; GET / -> 200 text/html SPA shell referencing a hashed bundle; bundle asset -> 200 javascript; bundle contains the /admin /teacher /student routes
  - deep link /admin/dashboard -> SPA fallback (index.html); unknown API path still 404 (never the shell)
  - /uploads static mount serves a written probe file, then it is removed
  - API guards intact after static mounts: /api/health 200 status=ok; /api/admin/dashboard 401; /api/reports/attempts.csv 401; unknown API 404 JSON envelope
  - login -> dashboards: admin/teacher/student each log in, /api/auth/me returns the matching role, and /admin|/teacher|/student each serve the SPA shell
DB restored after run: 0 leftover __p28 users, 0 audit rows, temp upload probe deleted
```

**Deviations / notes:** the archive is excluded from lint/test/format globs, so moving `client/` there cannot reintroduce legacy lint noise. `client-react/dist` is intentionally git-ignored — `npm run build` is a prerequisite for `npm start`, which the new startup warning makes explicit. `node --check` on the legacy scripts and the archived client is no longer part of verification because the files are no longer live.


## Phase 29 Details (completed 2026-10-12)

**Scope:** raise the automated test suite from a handful of lifecycle/service tests to full HTTP coverage of every role surface, then wire the same gates into CI so they run on every push/PR.

**Shared HTTP test helpers (`server/tests/helpers.js`, ignored by the `*.test.js` glob):**

| Helper | Purpose |
|---|---|
| `makeJar()` | Minimal cookie jar that records `Set-Cookie` and replays `Cookie` per request |
| `startServer(app)` / `stopServer(server, pool)` | Boot `app.listen(0)`, and tear down with `closeAllConnections()` + `close()` + `pool.end()` |
| `request({port, method, path, jar, csrf, body, headers})` | `fetch` wrapper returning `{status, headers, text}`; JSON body encoding |
| `readJson(res)` | Parse the response text as JSON (asserts on failure) |
| `ensureCsrf(port, jar)` | `GET /api/csrf-token`, stores the cookie, returns the matching header token |
| `login(port, jar, username, password)` | Full CSRF + `POST /api/auth/login`, returns the parsed body and keeps cookies in the jar |

**New route-level suites (`npm test` = `node --test server/tests/*.test.js`):**

| File | Coverage |
|---|---|
| `authorization.test.js` | CSRF cookie/header match; `/api/auth/me`; role matrix for `/api/admin·teacher·student/dashboard` + `/api/reports/attempts.csv` (allowed 200, wrong role 403 "Insufficient permissions", anonymous 401 "Authentication required"); logout 401 + CSRF-less 403; mutating route without CSRF → 403 before auth; admin passes auth and reaches validation (400); unknown API → 404 "Route not found" envelope |
| `admin.routes.test.js` | dashboard numeric counts; courses CRUD (201/200/204 + 400/404); classes CRUD + geofence validation + duplicate code 409; users CRUD (201/200/204 + 409/400/404); allocations assign/list/unassign; audit logs contain `COURSE_CREATE` |
| `teacher.routes.test.js` | dashboard; question-bank validation (bad type/options/true-false → 400) + create 201; quiz create validation + foreign-course 403; quiz detail/attach 201 + duplicate 409; publish empty → 409, publish 200; statistics; update 200/400/404; close; detach (`removed:true`) + 404; delete; cross-teacher isolation 404. Quits `redisClient` in `after()` |
| `student.routes.test.js` | dashboard; published-in/draft-out quiz list; preview access-code 403 / missing location 400 / outside geofence 403 / ok 200 (sanitized, no `answer_data`); enrolment 404; start (same guards) + resume same attempt; location 200/403; submit grades 3/3 `passed`; history; attempted quiz leaves the list; unenrolled start → 404. Quits `redisClient` in `after()` |
| `report.routes.test.js` | anonymous 401 / student 403; all 3 reports × 3 formats non-empty with correct content-type + `attachment` disposition; attempts CSV header + row; teacher scoping (own quiz in, foreign out); unknown report 404 |

**Continuous integration (`.github/workflows/ci.yml`):**

| Job | Steps |
|---|---|
| `server` (ubuntu-latest, Node 20) | MySQL 8.0 service with health check; env `NODE_ENV=test` + `DB_*` + `JWT_SECRET`; `npm ci`; load `database/schema.sql` then `database/seeders/001_development_seed.sql`; `npm run lint`; `npm test` |
| `client` (ubuntu-latest, Node 20) | `npm ci --prefix client-react`; `npm run client:lint`; `npm run build` |

Triggers on push to `main`/`master` and on pull requests, with `concurrency` set to cancel superseded runs.

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · npm run build OK (56 modules) · npm test 68/68 (was 38)
smoke (all scripts, boot app.listen(0)): phase-13 24/24 · phase-24 53/53 · phase-25 35/35 · phase-26 21/21 · phase-27 14/14 · phase-28 27/27
DB restored after runs: 0 leftover p29.* / acct_* / __p* users, courses, quizzes, attempts, audit rows
```

**Deviations / notes:** `helpers.js` is intentionally not a `*.test.js` file so the runner does not execute it. The `teacher`/`student` suites import `redisClient` and call `redisClient.quit()` in `after()` to silence the local "Redis not running" retry noise (Redis is optional; caching degrades gracefully). CI loads the seeder because several suites read the seeded `admin`/`teacher.demo`/`student.demo` accounts and the `Demo Class` geofence; the CI MySQL service uses a throwaway root password supplied via job env, never a committed secret. The workflow has not been executed on GitHub from this machine — its first live run happens on the next push.


## Phase 30 Details (completed 2026-10-12)

**Scope:** make the app safe to run in production, give it a real database-migration path and health/shutdown behaviour, document deployment, and finally put the project under version control with a baseline tag.

**Configuration (`server/src/config/env.js`):** still the single reader of `.env`; now also exposes `IS_PRODUCTION`/`IS_TEST`, `TRUST_PROXY`, `COOKIE_SECURE`, `REQUEST_BODY_LIMIT`, `DB_CONNECTION_LIMIT`, `REDIS_URL`, and the rate-limit knobs, with `readBool`/`readInt`/`readTrustProxy` helpers. `assertProductionEnv()` runs at load and refuses to boot in production on a missing/default `JWT_SECRET`, a `localhost`/`127.0.0.1` `CLIENT_ORIGIN` or `APP_BASE_URL`, an empty `DB_PASSWORD`, or disabled `COOKIE_SECURE`.

**Hardening:**

| Area | Change | Where |
|---|---|---|
| CSP | `helmet` now emits a strict CSP (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`; `style-src` allows inline styles for React; HTTPS upgrade only in production); CORP set to `cross-origin` for uploads | `server/src/app.js` |
| Proxy | `app.set('trust proxy', TRUST_PROXY)` (default `1` in production, false otherwise) |
| Cookies | `Secure` in production via `COOKIE_SECURE`; CSRF cookie and `jwt` cookie both read it from config (no more raw `process.env` reads) | `middleware/csrf.js`, `controllers/auth.controller.js` |
| Rate limits | New `middleware/rateLimit.js`: `mutationLimiter` on all `/api` mutations + stricter `authLimiter` on `/api/auth`; both skipped under `NODE_ENV=test` | `middleware/rateLimit.js`, `app.js` |
| Body limits | `express.json`/`express.urlencoded` capped by `REQUEST_BODY_LIMIT` (uploads stay 5 MB via multer) | `app.js` |
| Startup validation | Fail fast in production on missing/default secrets, localhost origins, empty DB password, disabled secure cookies | `config/env.js` |
| DB pool | `enableKeepAlive` + configurable `DB_CONNECTION_LIMIT`, `queueLimit 0` | `config/database.js` |
| Least-privilege DB | Template for app (DML) + migration (DDL) users | `database/create-app-user.sql` |
| Redis | `REDIS_URL` now comes from config; a single warning is logged when Redis is unreachable instead of error spam | `config/redis.js` |

**Migrations:** `scripts/migrate.js` (npm `migrate`) applies `database/migrations/*.sql` in filename order inside a `schema_migrations` ledger and skips already-applied files; `database/migrations/README.md` documents the ordered-apply procedure and privileges.

**Health + lifecycle:** `routes/health.routes.js` now serves `GET /api/health` (liveness), `GET /api/health/live`, and `GET /api/health/ready` (database check → 200/503; Redis reported but non-fatal). New `server/src/server.js` is the entrypoint: it logs the DB connection, warns if the SPA build is missing, and shuts down gracefully on `SIGTERM`/`SIGINT` (stop accepting → close server → `pool.end()` → Redis quit, 10 s force-exit). `npm start`/`npm run dev` now target `server/src/server.js`.

**Git baseline:** `.gitignore` expanded (deps, build output, uploads, logs, env files, editor/OS); `git init` (branch `main`) + initial commit + annotated tag as the historical baseline (per ground rule 4, version control only at the end).

**Verification (2026-10-12, XAMPP MariaDB, seeded `smartclass`):**

```
root eslint 0 · client oxlint 0 · npm run build OK (56 modules) · npm test 68/68
smoke (phase-13 updated for the new prod guards): phase-13 27/27 · 24 53/53 · 25 35/35 · 26 21/21 · 27 14/14 · 28 27/27
npm run migrate -> apply 002_users_email.sql; second run -> "Database is up to date."
npm start (PORT=3055):
  GET /api/health       -> 200 {"name":"PHILS LEARNOVA","status":"ok",...}
  GET /api/health/live  -> 200 {"status":"ok"}
  GET /api/health/ready -> 200 {"status":"ready","checks":{"database":"ok","redis":"unavailable"}}
  Content-Security-Policy present (script-src 'self'; object-src 'none'; frame-ancestors 'none'; ...)
  POST /api/admin/courses without CSRF -> 403
```

**Deviations / notes:** a strict CSP required allowing `'unsafe-inline'` for styles because the React/Tailwind SPA emits inline `style` attributes; scripts stay strict (`'self'`, no inline). Ordered migrations were chosen over an ORM; the one existing migration was already folded into `database/schema.sql`, so `npm run migrate` is a no-op on a fresh install. `SIGTERM`/`SIGINT` draining is standard Node and is exercised in Linux CI/containers; Windows `Stop-Process` terminates hard, so it was not exercised locally. The git tag is local-only — no remote is configured (GitHub CLI is not installed on this machine), so pushing is a manual step.


## Notes

- Auth is now single-path: `attachUser` (middleware/jwt.js) is the only token decoder and routes import `requireAuth`/`requireRole` from `middleware/auth.js` only - do not reintroduce a second copy
- Password hashing lives only in `services/password.service.js` (cost 12, matches `database/seeders/001_development_seed.sql`)
- Git baseline: the project is now a git repo (branch `main`) with the Phase 30 snapshot committed and tagged; no remote is configured yet
- Database migrations live in `database/migrations/*.sql` and are applied in order by `npm run migrate` (ledger table `schema_migrations`); `database/schema.sql` remains the fresh-install schema
- Production hardening lives in `server/src/config/env.js` (fail-fast validation, limits), `server/src/app.js` (CSP, trust proxy, rate limits), `server/src/middleware/rateLimit.js`, `server/src/routes/health.routes.js` (liveness/readiness), and `server/src/server.js` (entrypoint + graceful shutdown); deployment steps are in `README.md`
- Tests pass: 68/68 (`npm test`) - geofence x2 + app export + `smoke.auth.test.js` (health / invalid login 401 / no-token admin 401) + account lifecycle (me/profile/change-password/forgot/reset) + quiz/question lifecycle (edit/delete guards, attach/detach, grading) + email service (send/skip/failure, welcome, reset link) + report service (row cap, summaries, CSV quoting, xlsx/pdf builders) + Phase 29 route suites (`authorization.test.js` role/CSRF matrix, `admin.routes.test.js`, `teacher.routes.test.js`, `student.routes.test.js`, `report.routes.test.js`); run after each phase
- No test framework beyond `node:test` may be added (`supertest` etc. are intentionally absent); integration tests boot `app.listen(0)` and must `pool.end()` in cleanup or the runner hangs
- Dead code is archived under `archive/` (each has a README): Phase 1 → `archive/postgres-conflict-2026-10-05/`, Phase 13 → `archive/empty-config-duplicates-2026-10-06/`, Phase 16 → `archive/phase16/`, Phase 28 → `archive/phase28/`; a git baseline now exists, but archive/ is retained for the audit trail
- Smoke scripts (not matched by `npm test`'s `*.test.js` glob) live in `server/tests/smoke/` and boot `app.listen(0)` themselves: `phase-13.verify.js` (27/27, config/env + prod fail-fast), `phase-24.verify.js` (53/53), `phase-25.verify.js` (35/35), `phase-26.verify.js` (21/21), `phase-27.verify.js` (14/14), `phase-28.verify.js` (27/27); the legacy-client scripts moved to `archive/phase28/legacy-client-smoke/`; the route-level `*.test.js` suites (Phase 29) run under `npm test` and boot `app.listen(0)` via `server/tests/helpers.js`
- Config has one entry point: `server/src/config/env.js` loads `.env` and exposes every value; `app.js`/`database.js` must consume it rather than re-reading `process.env`
- Empty duplicate configs live in `archive/empty-config-duplicates-2026-10-06/` (see its README)
- 20-Phase-LMS-Development-Procedure.md is still 0 bytes (placeholder)
