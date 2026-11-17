"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "../actions";
import { Field, Notice } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="next" value={next} />
      <Field
        label="Email or username"
        name="identifier"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        defaultValue={state.values?.identifier}
        error={f.identifier}
      />
      <PasswordField label="Password" name="password" autoComplete="current-password" required error={f.password} />
      <SubmitButton variant="dark" size="lg" full trailingArrow pendingLabel="Signing in...">
        Sign in
      </SubmitButton>
    </form>
  );
}
