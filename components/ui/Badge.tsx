import { REWARD_STATUS_LABELS, type RewardStatus } from "@/lib/loyalty/codes";

const tones = {
  olive: "bg-olive-deep text-cream",
  sage: "bg-sage-soft text-olive-night",
  peach: "bg-peach text-olive-night",
  muted: "bg-ink/6 text-muted",
  danger: "bg-danger-soft text-danger",
  light: "bg-cream/15 text-cream",
} as const;

export function Badge({ tone = "sage", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${tones[tone]}`}>
      {children}
    </span>
  );
}

const rewardTone: Record<RewardStatus, keyof typeof tones> = {
  available: "peach",
  pending: "olive",
  redeemed: "sage",
  cancelled: "muted",
};

export function RewardStatusBadge({ status }: { status: RewardStatus }) {
  return <Badge tone={rewardTone[status]}>{REWARD_STATUS_LABELS[status]}</Badge>;
}
