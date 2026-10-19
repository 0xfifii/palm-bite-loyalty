import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Notice } from "@/components/ui/Field";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Welcome back" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "");
  return (
    <>
      <h1 className="type-heading text-[1.9rem]">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to see your card and collect today&apos;s point.</p>
      <div className="mt-6 space-y-3">
        {sp.error === "link" && <Notice tone="error">That link has expired or was already used. Please sign in or request a new one.</Notice>}
        {sp.reset === "1" && <Notice tone="success">Password updated. Please sign in.</Notice>}
      </div>
      <LoginForm next={next} />
      <div className="mt-6 flex flex-col items-center gap-3 text-sm text-muted">
        <Link href="/forgot-password" className="font-semibold text-olive-deep underline underline-offset-4">
          Forgot your password?
        </Link>
        <p>
          New to Palm Bite Loyalty?{" "}
          <Link href="/join" className="font-semibold text-olive-deep underline underline-offset-4">
            Join the Club
          </Link>
        </p>
      </div>
    </>
  );
}
