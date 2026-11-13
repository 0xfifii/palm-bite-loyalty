export type UserRole = "customer" | "staff" | "admin";
export type AccountStatus = "active" | "suspended";
export type RewardStatus = "available" | "pending" | "redeemed" | "cancelled";
export type RedemptionStatus = "pending" | "completed" | "cancelled";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  staff_request?: "pending" | "approved" | "declined" | null;
};

export type LoyaltyAccount = {
  customer_id: string;
  current_points: number;
  cycle_number: number;
  total_visits: number;
  rewards_redeemed: number;
  updated_at: string;
};

export type Visit = {
  id: string;
  customer_id: string;
  method: "qr" | "staff_assisted";
  visit_date: string;
  cycle_number: number;
  created_at: string;
  note: string | null;
};

export type Reward = {
  id: string;
  customer_id: string;
  cycle_number: number;
  reference: string;
  status: RewardStatus;
  earned_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type CustomizationGroup = {
  name: string;
  options: string[];
  multi?: boolean;
};

export type Drink = {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  accent_color: string;
  is_active: boolean;
  is_reward_eligible: boolean;
  is_sample: boolean;
  customization: CustomizationGroup[];
  sort_order: number;
  price_naira: number | null;
  item_type: "drink" | "food" | "pick" | "merch";
  art: string;
};

export type CommunityItem = {
  id: string;
  kind: "club" | "event";
  title: string;
  tagline: string;
  description: string;
  schedule: string;
  location: string;
  join_link: string | null;
  starts_at: string | null;
  icon: "fitness" | "book" | "spark";
  is_active: boolean;
  sort_order: number;
};

export type OrderLine = { id: string; name: string; qty: number; price: number; line_total: number };

export type Order = {
  id: string;
  reference: string;
  customer_id: string;
  items: OrderLine[];
  total_naira: number;
  fulfilment: "pickup" | "dine_in" | "delivery";
  note: string | null;
  status: "new" | "confirmed" | "ready" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type BusinessSettings = {
  order_link: string;
  whatsapp_number: string | null;
  store_address: string;
  payment_note: string | null;
};

export type Redemption = {
  id: string;
  reward_id: string;
  customer_id: string;
  drink_id: string;
  drink_name: string;
  customizations: Record<string, string | string[]>;
  reference: string;
  status: RedemptionStatus;
  requested_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type RpcResult = { code: string; [key: string]: unknown };
