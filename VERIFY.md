# VERIFY.md — End-to-End Verification Checklist

Repeatable checklist for the PHILS LEARNOVA LMS. Run the automated parts first, then
walk the manual browser checks once per release candidate.

- **Stack:** Node/Express (MySQL) + React 19 / Vite / Tailwind SPA
- **Entry point:** `server/src/server.js` (boots the HTTP listener; `server/src/app.js` builds the Express app and serves the API plus the built SPA in `client-react/dist`)
- **Default port:** from `.env` `PORT` (defaults to 3000)
- **Automated smoke runner:** `scripts/smoke-check.ps1`

---

## 0. Prerequisites

- [ ] Node.js installed (`node --version`)
- [ ] MySQL running and the `smartclass` schema imported (`database/schema.sql`)
- [ ] Seed loaded (`database/seeders/001_development_seed.sql`)
- [ ] `.env` exists (copy from `.env.example`, set `JWT_SECRET`)
- [ ] `node_modules` present

`npm install` is only a no-op when this repo was already provisioned with
`node_modules`. On a clean clone run:

```powershell
npm install --no-audit --no-fund
```

---

## 1. Automated checks

Run from the repo root.

- [ ] **Tests pass**

  ```powershell
  npm test
  ```
  Expected: `pass 68`, `fail 0` (auth/account lifecycle, quiz/question lifecycle, email, report service, geofence, health, guard tests, plus the Phase 29 route suites: `authorization`, `admin.routes`, `teacher.routes`, `student.routes`, `report.routes`).

- [ ] **Client lint + production build** (added in Phase 28)

  ```powershell
  npm run client:lint    # oxlint, expected exit code 0
  npm run build          # vite build -> client-react/dist
  ```
  The build is required before `npm start` serves the SPA. `npm run verify` runs
  `lint`, `client:lint`, `build`, and `test` in sequence.

- [ ] **Lint passes** (added in Phase 15)

  ```powershell
  npm run lint
  ```
  Expected: no output after the command banner, exit code `0`.

- [ ] **Format check** (added in Phase 15)

  ```powershell
  npm run format
  ```
  This is the prettier *check* command (`format:write` performs the rewrite).
  Expected: exit code `1` and `Code style issues found in N files` — this is the
  intentionally-unformatted baseline from Phase 15, **not** a regression. Only a new
  error indicating an unreadable/invalid file matters.

- [ ] **PowerShell smoke runner** (Phase 18)

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\smoke-check.ps1
  ```
  Boots the app on an ephemeral test port, probes health/CSRF/auth guards, prints
  `PASS`/`FAIL` per check, then stops the server. Expected: `ALL PASS`, exit code `0`.
  Options: `-Port 3017` (override) and `-KeepRunning` (leave the server up for manual
  testing).

- [ ] **Regression smoke scripts** (self-booting: each starts the app on an ephemeral port)

  ```powershell
  node server\tests\smoke\phase-13.verify.js   # config/env alignment
  node server\tests\smoke\phase-24.verify.js   # quiz/question lifecycle   expected 53/53
  node server\tests\smoke\phase-25.verify.js   # account lifecycle        expected 35/35
  node server\tests\smoke\phase-26.verify.js   # email delivery           expected 21/21
  node server\tests\smoke\phase-27.verify.js   # reports (csv/xlsx/pdf)   expected 14/14
  node server\tests\smoke\phase-28.verify.js   # SPA serving + build      expected 27/27
  ```

- [ ] **Database migrations apply cleanly** (added in Phase 30)

  ```powershell
  npm run migrate        # applies database/migrations/*.sql in order
  npm run migrate        # second run: "Database is up to date."
  ```

- [ ] **Health / readiness endpoints** (added in Phase 30)

  ```powershell
  # with the app running
  curl http://localhost:3000/api/health          # 200 {"status":"ok"}
  curl http://localhost:3000/api/health/ready    # 200 {"status":"ready",checks:{database:"ok"}}
  ```
  The response also carries a strict `Content-Security-Policy` header.

- [ ] **CI workflow present** (added in Phase 29)

  `.github/workflows/ci.yml` runs the same gates remotely: a `server` job (MySQL 8.0 service →
  load schema + seed → `npm run lint` → `npm test`) and a `client` job (`npm run client:lint` →
  `npm run build`) on pushes and pull requests.

---

## 2. Manual browser checks

Start the app and open it:

```powershell
npm start
```

Open `http://localhost:3000` (or your configured `PORT`) in a browser with DevTools open
(Console + Network tabs).

### 2.1 Login as ADMIN / TEACHER / STUDENT works

- [ ] Visit `/` → the SPA redirects to `/login` with the sign-in form
- [ ] Sign in as each role (seeded users: `admin`, `teacher.demo`, `student.demo`).
      All three share one bcrypt hash — use the password the seed was generated with.
      If you do not know it, reset one locally (cost 12, matching the app):

      ```powershell
      node -e "require('bcrypt').hash('LearNova#2026',12).then(h=>console.log(h))"
      ```
      then `UPDATE users SET password_hash='<hash>' WHERE username='admin';` in MySQL.
