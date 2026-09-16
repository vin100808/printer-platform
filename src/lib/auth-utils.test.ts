import { describe, expect, it } from "vitest";
import { hashSessionToken, sessionExpiry } from "./auth-utils";

describe("authentication utilities", () => {
  it("hashes session tokens deterministically without storing the original token", () => {
    const token = "secret-session-token";
    const hash = hashSessionToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it("computes session expiration from the configured lifetime", () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    expect(sessionExpiry(now, 7).toISOString()).toBe("2026-09-23T00:00:00.000Z");
  });
});
