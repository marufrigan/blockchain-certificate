import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = process.env.TRUSTCERT_ROOT || path.resolve(__dirname, "..", "..");
dotenv.config({ path: path.join(rootDir, ".env") });
process.env.TRUSTCERT_CONFIG_DIR =
  process.env.TRUSTCERT_CONFIG_DIR || path.join(rootDir, "backend/src/config");

export async function createApp() {
  const [
    { default: express },
    { default: cors },
    { default: helmet },
    { default: rateLimit },
    { default: authRoutes },
    { default: certificateRoutes },
    { default: universityRoutes },
    { default: metricsRoutes },
    { default: analyticsRoutes },
  ] = await Promise.all([
    import("express"),
    import("cors"),
    import("helmet"),
    import("express-rate-limit"),
    import("./routes/auth.js"),
    import("./routes/certificates.js"),
    import("./routes/universities.js"),
    import("./routes/metrics.js"),
    import("./routes/analytics.js"),
  ]);

  const app = express();
  app.use(helmet());

  function isLocalDevOrigin(origin) {
    if (!origin) return true;
    try {
      const u = new URL(origin);
      if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return false;
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  const explicitOrigins = new Set(
    ["http://localhost:3000", "http://127.0.0.1:3000", process.env.FRONTEND_URL].filter(Boolean)
  );
  const isProd = process.env.NODE_ENV === "production";

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (explicitOrigins.has(origin)) return callback(null, true);
        if (!isProd && isLocalDevOrigin(origin)) return callback(null, true);
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
    })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/universities", universityRoutes);
  app.use("/api/metrics", metricsRoutes);
  app.use("/api/analytics", analyticsRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