- [ ] After sign-in you land on the matching dashboard:
      `admin → /admin`, `teacher → /teacher`, `student → /student`
- [ ] Wrong password shows the server message **"Invalid username or password."** on the
      page (it must **not** reload the page)
- [ ] Opening the wrong dashboard for a role (e.g. a student opening `/admin`)
      redirects to that role's own home instead of rendering a raw error

### 2.2 Admin dashboard

- [ ] Admin dashboard loads without console errors
- [ ] Metrics tiles populate (`GET /api/admin/dashboard`)
- [ ] **Courses** table lists courses (`GET /api/admin/courses`)
- [ ] No-`/api/api` check: Network tab has clean `/api/admin/...` URLs
- [ ] **Users** table lists users (`GET /api/admin/users`) with role and status; admin can
      create, edit (including activate/deactivate), and deactivate users. Deactivate is a
      soft delete — the row is kept and set to `INACTIVE` so audit history survives.

### 2.3 Teacher dashboard

- [ ] Teacher dashboard loads without console errors
- [ ] Assigned **courses** and **classes** render (`GET /api/teacher/dashboard`)
- [ ] **Your quizzes** table renders (`GET /api/teacher/quizzes`)

### 2.4 Student dashboard + quiz flow (the Phase 5 fix)

- [ ] Student dashboard loads without console errors
- [ ] Available **quizzes** render (`GET /api/student/quizzes`) and **history** renders
      (`GET /api/student/history`)
- [ ] Click a quiz → the quiz runner opens inside the student dashboard
- [ ] Grant/deny the browser geolocation prompt, enter the access code if prompted
- [ ] Questions render (`POST /api/student/quizzes/:id/start`) — this call must **not**
      crash even when `answer_data` is missing/blank (the guarded `JSON.parse` fix from Phase 5)
- [ ] Answer and **Submit quiz** → result appears, no console error
      (`POST /api/student/attempts/:id/submit`)
- [ ] The attempt shows up in **history** after reload

### 2.5 Reports

- [ ] Signed in as **admin**, open the **Reports** tab and download each report as CSV / Excel / PDF
- [ ] Or by URL: `GET /api/reports/{attempts,quizzes,students}.{csv,xlsx,pdf}`
      (e.g. `curl -b cookie.txt http://localhost:3000/api/reports/attempts.csv -o attempts.csv`)
- [ ] CSV has header row `Attempt,Student,Quiz,Course,Score,Status,Passed,Started At,Submitted At`;
      Excel downloads a real `.xlsx`; PDF downloads a real `.pdf`
- [ ] Signed in as **teacher**, the Reports tab only includes your own quizzes; **student** gets 403

---

## 3. Cross-cutting sanity checks

- [ ] **No `/api/api` in the network tab.** Requests must look like `/api/auth/me`, not
      `/api/api/auth/me`. (The SPA calls relative `/api/...` paths from `client-react/src/lib/api.js`.)
- [ ] **SPA deep links work on reload.** Refreshing `/admin`, `/teacher`, `/student`, or
      `/reset-password` returns the app shell (server SPA fallback), not a 404.
- [ ] **No console errors on any screen** (login, admin / teacher / student dashboards)
- [ ] **Logout works**: click Sign out → `/api/auth/logout` clears the cookie; visiting a
      protected route afterwards redirects back to `/login`

---

## 4. Endpoint reference (what each page actually calls)

| Screen | Method + path | Auth |
|---|---|---|
| Landing | `GET /` | public |
| Login | `POST /api/auth/login`, `GET /api/auth/me` | CSRF + public |
| CSRF token | `GET /api/csrf-token` | public |
| Admin dashboard | `GET /api/admin/dashboard`, `GET /api/admin/courses` | ADMIN |
| Create user | `POST /api/admin/users` | ADMIN |
| Teacher dashboard | `GET /api/teacher/dashboard` | TEACHER |
| Teacher quizzes | `GET /api/teacher/quizzes` | TEACHER |
| Student dashboard | `GET /api/student/dashboard`, `GET /api/student/quizzes` | STUDENT |
| Start quiz | `POST /api/student/quizzes/:id/start` | STUDENT |
| Submit quiz | `POST /api/student/attempts/:id/submit` | STUDENT |
| History | `GET /api/student/history` | STUDENT |
| Reports (CSV/Excel/PDF) | `GET /api/reports/{attempts,quizzes,students}.{csv,xlsx,pdf}` | ADMIN, TEACHER (scoped) |
| Health | `GET /api/health` | public |
| Liveness | `GET /api/health/live` | public |
| Readiness | `GET /api/health/ready` | public |

Notes:
- `/api/auth`, `/api/admin`, `/api/teacher`, `/api/student`, `/api/reports` are all
  CSRF-protected on non-GET requests (send `x-csrf-token` matching the `learnova_csrf` cookie).
- Auth failures: **401** = not signed in, **403** = signed in with the wrong role.