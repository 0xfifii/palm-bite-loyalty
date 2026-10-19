/** CSV helpers with spreadsheet formula-injection protection. */

export const REPORT_KINDS = {
  customers: { label: "Registered customers", dated: true },
  daily_visits: { label: "Daily verified visits", dated: true },
  visits: { label: "Visit log", dated: true },
  points: { label: "Points awarded and changed", dated: true },
  balances: { label: "Current customer balances", dated: false },
  rewards_earned: { label: "Rewards earned", dated: true },
  rewards_redeemed: { label: "Rewards redeemed", dated: true },
  pending_redemptions: { label: "Pending redemptions", dated: false },
  adjustments: { label: "Manual adjustments", dated: true },
} as const;

export type ReportKind = keyof typeof REPORT_KINDS;

export function isReportKind(value: string): value is ReportKind {
  return Object.prototype.hasOwnProperty.call(REPORT_KINDS, value);
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Neutralise values a spreadsheet would execute as a formula.
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export type ReportSummary = { label: string; value: string | number }[];

export function summarize(kind: ReportKind, rows: Array<Record<string, unknown>>): ReportSummary {
  const n = rows.length;
  const sum = (key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const distinct = (key: string) => new Set(rows.map((r) => r[key])).size;
  switch (kind) {
    case "customers":
      return [
        { label: "Customers", value: n },
        { label: "Total visits", value: sum("total_visits") },
        { label: "Rewards redeemed", value: sum("rewards_redeemed") },
      ];
    case "daily_visits":
      return [
        { label: "Days", value: n },
        { label: "Verified visits", value: sum("verified_visits") },
        { label: "Staff-assisted", value: sum("staff_assisted_visits") },
      ];
    case "visits":
      return [
        { label: "Visits", value: n },
        { label: "Unique customers", value: distinct("customer_id") },
      ];
    case "points":
      return [
        { label: "Entries", value: n },
        { label: "Points from visits", value: rows.filter((r) => r.type === "visit").reduce((s, r) => s + Number(r.points_delta), 0) },
        { label: "Net change", value: sum("points_delta") },
      ];
    case "balances":
      return [
        { label: "Customers", value: n },
        { label: "Points outstanding", value: sum("current_points") },
        { label: "With open reward", value: rows.filter((r) => r.open_reward).length },
      ];
    case "rewards_earned":
      return [
        { label: "Rewards earned", value: n },
        { label: "Redeemed", value: rows.filter((r) => r.status === "redeemed").length },
      ];
    case "rewards_redeemed":
      return [
        { label: "Redeemed", value: n },
        { label: "Unique customers", value: distinct("customer_id") },
      ];
    case "pending_redemptions":
      return [{ label: "Pending", value: n }];
    case "adjustments":
      return [
        { label: "Adjustments", value: n },
        { label: "Net points", value: sum("points_delta") },
      ];
  }
}
