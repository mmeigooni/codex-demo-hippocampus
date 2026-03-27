import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

const REQUIRED_HEADER_KEYS = [
  "Content-Security-Policy-Report-Only",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

describe("next security headers config", () => {
  it("disables x-powered-by header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("defines required security headers on all routes", async () => {
    expect(typeof nextConfig.headers).toBe("function");

    const configuredHeaders = await nextConfig.headers?.();
    expect(configuredHeaders).toBeDefined();

    const allRoutesEntry = configuredHeaders?.find((entry) => entry.source === "/(.*)");
    expect(allRoutesEntry).toBeDefined();

    const headers = new Map((allRoutesEntry?.headers ?? []).map((header) => [header.key, header.value]));

    for (const key of REQUIRED_HEADER_KEYS) {
      expect(headers.has(key)).toBe(true);
    }

    const cspReportOnly = headers.get("Content-Security-Policy-Report-Only") ?? "";
    expect(cspReportOnly).toContain("script-src");
    expect(cspReportOnly).toContain("'unsafe-eval'");
    expect(cspReportOnly).toContain("https://avatars.githubusercontent.com");
    expect(cspReportOnly).toContain("https://*.githubusercontent.com");
  });
});
