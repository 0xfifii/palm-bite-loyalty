/**
 * Palm Bite accepts only its own email and password sign-in (and the email
 * links for confirming an account or resetting a password). Sessions made
 * through any outside app or provider are treated as signed out.
 */
type Claims = {
  is_anonymous?: boolean;
  app_metadata?: { provider?: string; providers?: string[] };
  amr?: { method?: string }[];
};

const OUTSIDE_METHODS = new Set(["oauth", "sso/saml", "anonymous", "web3", "id_token"]);

export function isThirdPartySession(claims: unknown): boolean {
  if (!claims || typeof claims !== "object") return false;
  const c = claims as Claims;
  if (c.is_anonymous) return true;
  const provider = c.app_metadata?.provider;
  if (provider && provider !== "email") return true;
  return (c.amr ?? []).some((a) => OUTSIDE_METHODS.has(String(a?.method ?? "")));
}
