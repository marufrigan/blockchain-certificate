/**
 * Research metrics capture script.
 * Run after performing issue/revoke/replace operations to export gas and timing data.
 *
 * Usage: node src/scripts/captureMetrics.js [json|csv]
 */
import { exportMetrics, getMetrics } from "../services/metrics.js";

const format = process.argv[2] || "json";

const summary = {
  issue: getMetrics({ action: "ISSUE" }),
  revoke: getMetrics({ action: "REVOKE" }),
  replace: getMetrics({ action: "REPLACE" }),
  verify: getMetrics({ action: "VERIFY" }),
};

console.log("Metrics summary:", JSON.stringify(summary, null, 2));

const result = await exportMetrics(format);
console.log(`Exported ${result.count} records to ${result.filePath}`);
