# TODO_NOW.md - Current Session
**Date:** Mon Oct 12 2026

## Status: PHASE 30 COMPLETE (Production hardening, git baseline, deployment) — all 30 phases done

### Phase 30 - actions taken
- [x] `server/src/config/env.js`: single `.env` reader now also exposes `IS_PRODUCTION`/`IS_TEST`, `TRUST_PROXY`, `COOKIE_SECURE`, `REQUEST_BODY_LIMIT`, `DB_CONNECTION_LIMIT`, `REDIS_URL`, `RATE_LIMIT_*`; `assertProductionEnv()` fails fast on missing/default `JWT_SECRET`, localhost origins, empty DB password, or disabled secure cookies
- [x] `server/src/app.js`: strict helmet CSP (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`; styles allow inline for React), `app.set('trust proxy', TRUST_PROXY)`, size-limited parsers, mutation + auth rate limiters, startup SPA-build warning moved to the entrypoint
- [x] `server/src/middleware/rateLimit.js` (new): `mutationLimiter` on all `/api` mutations + stricter `authLimiter` on `/api/auth`, skipped under `NODE_ENV=test`
- [x] `server/src/middleware/csrf.js` + `controllers/auth.controller.js`: cookie `secure` flag from `COOKIE_SECURE` (config) instead of raw `process.env`
- [x] `server/src/config/database.js`: keep-alive + configurable pool size; `config/redis.js`: `REDIS_URL` from config + single warning when unreachable
- [x] `server/src/routes/health.routes.js`: `/api/health` (liveness), `/api/health/live`, `/api/health/ready` (DB check → 200/503; Redis non-fatal, loaded lazily)
- [x] `server/src/server.js` (new entrypoint): logs DB connection, graceful `SIGTERM`/`SIGINT` shutdown (drain → `pool.end()` → Redis quit, 10s force-exit); `npm start`/`dev` retargeted
- [x] `scripts/migrate.js` + `database/migrations/README.md`: ordered migration runner with a `schema_migrations` ledger; `database/create-app-user.sql`: least-privilege app + migration users
- [x] `.gitignore` expanded; `git init` (branch `main`) + baseline commit + annotated tag (local only, no remote)
- [x] Verification: root eslint 0, client oxlint 0, `npm run build` OK, `npm test` 68/68; smoke all pass (phase-13 27/27 — updated for new prod guards · 24 53/53 · 25 35/35 · 26 21/21 · 27 14/14 · 28 27/27); `npm run migrate` applies then reports up-to-date; `npm start` (3055) health/live/ready 200, CSP header present, no-CSRF POST 403; DB cleaned to seed state (removed orphan `probe.*` users)
- [x] Docs: `README.md` (Deployment + env matrix + security), `VERIFY.md` (migrate + health checks), `FIX_PLAN.md` (Phase 30 detail), `FINAL_SUMMARY.md` (Phases 1-30), `TODO_NOW.md`

### Phase 29 - actions taken
- [x] New `server/tests/helpers.js` — shared HTTP test utils (`makeJar`, `startServer`/`stopServer`, `request`, `readJson`, `ensureCsrf`, `login`); intentionally not a `*.test.js` so the runner skips it
- [x] New `server/tests/authorization.test.js` — CSRF cookie/header match, `/me`, role matrix for admin/teacher/student dashboards + reports (401/403/200), logout, CSRF-before-auth, validation reach (400), unknown API 404
- [x] New `server/tests/admin.routes.test.js` — dashboard counts, courses/classes/users CRUD (+ geofence/dup-code 409), allocations assign/list/unassign, audit logs (`COURSE_CREATE`)
- [x] New `server/tests/teacher.routes.test.js` — dashboard, question-bank validation, quiz create/detail/attach, publish guards (409), statistics, update/close/detach/delete, cross-teacher isolation; quits `redisClient` in `after()`
- [x] New `server/tests/student.routes.test.js` — dashboard, quiz list (draft hidden), preview/start access-code + geofence guards, resume attempt, location check, submit grade (3/3 passed), history, unenrolled 404; quits `redisClient` in `after()`
- [x] New `server/tests/report.routes.test.js` — anon 401 / student 403, all 3×3 reports non-empty with correct content-types + attachment disposition, CSV header/row, teacher scoping, unknown 404
- [x] New `.github/workflows/ci.yml` — `server` job (MySQL 8.0 service, node 20, schema+seed, lint, test) + `client` job (node 20, client:lint, build) on push/PR
- [x] Verification: root eslint 0, client oxlint 0, `npm run build` OK (56 modules), `npm test` **68/68** (was 38); smoke all pass (phase-13 24 · 24 53 · 25 35 · 26 21 · 27 14 · 28 27); DB restored (0 leftovers)
- [x] Docs: `FIX_PLAN.md` (Phase 29 detail + checklist), `README.md` (68 tests + CI section), `VERIFY.md` (68 tests + CI check), `TODO_NOW.md`

### Phase 28 - actions taken
- [x] Retired the vanilla UI: `client/` → `archive/phase28/legacy-client/` (was already unserved); legacy smoke scripts `phase-11-12.verify.js` + `phase-14.verify.js` → `archive/phase28/legacy-client-smoke/`
- [x] `eslint.config.js`: removed dead `client/js/**` browser config block + `browserGlobals`
- [x] `package.json` root pipeline: `build`, `client:install`, `client:dev`, `client:lint`, `verify` (all via `npm --prefix client-react`)
- [x] `server/src/app.js`: warns at startup when `client-react/dist/index.html` is missing (points to `npm run build`)
- [x] `.gitignore`: ignore `client-react/dist/` + `uploads/` (ahead of the Phase 30 git baseline)
- [x] `setup-lms.sh`: no longer scaffolds the flat legacy `client/` layout
- [x] New `server/tests/smoke/phase-28.verify.js` → **27/27 PASS** (legacy client archived + README, build present, SPA shell + hashed bundle served, three role routes compiled, deep-link fallback, unknown API 404, `/uploads` probe, health/admin/reports guards, admin/teacher/student login → matching role + dashboard shell); temp users + upload probe cleaned
- [x] Docs: `README.md` (stack/start/build/areas), `VERIFY.md` (stack/entry/routes/smoke list), `FIX_PLAN.md` (Phase 28 detail + checklist), `TODO_NOW.md`
- [x] Verification: root eslint 0, client oxlint 0, `npm run build` OK (56 modules), `npm test` 38/38, no DB writes this phase

### Phase 27 - actions taken
- [x] New `services/report.service.js`: ownership-scoped attempt fetch (`MAX_REPORT_ROWS=5000`, +1 row to detect truncation), `summarizeByQuiz`/`summarizeByStudent`, `toAttemptRows`, `csvHeader`/`csvRow`/`toCsv`, `buildXlsxBuffer` (ExcelJS), `buildPdfBuffer` (PDFKit, landscape A4 table + page breaks)
- [x] `report.controller.js` rewritten: `download(report, format)` factory, `{attempts,quizzes,students}×{csv,xlsx,pdf}`, role scope (admin=all, teacher=own quizzes), Content-Disposition/`no-store`/`X-Report-Truncated`, CSV streamed
- [x] `report.routes.js`: `requireRole('ADMIN','TEACHER')` (students 403), declarative 3×3 route table (keeps `attempts.csv` URL)
- [x] Client: `api.downloadReport(report, format)` (blob + Content-Disposition filename), new `pages/ReportsPanel.jsx`, Reports tab on Admin + Teacher dashboards
- [x] New `server/tests/report.service.test.js` → **7/7**; new `server/tests/smoke/phase-27.verify.js` → **14/14 PASS** (admin all 3 reports × 3 formats, teacher scoping, 401/403/404), DB restored (0 leftovers)
- [x] Docs: `FIX_PLAN.md` (Phase 27 checklist + detail), `TODO_NOW.md`, `README.md`
- [x] Verification: root eslint 0, client oxlint 0, `vite build` OK, `npm test` 38/38

### Phase 26 - actions taken
- [x] `config/env.js`: added `SMTP_HOST/PORT/SECURE/USER/PASS`, `EMAIL_FROM`, `APP_BASE_URL` (defaults `CLIENT_ORIGIN`), derived `EMAIL_ENABLED = NODE_ENV !== 'test' && host+user+pass`; `.env` + `.env.example` placeholders (no secrets)
- [x] `services/email.service.js` rewritten: reads config **only** from `config/env.js` (no `process.env`); no-op transport when disabled; every path logs-and-swallows (never throws); `sendPasswordResetEmail` + `buildResetLink`; welcome uses real `email` and skips when absent; `setEmailTransport()` DI for tests
- [x] `auth.controller.forgotPassword`: selects email + sends the reset email (best-effort, never fatal)
- [x] `admin.controller.createUser`: optional `email` (`requireOptionalEmail`), stores it, dup→409, welcome email to the real address
- [x] `validators/common.js`: `requireOptionalEmail`
- [x] New `server/tests/email.service.test.js` → **6/6**; new `server/tests/smoke/phase-26.verify.js` → **21/21 PASS** (welcome/reset composition via injected transport, dup/invalid email, 401/403/CSRF), DB restored (0 leftovers/tokens/logs)
- [x] Docs: `FIX_PLAN.md` (Phase 26 checklist + detail section), `TODO_NOW.md`, `README.md`
- [x] Verification: root eslint 0, client oxlint 0, `vite build` OK, `npm test` 31/31 (SMTP not required)

### Phase 25 - actions taken
- [x] Server `auth.controller.js` hardened: unique-email 409 (`ER_DUP_ENTRY`), email-format + full_name validation, current-password verify, generic forgot-password (no enumeration), single-use reset token (`UPDATE ... WHERE id=? AND used=0` before hashing, 1h TTL), responses `{success:true,message}`
- [x] `/me` now overlays fresh `full_name`/`email` from the DB onto the token payload (fixes the refreshed Profile panel; keeps `sub`/`role` token-sourced)
- [x] `auth.routes.js`: `/profile`, `/change-password`, `/forgot-password`, `/reset-password` moved above `module.exports` (were unreachable)
- [x] `002_users_email.sql` made idempotent (information_schema checks + PREPARE/EXECUTE; runs twice, exit 0); seeder inserts `email`
- [x] Client: `lib/api.js` (updateProfile/changePassword/forgotPassword/resetPassword), `AuthProvider.updateUser`, new `pages/{ProfilePanel,ForgotPassword,ResetPassword}.jsx`, App routes + Login link, Profile tab on all 3 dashboards
- [x] `account.lifecycle.test.js` rewritten → **12/12**; new `server/tests/smoke/phase-25.verify.js` → **35/35 PASS** (profile/email 409, change-password, non-enumerating forgot, single-use + expired reset, 401/403/CSRF matrix, static UI + built-bundle checks), DB restored (0 leftovers, 0 tokens)
- [x] Docs: `FIX_PLAN.md` (Phase 25 checklist + detail section), `TODO_NOW.md`, `README.md`
- [x] Verification: root eslint 0, client oxlint 0, `vite build` OK, `npm test` 25/25

### Phase 24 - actions taken
- [x] Preflight repairs (tree was red → green): `auth.controller.js` stripped SQL + TDZ crash, `account.lifecycle.test.js` interpolation, `database/schema.sql` duplicate blocks, applied migration `002_users_email.sql` to live DB
- [x] Grading: `normalizeTextAnswer()` (trim + collapse whitespace + lowercase) for TRUE_FALSE/SHORT_ANSWER/FILL_BLANK; `passed = (score/total)*100 >= pass_mark`; Redis `student_quizzes:*` invalidated on submit (`student.controller.js`)
- [x] `publishQuiz` 404 if not owned, **409 "no questions"** when empty; `getQuizDetail` returns `class_ids` (`teacher.controller.js`)
- [x] Admin class edit + allocation lifecycle: `getClass`, `updateClass` (ER_DUP_ENTRY→409, lat/lng pair validation), `listAllocations`, `unassignStudent/Teacher/Course` + routes (`admin.controller.js`, `admin.routes.js`)
- [x] Client: `lib/api.js` wrappers (getClass/updateClass/getAllocations/unassign*/updateQuestion/deleteQuestion/updateQuiz/deleteQuiz/detachQuestion)
- [x] Client panels rewritten: `QuestionBankPanel` (edit/delete + edit modal), `QuizzesPanel` (edit/delete/detach/publish/close/stats + class_ids), `ClassesPanel` (edit mode), `AllocationsPanel` (allocation tables + ConfirmDialog Remove + reload)
- [x] New `server/tests/smoke/phase-24.verify.js` → **53/53 PASS** (questions/quiz lifecycle, 409 guards, image upload+clear, grading percentage + case-insensitive, class edit + duplicate 409, allocations list/unassign, 401/403 matrix), DB restored (0 leftovers)
- [x] Docs: `FIX_PLAN.md` (Phase 24 checklist + detail section), `TODO_NOW.md`, `README.md`
- [x] Verification: root eslint 0, client oxlint 0, `vite build` OK, `npm test` 15/15

