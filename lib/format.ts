/** Date and time formatting in the Palm Bite business timezone. */

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** A business-local calendar date (YYYY-MM-DD) shown without timezone shifting. */
export function formatVisitDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function describeCustomizations(c: Record<string, string | string[]> | null | undefined): string {
  if (!c) return "";
  return Object.entries(c)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("; ");
}

/** Request-time clock for server components. */
export function currentTimeMs(): number {
  return Date.now();
}

const NAIRA = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** 17000 becomes "N17,000" with the naira sign. */
export function naira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return `\u20A6${NAIRA.format(amount)}`;
}
