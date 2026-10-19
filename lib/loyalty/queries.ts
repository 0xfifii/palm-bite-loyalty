import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Drink, LoyaltyAccount, Redemption, Reward, Visit } from "@/lib/types";

/** Reads a customer's own loyalty data. RLS guarantees only their rows return. */
export async function loadCustomer(supabase: SupabaseClient, userId: string, opts: { visits?: number; rewards?: number } = {}) {
  const [account, rewards, redemptions, visits, settings] = await Promise.all([
    supabase.from("loyalty_accounts").select("*").eq("customer_id", userId).single<LoyaltyAccount>(),
    supabase
      .from("rewards")
      .select("*")
      .eq("customer_id", userId)
      .order("earned_at", { ascending: false })
      .limit(opts.rewards ?? 50),
    supabase
      .from("redemptions")
      .select("*")
      .eq("customer_id", userId)
      .order("requested_at", { ascending: false })
      .limit(100),
    supabase
      .from("visits")
      .select("id, customer_id, method, visit_date, cycle_number, created_at, note")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(opts.visits ?? 10),
    supabase.from("app_settings").select("business_timezone").single<{ business_timezone: string }>(),
  ]);

  const rewardList = (rewards.data ?? []) as Reward[];
  const redemptionList = (redemptions.data ?? []) as Redemption[];
  const openReward = rewardList.find((r) => r.status === "available" || r.status === "pending") ?? null;
  const pendingRedemption = openReward
    ? (redemptionList.find((d) => d.reward_id === openReward.id && d.status === "pending") ?? null)
    : null;

  return {
    account: account.data,
    rewards: rewardList,
    redemptions: redemptionList,
    openReward,
    pendingRedemption,
    visits: (visits.data ?? []) as Visit[],
    timezone: settings.data?.business_timezone ?? "Africa/Lagos",
  };
}

export async function loadDrinks(supabase: SupabaseClient, opts: { eligibleOnly?: boolean } = {}) {
  let q = supabase.from("drinks").select("*").eq("is_active", true).order("sort_order").order("name");
  if (opts.eligibleOnly) q = q.eq("is_reward_eligible", true);
  const { data } = await q;
  return (data ?? []) as Drink[];
}
