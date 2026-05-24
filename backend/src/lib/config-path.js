import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getConfigDir() {
  if (process.env.TRUSTCERT_CONFIG_DIR) {
    return process.env.TRUSTCERT_CONFIG_DIR;
  }
  const candidates = [
    path.join(__dirname, "../config"),
    path.join(process.cwd(), "src/config"),
    path.join(process.cwd(), "backend/src/config"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "deployment.json"))) {
      return dir;
    }
  }
  return candidates[0];
}
