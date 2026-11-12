/**
 * Machine-readable response codes and the customer-facing copy for each.
 * Client-safe: contains no secrets or server logic.
 */
export const SCAN_CODES = [
  "POINT_AWARDED",
  "ALREADY_COLLECTED_TODAY",
  "QR_EXPIRED",
  "QR_INVALID",
  "QR_REVOKED",
  "UNAUTHENTICATED",
  "REWARD_PENDING_REDEMPTION",
  "TEMPORARY_ERROR",
  "ACCOUNT_SUSPENDED",
  "RATE_LIMITED",
  "APPROVAL_PENDING",
  "QR_USED",
  "VISIT_REJECTED",
  "REQUEST_EXPIRED",
] as const;

export type ScanCode = (typeof SCAN_CODES)[number];

export const POINTS_PER_REWARD = 15;

export type ScanMessage = { title: string; body: string; tone: "success" | "info" | "error" };

export const SCAN_MESSAGES: Record<ScanCode, ScanMessage> = {
  POINT_AWARDED: {
    title: "+1 POINT!",
    body: "Another visit, another step closer to your next free drink.",
    tone: "success",
  },
  ALREADY_COLLECTED_TODAY: {
    title: "Already collected",
    body: "You've already collected your Palm Bite point for today. Come back again tomorrow!",
    tone: "info",
  },
  QR_EXPIRED: {
    title: "Code expired",
    body: "This QR code has expired. Please scan the current Palm Bite code.",
    tone: "error",
  },
  QR_INVALID: {
    title: "Visit not verified",
    body: "We couldn't verify this visit. Please scan the QR displayed at Palm Bite.",
    tone: "error",
  },
  QR_REVOKED: {
    title: "Code no longer valid",
    body: "This QR code has been withdrawn. Please scan the current Palm Bite code or ask a team member.",
    tone: "error",
  },
  UNAUTHENTICATED: {
    title: "Please sign in",
    body: "Sign in to your Palm Bite Loyalty account to collect your point.",
    tone: "info",
  },
  REWARD_PENDING_REDEMPTION: {
    title: "Your free drink is waiting",
    body: "You have a reward ready. Redeem it first, then your next card begins.",
    tone: "info",
  },
  TEMPORARY_ERROR: {
    title: "Connection problem",
    body: "We couldn't reach Palm Bite right now. No point has been added. Please try again.",
    tone: "error",
  },
  ACCOUNT_SUSPENDED: {
    title: "Account paused",
    body: "Your account is currently paused. Please speak with a Palm Bite team member.",
    tone: "error",
  },
  RATE_LIMITED: {
    title: "Slow down a little",
    body: "Too many attempts in a short time. Please wait a minute and try again.",
    tone: "error",
  },
  APPROVAL_PENDING: {
    title: "Waiting for Palm Staff",
    body: "Show this screen at the counter. Your point is added as soon as a Palm Staff member approves.",
    tone: "info",
  },
  QR_USED: {
    title: "Code already used",
    body: "Each code works for one Palm Fren. Please scan the new code on the screen.",
    tone: "error",
  },
  VISIT_REJECTED: {
    title: "Visit not approved",
    body: "A Palm Staff member didn't approve this visit. Please speak to them if you think this is a mistake.",
    tone: "error",
  },
  REQUEST_EXPIRED: {
    title: "Approval timed out",
    body: "Your visit wasn't approved in time. Please scan the new code on the screen.",
    tone: "error",
  },
};

export const CAMERA_ERROR_MESSAGE =
  "We couldn't access your camera. Please allow camera access or ask a team member for assistance.";

export function isScanCode(value: unknown): value is ScanCode {
  return typeof value === "string" && (SCAN_CODES as readonly string[]).includes(value);
}

export const REWARD_STATUS_LABELS = {
  available: "Available",
  pending: "Awaiting Confirmation",
  redeemed: "Redeemed",
  cancelled: "Cancelled",
} as const;

export type RewardStatus = keyof typeof REWARD_STATUS_LABELS;

export const ACTION_MESSAGES: Record<string, string> = {
  FORBIDDEN: "You do not have permission to do that.",
  UNAUTHENTICATED: "Please sign in again.",
  REWARD_NOT_FOUND: "We couldn't find that reward.",
  REWARD_NOT_AVAILABLE: "This reward is no longer available to choose.",
  REWARD_EXPIRED: "This reward has expired.",
  DRINK_NOT_ELIGIBLE: "That drink isn't eligible as a reward right now.",
  INVALID_CUSTOMIZATION: "One of the selected options isn't available for this drink.",
  REDEMPTION_NOT_FOUND: "No redemption matches that reference.",
  ALREADY_REDEEMED: "This reward has already been redeemed.",
  REDEMPTION_CANCELLED: "This redemption request was cancelled.",
  REDEMPTION_NOT_PENDING: "This redemption is no longer pending.",
  REWARD_NOT_PENDING: "This reward is not awaiting confirmation.",
  OWNERSHIP_MISMATCH: "This reference does not match the reward owner. Do not serve.",
  ACCOUNT_SUSPENDED: "This account is suspended.",
  CUSTOMER_NOT_FOUND: "Customer not found.",
  INVALID_ADJUSTMENT: "That adjustment is not allowed.",
  REASON_REQUIRED: "Please give a reason of at least 5 characters.",
  REWARD_PENDING_REDEMPTION: "This customer has an open reward. Redeem or void it first.",
  REQUEST_NOT_FOUND: "That visit request no longer exists.",
  ALREADY_DECIDED: "Another Palm Staff member already handled this visit.",
  NO_PENDING_REQUEST: "This person has no pending staff request.",
  CANNOT_CHANGE_SELF: "You cannot change your own account this way.",
  INVALID_TIMEZONE: "That timezone is not recognised.",
  INVALID_TTL: "QR lifetime must be between 30 and 300 seconds.",
  TEMPORARY_ERROR: "Something went wrong. Please try again.",
};

export function actionMessage(code: string | undefined | null): string {
  return (code && ACTION_MESSAGES[code]) || ACTION_MESSAGES.TEMPORARY_ERROR;
}
