# archive/phase16 - dead code removed 2026-10-06

Moved here (not deleted) because the repo has no git history yet.

| File | Why it was dead |
|---|---|
| `client-js-admin.js` (3599 b) | No `<script src="/js/admin.js">` in any HTML page. Calls removed endpoints (`getUsers`/`deleteUser`) and renders schema columns that do not exist. Admin page ships its own inline script. |
| `client-js-teacher.js` (3895 b) | No `<script src="/js/teacher.js">` in any HTML page. Teacher page ships its own inline script. |
| `20-Phase-LMS-Development-Procedure.md.0bytes` | 0-byte placeholder, never written. Renamed with `.0bytes` suffix so it cannot be confused with a live document. |

## Also removed in this phase (0-byte placeholders, not archived)

`.gitkeep` files whose directories now contain real files:

- `server/src/controllers/.gitkeep`
- `server/src/services/.gitkeep`
- `server/src/validators/.gitkeep`
- `database/seeders/.gitkeep`

(`archive/postgres-conflict-2026-10-05/migrations/.gitkeep` was left alone - it is part of an archived snapshot.)

## Audited and confirmed LIVE (nothing to do)

- `server/src/services/auth.service.js` - already deleted in Phase 12; zero references to `auth.service` remain.
- `server/src/validators/common.js` - required by `admin`, `student`, `teacher` controllers.
- All 4 services (`audit`, `geofence`, `password`, `quiz`) - each imported by at least one controller.
- All 6 route files - mounted in `server/src/app.js`; all 5 controllers required by their routes.
- `client/js/{api,app,student}.js` - referenced by `client/index.html`, `client/login.html`, `client/pages/{admin,student,teacher}/*.html`.
- `*.bak` / `*.old` / `*.orig` / `*.tmp` - none found anywhere.
- `course.controller` / `assessment` / `enrollment` grep hits: only inside this archive tree (Phase 1 conflict stash) plus the live `client/pages/student/quiz.html` (quiz UI text).
