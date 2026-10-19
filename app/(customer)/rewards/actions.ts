"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionMessage } from "@/lib/loyalty/codes";
import type { RpcResult } from "@/lib/types";

const chooseSchema = z.object({
  rewardId: z.uuid(),
  drinkId: z.uuid(),
  customizations: z.record(z.string().max(40), z.union([z.string().max(40), z.array(z.string().max(40)).max(12)])),
});

export type ChooseState = { error?: string; reference?: string; drinkName?: string };

/** Creates a pending redemption. The database verifies ownership, status and eligibility. */
export async function chooseRewardDrink(input: unknown): Promise<ChooseState> {
  const parsed = chooseSchema.safeParse(input);
  if (!parsed.success) return { error: "Please choose a drink and its options." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_reward_drink", {
    p_reward_id: parsed.data.rewardId,
    p_drink_id: parsed.data.drinkId,
    p_customizations: parsed.data.customizations,
  });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  const result = data as RpcResult;
  if (result.code !== "REDEMPTION_REQUESTED") return { error: actionMessage(result.code) };

  revalidatePath("/home");
  revalidatePath("/rewards");
  return { reference: String(result.reference), drinkName: String(result.drink_name) };
}

export async function cancelMyRedemption(reference: string): Promise<{ error?: string }> {
  if (typeof reference !== "string" || !/^PB-[0-9A-Z]{6}$/.test(reference)) return { error: actionMessage("REDEMPTION_NOT_FOUND") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_redemption", { p_reference: reference, p_reason: "Customer changed drink" });
  if (error) return { error: actionMessage("TEMPORARY_ERROR") };
  const result = data as RpcResult;
  if (result.code !== "REDEMPTION_CANCELLED") return { error: actionMessage(result.code) };
  revalidatePath("/home");
  revalidatePath("/rewards");
  return {};
}