### Notes / deferred (Phase 25)
- `DELETE /api/admin/users/:id` still fails with FK error when the user has audit history (`audit_logs.user_id`, no cascade) — needs soft-delete or `ON DELETE` policy
- `phase22.verify.js` / `phase23.verify.js` referenced in the notes below were not present in `server/tests/smoke/`; Phase 24 is the first lifecycle script in this series
- Redis is not running locally → `invalidateCache` is a no-op (caching bypassed)

### Phase 22 - actions taken
- [x] `/teacher` route now renders `TeacherDashboard.jsx` (ProtectedRoute role TEACHER); interim `TeacherPlaceholder.jsx` deleted
- [x] `pages/teacher/OverviewPanel.jsx` — assigned courses/classes metrics + lists from `GET /api/teacher/dashboard`
- [x] `pages/teacher/QuestionBankPanel.jsx` — paginated bank table (difficulty chip, answer preview, image flag) + create modal: 4 question types, MC options with correct-option radio, TF select, short/fill expected answer, difficulty, optional image upload via `FormData` (`multer`, 5 MB)
- [x] `pages/teacher/QuizzesPanel.jsx` — quiz table with status chips + create modal (title, course select, class checkboxes, duration, attempt limit, pass mark, access code, randomize Q/O, `datetime-local` schedule window), row actions Publish/Close/Questions/Stats with inline error banner
- [x] Question picker modal — `GET /quizzes/:id` attached list + bank picker with Add (attached disabled); empty-publish 404 mapped to "Attach at least one question first."
- [x] Statistics modal — summary cards (attempts/average/best), **per-question breakdown** (correct/answered + accuracy % + correct answer), per-student results
- [x] Server (additive): new `GET /api/teacher/quizzes/:id` (ownership-checked detail for the picker); `statistics` now also returns per-question `answered_count`/`correct_count` + explicit 404 for foreign quizzes
- [x] `lib/api.js`: `getTeacherQuiz`; `getQuizStatistics` response gains `questions`
- [x] Docs: `FIX_PLAN.md` (Phase 22 checklist + detail section, Phase 23 placeholder notes corrected)
- [x] Verification: root eslint 0, oxlint 0, build OK, `npm test` 7/7, smoke ALL PASS, **phase22.verify.js 67/67** (full E2E: create 4 questions incl. image upload → quiz DRAFT → attach ×4 → publish → student attempt 4/4 → statistics breakdown ×4 → close; role matrix + foreign-quiz 404s; empty-publish 404; unassigned-course 403), DB restored to seeded state, temp server stopped

