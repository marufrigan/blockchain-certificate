import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metricsStore = [];

export function recordMetric(entry) {
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  metricsStore.push(record);
  return record;
}

export function getMetrics(filters = {}) {
  let data = [...metricsStore];
  if (filters.action) data = data.filter((m) => m.action === filters.action);
  return data;
}

export async function exportMetrics(format = "json") {
  const outDir = path.join(__dirname, "../../../docs/metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(outDir, `metrics-${timestamp}.${format}`);

  if (format === "csv") {
    const headers = [
      "timestamp",
      "action",
      "certificateId",
      "txHash",
      "gasUsed",
      "confirmationTimeMs",
      "verificationResponseTimeMs",
    ];
    const rows = metricsStore.map((m) =>
      headers.map((h) => JSON.stringify(m[h] ?? "")).join(",")
    );
    fs.writeFileSync(filePath, [headers.join(","), ...rows].join("\n"));
  } else {
    fs.writeFileSync(filePath, JSON.stringify(metricsStore, null, 2));
  }

  return { filePath, count: metricsStore.length };
}
