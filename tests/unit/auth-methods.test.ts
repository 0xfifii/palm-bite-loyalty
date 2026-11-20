import { describe, expect, it } from "vitest";
import { isThirdPartySession } from "@/lib/auth-methods";

describe("isThirdPartySession", () => {
  it("accepts Palm Bite email and password, and email links", () => {
    expect(isThirdPartySession({ app_metadata: { provider: "email" }, amr: [{ method: "password" }] })).toBe(false);
    expect(isThirdPartySession({ app_metadata: { provider: "email" }, amr: [{ method: "otp" }] })).toBe(false);
    expect(isThirdPartySession({ sub: "x" })).toBe(false);
  });
  it("refuses outside apps and providers", () => {
    expect(isThirdPartySession({ app_metadata: { provider: "google" } })).toBe(true);
    expect(isThirdPartySession({ app_metadata: { provider: "email" }, amr: [{ method: "oauth" }] })).toBe(true);
    expect(isThirdPartySession({ is_anonymous: true })).toBe(true);
    expect(isThirdPartySession({ amr: [{ method: "sso/saml" }] })).toBe(true);
  });
});
