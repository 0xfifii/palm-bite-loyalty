"use client";

import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "../actions";
import { Notice } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <>
      <h1 className="type-heading text-[1.9rem]">Choose a new password</h1>
      <p className="mt-2 text-muted">Use at least 8 characters with a letter and a number.</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <PasswordField label="New password" name="password" autoComplete="new-password" required error={state.fields?.password} />
        <PasswordField label="Confirm password" name="confirm" autoComplete="new-password" required error={state.fields?.confirm} />
        <SubmitButton variant="dark" size="lg" full pendingLabel="Saving...">
          Save password
        </SubmitButton>
      </form>
    </>
  );
}
