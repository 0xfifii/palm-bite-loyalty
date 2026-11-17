"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";
import { Field, Notice } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export function ProfileForm({ fullName, phone, email, username }: { fullName: string; phone: string | null; email: string; username: string | null }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.ok && <Notice tone="success">Your details are saved.</Notice>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Full name" name="fullName" defaultValue={fullName} autoComplete="name" error={state.fields?.fullName} />
      <Field
        label="Username"
        name="username"
        defaultValue={username ?? ""}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Pick a username"
        error={state.fields?.username}
        hint={username ? "You can sign in with this instead of your email." : "Add a username so you can sign in with it. Nobody else can use the same one."}
      />
      <Field label="Phone number" name="phone" type="tel" defaultValue={phone ?? ""} autoComplete="tel" error={state.fields?.phone} />
      <Field label="Email" name="email" type="email" value={email} readOnly disabled hint="Contact Palm Bite to change the email on your account." />
      <SubmitButton variant="dark" pendingLabel="Saving...">
        Save changes
      </SubmitButton>
    </form>
  );
}
