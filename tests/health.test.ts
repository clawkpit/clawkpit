import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns a public JSON health status", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toMatchObject({ ok: true, status: "ok" });
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});
