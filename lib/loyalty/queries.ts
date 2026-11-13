import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessSettings, CommunityItem, Drink, LoyaltyAccount, Redemption, Reward, Visit } from "@/lib/types";

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
  if (opts.eligibleOnly) q = q.eq("is_reward_eligible", true).eq("item_type", "drink");
  const { data } = await q;
  return (data ?? []) as Drink[];
}

/** Menu sections in the order Palm Bite presents them. */
export const MENU_SECTIONS: { key: string; title: string; blurb: string }[] = [
  { key: "Our Picks", title: "Our Picks", blurb: "Pairings we love" },
  { key: "Gems", title: "Gems", blurb: "Our signature drinks" },
  { key: "Slab", title: "Slab", blurb: "Our signature food" },
  { key: "Pastries", title: "Pastries", blurb: "Baked and filled" },
  { key: "Fresh", title: "Fresh", blurb: "Juice and iced drinks" },
  { key: "Palms Coffee", title: "Palms Coffee", blurb: "Hot and iced coffee" },
];

export function groupMenu(items: Drink[]) {
  const food = items.filter((d) => d.item_type !== "merch");
  const known = new Set(MENU_SECTIONS.map((s) => s.key));
  const sections = MENU_SECTIONS.map((s) => ({ ...s, items: food.filter((d) => d.category === s.key) })).filter((s) => s.items.length);
  const others = Array.from(new Set(food.filter((d) => !known.has(d.category)).map((d) => d.category)));
  for (const c of others) sections.push({ key: c, title: c, blurb: "", items: food.filter((d) => d.category === c) });
  return { sections, merch: items.filter((d) => d.item_type === "merch") };
}

export async function loadBusiness(supabase: SupabaseClient): Promise<BusinessSettings> {
  const { data } = await supabase.from("app_settings").select("order_link, whatsapp_number, store_address, payment_note").single();
  return {
    order_link: data?.order_link ?? "https://wa.me/message/DYZNLHGJWIAIC1",
    whatsapp_number: data?.whatsapp_number ?? null,
    store_address: data?.store_address ?? "Palm View, along UBA Gate",
    payment_note: data?.payment_note ?? null,
  };
}

/** Active clubs, plus events that have not finished yet. */
export async function loadCommunity(supabase: SupabaseClient) {
  const { data } = await supabase.from("community_items").select("*").eq("is_active", true).order("sort_order");
  const yesterday = Date.now() - 24 * 3600 * 1000;
  return ((data ?? []) as CommunityItem[]).filter((c) => c.kind === "club" || !c.starts_at || Date.parse(c.starts_at) > yesterday);
}
