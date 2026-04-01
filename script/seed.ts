import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const password = process.env.ADMIN_PASSWORD || "FusePro2024!";
  const hashed = await bcrypt.hash(password, 12);

  const userRes = await pool.query(
    `INSERT INTO users (email, password, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
     RETURNING id, email, name, role`,
    ["admin@fusepro.cloud", hashed, "Admin User", "admin"]
  );
  console.log("Admin user:", userRes.rows[0]);

  await pool.query(
    `INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ["company_name", "Fuse Pro Electric"]
  );
  await pool.query(
    `INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ["company_phone", "(224) 313-1004"]
  );
  await pool.query(
    `INSERT INTO admin_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ["tax_rate", "9.25"]
  );

  console.log("Seed complete!");
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
