/**
 * runMigrations()
 *
 * Core migration logic, shared by:
 *   - server/index.ts  (enforced at startup — app cannot start if migrations fail)
 *   - script/migrate.ts (standalone CLI runner for deploy pipelines)
 *
 * Behaviour:
 *   1. Creates _migrations tracking table (idempotent, IF NOT EXISTS).
 *   2. Reads *.sql files from migrations/ in alphabetical order.
 *   3. Skips files already recorded in _migrations.
 *   4. Applies each pending file inside a transaction; records on success.
 *   5. Throws on the first failure — callers decide whether to exit.
 *
 * Path resolution:
 *   Uses process.cwd()/migrations so it works regardless of whether the
 *   caller is a source file (dev/tsx) or a compiled dist bundle (prod).
 *   The server is always started from the project root directory.
 */

import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT        PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("[MIGRATE] DATABASE_URL is not set.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(CREATE_TRACKING_TABLE);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("[MIGRATE] No migration files found — nothing to apply.");
      return;
    }

    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM _migrations ORDER BY name",
    );
    const applied = new Set(rows.map(r => r.name));

    let pendingCount = 0;

    for (const file of files) {
      if (applied.has(file)) continue;

      pendingCount++;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

      console.log(`[MIGRATE] Applying ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[MIGRATE] Done    ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(
          `[MIGRATE] Failed at ${file}: ${(err as Error).message}`,
        );
      }
    }

    if (pendingCount === 0) {
      console.log("[MIGRATE] All migrations already applied.");
    } else {
      console.log(`[MIGRATE] ${pendingCount} migration(s) applied successfully.`);
    }
  } finally {
    await client.end();
  }
}
