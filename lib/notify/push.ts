import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url: string; tag?: string; sticky?: boolean; badge?: number };

let configured: boolean | null = null;

function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@palmbitecafe.app", pub, priv);
  return (configured = true);
}

type Sub = { endpoint: string; p256dh: string; auth: string };

async function deliver(subs: Sub[], msg: PushMessage): Promise<{ sent: number; failed: { status?: number; message: string }[] }> {
  const db = createAdminClient();
  let sent = 0;
  const failed: { status?: number; message: string }[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          // Kept for up to 24 hours, so a phone that was off or offline still gets it.
          { TTL: 24 * 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        failed.push({ status: err.statusCode, message: String(err.body || err.message || "unknown").slice(0, 200) });
        // The phone unsubscribed or the browser forgot it: tidy up.
        if (err.statusCode === 404 || err.statusCode === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
  return { sent, failed };
}

/** For the notification check screen: sends a test to the signed-in person. */
export async function testPush(userId: string) {
  const configured = ready();
  if (!configured) return { configured, devices: 0, sent: 0, failed: [] as { status?: number; message: string }[] };
  const { data } = await createAdminClient().from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  const subs = data ?? [];
  if (!subs.length) return { configured, devices: 0, sent: 0, failed: [] };
  const r = await deliver(subs, { title: "Palm Bite test notification", body: "It works! You'll get order updates like this.", url: "/notifications", tag: "pb-test" });
  return { configured, devices: subs.length, ...r };
}

/** Notifies one Palm Fren on every device they turned notifications on for. */
export async function notifyUser(userId: string, msg: PushMessage) {
  if (!ready()) return;
  try {
    const { data } = await createAdminClient().from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
    if (data?.length) await deliver(data, msg);
  } catch (e) {
    console.error("[push] user notify failed", e);
  }
}

/** Notifies every active staff member and admin (stays on screen until seen). */
export async function notifyStaff(msg: PushMessage) {
  if (!ready()) return;
  msg = { sticky: true, ...msg };
  try {
    const { count } = await createAdminClient().from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
    if (count) msg = { ...msg, badge: count };
  } catch {
    /* badge is optional */
  }
  try {
    const { data } = await createAdminClient()
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, profiles!inner(role, status)")
      .in("profiles.role", ["staff", "admin"])
      .eq("profiles.status", "active");
    if (data?.length) await deliver(data as unknown as Sub[], msg);
  } catch (e) {
    console.error("[push] staff notify failed", e);
  }
}
