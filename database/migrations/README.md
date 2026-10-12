# Database migrations

Ordered, append-only SQL applied after the base schema (`database/schema.sql`).

## Apply

Use the runner (recommended). It records applied files in a `schema_migrations`
table and skips them on re-runs:

```powershell
npm run migrate
```

The runner connects with the same `.env` values as the app and applies every
`*.sql` file in this directory in **filename order** (`001_...`, `002_...`, …).
Each file is also written idempotently, so applying it twice is safe.

## Add a migration

1. Create a new file with the next zero-padded number and a short slug, e.g.
   `003_quiz_attempt_ip.sql`.
2. Write idempotent SQL (guard `ALTER`/`CREATE` with `information_schema`
   checks, or use `CREATE TABLE IF NOT EXISTS`).
3. Start the file with `USE smartclass;`.
4. Run `npm run migrate`.

## Manual / ordered apply

Without the runner, apply the files in order with the MySQL client:

```powershell
mysql --user=root smartclass < database\migrations\002_users_email.sql
```

## Privileges

Table DML (SELECT/INSERT/UPDATE/DELETE) is all the **application** user needs;
DDL (CREATE/ALTER/INDEX/DROP) is only needed by the **migration** user. See
`database/create-app-user.sql` for a least-privilege setup template.

## Existing migrations

| File | Adds |
|---|---|
| `002_users_email.sql` | `users.email` (+ unique index) and `password_reset_tokens` (Phase 25). Already part of `database/schema.sql`, so it is a no-op on a fresh install. |
