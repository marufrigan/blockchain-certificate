import { Router } from "express";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", authenticate, requireRole("UNIVERSITY_ADMIN", "SUPER_ADMIN"), async (req, res) => {
  const uniFilter = req.user.role === "UNIVERSITY_ADMIN" ? "WHERE university_id = $1" : "";
  const params = req.user.role === "UNIVERSITY_ADMIN" ? [req.user.universityId] : [];

  const [total, byStatus, recentTx] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int as count FROM certificates ${uniFilter}`, params),
    pool.query(
      `SELECT status, COUNT(*)::int as count FROM certificates ${uniFilter} GROUP BY status`,
      params
    ),
    pool.query(
      `SELECT action, COUNT(*)::int as count, AVG(confirmation_time_ms)::int as avg_confirmation_ms
       FROM blockchain_transactions ${uniFilter ? "WHERE certificate_id IN (SELECT certificate_id FROM certificates " + uniFilter + ")" : ""}
       GROUP BY action`,
      params
    ),
  ]);

  res.json({
    totalCertificates: total.rows[0]?.count || 0,
    byStatus: byStatus.rows,
    blockchainMetrics: recentTx.rows,
  });
});

export default router;
