import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Join the Club" };

export default function JoinPage() {
  return (
    <>
      <h1 className="type-heading text-[1.9rem]">Join the Club</h1>
      <p className="mt-2 text-muted">Your card starts at zero. Your first point comes with your first visit.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-olive-deep underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
