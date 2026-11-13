import { z } from "zod";

const E164 = /^\+[1-9][0-9]{7,14}$/;

/**
 * Normalises a phone number to E.164. Local numbers starting with 0 use the
 * default country code (Nigeria, 234, unless configured otherwise).
 */
export function normalizePhone(input: string, defaultCountryCode = "234"): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/[^0-9+\s().-]/.test(trimmed)) return null;
  let digits = trimmed.replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.indexOf("+") > 0) return null;
  let result: string;
  if (digits.startsWith("+")) {
    result = digits;
  } else if (digits.startsWith("0")) {
    result = `+${defaultCountryCode}${digits.slice(1)}`;
  } else if (digits.startsWith(defaultCountryCode) && digits.length > 10) {
    result = `+${digits}`;
  } else {
    result = `+${defaultCountryCode}${digits}`;
  }
  return E164.test(result) ? result : null;
}

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Please enter your full name.")
  .max(80, "Name is too long.")
  .regex(NAME_RE, "Please use letters, spaces, hyphens or apostrophes only.");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address.")).refine((v) => v.length <= 254);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export function phoneSchema(defaultCountryCode = "234") {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = normalizePhone(v, defaultCountryCode);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Please enter a valid phone number." });
        return z.NEVER;
      }
      return n;
    });
}

export function registerSchema(defaultCountryCode = "234") {
  return z.object({
    fullName: nameSchema,
    phone: phoneSchema(defaultCountryCode),
    email: emailSchema,
    password: passwordSchema,
  });
}

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Please enter your password.").max(72),
});

export const drinkSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).default(""),
  category: z.string().trim().min(2).max(40),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
  is_reward_eligible: z.boolean(),
  price_naira: z.coerce.number().int().min(0).max(10_000_000).nullable(),
  item_type: z.enum(["drink", "food", "pick", "merch"]),
  art: z.enum(["iced", "frappe", "juice", "hot", "plate", "salad", "waffle", "cake", "bread", "croissant", "pizza", "pie", "wrap", "sandwich", "combo", "tee", "tote", "cap"]),
  customization: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        options: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
        multi: z.boolean().optional(),
      }),
    )
    .max(8),
});

/** Parses the admin's plain-text customization editor: "Milk: Whole, Oat" or "Extras*: Shot, Vanilla" (asterisk = multi-select). */
export function parseCustomizationText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx < 1) return null;
      let name = line.slice(0, idx).trim();
      const multi = name.endsWith("*");
      if (multi) name = name.slice(0, -1).trim();
      const options = line
        .slice(idx + 1)
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      return { name, options: Array.from(new Set(options)), multi };
    })
    .filter((g): g is { name: string; options: string[]; multi: boolean } => g !== null && g.options.length > 0);
}

export function customizationToText(groups: Array<{ name: string; options: string[]; multi?: boolean }>): string {
  return groups.map((g) => `${g.name}${g.multi ? "*" : ""}: ${g.options.join(", ")}`).join("\n");
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
