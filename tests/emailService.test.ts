import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveOpsNotifyEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadResolveOpsNotifyEmail() {
    const mod = await import("../src/services/emailService");
    return mod.resolveOpsNotifyEmail;
  }

  it("returns null when no ops email env vars are set", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("OPS_EMAIL", "");
    vi.stubEnv("MAINTAINER_EMAIL", "");
    const resolveOpsNotifyEmail = await loadResolveOpsNotifyEmail();
    expect(resolveOpsNotifyEmail()).toBeNull();
  });

  it("prefers ADMIN_EMAIL over OPS_EMAIL and MAINTAINER_EMAIL", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("OPS_EMAIL", "ops@example.com");
    vi.stubEnv("MAINTAINER_EMAIL", "maintainer@example.com");
    const resolveOpsNotifyEmail = await loadResolveOpsNotifyEmail();
    expect(resolveOpsNotifyEmail()).toBe("admin@example.com");
  });

  it("falls back to OPS_EMAIL then MAINTAINER_EMAIL", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("OPS_EMAIL", "ops@example.com");
    vi.stubEnv("MAINTAINER_EMAIL", "maintainer@example.com");
    const resolveOpsNotifyEmail = await loadResolveOpsNotifyEmail();
    expect(resolveOpsNotifyEmail()).toBe("ops@example.com");

    vi.resetModules();
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("OPS_EMAIL", "");
    vi.stubEnv("MAINTAINER_EMAIL", "maintainer@example.com");
    const resolveMaintainer = await loadResolveOpsNotifyEmail();
    expect(resolveMaintainer()).toBe("maintainer@example.com");
  });
});
