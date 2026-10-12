# PHILS LEARNOVA

A migration of the Learnova ASP.NET Web Forms learning management system into a React + Node.js application.

## Stack

- Frontend: React 19 + Vite 8 + Tailwind CSS v4 (SPA in `client-react/`)
- Backend: Node.js and Express
- Database: MySQL or MariaDB

## Legacy functionality mapped

- Admin dashboard, course management, teacher/student accounts, and assignments
- Teacher quiz creation, publishing, question banks, and statistics
- Student course browsing, access codes, quiz attempts, grades, and history
- New class management, class membership, quiz scheduling, question types, randomization, and classroom geofencing

## Start locally

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set database values (and a strong `JWT_SECRET` for production).
4. Create the database using `database/schema.sql` (or run `setup-smartclass-db.ps1` on Windows).
5. Install and build the frontend: `npm run client:install` then `npm run build`.
6. Run `npm run dev` (API + SPA on one port).
7. Open `http://localhost:3000`.

For frontend development with HMR, run `npm run client:dev` (Vite on `:5173`, proxies `/api` to `:3000`) alongside `npm run dev`.

## Test, lint, format

```powershell
npm run build         # vite build -> client-react/dist (required before npm start)
npm run client:install # install client-react dependencies
npm run client:dev    # Vite dev server with HMR (:5173)
npm run client:lint   # oxlint the React app
npm test              # node:test unit + integration smoke (68 tests)
npm run migrate       # apply database/migrations/*.sql in order (idempotent)
npm run lint          # ESLint 10 flat config
npm run lint:fix      # apply autofixes
npm run verify        # lint + client:lint + build + test
npm run format:check  # prettier --check (alias: npm run format)
npm run format:write  # prettier --write
```

End-to-end verification: see `VERIFY.md` for the manual checklist, or run the scripted
probe which boots the app, checks health/auth guards, and exits non-zero on failure:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-check.ps1
```

Server-dependent regression scripts live in `server/tests/smoke/` (they are intentionally
outside the `npm test` glob because they need a running server on a fixed port).

CI (`.github/workflows/ci.yml`) runs on pushes and pull requests: a `server` job brings up a
MySQL 8.0 service, loads `database/schema.sql` + the development seed, then runs `npm run lint`
and `npm test`; a `client` job runs `npm run client:lint` and `npm run build` for the SPA.

## Email

Email is optional and off by default. Set `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` in `.env`
(plus `SMTP_PORT`/`SMTP_SECURE` and `EMAIL_FROM`) to enable delivery; leave `SMTP_HOST` empty to
disable it. Delivery is always disabled under `NODE_ENV=test`, so the suite never needs a mail
server. Sends are best-effort: failures are logged and never fail the API request. Password-reset
links use `${APP_BASE_URL}/reset-password?token=...`.

## Project areas

- `client-react/`: React + Vite SPA — **the only frontend**; `server/src/app.js` serves its build (`client-react/dist`)
- `server/`: Express application, API routes, middleware, and tests
- `database/`: schema (`schema.sql`) and development seed data
- `archive/`: removed code kept for audit trail (no git history); the retired vanilla UI lives in `archive/phase28/legacy-client/`

Rebuild the frontend after UI changes: `npm run build`.

## API overview

Authentication uses JWTs in secure HTTP-only cookies and a CSRF double-submit token.

- `GET /api/health`, `GET /api/health/live`, `GET /api/health/ready` (unauthenticated)
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PUT /api/auth/profile`, `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET /api/admin/dashboard`
- `GET|POST|PUT|DELETE /api/admin/courses`
- `GET|POST /api/admin/classes`, `GET|PUT /api/admin/classes/:id`
- `POST /api/admin/users`, `GET /api/admin/users`, `PUT|DELETE /api/admin/users/:id`
- `GET /api/admin/allocations`
- `POST /api/admin/allocations/students`
- `POST /api/admin/allocations/teachers`
- `POST /api/admin/allocations/courses`
- `DELETE /api/admin/allocations/students/:studentId/classes/:classId`
- `DELETE /api/admin/allocations/teachers/:teacherId/classes/:classId`
- `DELETE /api/admin/allocations/courses/:teacherId/courses/:courseId`
- `GET /api/admin/audit-logs`
- `GET /api/teacher/dashboard`
- `GET|POST /api/teacher/question-bank`, `PUT|DELETE /api/teacher/question-bank/:id`
- `GET|POST /api/teacher/quizzes`, `GET|PUT|DELETE /api/teacher/quizzes/:id`
- `POST /api/teacher/quizzes/:id/questions`, `DELETE /api/teacher/quizzes/:id/questions/:questionId`
- `POST /api/teacher/quizzes/:id/publish`
- `POST /api/teacher/quizzes/:id/close`
- `GET /api/teacher/quizzes/:id/statistics`
- `GET /api/student/dashboard`, `GET /api/student/quizzes`, `GET /api/student/history`
- `POST /api/student/quizzes/:id/start`
- `POST /api/student/attempts/:id/location`
- `POST /api/student/attempts/:id/submit`
- `GET /api/reports/{attempts,quizzes,students}.{csv,xlsx,pdf}` for admins and teachers (teachers scoped to their own quizzes)

## Database

Run `database/schema.sql` for a clean database. `database/seeders/001_development_seed.sql` holds the development seed template; generate real bcrypt hashes before using seed data.

The schema includes users, courses, classes, student/teacher allocations, quizzes, class-scoped quiz access, question banks, attempts, per-question answers, geofence checks, and audit logs. Foreign keys, unique attempt constraints, and indexes protect integrity.