### Phase 23 - actions taken (previous session)
- [x] `/student` route + `StudentDashboard.jsx` (tabs Overview/Quizzes/History; full-screen quiz session while an attempt is live)
- [x] `pages/student/QuizzesPanel.jsx` — start dialog with optional access code, `navigator.geolocation` → `api.startQuiz`, best-effort `api.verifyLocation` re-check, explicit "allow location access" messaging when the browser denies and the server requires coordinates
- [x] `pages/student/QuizRunner.jsx` — countdown timer with auto-submit at 0 (ref-backed answers, no stale submit), renders MULTIPLE_CHOICE (radios), TRUE/FALSE (buttons), SHORT_ANSWER/FILL_BLANK (inputs), image support, exit confirm, result card
- [x] `pages/student/HistoryPanel.jsx` (paginated) + `OverviewPanel.jsx` (metrics, courses, recent attempts)
- [x] Interim `TeacherPlaceholder.jsx` at `/teacher` — without it teachers looped `/teacher` → `*` → `/login`; **removed in Phase 22** (replaced by `TeacherDashboard.jsx`)
- [x] Login copy fix; `App.jsx` role routes: admin, student, teacher placeholder
- [x] Verification: oxlint 0 warnings, build OK, root eslint 0, `npm test` 7/7, **phase23.verify.js 37/37** (geofence 400/403, access code 403, sanitized payload, mid-attempt location check, scored 3/4 → passed, history + re-list assertions, 401/403 role matrix), DB restored to seeded state

