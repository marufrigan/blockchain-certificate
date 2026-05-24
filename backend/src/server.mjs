/**
 * Starts /health immediately, then loads Express in the background (fast on slow disks).
 */
import http from "http";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
let routesReady = false;
let handle = null;

const server = http.createServer((req, res) => {
  const url = req.url?.split("?")[0] || "/";

  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "trustcert-api", routesReady }));
    return;
  }

  if (!handle) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API still loading — retry in a few seconds" }));
    return;
  }

  handle(req, res);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Run: npm run stop:apps`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

function loadExpressApp() {
  const appUrl = pathToFileURL(path.join(__dirname, "app.mjs")).href;
  import(appUrl)
    .then((mod) => mod.createApp())
    .then((app) => {
      handle = app;
      routesReady = true;
      console.log("TrustCert API routes ready");
    })
    .catch((err) => {
      console.error("Failed to load API:", err);
      process.exit(1);
    });
}

server.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  console.log(`TrustCert API: http://localhost:${PORT}/health`);
  setImmediate(loadExpressApp);
});
