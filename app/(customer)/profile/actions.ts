"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fieldErrors, nameSchema, phoneSchema, usernameSchema } from "@/lib/validation";

export type ProfileState = { ok?: boolean; error?: string; fields?: Record<string, string> };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const { supabase, user } = await requireUser("/profile");
  const schema = z.object({
    fullName: nameSchema,
    phone: phoneSchema(process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "234"),
    username: usernameSchema,
  });
  const parsed = schema.safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone"), username: formData.get("username") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  // Column-level grants allow only full_name, phone and username to be changed.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone, username: parsed.data.username })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return /username/i.test(error.message)
        ? { fields: { username: "That username is taken. Please pick another." } }
        : { fields: { phone: "This phone number is already registered." } };
    }
    return { error: "We couldn't save your details. Please try again." };
  }
  revalidatePath("/profile");
  revalidatePath("/home");
  return { ok: true };
}
