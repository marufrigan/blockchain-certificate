import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  try {
    await pool.query(sql);
  } catch (err) {
    // Re-run safe: enums/tables may already exist from a prior partial migrate.
    if (err.code === "42710" || err.code === "42P07") {
      console.log("Database schema already present; migration skipped.");
    } else {
      throw err;
    }
  }
  console.log("Database migration completed successfully.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
