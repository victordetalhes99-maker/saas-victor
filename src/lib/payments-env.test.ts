import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("payments-env", () => {
  const originalEnv = process.env.PAYMENTS_ENV;
  const originalAppEnv = process.env.APP_ENV;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.PAYMENTS_ENV;
    else process.env.PAYMENTS_ENV = originalEnv;
    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("getServerPaymentsEnv", () => {
    it("returns 'live' only when explicitly set to live", async () => {
      process.env.PAYMENTS_ENV = "live";
      const { getServerPaymentsEnv } = await import("./payments-env");
      expect(getServerPaymentsEnv()).toBe("live");
    });

    it("defaults to 'sandbox' for anything else — the safe default", async () => {
      delete process.env.PAYMENTS_ENV;
      delete process.env.APP_ENV;
      const { getServerPaymentsEnv } = await import("./payments-env");
      expect(getServerPaymentsEnv()).toBe("sandbox");
    });

    it("defaults to 'sandbox' for typos or unexpected values", async () => {
      process.env.PAYMENTS_ENV = "production"; // not the literal "live"
      const { getServerPaymentsEnv } = await import("./payments-env");
      expect(getServerPaymentsEnv()).toBe("sandbox");
    });

    it("falls back to APP_ENV when PAYMENTS_ENV is not set", async () => {
      delete process.env.PAYMENTS_ENV;
      process.env.APP_ENV = "live";
      const { getServerPaymentsEnv } = await import("./payments-env");
      expect(getServerPaymentsEnv()).toBe("live");
    });
  });
});
