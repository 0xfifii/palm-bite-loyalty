import { describe, expect, it } from "vitest";
import { cardState } from "@/lib/loyalty/progress";
import { normalizePhone, parseCustomizationText, customizationToText, registerSchema } from "@/lib/validation";
import { csvCell, summarize, toCsv } from "@/lib/reports/csv";
import { drinkSvg } from "@/lib/brand/drink-art";
import { SCAN_MESSAGES } from "@/lib/loyalty/codes";

describe("loyalty card presentation", () => {
  it("shows zero for a new customer", () => {
    const s = cardState(0, false);
    expect(s.label).toBe("00 / 15 VISITS");
    expect(s.summary).toBe("15 more eligible visits until your free drink.");
    expect(s.stamps.filter(Boolean)).toHaveLength(0);
  });

  it("matches the brief's example at 8 points", () => {
    const s = cardState(8, false);
    expect(s.label).toBe("08 / 15 VISITS");
    expect(s.summary).toBe("7 more eligible visits until your free drink.");
    expect(s.stamps.filter(Boolean)).toHaveLength(8);
  });

  it("uses the singular for one remaining visit", () => {
    expect(cardState(14, false).summary).toBe("1 more eligible visit until your free drink.");
  });

  it("unlocks at 15 or when a reward is open", () => {
    expect(cardState(15, false).unlocked).toBe(true);
    expect(cardState(0, true).unlocked).toBe(true);
    expect(cardState(99, false).points).toBe(15);
    expect(cardState(-4, false).points).toBe(0);
  });
});

describe("customer copy", () => {
  it("uses the exact messages from the brief", () => {
    expect(SCAN_MESSAGES.POINT_AWARDED.title).toBe("+1 POINT!");
    expect(SCAN_MESSAGES.ALREADY_COLLECTED_TODAY.body).toBe("You've already collected your Palm Bite point for today. Come back again tomorrow!");
    expect(SCAN_MESSAGES.QR_EXPIRED.body).toBe("This QR code has expired. Please scan the current Palm Bite code.");
    expect(SCAN_MESSAGES.QR_INVALID.body).toBe("We couldn't verify this visit. Please scan the QR displayed at Palm Bite.");
  });
});

describe("phone numbers", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["08031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["00447700900123", "+447700900123"],
    ["(0803) 123-4567", "+2348031234567"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "abc", "12", "+0123456789", "080312345678901234567", "0803+1234567"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("registration validation", () => {
  const schema = registerSchema();
  it("accepts a valid customer", () => {
    const r = schema.safeParse({ fullName: "Tolu Bello", phone: "08031234567", email: "TOLU@Example.com ", password: "Palmbite1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("tolu@example.com");
  });
  it("rejects weak passwords and odd names", () => {
    expect(schema.safeParse({ fullName: "Tolu", phone: "08031234567", email: "a@b.co", password: "password" }).success).toBe(false);
    expect(schema.safeParse({ fullName: "<script>", phone: "08031234567", email: "a@b.co", password: "Palmbite1" }).success).toBe(false);
  });
});

describe("customization editor", () => {
  it("parses and prints groups", () => {
    const groups = parseCustomizationText("Milk: Whole, Oat, Oat\nExtras*: Shot, Vanilla\nbad line\nEmpty:");
    expect(groups).toEqual([
      { name: "Milk", options: ["Whole", "Oat"], multi: false },
      { name: "Extras", options: ["Shot", "Vanilla"], multi: true },
    ]);
    expect(customizationToText(groups)).toBe("Milk: Whole, Oat\nExtras*: Shot, Vanilla");
  });
});

describe("CSV export", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+2348031234567")).toBe("+2348031234567");
    expect(csvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(csvCell("-15")).toBe("-15");
    expect(csvCell(-3)).toBe("-3");
  });
  it("builds a header from all keys", () => {
    expect(toCsv([{ a: 1 }, { a: 2, b: "x" }])).toBe("a,b\r\n1,\r\n2,x\r\n");
  });
  it("summarises reports from the rows themselves", () => {
    const s = summarize("daily_visits", [
      { verified_visits: 3, staff_assisted_visits: 1 },
      { verified_visits: 2, staff_assisted_visits: 0 },
    ]);
    expect(s).toEqual([
      { label: "Days", value: 2 },
      { label: "Verified visits", value: 5 },
      { label: "Staff-assisted", value: 1 },
    ]);
  });
});

describe("drink illustration", () => {
  it("never injects untrusted colour strings", () => {
    const svg = drinkSvg({ accent: '"/><script>alert(1)</script>', idSuffix: "<x>" });
    expect(svg).not.toContain("<script");
    expect(svg).toContain("#A9B89A");
  });
});
