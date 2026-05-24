import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

async function seed() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  await pool.query(`
    INSERT INTO universities (name, code, admin_wallet)
    VALUES
      ('Metropolitan State University', 'MSU', '0x0000000000000000000000000000000000000001'),
      ('Pacific Institute of Technology', 'PIT', '0x0000000000000000000000000000000000000002')
    ON CONFLICT (code) DO NOTHING
  `);

  const uniResult = await pool.query(`SELECT id FROM universities WHERE code = 'MSU' LIMIT 1`);
  const universityId = uniResult.rows[0]?.id;

  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, university_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    ["superadmin@trustcert.edu", passwordHash, "System Super Admin", "SUPER_ADMIN", null]
  );

  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, university_id, wallet_address)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING`,
    [
      "admin@msu.edu",
      passwordHash,
      "MSU Registrar",
      "UNIVERSITY_ADMIN",
      universityId,
      "0x0000000000000000000000000000000000000001",
    ]
  );

  console.log("Seed data inserted.");
  console.log("Default credentials: superadmin@trustcert.edu / Admin@123");
  console.log("University admin: admin@msu.edu / Admin@123");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
