"use server";

import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashIp, rateLimit } from "@/lib/security";
import { homeFor, safeNext } from "@/lib/auth";
import { emailSchema, fieldErrors, passwordSchema, registerSchema, signInSchema } from "@/lib/validation";

export type FormState = {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
};

const DEFAULT_CC = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "234";

async function limited(action: string, limit: number, windowSeconds: number): Promise<boolean> {
  const ip = hashIp(await clientIp());
  return !(await rateLimit(`${action}:${ip}`, limit, windowSeconds));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  if (await limited("register", 5, 600)) {
    return { error: "Too many sign-up attempts. Please wait a few minutes.", values };
  }

  const parsed = registerSchema(DEFAULT_CC).safeParse({ ...values, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const { fullName, phone, email, password } = parsed.data;
  const accountType = formData.get("accountType") === "staff" ? "staff" : "fren";

  const { data: conflicts } = await createAdminClient().rpc("registration_conflicts", {
    p_email: email,
    p_phone: phone,
  });
  const c = (conflicts ?? {}) as { email_taken?: boolean; phone_taken?: boolean };
  if (c.email_taken || c.phone_taken) {
    return {
      fields: {
        ...(c.email_taken ? { email: "An account with this email already exists. Try signing in." } : {}),
        ...(c.phone_taken ? { phone: "This phone number is already registered." } : {}),
      },
      values,
    };
  }

  const supabase = await createClient();
  const { data: signUp, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // account_type only records a request; staff access needs admin approval.
      data: { full_name: fullName, phone, account_type: accountType },
      emailRedirectTo: `${serverEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/home`,
    },
  });

  if (error) {
    const msg = /registered|exists/i.test(error.message)
      ? "An account with this email already exists. Try signing in."
      : /database error/i.test(error.message)
        ? "This email or phone number is already registered."
        : "We couldn't create your account right now. Please try again.";
    return { error: msg, values };
  }

  // Projects with email confirmation turned off sign the customer in immediately.
  if (signUp.session) redirect("/home");
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const next = safeNext(formData.get("next"), "");

  if (await limited("signin", 10, 300)) {
    return { error: "Too many sign-in attempts. Please wait a few minutes.", values };
  }

  const parsed = signInSchema.safeParse({ email: values.email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    const unconfirmed = error && /confirm/i.test(error.message);
    return {
      error: unconfirmed
        ? "Please confirm your email first. Check your inbox for the Palm Bite link."
        : "That email and password don't match our records.",
      values,
    };
  }

  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).single();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return { error: "This account is paused. Please speak with a Palm Bite team member.", values };
  }

  redirect(next || homeFor(profile.role));
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await limited("recover", 5, 600)) {
    return { error: "Too many requests. Please wait a few minutes." };
  }
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) return { fields: { email: "Please enter a valid email address." } };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${serverEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  // Same response whether or not the account exists, to avoid account discovery.
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { fields: { password: parsed.error.issues[0].message } };
  if (password !== confirm) return { fields: { confirm: "Passwords do not match." } };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We couldn't update your password. Please request a new link." };
  redirect("/home?password=updated");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
