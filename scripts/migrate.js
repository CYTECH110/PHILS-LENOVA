#!/usr/bin/env node
/**
 * Ordered migration runner.
 *
 * Applies every `database/migrations/*.sql` file in filename order and records
 * each applied file in a `schema_migrations` table so re-runs are a no-op.
 * Migrations are also written to be idempotent, so this is safe to run on an
 * existing database.
 *
 *   npm run migrate
 *
 * Connection settings come from server config (`config/env.js` → `.env`).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = require('../server/src/config/env');

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

async function main() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (!files.length) {
    console.log('No migration files found.');
    return;
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true
  });

  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const [rows] = await connection.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.filename));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip   ${file}`);
        continue;
      }
      console.log(`apply  ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      count += 1;
    }

    console.log(count ? `Applied ${count} migration(s).` : 'Database is up to date.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
