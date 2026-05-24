import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { getMetrics, exportMetrics } from "../services/metrics.js";

const router = Router();

router.get("/", authenticate, requireRole("SUPER_ADMIN", "UNIVERSITY_ADMIN"), (req, res) => {
  res.json({ metrics: getMetrics({ action: req.query.action }) });
});

router.post("/export", authenticate, requireRole("SUPER_ADMIN"), async (req, res) => {
  const format = req.body.format === "csv" ? "csv" : "json";
  const result = await exportMetrics(format);
  res.json(result);
});

export default router;
