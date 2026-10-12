# archive/phase28 - legacy frontend retired 2026-10-12

Moved here (not deleted) because the repo has no git history yet.

## Why it was dead

`server/src/app.js` only serves the built React SPA (`client-react/dist`) plus `/uploads`:

```js
const clientDist = path.join(__dirname, '../../client-react/dist');
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use(express.static(clientDist));
```

No live route, middleware, or script mounted the old `client/` tree any more, so it was
kept only as reference and is now archived. `client-react/` is the single frontend.

## Moved here

| Path | What it was |
|---|---|
| `legacy-client/` | The vanilla HTML/CSS/JS UI (`index.html`, `login.html`, `css/`, `js/`, `pages/{admin,teacher,student}/`, and an empty `uploads/`) |
| `legacy-client-smoke/phase-11-12.verify.js` | Phase 11/12 smoke script; read `client/login.html`, `client/js/api.js`, `client/index.html` |
| `legacy-client-smoke/phase-14.verify.js` | Phase 14 smoke script; parsed `client/css/styles.css` for the `max-OPEOKwidth` corruption fix |

## References audit (nothing live pointed at `client/`)

- `server/src/**`: the only `express.static` mounts are `/uploads` and `client-react/dist` (above). No `client/` mount.
- `client-react/src/**`: only relative `/api/...` calls; no import of the legacy tree.
- Root config/scripts: `eslint.config.js` dropped its `client/js/**` block; `setup-lms.sh` no longer scaffolds `client/`; `package.json` scripts all use `client-react`.

The only remaining `client/` string matches anywhere in the repo are inside this archive
directory (including `legacy-client/js/{api,student}.js` and the two moved smoke scripts).