### Notes / deferred (Phase 24)
- TRUE/FALSE grading is exact-match server-side — UI sends `TRUE`/`FALSE`; make grading case-insensitive in Phase 24
- `passed = score(count) >= pass_mark(%)` — default pass_mark 50 can never pass; needs percentage math (Phase 24)
- Redis quiz-list cache has no invalidation on submit (only matters when Redis runs)
- Re-attaching an already-attached question → DB duplicate-key 500 (teacher UI prevents it; guard the endpoint in Phase 24)
- No question edit/delete endpoints — the React bank table intentionally has no row actions until Phase 24

### Phase 21 - actions taken
- [x] New admin panels in `client-react/src/pages/admin/`: Users (create/edit/delete + status toggle), Courses (CRUD + activate/deactivate), Classes (create w/ geofence lat/lng/radius + "Use my location"), Allocations (student→class, teacher→class, teacher→course), Audit logs (paginated, expandable details)
- [x] Shared components `client-react/src/components/{Modal,Panel,Field,ConfirmDialog}.jsx`; `AdminDashboard.jsx` now has tab nav (Overview/Users/Courses/Classes/Allocations/Audit logs)
- [x] `lib/api.js`: 12 new admin wrappers; `lib/usePagedList.js`: added `reload()`; `lib/fetchOptions.js`: paged option loaders for dropdowns
- [x] Server (additive, required for the status toggle): `listUsers` returns `status`; `updateUser` accepts optional `status`; `auditLogs` ordered `created_at DESC, id DESC` (fixes same-second ties)
- [x] Docs: `FIX_PLAN.md` Phase 21 section + 21-30 checklist, `README.md` (users routes, `client-react` is the live frontend, rebuild command)
- [x] Verification: oxlint 0, `vite build` OK, root `npm run lint` 0, `npm test` 7/7 (XAMPP MariaDB up), API+bundle walkthrough **39/39** on PORT=3021 against seeded `smartclass`, test data cleaned (3 users/1 course/1 class/0 logs)

