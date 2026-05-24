import { Router } from "express";
import multer from "multer";
import { body, param } from "express-validator";
import { pool } from "../db/pool.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { handleValidation } from "../middleware/validate.js";
import {
  verifyOnChain,
  getOnChainHistory,
  waitForTransaction,
  hashCertificateContent,
  getContractAddress,
  getChainId,
} from "../services/blockchain.js";
import { uploadToIpfs, publicIpfsDocumentUrl, isPinataConfigured } from "../services/ipfs.js";
import { logAudit } from "../services/audit.js";
import { recordMetric } from "../services/metrics.js";

const router = Router();

/** Lazy-load: top-level `qrcode` import can hang 30s+ on some macOS setups. */
async function qrDataUrl(text) {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(text);
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function saveBlockchainTx({
  certificateId,
  txHash,
  action,
  status,
  gasUsed,
  gasPrice,
  blockNumber,
  confirmationTimeMs,
  fromAddress,
  errorMessage,
}) {
  await pool.query(
    `INSERT INTO blockchain_transactions
     (certificate_id, tx_hash, action, status, gas_used, gas_price, block_number, confirmation_time_ms, network, from_address, error_message, confirmed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $12::tx_status = 'CONFIRMED'::tx_status THEN NOW() ELSE NULL END)`,
    [
      certificateId,
      txHash,
      action,
      status,
      gasUsed,
      gasPrice,
      blockNumber,
      confirmationTimeMs,
      process.env.NETWORK_NAME || "amoy",
      fromAddress,
      errorMessage,
      status,
    ]
  );
}

async function addCertificateHistory({ certificateId, relatedId, action, oldStatus, newStatus, reason, userId, wallet }) {
  await pool.query(
    `INSERT INTO certificate_history (certificate_id, related_certificate_id, action, old_status, new_status, reason, performed_by, wallet_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [certificateId, relatedId, action, oldStatus, newStatus, reason, userId, wallet]
  );
}

// Confirm on-chain tx and sync DB (client signs tx via MetaMask, then submits hash)
router.post(
  "/confirm",
  authenticate,
  requireRole("UNIVERSITY_ADMIN", "SUPER_ADMIN"),
  [
    body("certificateId").trim().notEmpty(),
    body("txHash").matches(/^0x[a-fA-F0-9]{64}$/),
    body("action").isIn(["ISSUE", "REVOKE", "REPLACE"]),
    body("metadata").isObject(),
  ],
  handleValidation,
  async (req, res) => {
    const { certificateId, txHash, action, metadata } = req.body;
    const startConfirm = Date.now();

    try {
      const txResult = await waitForTransaction(txHash);
      const { receipt, confirmationTimeMs, gasUsed, gasPrice, blockNumber, status } = txResult;

      if (status !== "CONFIRMED") {
        await saveBlockchainTx({
          certificateId,
          txHash,
          action,
          status: "FAILED",
          fromAddress: metadata.issuerWallet,
          errorMessage: "Transaction failed on chain",
        });
        return res.status(400).json({ error: "Blockchain transaction failed" });
      }

      await saveBlockchainTx({
        certificateId,
        txHash,
        action,
        status: "CONFIRMED",
        gasUsed,
        gasPrice,
        blockNumber,
        confirmationTimeMs,
        fromAddress: metadata.issuerWallet,
      });

      recordMetric({
        action,
        certificateId,
        txHash,
        gasUsed,
        confirmationTimeMs,
      });

      if (action === "ISSUE") {
        await pool.query(
          `INSERT INTO certificates (
            certificate_id, student_name, student_id, degree, department, issue_date,
            issuer_wallet, certificate_hash, ipfs_cid, status, previous_certificate_id,
            version_number, university_id, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10,$11,$12,$13)
          ON CONFLICT (certificate_id) DO UPDATE SET
            status = 'ACTIVE', updated_at = NOW()`,
          [
            certificateId,
            metadata.studentName,
            metadata.studentId,
            metadata.degree,
            metadata.department,
            metadata.issueDate,
            metadata.issuerWallet,
            metadata.certificateHash,
            metadata.ipfsCid,
            metadata.previousCertificateId || null,
            metadata.versionNumber || 1,
            req.user.universityId,
            req.user.id,
          ]
        );
        await addCertificateHistory({
          certificateId,
          action: "ISSUED",
          newStatus: "ACTIVE",
          userId: req.user.id,
          wallet: metadata.issuerWallet,
        });
      } else if (action === "REVOKE") {
        await pool.query(
          `UPDATE certificates SET status = 'REVOKED', revocation_reason = $2, revoked_at = NOW(), updated_at = NOW()
           WHERE certificate_id = $1`,
          [certificateId, metadata.revocationReason]
        );
        await addCertificateHistory({
          certificateId,
          action: "REVOKED",
          oldStatus: "ACTIVE",
          newStatus: "REVOKED",
          reason: metadata.revocationReason,
          userId: req.user.id,
          wallet: metadata.issuerWallet,
        });
      } else if (action === "REPLACE") {
        await pool.query(
          `UPDATE certificates SET status = 'REPLACED', replaced_by_certificate_id = $2, replaced_at = NOW(), updated_at = NOW()
           WHERE certificate_id = $1`,
          [metadata.oldCertificateId, certificateId]
        );
        await pool.query(
          `INSERT INTO certificates (
            certificate_id, student_name, student_id, degree, department, issue_date,
            issuer_wallet, certificate_hash, ipfs_cid, status, previous_certificate_id,
            version_number, university_id, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10,$11,$12,$13)`,
          [
            certificateId,
            metadata.studentName,
            metadata.studentId,
            metadata.degree,
            metadata.department,
            metadata.issueDate,
            metadata.issuerWallet,
            metadata.certificateHash,
            metadata.ipfsCid,
            metadata.oldCertificateId,
            metadata.versionNumber,
            req.user.universityId,
            req.user.id,
          ]
        );
        await addCertificateHistory({
          certificateId: metadata.oldCertificateId,
          relatedId: certificateId,
          action: "REPLACED",
          oldStatus: "ACTIVE",
          newStatus: "REPLACED",
          userId: req.user.id,
          wallet: metadata.issuerWallet,
        });
        await addCertificateHistory({
          certificateId,
          relatedId: metadata.oldCertificateId,
          action: "ISSUED",
          newStatus: "ACTIVE",
          userId: req.user.id,
          wallet: metadata.issuerWallet,
        });
      }

      await logAudit({
        userId: req.user.id,
        action: `CERTIFICATE_${action}`,
        resourceType: "certificate",
        resourceId: certificateId,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        details: { txHash, confirmationTimeMs: Date.now() - startConfirm },
      });

      res.json({
        success: true,
        txHash,
        confirmationTimeMs,
        gasUsed,
        blockNumber,
      });
    } catch (err) {
      console.error("Confirm error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Prepare issue: upload PDF to IPFS, return hash + encoding for client-side tx
router.post(
  "/prepare-issue",
  authenticate,
  requireRole("UNIVERSITY_ADMIN"),
  upload.single("certificateFile"),
  [
    body("certificateId").trim().notEmpty().escape(),
    body("studentName").trim().notEmpty().escape(),
    body("studentId").trim().notEmpty().escape(),
    body("degree").trim().notEmpty().escape(),
    body("department").trim().notEmpty().escape(),
    body("issueDate").isISO8601(),
    body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/),
  ],
  handleValidation,
  async (req, res) => {
    if (req.user.walletAddress && req.user.walletAddress.toLowerCase() !== req.body.walletAddress.toLowerCase()) {
      return res.status(403).json({ error: "Wallet does not match registered university admin wallet" });
    }

    const existing = await pool.query(`SELECT id FROM certificates WHERE certificate_id = $1`, [
      req.body.certificateId,
    ]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "Certificate ID already exists in database" });
    }

    let buffer = req.file?.buffer;
    if (!buffer) {
      buffer = Buffer.from(
        JSON.stringify({
          certificateId: req.body.certificateId,
          studentName: req.body.studentName,
          degree: req.body.degree,
          issueDate: req.body.issueDate,
        })
      );
    }

    const certificateHash = hashCertificateContent(buffer);
    const { cid, mock } = await uploadToIpfs(buffer, `${req.body.certificateId}.pdf`);
    const issueTimestamp = Math.floor(new Date(req.body.issueDate).getTime() / 1000);

    res.json({
      certificateHash,
      ipfsCid: cid,
      ipfsUrl: publicIpfsDocumentUrl(cid),
      ipfsMock: mock,
      ipfsSetupHint: mock
        ? "Add PINATA_API_KEY and PINATA_SECRET_API_KEY to the project root .env, restart npm run dev, then issue again for a real IPFS file link."
        : null,
      issueTimestamp,
      contractAddress: getContractAddress(),
      chainId: getChainId(),
      encoding: {
        certificateId: req.body.certificateId,
        studentName: req.body.studentName,
        studentId: req.body.studentId,
        degree: req.body.degree,
        department: req.body.department,
        issueDate: issueTimestamp,
        certificateHash,
        ipfsCid: cid,
        previousCertificateId: "",
        versionNumber: 1,
      },
    });
  }
);

router.post(
  "/prepare-revoke",
  authenticate,
  requireRole("UNIVERSITY_ADMIN"),
  [body("certificateId").trim().notEmpty(), body("reason").trim().notEmpty(), body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/)],
  handleValidation,
  async (req, res) => {
    const cert = await pool.query(`SELECT * FROM certificates WHERE certificate_id = $1`, [req.body.certificateId]);
    if (!cert.rows[0]) return res.status(404).json({ error: "Certificate not found" });
    if (cert.rows[0].status !== "ACTIVE") {
      return res.status(400).json({ error: "Only ACTIVE certificates can be revoked" });
    }
    res.json({ contractAddress: getContractAddress(), chainId: getChainId(), certificateId: req.body.certificateId, reason: req.body.reason });
  }
);

router.post(
  "/prepare-replace",
  authenticate,
  requireRole("UNIVERSITY_ADMIN"),
  upload.single("certificateFile"),
  [
    body("oldCertificateId").trim().notEmpty(),
    body("newCertificateId").trim().notEmpty(),
    body("studentName").trim().notEmpty(),
    body("studentId").trim().notEmpty(),
    body("degree").trim().notEmpty(),
    body("department").trim().notEmpty(),
    body("issueDate").isISO8601(),
    body("walletAddress").matches(/^0x[a-fA-F0-9]{40}$/),
  ],
  handleValidation,
  async (req, res) => {
    const old = await pool.query(`SELECT * FROM certificates WHERE certificate_id = $1`, [req.body.oldCertificateId]);
    if (!old.rows[0] || old.rows[0].status !== "ACTIVE") {
      return res.status(400).json({ error: "Old certificate must exist and be ACTIVE" });
    }

    let buffer = req.file?.buffer || Buffer.from(JSON.stringify(req.body));
    const certificateHash = hashCertificateContent(buffer);
    const { cid, mock } = await uploadToIpfs(buffer, `${req.body.newCertificateId}.pdf`);
    const issueTimestamp = Math.floor(new Date(req.body.issueDate).getTime() / 1000);
    const newVersion = (old.rows[0].version_number || 1) + 1;

    res.json({
      certificateHash,
      ipfsCid: cid,
      ipfsUrl: publicIpfsDocumentUrl(cid),
      ipfsMock: mock,
      ipfsSetupHint: mock
        ? "Add Pinata keys to root .env and restart the API for a working IPFS document link."
        : null,
      issueTimestamp,
      versionNumber: newVersion,
      contractAddress: getContractAddress(),
      chainId: getChainId(),
      encoding: {
        oldCertificateId: req.body.oldCertificateId,
        newCertificateId: req.body.newCertificateId,
        studentName: req.body.studentName,
        studentId: req.body.studentId,
        degree: req.body.degree,
        department: req.body.department,
        issueDate: issueTimestamp,
        certificateHash,
        ipfsCid: cid,
      },
    });
  }
);

// Public verification
router.get("/verify/:certificateId", param("certificateId").trim().notEmpty(), handleValidation, async (req, res) => {
  const { certificateId } = req.params;
  const start = Date.now();

  const [dbResult, onChain] = await Promise.all([
    pool.query(`SELECT * FROM certificates WHERE certificate_id = $1`, [certificateId]),
    verifyOnChain(certificateId).catch(() => null),
  ]);

  const dbCert = dbResult.rows[0];
  const historyDb = await pool.query(
    `SELECT * FROM certificate_history WHERE certificate_id = $1 OR related_certificate_id = $1 ORDER BY created_at`,
    [certificateId]
  );

  const txResult = await pool.query(
    `SELECT tx_hash, action, status, gas_used, confirmation_time_ms, created_at, confirmed_at
     FROM blockchain_transactions WHERE certificate_id = $1 OR certificate_id IN (
       SELECT certificate_id FROM certificates WHERE previous_certificate_id = $1 OR replaced_by_certificate_id = $1
     ) ORDER BY created_at`,
    [certificateId]
  );

  let onChainHistory = [];
  if (onChain?.exists) {
    try {
      onChainHistory = await getOnChainHistory(certificateId);
    } catch {
      /* history may use linked cert */
    }
  }

  recordMetric({
    action: "VERIFY",
    certificateId,
    verificationResponseTimeMs: Date.now() - start,
  });

  const publicBase = process.env.PUBLIC_URL || "http://localhost:3000";
  const verifyUrl = `${publicBase}/verify?id=${encodeURIComponent(certificateId)}`;

  res.json({
    certificateId,
    source: {
      database: !!dbCert,
      blockchain: onChain?.exists ?? false,
    },
    certificate: dbCert
      ? {
          studentName: dbCert.student_name,
          studentId: dbCert.student_id,
          degree: dbCert.degree,
          department: dbCert.department,
          issueDate: dbCert.issue_date,
          status: dbCert.status,
          revocationReason: dbCert.revocation_reason,
          replacedByCertificateId: dbCert.replaced_by_certificate_id,
          previousCertificateId: dbCert.previous_certificate_id,
          versionNumber: dbCert.version_number,
          ipfsCid: dbCert.ipfs_cid,
          ipfsUrl: publicIpfsDocumentUrl(dbCert.ipfs_cid),
          certificateHash: dbCert.certificate_hash,
          issuerWallet: dbCert.issuer_wallet,
        }
      : onChain
        ? {
            studentName: onChain.studentName,
            degree: onChain.degree,
            issueDate: new Date(onChain.issueDate * 1000).toISOString().split("T")[0],
            status: onChain.status,
            revocationReason: onChain.revocationReason,
            replacedByCertificateId: onChain.replacedByCertificateId,
            previousCertificateId: onChain.previousCertificateId,
            versionNumber: onChain.versionNumber,
            ipfsCid: onChain.ipfsCid,
            ipfsUrl: publicIpfsDocumentUrl(onChain.ipfsCid),
            certificateHash: onChain.certificateHash,
          }
        : null,
    isValid: onChain?.isValid ?? dbCert?.status === "ACTIVE",
    onChain,
    history: {
      database: historyDb.rows,
      blockchain: onChainHistory,
    },
    transactions: txResult.rows,
    verificationTimeMs: Date.now() - start,
    verifyUrl,
    qrCodeDataUrl: await qrDataUrl(verifyUrl),
    ipfsDocumentNote: isPinataConfigured()
      ? null
      : "IPFS file link is disabled until you add PINATA_API_KEY and PINATA_SECRET_API_KEY to the project .env and restart the API. The certificate hash and CID are still stored on-chain.",
  });
});

router.get("/", authenticate, requireRole("UNIVERSITY_ADMIN", "SUPER_ADMIN"), async (req, res) => {
  let query = `SELECT c.*, u.name as university_name FROM certificates c LEFT JOIN universities u ON c.university_id = u.id`;
  const params = [];
  if (req.user.role === "UNIVERSITY_ADMIN" && req.user.universityId) {
    query += ` WHERE c.university_id = $1`;
    params.push(req.user.universityId);
  }
  query += ` ORDER BY c.created_at DESC LIMIT 100`;
  const result = await pool.query(query, params);
  res.json({ certificates: result.rows });
});

router.get("/:certificateId", authenticate, async (req, res) => {
  const result = await pool.query(`SELECT * FROM certificates WHERE certificate_id = $1`, [
    req.params.certificateId,
  ]);
  if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
  const history = await pool.query(
    `SELECT * FROM certificate_history WHERE certificate_id = $1 OR related_certificate_id = $1 ORDER BY created_at`,
    [req.params.certificateId]
  );
  const txs = await pool.query(
    `SELECT * FROM blockchain_transactions WHERE certificate_id = $1 ORDER BY created_at`,
    [req.params.certificateId]
  );
  res.json({ certificate: result.rows[0], history: history.rows, transactions: txs.rows });
});

// Verification receipt download
router.get("/verify/:certificateId/receipt", async (req, res) => {
  const verifyRes = await fetch(
    `${process.env.API_URL || "http://localhost:4000"}/api/certificates/verify/${req.params.certificateId}`
  ).catch(() => null);
  const data = verifyRes ? await verifyRes.json() : { certificateId: req.params.certificateId };
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="verification-${req.params.certificateId}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

export default router;
