-- Least-privilege database users for PHILS LEARNOVA.
--
-- Run this once as a MySQL administrator (e.g. root) and REPLACE every
-- password placeholder before executing. Then point the app/.env at the
-- application user (`DB_USER`/`DB_PASSWORD`) so the API never runs as root.
--
--   mysql --user=root < database/create-app-user.sql
--
-- The application user gets data access only. DDL (schema migrations) is
-- reserved for the migration user, which is used solely by `npm run migrate`.

-- ---------------------------------------------------------------------------
-- Application user: DML only.
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'learnova_app'@'%' IDENTIFIED BY 'REPLACE_WITH_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON smartclass.* TO 'learnova_app'@'%';

-- ---------------------------------------------------------------------------
-- Migration user: DML + DDL. Used only by the migration runner.
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'learnova_migrate'@'%' IDENTIFIED BY 'REPLACE_WITH_MIGRATE_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON smartclass.* TO 'learnova_migrate'@'%';

FLUSH PRIVILEGES;
