import { POINTS_PER_REWARD } from "./codes";

export type CardState = {
  points: number;
  remaining: number;
  unlocked: boolean;
  stamps: boolean[];
  label: string;
  summary: string;
};

export function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, "0");
}

/** Pure presentation of a loyalty balance. The balance itself always comes from the database. */
export function cardState(rawPoints: number, hasOpenReward: boolean): CardState {
  const points = Math.min(POINTS_PER_REWARD, Math.max(0, Math.trunc(rawPoints || 0)));
  const unlocked = hasOpenReward || points >= POINTS_PER_REWARD;
  const remaining = unlocked ? 0 : POINTS_PER_REWARD - points;
  const stamps = Array.from({ length: POINTS_PER_REWARD }, (_, i) => i < (unlocked ? POINTS_PER_REWARD : points));
  return {
    points: unlocked ? POINTS_PER_REWARD : points,
    remaining,
    unlocked,
    stamps,
    label: `${pad2(unlocked ? POINTS_PER_REWARD : points)} / ${POINTS_PER_REWARD} VISITS`,
    summary: unlocked
      ? "Your next drink is on us!"
      : `${remaining} more eligible ${remaining === 1 ? "visit" : "visits"} until your free drink.`,
  };
}
