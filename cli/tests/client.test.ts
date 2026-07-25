import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiRequestError } from "../src/client.js";
import { clearConfigToken, loadConfig, saveConfig } from "../src/config.js";

describe("ApiClient", () => {
  it("sends bearer auth and parses JSON", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ user: { email: "a@b.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: "https://example.test",
      apiToken: "secret",
      fetchImpl,
    });
    const data = await client.get<{ user: { email: string } }>("/api/me");
    expect(data.user.email).toBe("a@b.com");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(url)).toBe("https://example.test/api/me");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });

  it("maps API errors", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { code: "NOT_FOUND", message: "Nope" } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const client = new ApiClient({
      baseUrl: "https://example.test",
      apiToken: "secret",
      fetchImpl,
    });
    await expect(client.get("/api/v1/items/x")).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "NOT_FOUND",
      status: 404,
    } satisfies Partial<ApiRequestError>);
  });

  it("requires token when auth is enabled", async () => {
    const client = new ApiClient({ baseUrl: "https://example.test" });
    await expect(client.get("/api/me")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("config", () => {
  let dir: string;
  let path: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("saves and loads token without echoing secrets elsewhere", () => {
    dir = mkdtempSync(join(tmpdir(), "clawkpit-cli-"));
    path = join(dir, "config.json");
    saveConfig({ baseUrl: "http://localhost:3000", apiToken: "tok" }, path);
    const loaded = loadConfig(path);
    expect(loaded).toEqual({ baseUrl: "http://localhost:3000", apiToken: "tok" });
    const raw = readFileSync(path, "utf8");
    expect(raw).toContain("tok");
    clearConfigToken(path);
    expect(loadConfig(path).apiToken).toBeUndefined();
    expect(loadConfig(path).baseUrl).toBe("http://localhost:3000");
  });
});
