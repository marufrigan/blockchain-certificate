/**
 * Jest / supertest entry — loads full app synchronously in test mode.
 */
import { createApp } from "./app.mjs";

const app = await createApp();
app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "trustcert-api", routesReady: true });
});

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

export default app;
