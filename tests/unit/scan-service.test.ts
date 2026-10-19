import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { processScan, type ScanDeps } from "@/lib/loyalty/scan-service";
import { createQrToken } from "@/lib/qr/token";
import { buildScanUrl } from "@/lib/qr/parse";
import { SCAN_MESSAGES } from "@/lib/loyalty/codes";

const SECRET = "unit-test-secret-that-is-long-enough-123";
const LOC = "00000000-0000-4000-8000-000000000001";

function deps(overrides: Partial<ScanDeps> = {}) {
  const award = vi.fn(async () => ({ code: "POINT_AWARDED", replayed: false, reward_unlocked: false, account: { points: 3, cycle: 1, total_visits: 3, rewards_redeemed: 0 } }));
  const logAttempt = vi.fn(async () => undefined);
  const d: ScanDeps = {
    getUserId: async () => "11111111-1111-4111-8111-111111111111",
    rateLimit: async () => true,
    award,
    logAttempt,
    secrets: [SECRET],
    locationId: LOC,
    ...overrides,
  };
  return { d, award: (overrides.award as typeof award) ?? award, logAttempt };
}

const input = (body: unknown) => ({ body, ipHash: "iphash", userAgent: "test" });

describe("processScan", () => {
  it("awards a point for a valid token and passes only server-derived values", async () => {
    const { d, award } = deps();
    const t = createQrToken(SECRET, LOC);
    const key = randomUUID();
    const res = await processScan(d, input({ token: buildScanUrl("https://pb.example", t.token), idempotencyKey: key }));
    expect(res.code).toBe("POINT_AWARDED");
    expect(res.title).toBe("+1 POINT!");
    expect(res.message).toBe(SCAN_MESSAGES.POINT_AWARDED.body);
    expect(award).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: t.sessionId, tokenHash: t.tokenHash, locationId: LOC, idempotencyKey: key }),
    );
  });

  it("rejects signed-out users without touching the database", async () => {
    const { d, award } = deps({ getUserId: async () => null });
    const t = createQrToken(SECRET, LOC);
    const res = await processScan(d, input({ token: t.token, idempotencyKey: randomUUID() }));
    expect(res.code).toBe("UNAUTHENTICATED");
    expect(award).not.toHaveBeenCalled();
  });

  it("rejects tampered tokens before any award and logs the attempt", async () => {
    const { d, award, logAttempt } = deps();
    const t = createQrToken(SECRET, LOC);
    const res = await processScan(d, input({ token: t.token.slice(0, -1) + "x", idempotencyKey: randomUUID() }));
    expect(res.code).toBe("QR_INVALID");
    expect(award).not.toHaveBeenCalled();
    expect(logAttempt).toHaveBeenCalledWith(expect.objectContaining({ code: "QR_INVALID" }));
  });

  it("rejects arbitrary URLs", async () => {
    const { d, award } = deps();
    const res = await processScan(d, input({ token: "https://pb.example/scan?t=free-points", idempotencyKey: randomUUID() }));
    expect(res.code).toBe("QR_INVALID");
    expect(award).not.toHaveBeenCalled();
  });

  it("rejects requests without a valid idempotency key", async () => {
    const { d, award } = deps();
    const t = createQrToken(SECRET, LOC);
    const res = await processScan(d, input({ token: t.token, idempotencyKey: "not-a-uuid" }));
    expect(res.code).toBe("QR_INVALID");
    expect(award).not.toHaveBeenCalled();
  });

  it("applies rate limits", async () => {
    const { d, award } = deps({ rateLimit: async (key) => !key.startsWith("scan:user:") });
    const t = createQrToken(SECRET, LOC);
    const res = await processScan(d, input({ token: t.token, idempotencyKey: randomUUID() }));
    expect(res.code).toBe("RATE_LIMITED");
    expect(award).not.toHaveBeenCalled();
  });

  it("never reports success when the database call fails", async () => {
    const { d } = deps({ award: vi.fn(async () => { throw new Error("network"); }) });
    const t = createQrToken(SECRET, LOC);
    const res = await processScan(d, input({ token: t.token, idempotencyKey: randomUUID() }));
    expect(res.code).toBe("TEMPORARY_ERROR");
  });

  it.each(["ALREADY_COLLECTED_TODAY", "QR_EXPIRED", "QR_REVOKED", "QR_INVALID", "REWARD_PENDING_REDEMPTION", "ACCOUNT_SUSPENDED"])(
    "passes through database result %s with its message",
    async (code) => {
      const { d } = deps({ award: vi.fn(async () => ({ code })) });
      const t = createQrToken(SECRET, LOC);
      const res = await processScan(d, input({ token: t.token, idempotencyKey: randomUUID() }));
      expect(res.code).toBe(code);
      expect(res.message).toBe(SCAN_MESSAGES[code as keyof typeof SCAN_MESSAGES].body);
    },
  );

  it("maps unknown database results to TEMPORARY_ERROR", async () => {
    const { d } = deps({ award: vi.fn(async () => ({ code: "SOMETHING_ELSE" })) });
    const t = createQrToken(SECRET, LOC);
    const res = await processScan(d, input({ token: t.token, idempotencyKey: randomUUID() }));
    expect(res.code).toBe("TEMPORARY_ERROR");
  });
});