Forward changes live in `database/migrations/` and are applied in filename order by
`npm run migrate` (tracked in a `schema_migrations` table, safe to re-run). See
`database/migrations/README.md`. Create a least-privilege app user with
`database/create-app-user.sql` so the API never connects as root.

## Deployment

PHILS LEARNOVA is a single Node/Express process that serves both the API and the built
SPA (`client-react/dist`). A MySQL/MariaDB database is the only required external service;
Redis and SMTP are optional.

### Environment matrix

| Variable | Required | Default | Production guidance |
|---|---|---|---|
| `NODE_ENV` | recommended | `development` | Set to `production` (enables fail-fast validation, Secure cookies, HTTPS upgrade) |
| `PORT` | no | `3000` | Usually provided by the host |
| `CLIENT_ORIGIN` | prod | `http://localhost:3000` | The HTTPS origin of the SPA (no localhost in prod) |
| `APP_BASE_URL` | no | `CLIENT_ORIGIN` | Public https URL used in email links |
| `TRUST_PROXY` | yes behind proxy | `1` in prod else `false` | Set to the number of proxy hops (e.g. `1`) |
| `COOKIE_SECURE` | prod | `true` in production | Must stay `true` (auth cookie over HTTPS only) |
| `JWT_SECRET` | yes (prod) | dev placeholder | ≥32 random chars; boot fails otherwise |
| `JWT_EXPIRES_IN` | no | `8h` | Token/cookie lifetime |
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | yes | localhost, `root` | Use a **least-privilege** user |
| `DB_CONNECTION_LIMIT` | no | 10 | Pool size (size to the DB host) |
| `REDIS_URL` | no | `redis://localhost:6379` | Optional cache; app degrades gracefully when absent |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | no | 900000 / 600 / 100 | Per-IP limits (mutations / auth) |
| `REQUEST_BODY_LIMIT` | no | 1mb | JSON/urlencoded body cap |
| `SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASS`, `EMAIL_FROM` | no | disabled | Enables password-reset + welcome email |

### Hosting

- **Database:** managed MySQL 8 / MariaDB (or self-hosted). Create the schema, then the
  least-privilege user (`database/create-app-user.sql`) and point `DB_*` at it.
- **Backend + SPA:** deploy the repo to any Node 20+ host (Render, Railway, Fly, a VM with
  PM2/systemd, a container). The Express server serves `client-react/dist`, so by default the
  SPA and API share one origin — the simplest and recommended setup.
- **Separate static/SPA host (optional):** host `client-react/dist` on a CDN/static host and set
  `CLIENT_ORIGIN` to that origin (CORS already allows it with credentials). Prefer a same-site
  subdomain so the `SameSite=Strict` auth cookie is still sent.
- **Redis (optional):** a managed Redis instance; set `REDIS_URL`. Caching degrades gracefully
  when it is unreachable.

### Deploy steps

```powershell
npm ci                                    # server deps
npm ci --prefix client-react              # SPA deps
npm run build                             # -> client-react/dist (required before start)
npm run migrate                           # apply pending database migrations

$env:NODE_ENV='production'; $env:PORT='3000'   # plus DB_*/JWT_SECRET/CLIENT_ORIGIN/TRUST_PROXY
npm start                                 # node server/src/server.js
```

Terminate TLS at the reverse proxy, set `TRUST_PROXY` to the number of proxy hops, and keep
`COOKIE_SECURE=true`. Liveness: `GET /api/health`; readiness (checks the database):
`GET /api/health/ready`. The server shuts down gracefully on `SIGTERM`/`SIGINT` (drains HTTP,
then closes the MySQL pool and Redis).

- Passwords are hashed with bcrypt; plaintext migration is intentionally not supported.
- Correct answers are loaded and graded on the server.
- Every role API uses authentication and role middleware.
- Teacher quiz operations re-check creator ownership.
- Student quiz access requires class membership and published/scheduled status.
- Mutating requests require a CSRF token.
- Helmet security headers include a strict Content-Security-Policy (no inline scripts); CORS,
  parameterized SQL, and centralized errors are enabled.
- Rate limiting is applied to every mutating API route, with a stricter cap on the auth endpoints.
- Request bodies are size-limited (`REQUEST_BODY_LIMIT`, default 1 MB; uploads 5 MB).
- `trust proxy` is configurable and auth cookies are `HttpOnly`, `SameSite=Strict`, and `Secure`
  in production.
- Geofence checks are logged and use server-side distance calculations.
- Password reset uses single-use, 1-hour tokens and a non-enumerating response; profile emails are unique.
- Production fails fast on a missing/default `JWT_SECRET`, a localhost origin, an empty
  `DB_PASSWORD`, or disabled secure cookies; use HTTPS, a restricted `CLIENT_ORIGIN`, and a
  least-privilege database user (`database/create-app-user.sql`).

## Testing and deployment

Run `npm test` for the test suite and `node --check` on JavaScript files when adding scripts. Use Visual Studio Code, Node.js 20+, MySQL/MariaDB, and a process manager such as systemd, PM2, or a container in production. Put a reverse proxy with HTTPS in front of Express and back up the database before migrations.

Known limitations: short-answer/fill-blank and true/false grading is normalized text matching (trim, collapse whitespace, case-insensitive); browser geolocation can be spoofed or denied and must be treated as an additional control; report exports are capped at 5000 attempts per file; email is best-effort and disabled unless SMTP is configured (password-reset and welcome messages are composed and sent when enabled). The full phase-by-phase changelog and fixes are in `FIX_PLAN.md`; the current session status is in `TODO_NOW.md`.
