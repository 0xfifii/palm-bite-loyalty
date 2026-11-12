import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Lets the counter display know when its code has been claimed, so it can show a fresh one. Staff only (RLS). */
export async function GET(request: Request) {
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("sid"));
  if (!id.success) return NextResponse.json({ code: "INVALID" }, { status: 400 });
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("qr_sessions").select("consumed_at, revoked_at").eq("id", id.data).maybeSingle();
    if (!data) return NextResponse.json({ code: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { code: "OK", consumed: Boolean(data.consumed_at), revoked: Boolean(data.revoked_at) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ code: "TEMPORARY_ERROR" }, { status: 503 });
  }
}
