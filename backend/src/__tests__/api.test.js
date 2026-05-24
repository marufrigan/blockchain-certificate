import request from "supertest";
import app from "../index.js";

describe("TrustCert API", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /api/auth/login rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "invalid@test.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("GET /api/certificates/verify/:id returns structured response", async () => {
    const res = await request(app).get("/api/certificates/verify/NONEXISTENT-TEST-ID");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("certificateId");
    expect(res.body).toHaveProperty("isValid");
  });
});
