"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "../actions";
import { Field, Notice } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});
  const f = state.fields ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="mt-7 space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Full name" name="fullName" autoComplete="name" required defaultValue={v.fullName} error={f.fullName} />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="0803 123 4567"
        defaultValue={v.phone}
        error={f.phone}
        hint="Staff use this to find your card if you can't scan."
      />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={f.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={f.password}
        hint="At least 8 characters with a letter and a number."
      />
      <SubmitButton variant="dark" size="lg" full trailingArrow pendingLabel="Creating your card...">
        Create my card
      </SubmitButton>
      <p className="text-xs leading-relaxed text-muted">
        We use your details only to run your Palm Bite loyalty card. We will email you a link to confirm your address.
      </p>
    </form>
  );
}
