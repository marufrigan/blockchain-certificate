# Gas & Performance Analysis

Two ways to collect metrics for your research paper.

## 1. Hardhat benchmark (repeatable, no UI)

Runs issue, revoke, replace, and a view `verifyCertificate` on a fresh local chain.

```bash
cd "/Users/maruffarhan/Desktop/Blockchain Certificate"
npm run gas:analysis
```

**Output:** `docs/metrics/gas-analysis-<timestamp>.json` and `.csv`

| Field | Meaning |
|-------|---------|
| `gasUsed` | Gas units consumed by the transaction |
| `transactionCostEth` | `gasUsed × gasPrice` on Hardhat |
| `VERIFY_VIEW` | Off-chain read; `verificationResponseTimeMs` only |

## 2. Real app transactions (PostgreSQL)

After you issue/revoke/replace through the **admin UI** (with `npm run dev` running):

```bash
npm run gas:from-db
```

**Output:** `docs/metrics/gas-from-db-<timestamp>.json` and `.csv`

Includes **confirmation time** (ms) recorded when the backend waits for the tx.

## 3. In-memory metrics (current session only)

While the API is running, confirmed txs also call `recordMetric`. Export via admin API or:

```bash
cd backend && node src/scripts/captureMetrics.js csv
```

## Suggested table for a paper

| Operation | Avg gas (Hardhat) | Avg confirmation (ms) | Notes |
|-----------|-------------------|------------------------|-------|
| Issue | from `gas:analysis` | from `gas:from-db` | One-time mint |
| Revoke | … | … | Status → REVOKED |
| Replace | … | … | Two certs linked |
| Verify | 0 (view) | API timing | No gas on-chain |

Run **`npm run gas:analysis`** once and paste the console summary into your results section.
