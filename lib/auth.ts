import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/**
 * Returns the verified user and their profile. getClaims() verifies the
 * session token's signature (locally with the project's signing keys, or with
 * Supabase Auth on older projects), so a forged cookie is rejected without an
 * extra network round trip on every page. The role always comes from the
 * database, never from the client.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const user = typeof sub === "string" ? { id: sub } : null;
  if (!user) return { supabase, user: null, profile: null } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, role, status, created_at")
    .eq("id", user.id)
    .single<Profile>();

  return { supabase, user, profile: profile ?? null } as const;
});

export async function requireUser(next = "/home") {
  const session = await getSession();
  if (!session.user || !session.profile) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (session.profile.status !== "active") {
    redirect("/suspended");
  }
  return { ...session, user: session.user, profile: session.profile };
}

export async function requireRole(roles: UserRole[], next = "/home") {
  const session = await requireUser(next);
  if (!roles.includes(session.profile.role)) {
    redirect("/home");
  }
  return session;
}

export function homeFor(role: UserRole | undefined | null): string {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/home";
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
