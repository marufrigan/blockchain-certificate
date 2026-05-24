import fs from "fs";

const logPath = process.env.TRUSTCERT_BOOT_LOG;
if (logPath) {
  fs.appendFileSync(logPath, `${new Date().toISOString()} loading TrustCert API…\n`);
}
