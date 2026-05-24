import { pool } from "../db/pool.js";

export async function logAudit({ userId, action, resourceType, resourceId, ip, userAgent, details }) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, action, resourceType, resourceId, ip, userAgent, JSON.stringify(details || {})]
  );
}
