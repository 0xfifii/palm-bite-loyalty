"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { testPush } from "./push";
import { emailReady, emailUser } from "./email";

const sub = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Saves this device so Palm Bite can send order updates to it. */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser("/orders");
  const parsed = sub.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { data, error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  return { ok: !error && (data as { code: string })?.code === "OK" };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser("/orders");
  const { error } = await supabase.rpc("remove_push_subscription", { p_endpoint: String(endpoint).slice(0, 1000) });
  return { ok: !error };
}

export async function sendTestNotification() {
  const { user } = await requireUser("/notifications");
  return testPush(user.id);
}

export async function sendTestEmail(): Promise<{ ready: boolean; to: string | null }> {
  const { user, profile } = await requireUser("/notifications");
  if (!emailReady()) return { ready: false, to: null };
  await emailUser(user.id, {
    subject: "Palm Bite: test email",
    heading: "Email notifications work",
    body: "You'll get Palm Bite order emails like this one.",
    url: "/notifications",
    button: "Open Palm Bite",
    urgent: true,
  });
  return { ready: true, to: profile.email };
}
