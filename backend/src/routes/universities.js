import { Router } from "express";
import { body } from "express-validator";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { handleValidation } from "../middleware/validate.js";
import { logAudit } from "../services/audit.js";
import { getContractAddress, getChainId } from "../services/blockchain.js";

const router = Router();

router.get("/", authenticate, async (req, res) => {
  const result = await pool.query(`SELECT * FROM universities WHERE is_active = true ORDER BY name`);
  res.json({ universities: result.rows });
});

router.post(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN"),
  [
    body("name").trim().notEmpty(),
    body("code").trim().isLength({ min: 2, max: 50 }),
    body("adminWallet").matches(/^0x[a-fA-F0-9]{40}$/),
  ],
  handleValidation,
  async (req, res) => {
    const { name, code, adminWallet } = req.body;
    const result = await pool.query(
      `INSERT INTO universities (name, code, admin_wallet) VALUES ($1, $2, $3) RETURNING *`,
      [name, code, adminWallet]
    );
    await logAudit({
      userId: req.user.id,
      action: "REGISTER_UNIVERSITY",
      resourceType: "university",
      resourceId: result.rows[0].id,
      ip: req.ip,
      details: { adminWallet },
    });
    res.status(201).json({
      university: result.rows[0],
      contractAddress: getContractAddress(),
      chainId: getChainId(),
      note: "Register admin wallet on-chain via registerUniversity() using Super Admin MetaMask",
    });
  }
);

router.post(
  "/confirm-registration",
  authenticate,
  requireRole("SUPER_ADMIN"),
  [body("universityId").isUUID(), body("txHash").matches(/^0x[a-fA-F0-9]{64}$/)],
  handleValidation,
  async (req, res) => {
    const uni = await pool.query(`SELECT * FROM universities WHERE id = $1`, [req.body.universityId]);
    if (!uni.rows[0]) return res.status(404).json({ error: "University not found" });
    await logAudit({
      userId: req.user.id,
      action: "UNIVERSITY_ONCHAIN_REGISTERED",
      resourceType: "university",
      resourceId: req.body.universityId,
      details: { txHash: req.body.txHash },
    });
    res.json({ success: true, txHash: req.body.txHash });
  }
);

export default router;
