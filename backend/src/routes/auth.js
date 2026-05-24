import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body } from "express-validator";
import { pool } from "../db/pool.js";
import { handleValidation } from "../middleware/validate.js";
import { logAudit } from "../services/audit.js";

const router = Router();

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await pool.query(
        `SELECT u.*, uni.name as university_name, uni.admin_wallet
         FROM users u
         LEFT JOIN universities uni ON u.university_id = uni.id
         WHERE u.email = $1 AND u.is_active = true`,
        [email]
      );
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          universityId: user.university_id,
          walletAddress: user.wallet_address || user.admin_wallet,
        },
        process.env.JWT_SECRET || "dev-secret-change-me",
        { expiresIn: "8h" }
      );

      await logAudit({
        userId: user.id,
        action: "LOGIN",
        resourceType: "user",
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          universityId: user.university_id,
          universityName: user.university_name,
          walletAddress: user.wallet_address || user.admin_wallet,
        },
      });
    } catch (err) {
      console.error("[auth/login]", err);
      res.status(503).json({
        error: "Cannot reach database. Is PostgreSQL running? (brew services start postgresql@16)",
      });
    }
  }
);

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET || "dev-secret-change-me");
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.wallet_address, uni.name as university_name
       FROM users u LEFT JOIN universities uni ON u.university_id = uni.id WHERE u.id = $1`,
      [decoded.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
