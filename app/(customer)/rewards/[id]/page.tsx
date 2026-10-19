import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadDrinks } from "@/lib/loyalty/queries";
import type { Reward } from "@/lib/types";
import { ChooseDrink } from "./ChooseDrink";

export const metadata: Metadata = { title: "Choose your drink" };

export default async function ChooseRewardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser(`/rewards/${id}`);
  const { data: reward } = await supabase.from("rewards").select("*").eq("id", id).maybeSingle<Reward>();
  if (!reward) notFound();
  if (reward.status !== "available") redirect("/rewards");
  const drinks = await loadDrinks(supabase, { eligibleOnly: true });
  return <ChooseDrink rewardId={reward.id} drinks={drinks} />;
}
