"use client";

import { useActionState, useState } from "react";
import { registerAction, type FormState } from "../actions";
import { Field, Notice } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});
  const f = state.fields ?? {};
  const v = state.values ?? {};
  const [type, setType] = useState<"fren" | "staff">("fren");
  return (
    <form action={action} className="mt-7 space-y-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-ink">I am joining as</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "fren", title: "Palm Fren", body: "Collect points and get free drinks" },
              { value: "staff", title: "Palm Staff", body: "I work at Palm Bite" },
            ] as const
          ).map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-olive/20 ${
                type === o.value ? "border-olive-deep bg-sage-mist" : "border-line bg-surface hover:border-ink/25"
              }`}
            >
              <input
                type="radio"
                name="accountType"
                value={o.value}
                checked={type === o.value}
                onChange={() => setType(o.value)}
                className="sr-only"
              />
              <span className="type-heading block text-lg">{o.title}</span>
              <span className="mt-1 block text-sm leading-snug text-muted">{o.body}</span>
            </label>
          ))}
        </div>
        {type === "staff" && (
          <p className="mt-3 rounded-2xl bg-peach-soft px-4 py-3 text-sm leading-relaxed text-olive-night">
            A Palm Bite admin will approve your staff access. Until then you can use the app as a Palm Fren.
          </p>
        )}
      </fieldset>
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
