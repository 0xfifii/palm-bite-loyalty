import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Order emails through Brevo (brevo.com). Turned on by setting
 * BREVO_API_KEY and BREVO_SENDER_EMAIL (a sender verified in Brevo).
 * Staff emails are marked high priority so phones alert for them.
 */
export type EmailMessage = { subject: string; heading: string; body: string; url: string; button: string; urgent?: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailReady() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

function html(m: EmailMessage, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#F4EFE3;font-family:Arial,Helvetica,sans-serif;color:#1D2119">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FBF7EE;border-radius:20px;overflow:hidden">
<tr><td style="background:#5d724b;padding:20px 24px;color:#FBF7EE;font-size:20px;font-weight:bold">Palm Bite Cafe</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:22px">${esc(m.heading)}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;white-space:pre-line">${esc(m.body)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#1D2119;color:#FBF7EE;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold">${esc(m.button)}</a>
</td></tr>
<tr><td style="padding:0 24px 20px;font-size:12px;color:#6B6B5E">pour. sip. stay a while.</td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to: { email: string; name?: string }[], m: EmailMessage) {
  if (!emailReady() || !to.length) return;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://palmbitecafe.app").replace(/\/$/, "");
  const link = `${site}${m.url}`;
  // One email per person so addresses are never shared between recipients.
  await Promise.all(
    to.map(async (r) => {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || "Palm Bite Cafe" },
            to: [r.name ? { email: r.email, name: r.name } : { email: r.email }],
            subject: m.subject,
            htmlContent: html(m, link),
            textContent: `${m.heading}\n\n${m.body}\n\n${m.button}: ${link}`,
            ...(m.urgent ? { headers: { "X-Priority": "1 (Highest)", Importance: "high", "X-MSMail-Priority": "High", Priority: "urgent" } } : {}),
            tags: ["palm-bite-order"],
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) console.error("[email] brevo refused", res.status, (await res.text()).slice(0, 200));
      } catch (e) {
        console.error("[email] send failed", e);
      }
    }),
  );
}

/** Emails every active staff member and admin (or ORDER_EMAIL_TO if set). */
export async function emailStaff(m: EmailMessage) {
  if (!emailReady()) return;
  const override = (process.env.ORDER_EMAIL_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (override.length) return send(override.map((email) => ({ email })), { ...m, urgent: true });
  const { data } = await createAdminClient().from("profiles").select("email, full_name").in("role", ["staff", "admin"]).eq("status", "active");
  await send((data ?? []).filter((p) => p.email).map((p) => ({ email: p.email, name: p.full_name })), { ...m, urgent: true });
}

/** Emails one Palm Fren about their own order. */
export async function emailUser(userId: string, m: EmailMessage) {
  if (!emailReady()) return;
  const { data } = await createAdminClient().from("profiles").select("email, full_name").eq("id", userId).single();
  if (data?.email) await send([{ email: data.email, name: data.full_name }], m);
}