### Deferred from Phase 21 (for later phases)
- Class edit endpoint (API is create/list only) — Phase 24
- Allocation list/unassign endpoints — Phase 24
- `DELETE /api/admin/users/:id` fails with FK error when the user has audit history — needs soft-delete or `ON DELETE` policy (Phase 25)
- Teacher/Student React dashboards — Phases 22-23 (**both done**)

### Phase 20 - actions taken
- [x] Updated `FIX_PLAN.md`: header + checklist marked complete for all 20 phases; Phase 19/20 detail sections added
- [x] Updated `README.md`: lint/test/format commands, VERIFY.md + smoke-runner pointers, structure/API drift corrected
- [x] Created `VERIFY.md` (checklist) and `scripts/smoke-check.ps1` (boots app, 7 probes, exit 0/1) - referenced from README
- [x] Confirmed `.env.example` has no secrets and matches `.env` keys; `20-Phase-LMS-Development-Procedure.md` (0 bytes) archived in Phase 16
- [x] Final verification: `npm test` 6/6, `npm run lint` 0 problems, `npm run format` baseline (30 files), smoke 50/50 + 24/24 + 12/12, `scripts/smoke-check.ps1` ALL PASS

### Phase 19 - actions taken
- [x] Ran all targeted greps: `/api/api`=0, quiz.html diff markers=0, `$1`/`RETURNING`/`result.rows`=0, `max-OPEOKwidth`=0, `answer_data: undefined`=0, `course.routes` not mounted, `/js/student.js` present in pages, TODO/FIXME=0
- [x] Reviewed all `req.user.sub` uses (30+, all behind auth; `decodeToken` backfills `sub`; `recordAudit` null-safe) - no undefined reachable
- [x] Reviewed both `JSON.parse(answer_data)` sites - startQuiz `:86` and submit `:138`, both guarded with try/catch + ternary
- [x] Fix 1: removed dead `decodeToken` export from `server/src/middleware/jwt.js` (only used internally)
- [x] Fix 2: added `format:check` npm script alias (spec referenced it; only `format` existed)
- [x] Verification: app loads, `npm test` 6/6, `npm run lint` 0, `format:check` runs, smoke 50/50 + 24/24 + 12/12, `smoke-check.ps1` ALL PASS

