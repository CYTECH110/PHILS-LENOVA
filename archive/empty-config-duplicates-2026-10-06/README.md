# Empty config duplicates (archived 2026-10-06, Phase 13)

`server/config/env.js` and `server/config/database.js` were **0-byte** files sitting
next to the real configuration in `server/src/config/`.

Why they existed: `setup-lms.sh` created a flat layout (`server/config`,
`server/controllers`, `server/middleware`, `server/routes`) that the project later
outgrew - the app lives under `server/src/`. The flat directories contained nothing
the app ever required (`server/src/*` resolves `../config/*` to `server/src/config/*`),
so they were dead weight and a trap: any `require('../config/env')` from a file
placed one level too high would have loaded an empty module and silently produced
`undefined` config.

Also removed with them: the empty `server/controllers`, `server/middleware` and
`server/routes` directories. `setup-lms.sh` was updated to create the real layout.

Source of truth: `server/src/config/env.js` (loads `.env`, exposes all values) and
`server/src/config/database.js` (mysql2 pool built from those values).
