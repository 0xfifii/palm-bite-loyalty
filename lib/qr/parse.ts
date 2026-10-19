/**
 * Client-safe helpers for reading whatever the camera decoded.
 * The displayed QR encodes a URL of the form https://<site>/scan?t=<token>
 * so a phone's native camera also opens the app. The in-app scanner accepts
 * either that URL or a raw token. Nothing here grants anything: the token is
 * always verified on the server.
 */
export const QR_PARAM = "t";

export function extractScannedToken(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 1000) return null;

  if (value.startsWith("PB1.")) return value;

  try {
    const url = new URL(value);
    const token = url.searchParams.get(QR_PARAM);
    if (token && token.startsWith("PB1.")) return token;
  } catch {
    // not a URL
  }
  return null;
}

export function buildScanUrl(siteUrl: string, token: string): string {
  const url = new URL("/scan", siteUrl);
  url.searchParams.set(QR_PARAM, token);
  return url.toString();
}
