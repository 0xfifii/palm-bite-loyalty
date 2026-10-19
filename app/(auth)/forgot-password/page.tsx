"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type FormState } from "../actions";
import { Field, Notice } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  return (
    <>
      <h1 className="type-heading text-[1.9rem]">Reset your password</h1>
      <p className="mt-2 text-muted">Enter the email on your card and we&apos;ll send you a reset link.</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fields?.email} />
        <SubmitButton variant="dark" size="lg" full pendingLabel="Sending...">
          Send reset link
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-olive-deep underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
