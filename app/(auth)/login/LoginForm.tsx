"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "../actions";
import { Field, Notice } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={f.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={f.password} />
      <SubmitButton variant="dark" size="lg" full trailingArrow pendingLabel="Signing in...">
        Sign in
      </SubmitButton>
    </form>
  );
}