### Phase 18 - actions taken
- [x] Created `VERIFY.md` - prerequisites, automated checks, per-role browser walkthrough, cross-cutting checks, endpoint/auth reference
- [x] Checklist grounded in real routes: noted admin has **no** user-list endpoint (only `POST /api/admin/users`); "view courses/quizzes" mapped to actual `GET /api/{teacher,student}/...`
- [x] Created `scripts/smoke-check.ps1` - boots app on port 3016 (`-Port` override), polls health, 7 probes, `-KeepRunning`, exit 0/1, PowerShell 5.1-safe (`Invoke-WebRequest -UseBasicParsing`)
- [x] No app code changed (new files only)
- [x] Verification: script ALL PASS on 3016 and 3017, clean teardown (no leftover listeners); `npm test` 6/6; `npm run lint` 0 problems

### Phase 17 - actions taken
- [x] Checked deps: `supertest` not installed → did NOT add it; used `node:test` + built-in `fetch`
- [x] Added `server/tests/smoke.auth.test.js` (CommonJS) - 3 tests / 8 assertions, no existing test touched
- [x] `GET /api/health` → 200 + `status:'ok'` (no DB)
- [x] `POST /api/auth/login` invalid creds → 401 (fetches CSRF token first, bogus user never inserted)
- [x] `GET /api/admin/dashboard` no cookie → 401 `Authentication required`
- [x] Boots `app.listen(0)` (ephemeral port); `test.after` closes connections + `pool.end()` so the process can't hang
- [x] Placed in `server/tests/` not `server/src/tests/` - `npm test` glob is `server/tests/*.test.js`
- [x] Verification: `npm test` 6/6 (3 consecutive runs, ~660ms, no flakiness), `npm run lint` 0 problems

