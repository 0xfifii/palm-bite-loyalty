import { describe, expect, it } from "vitest";
import { createQrToken, hashToken, verifyQrToken } from "@/lib/qr/token";
import { buildScanUrl, extractScannedToken } from "@/lib/qr/parse";

const SECRET = "a-very-long-test-secret-value-1234567890";
const OLD_SECRET = "an-older-secret-that-is-also-long-enough-1";
const LOC = "00000000-0000-4000-8000-000000000001";
const OTHER_LOC = "00000000-0000-4000-8000-000000000002";

describe("QR tokens", () => {
  it("round-trips and exposes the session id and hash", () => {
    const t = createQrToken(SECRET, LOC);
    const v = verifyQrToken(t.token, [SECRET], LOC);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.sid).toBe(t.sessionId);
      expect(v.payload.loc).toBe(LOC);
      expect(v.tokenHash).toBe(t.tokenHash);
      expect(v.tokenHash).toBe(hashToken(t.token));
    }
  });

  it("stays short enough for an easy-to-scan QR code", () => {
    const t = createQrToken(SECRET, LOC);
    expect(t.token.length).toBeLessThanOrEqual(90);
  });

  it("is unique every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createQrToken(SECRET, LOC).token));
    expect(tokens.size).toBe(200);
  });

  it("rejects a tampered body", () => {
    const t = createQrToken(SECRET, LOC);
    const [v, body, sig] = t.token.split(".");
    const flipped = body.slice(0, 5) + (body[5] === "A" ? "B" : "A") + body.slice(6);
    expect(verifyQrToken(`${v}.${flipped}.${sig}`, [SECRET], LOC)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a tampered signature", () => {
    const t = createQrToken(SECRET, LOC);
    const tampered = t.token.slice(0, -2) + (t.token.endsWith("AA") ? "BB" : "AA");
    expect(verifyQrToken(tampered, [SECRET], LOC).ok).toBe(false);
  });

  it("rejects tokens signed with another secret", () => {
    const t = createQrToken("someone-elses-secret-that-is-long-enough", LOC);
    expect(verifyQrToken(t.token, [SECRET], LOC)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects tokens minted for another location", () => {
    const t = createQrToken(SECRET, OTHER_LOC);
    expect(verifyQrToken(t.token, [SECRET], LOC)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("accepts the previous secret during rotation", () => {
    const t = createQrToken(OLD_SECRET, LOC);
    expect(verifyQrToken(t.token, [SECRET, OLD_SECRET], LOC).ok).toBe(true);
  });

  it("ignores secrets that are too short", () => {
    const t = createQrToken(SECRET, LOC);
    expect(verifyQrToken(t.token, ["short"], LOC).ok).toBe(false);
    expect(() => createQrToken("short", LOC)).toThrow();
  });

  it.each([
    "",
    "PB1",
    "PB1..",
    "PB2.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "PB1.not-base64!!.sig",
    "x".repeat(500),
  ])("rejects malformed input %#", (bad) => {
    expect(verifyQrToken(bad, [SECRET], LOC)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});

describe("scanned text parsing", () => {
  const t = createQrToken(SECRET, LOC).token;

  it("accepts a raw token or the display URL", () => {
    expect(extractScannedToken(t)).toBe(t);
    expect(extractScannedToken(buildScanUrl("https://loyalty.palmbite.example", t))).toBe(t);
  });

  it("ignores unrelated QR codes and arbitrary URLs", () => {
    expect(extractScannedToken("https://example.com/menu")).toBeNull();
    expect(extractScannedToken("https://loyalty.palmbite.example/scan?t=hello")).toBeNull();
    expect(extractScannedToken("WIFI:S:PalmBite;T:WPA;P:secret;;")).toBeNull();
    expect(extractScannedToken("")).toBeNull();
  });
});
