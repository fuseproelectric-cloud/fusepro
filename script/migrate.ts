/**
 * Standalone migration CLI — delegates to server/lib/run-migrations.ts.
 *
 * Usage:
 *   npm run db:migrate
 *   DATABASE_URL=postgres://... npx tsx script/migrate.ts
 *
 * Exits 0 on success, 1 on any failure.
 */

import { runMigrations } from "../server/lib/run-migrations";

runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