### Phase 16 - actions taken
- [x] Grepped `auth.service` (0 hits - already gone since Phase 12), `course.controller`/`assessment`/`enrollment` (only in Phase 1 archive; `quiz.html` hit is live quiz UI text)
- [x] No `*.bak` / `*.old` / `*.orig` / `*.tmp` anywhere
- [x] Moved dead `client/js/admin.js` + `client/js/teacher.js` → `archive/phase16/` (no HTML references either)
- [x] Moved 0-byte `20-Phase-LMS-Development-Procedure.md` → `archive/phase16/` (`.0bytes` suffix)
- [x] Removed 0-byte `.gitkeep` in `server/src/{controllers,services,validators}` + `database/seeders` (dirs have real files)
- [x] Wrote `archive/phase16/README.md` with the full audit trail
- [x] Confirmed live: `validators/common.js`, all 4 services, all 6 routes, all 5 controllers, `client/js/{api,app,student}.js`; 0 orphan JS files remain
- [x] Verification: `node --check` 0 failures, app requires OK, `npm run lint` 0 problems, `npm test` 3/3, smoke 50/50 (3013) + 24/24 (3014) + 12/12 (CSS)

### Phase 15 - actions taken
- [x] Created `eslint.config.js` - ESLint 10 flat config, CommonJS; no new deps (`@eslint/js`/`globals` not installed, so rules + globals are hand-rolled)
- [x] Created `.prettierrc` (printWidth 120, single quotes, semi, trailing commas, `endOfLine: auto` for the mixed CRLF/LF repo) + `.prettierignore`
- [x] Added npm scripts: `lint`, `lint:fix`, `format`, `format:write`
- [x] Config-only change: no source file edited, no `--fix`/`--write` run
- [x] `npx eslint --version` v10.11.0, `npx prettier --version` 3.9.9
- [x] `npm run lint` exit 0 (0 problems), `npm run format` exit 1 with 30 files (expected), `npm test` 3/3
- [x] One lint error fixed in config: declared `module` readonly in browser globals for `client/js/api.js` UMD guard

### Phase 14 - actions taken
- [x] Fixed `client/css/styles.css:15` - `max-OPEOKwidth: 660px` → `max-width: 660px` (only change made)
- [x] Scanned the file for other typos: uppercase corruption runs, mixed-case property names, common misspellings, diff markers - none found
- [x] Confirmed no `<style>` blocks in client HTML (nothing else to corrupt)
- [x] Added `server/tests/smoke/phase-14.verify.js` (structural + declaration parser) → **12/12 PASS**
- [x] `npm test` 3/3

### Phase 13 - actions taken
- [x] Read all config: `server/src/config/{env,database}.js`, empty `server/config/*`, `.env`, `.env.example`, `setup-lms.sh`
- [x] `server/src/config/*` kept as sole source of truth
- [x] Archived `server/config/{env,database}.js` (0 bytes) → `archive/empty-config-duplicates-2026-10-06/` + README; removed empty `server/{config,controllers,middleware,routes}`
- [x] Fixed root cause: `setup-lms.sh` no longer creates the obsolete flat layout
- [x] `.env.example` keys now identical to `.env` (added `JWT_EXPIRES_IN`), `DB_NAME=smartclass`, placeholder secret only
- [x] `.env`: added `JWT_EXPIRES_IN=8h` for key parity
- [x] `database.js` builds the mysql2 pool from `config/env` (not raw `process.env`)
- [x] `app.js` loads config instead of calling `dotenv` itself; PORT/CLIENT_ORIGIN come from config
- [x] `env.js` resolves `.env` by project-root path (cwd independent); production fails fast on default/missing `JWT_SECRET`
- [x] Verification: `npm test` 3/3, `phase-13.verify.js` **24/24**, `phase-11-12.verify.js` regression **50/50**

