import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, "..");
const outFile = path.join(backendDir, "dist/server.mjs");

await esbuild.build({
  entryPoints: [path.join(backendDir, "src/index.js")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: outFile,
  external: ["pg", "pg-native"],
  logLevel: "info",
});

console.log("API bundle:", outFile);
