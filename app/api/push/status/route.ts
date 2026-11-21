import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailReady } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

/** Setup check for phone notifications. Shares no secrets, only yes or no. */
export async function GET() {
  const keys = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && Boolean(process.env.VAPID_PRIVATE_KEY);
  let database = false;
  let anyPhones = false;
  try {
    const { count, error } = await createAdminClient().from("push_subscriptions").select("id", { count: "exact", head: true });
    database = !error;
    anyPhones = (count ?? 0) > 0;
  } catch {
    database = false;
  }
  return NextResponse.json({ keys, database, anyPhones, email: emailReady() }, { headers: { "Cache-Control": "no-store" } });
}
