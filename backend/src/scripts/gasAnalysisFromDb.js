/**
 * Export gas & timing metrics from PostgreSQL (real app transactions).
 *
 * Usage (from project root):
 *   node backend/src/scripts/gasAnalysisFromDb.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { pool } from "../db/pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
  const { rows } = await pool.query(
    `SELECT certificate_id, tx_hash, action, status, gas_used, gas_price, block_number,
            confirmation_time_ms, network, created_at, confirmed_at
     FROM blockchain_transactions
     WHERE status = 'CONFIRMED'
     ORDER BY created_at`
  );

  const byAction = {};
  for (const r of rows) {
    if (!byAction[r.action]) byAction[r.action] = [];
    byAction[r.action].push(r);
  }

  const summary = rows.map((r) => {
    const gasUsed = r.gas_used ? Number(r.gas_used) : null;
    const gasPrice = r.gas_price ? BigInt(r.gas_price) : 0n;
    const costWei = gasUsed && gasPrice ? BigInt(gasUsed) * gasPrice : 0n;
    return {
      action: r.action,
      certificateId: r.certificate_id,
      txHash: r.tx_hash,
      gasUsed,
      gasPriceWei: r.gas_price,
      estimatedCostWei: costWei.toString(),
      confirmationTimeMs: r.confirmation_time_ms,
      network: r.network,
      confirmedAt: r.confirmed_at,
    };
  });

  const aggregates = Object.entries(byAction).map(([action, list]) => {
    const gasValues = list.map((x) => Number(x.gas_used)).filter((n) => !Number.isNaN(n));
    const timeValues = list.map((x) => x.confirmation_time_ms).filter((n) => n != null);
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    return {
      action,
      count: list.length,
      avgGasUsed: avg(gasValues),
      minGasUsed: gasValues.length ? Math.min(...gasValues) : null,
      maxGasUsed: gasValues.length ? Math.max(...gasValues) : null,
      avgConfirmationTimeMs: avg(timeValues),
    };
  });

  const verifyMetrics = await pool.query(
    `SELECT details FROM audit_logs WHERE action = 'CERTIFICATE_VERIFY' OR action LIKE '%VERIFY%' LIMIT 100`
  ).catch(() => ({ rows: [] }));

  const report = {
    source: "postgresql_blockchain_transactions",
    exportedAt: new Date().toISOString(),
    transactionCount: rows.length,
    aggregates,
    transactions: summary,
    note:
      rows.length === 0
        ? "No confirmed transactions in DB yet. Issue/revoke/replace via the app first, or run npm run gas:analysis for Hardhat benchmarks."
        : null,
  };

  const outDir = path.join(__dirname, "../../../docs/metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `gas-from-db-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const csvPath = path.join(outDir, `gas-from-db-${stamp}.csv`);
  const headers = [
    "action",
    "certificateId",
    "txHash",
    "gasUsed",
    "gasPriceWei",
    "estimatedCostWei",
    "confirmationTimeMs",
    "network",
  ];
  const csv = [headers.join(","), ...summary.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join(
    "\n"
  );
  fs.writeFileSync(csvPath, csv);

  console.log("\n=== Gas analysis from database ===\n");
  console.log(JSON.stringify({ aggregates, transactionCount: rows.length }, null, 2));
  console.log(`\nExported: ${jsonPath}`);
  console.log(`Exported: ${csvPath}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
