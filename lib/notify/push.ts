import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url: string; tag?: string };

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

async function deliver(subs: Sub[], msg: PushMessage) {
  const db = createAdminClient();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          { TTL: 60 * 60, urgency: "high" },
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The phone unsubscribed or the browser forgot it: tidy up.
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
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

/** Notifies every active staff member and admin. */
export async function notifyStaff(msg: PushMessage) {
  if (!ready()) return;
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
