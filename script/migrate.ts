/**
 * Migration runner for hand-written SQL migrations in migrations/.
 *
 * Usage:
 *   npx tsx script/migrate.ts          # apply all pending migrations
 *   npm run db:migrate                  # same via package.json script
 *
 * How it works:
 *   1. Creates a `_migrations` tracking table if it doesn't exist.
 *   2. Reads all *.sql files from migrations/ in alphabetical order.
 *   3. Skips any migration already recorded in `_migrations`.
 *   4. Applies each pending migration in a transaction; records it on success.
 *   5. Aborts on the first failure — does NOT silently skip errors.
 *
 * All existing migrations use IF NOT EXISTS / ON CONFLICT DO NOTHING guards
 * for their core DDL, but some (e.g. ADD CONSTRAINT) are NOT idempotent.
 * The tracking table ensures each migration runs exactly once.
 *
 * This script must be run before starting the server after each deploy that
 * includes new migration files. The critical missing migration is:
 *   0003_numbering_sequences.sql  → creates job_number_seq + invoice_number_seq
 */

import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT        PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Ensure tracking table exists.
    await client.query(CREATE_TRACKING_TABLE);

    // Collect SQL files sorted alphabetically (i.e. 0001, 0002, ...).
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found in migrations/.");
      return;
    }

    // Load already-applied migrations.
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM _migrations ORDER BY name",
    );
    const applied = new Set(rows.map(r => r.name));

    let pendingCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  [skip]  ${file}`);
        continue;
      }

      pendingCount++;
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`  [apply] ${file} ...`);

      // Run migration + tracking insert in a single transaction so a partial
      // failure leaves neither the migration half-applied nor a false record.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (name) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`          OK`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`          FAILED: ${(err as Error).message}`);
        console.error(`\nMigration runner aborted. Fix the error above and re-run.`);
        process.exit(1);
      }
    }

    if (pendingCount === 0) {
      console.log("All migrations already applied. Nothing to do.");
    } else {
      console.log(`\n${pendingCount} migration(s) applied successfully.`);
    }
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error("Migration runner error:", err);
  process.exit(1);
});
