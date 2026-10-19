"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { actionMessage } from "@/lib/loyalty/codes";
import { drinkSchema, parseCustomizationText } from "@/lib/validation";
import type { RpcResult } from "@/lib/types";

export type ActionState = { ok?: boolean; error?: string; message?: string };

async function admin() {
  return requireRole(["admin"], "/admin");
}

function done(result: RpcResult | null, success: string, paths: string[]): ActionState {
  if (!result || result.code !== "OK") return { error: actionMessage(result?.code) };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, message: success };
}

export async function adjustPoints(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = z
    .object({
      customerId: z.uuid(),
      delta: z.coerce.number().int().min(-15).max(15).refine((n) => n !== 0, "Enter a non-zero amount."),
      reason: z.string().trim().min(5, "Please give a reason of at least 5 characters.").max(280),
    })
    .safeParse({ customerId: formData.get("customerId"), delta: formData.get("delta"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await supabase.rpc("admin_adjust_points", {
    p_customer: parsed.data.customerId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  return done(r, r.reward_unlocked ? "Points adjusted. The customer has unlocked a free drink." : "Points adjusted and recorded in the audit log.", [
    `/admin/customers/${parsed.data.customerId}`,
    "/admin",
  ]);
}

export async function setAccountStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = z
    .object({
      userId: z.uuid(),
      status: z.enum(["active", "suspended"]),
      reason: z.string().trim().min(5, "Please give a reason of at least 5 characters.").max(280),
    })
    .safeParse({ userId: formData.get("userId"), status: formData.get("status"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await supabase.rpc("admin_set_account_status", {
    p_user: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  return done(data as RpcResult, parsed.data.status === "active" ? "Account reactivated." : "Account suspended.", [
    `/admin/customers/${parsed.data.userId}`,
    "/admin/customers",
  ]);
}

export async function setRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = z
    .object({ userId: z.uuid(), role: z.enum(["customer", "staff", "admin"]) })
    .safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) return { error: "Choose a valid role." };
  const { data, error } = await supabase.rpc("admin_set_role", { p_user: parsed.data.userId, p_role: parsed.data.role });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  return done(data as RpcResult, "Role updated.", [`/admin/customers/${parsed.data.userId}`, "/admin/settings"]);
}

export async function voidReward(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = z
    .object({ rewardId: z.uuid(), customerId: z.uuid(), reason: z.string().trim().min(5, "Please give a reason of at least 5 characters.").max(280) })
    .safeParse({ rewardId: formData.get("rewardId"), customerId: formData.get("customerId"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await supabase.rpc("admin_cancel_reward", { p_reward_id: parsed.data.rewardId, p_reason: parsed.data.reason });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  return done(data as RpcResult, "Reward voided. The customer starts a new card.", [`/admin/customers/${parsed.data.customerId}`, "/admin/rewards"]);
}

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const parsed = z
    .object({ timezone: z.string().trim().min(1).max(64), ttl: z.coerce.number().int().min(30).max(300) })
    .safeParse({ timezone: formData.get("timezone"), ttl: formData.get("ttl") });
  if (!parsed.success) return { error: "QR lifetime must be between 30 and 300 seconds." };
  const { data, error } = await supabase.rpc("admin_update_settings", { p_timezone: parsed.data.timezone, p_qr_ttl_seconds: parsed.data.ttl });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  return done(data as RpcResult, "Settings saved.", ["/admin/settings", "/admin/qr"]);
}

export async function revokeQr(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const sessionId = formData.get("sessionId");
  const parsed = z
    .object({ sessionId: z.uuid().nullable(), reason: z.string().trim().max(280) })
    .safeParse({ sessionId: sessionId ? String(sessionId) : null, reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) return { error: "Invalid request." };
  const { data, error } = await supabase.rpc("revoke_qr_sessions", {
    p_session_id: parsed.data.sessionId,
    p_reason: parsed.data.reason || "Revoked by administrator",
  });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  const r = data as RpcResult;
  if (r.code !== "OK") return { error: actionMessage(r.code) };
  revalidatePath("/admin/qr");
  return { ok: true, message: `${r.revoked} active ${r.revoked === 1 ? "code" : "codes"} revoked. The display will show a fresh code.` };
}

// ---------------------------------------------------------------------------
// Drinks
// ---------------------------------------------------------------------------
// Vercel limits request bodies to 4.5 MB, so uploads are capped at 4 MB.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function saveDrink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await admin();
  const id = String(formData.get("id") ?? "");
  const isNew = id === "new";
  if (!isNew && !z.uuid().safeParse(id).success) return { error: "Drink not found." };

  const parsed = drinkSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    accent_color: formData.get("accent_color"),
    sort_order: formData.get("sort_order") ?? 100,
    is_active: formData.get("is_active") === "on",
    is_reward_eligible: formData.get("is_reward_eligible") === "on",
    customization: parseCustomizationText(String(formData.get("customization") ?? "")),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0] ?? "Drink")}: ${issue.message}` };
  }

  const values: Record<string, unknown> = { ...parsed.data };
  if (formData.get("clear_sample") === "on") values.is_sample = false;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { error: "Images must be JPEG, PNG, WebP or AVIF." };
    if (file.size > MAX_IMAGE_BYTES) return { error: "Images must be 4 MB or smaller." };
    const path = `drinks/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("drink-images").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { error: "The image could not be uploaded. Please try again." };
    values.image_url = supabase.storage.from("drink-images").getPublicUrl(path).data.publicUrl;
  } else if (formData.get("remove_image") === "on") {
    values.image_url = null;
  }

  const query = isNew ? supabase.from("drinks").insert(values).select("id").single() : supabase.from("drinks").update(values).eq("id", id).select("id").single();
  const { data, error } = await query;
  if (error || !data) return { error: "The drink could not be saved." };

  revalidatePath("/admin/drinks");
  revalidatePath("/drinks");
  revalidatePath("/home");
  if (isNew) redirect(`/admin/drinks/${data.id}?saved=1`);
  return { ok: true, message: "Drink saved." };
}
