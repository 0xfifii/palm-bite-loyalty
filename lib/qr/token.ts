import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Palm Bite visit QR tokens.
 *
 * Format: PB1.<body>.<signature>
 *   body       base64url of 16 bytes QR session id (UUID) + 12 random bytes
 *   signature  base64url HMAC-SHA256 over "PB1.<body>.<location id>"
 *
 * The location id is bound into the signature rather than carried in the
 * token, which keeps the QR code small enough to scan easily from a distance.
 * A token minted for another location fails signature verification.
 *
 * Expiry and revocation are authoritative in the database (qr_sessions),
 * which stores only the SHA-256 hash of the token, never the token itself.
 */

export const TOKEN_VERSION = "PB1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BODY_BYTES = 28;
const BODY_RE = /^[A-Za-z0-9_-]{38}$/;
const SIG_RE = /^[A-Za-z0-9_-]{43}$/;
export const MAX_TOKEN_LENGTH = 200;
export const MIN_SECRET_LENGTH = 32;

export type QrTokenPayload = { sid: string; loc: string };

export type VerifyResult =
  | { ok: true; payload: QrTokenPayload; tokenHash: string }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" };

function sign(body: string, locationId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${TOKEN_VERSION}.${body}.${locationId.toLowerCase()}`).digest();
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesToUuid(buf: Buffer): string {
  const h = buf.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function assertSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`QR signing secret must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createQrToken(secret: string, locationId: string) {
  assertSecret(secret);
  if (!UUID_RE.test(locationId)) throw new Error("Invalid location id.");
  const sessionId = randomUUID();
  const body = Buffer.concat([uuidToBytes(sessionId), randomBytes(12)]).toString("base64url");
  const token = `${TOKEN_VERSION}.${body}.${sign(body, locationId, secret).toString("base64url")}`;
  return { token, sessionId, tokenHash: hashToken(token) };
}

/**
 * Verifies structure and signature for the given location. Accepts a list of
 * secrets so the signing secret can be rotated without invalidating the code
 * currently on screen.
 */
export function verifyQrToken(token: string, secrets: Array<string | undefined>, locationId: string): VerifyResult {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: "MALFORMED" };
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !BODY_RE.test(parts[1]) || !SIG_RE.test(parts[2])) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (!UUID_RE.test(locationId)) return { ok: false, reason: "MALFORMED" };

  const bodyBytes = Buffer.from(parts[1], "base64url");
  if (bodyBytes.length !== BODY_BYTES) return { ok: false, reason: "MALFORMED" };
  const sid = bytesToUuid(bodyBytes.subarray(0, 16));
  if (!UUID_RE.test(sid)) return { ok: false, reason: "MALFORMED" };

  const provided = Buffer.from(parts[2], "base64url");
  const valid = secrets
    .filter((s): s is string => typeof s === "string" && s.length >= MIN_SECRET_LENGTH)
    .some((secret) => {
      const expected = sign(parts[1], locationId, secret);
      return expected.length === provided.length && timingSafeEqual(expected, provided);
    });
  if (!valid) return { ok: false, reason: "BAD_SIGNATURE" };

  return { ok: true, payload: { sid, loc: locationId.toLowerCase() }, tokenHash: hashToken(token) };
}