### This round (spec compliance pass)
- [x] Phase 11 spec: role casing checked against schema.sql `ENUM('ADMIN','TEACHER','STUDENT')`; login normalizes case-insensitively
- [x] Phase 11 spec: all redirects target `/pages/*/index.html`; removed the last wrong-path refs by deleting `client/js/login.js` (only file using `/admin/index.html` etc.)
- [x] Phase 11 spec: JWT + CSRF flow untouched
- [x] Phase 12 spec: `requireAuth` -> 401, `requireRole` -> 403, both centralized through the existing `errorHandler` via new `httpError()`
- [x] Phase 12 spec: minimal messages, no stack leak (5xx stacks only in development; generic 5xx text outside it)
- [x] Phase 12 spec: no `token_expired` flag (nothing consumes it)
- [x] Phase 12 spec: cookie name/flags unchanged (`jwt`, HttpOnly, SameSite=Strict, Path=/)
- [x] Added `server/tests/smoke/phase-11-12.verify.js` - **50/50 PASS**
- [x] `npm test` 3/3

### Completed this session
- [x] Phase 11: login/role consistency & redirects (see FIX_PLAN.md for detail)
- [x] Phase 12: audited token → middleware → route → response for inconsistencies
- [x] Consolidated `requireAuth`/`requireRole` into `server/src/middleware/auth.js` (deleted duplicate in jwt.js)
- [x] Single token decode path: `decodeToken()` + `attachUser` records `req.authError` (deleted unused `verifyToken`)
- [x] 401 = unauthenticated, 403 = wrong role; envelope `{success:false, error}` everywhere in auth layer
- [x] Fixed logout not deleting cookie (clearCookie carried maxAge:24h)
- [x] Cookie maxAge now derived from `JWT_EXPIRES_IN` (was hard-coded 24h vs 8h token)
- [x] Unified password hashing on `password.service.js` (cost 12; controller used 10)
- [x] Deleted `services/auth.service.js` (divergent issueToken/verifyToken/authenticate)
- [x] Removed dead/broken `register` endpoint (wrote non-existent `first_name/last_name/email` columns)
- [x] Verification: node --check, `npm test` 3/3, smoke script `server/tests/smoke/phase-11-12.verify.js` 50/50
- [x] Updated FIX_PLAN.md (Phase 12 details + Phase 13 preview)

### Next
- None - all 20 phases complete. Optional future work: `git init` (still not a repo) so the `archive/` stashes have a baseline; refresh `2-Week-LMS-Development-Plan.md` if it is used going forward.

## Findings Summary (Phase 11 audit)

### Bugs found & fixed
1. **401 swallowed login errors** - `api.js` redirected to `/login.html` on any 401 *before* reading the body, so a failed sign-in reloaded the page (form cleared, no message). Fixed: read body first, skip redirect for `/auth/login` and when already on the login page.
2. **No client-side role guard** - any visitor could open `/pages/*/index.html`; wrong role saw raw "Insufficient permissions" text. Fixed with `LearnovaApi.requireRole`.
3. **Case-sensitive login redirect** - `result.user.role === 'ADMIN'` with no unknown-role branch meant an unexpected role silently landed on the student dashboard. Fixed with a normalized map + explicit error.
4. **No sign-in link on landing page** - only path to `/login.html` was a failed API call.

### Deferred
- None outstanding. All previously deferred items are resolved: `login.js` (Phase 11), `register` endpoint + `server/config/*` (Phase 12/13), CSS bug (Phase 14), dead client JS (Phase 16).

### Test Output (last run)
```
✔ geofence accepts a point inside the configured radius
✔ geofence rejects a point outside the configured radius
✔ application exports an Express app
ℹ tests 3  ℹ pass 3  ℹ fail 0
```

### Smoke Test (port 3010)
```
/                        -> 200
/login.html              -> 200
/pages/admin/index.html  -> 200
/api/auth/me             -> 401  (drives guard redirect)
/api/csrf-token          -> 200
```
