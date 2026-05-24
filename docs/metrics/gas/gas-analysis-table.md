# Gas Analysis Results (Hardhat Benchmark)

| Operation | Gas Used (units) | Transaction Cost (ETH) | Notes |
|-----------|------------------|------------------------|-------|
| Register University | 71,995 | 0.000128 | One-time admin setup |
| Issue Certificate | 390,749 | 0.000655 | Mint new credential on-chain |
| Revoke Certificate | 98,254 | 0.000149 | Invalidate ACTIVE certificate |
| Replace Certificate | 520,092 | 0.000728 | Link old cert to new version |
| Verify (view call) | 0 | 0.000000 | Off-chain read; ~42 ms response time |

**Network:** Hardhat local (chain ID 31337)  
**Measured:** 2026-05-16 (automated test `GasAnalysis.test.js`)  
**Source:** `docs/metrics/gas-analysis-2026-05-16T18-08-20-978Z.json`

Verify uses a Solidity `view` function — no on-chain gas is consumed.
