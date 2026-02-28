/**
 * Sends the magic-link email via Resend (production only).
 * Requires: RESEND_API_KEY, APP_BASE_URL. Optional: MAGIC_LINK_FROM_EMAIL (defaults to onboarding@resend.dev).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const FROM_EMAIL = process.env.MAGIC_LINK_FROM_EMAIL ?? "Clawkpit <onboarding@resend.dev>";

export function canSendMagicLinkEmail(): boolean {
  return Boolean(RESEND_API_KEY && APP_BASE_URL);
}

export async function sendMagicLinkEmail(
  to: string,
  token: string,
  expiresAt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!RESEND_API_KEY || !APP_BASE_URL) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY, APP_BASE_URL)" };
  }
  const link = `${APP_BASE_URL.replace(/\/$/, "")}/login?token=${encodeURIComponent(token)}`;
  const expiresDate = new Date(expiresAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Your Clawkpit sign-in link",
      html: `
        <p>Use the link below to sign in to Clawkpit. It expires at ${expiresDate}.</p>
        <p><a href="${link}">Sign in to Clawkpit</a></p>
        <p>If you didn't request this, you can ignore this email.</p>
      `.trim(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return { ok: false, error: message };
  }
}

/** Sends the email-change verification link to the new address (production). */
export async function sendEmailChangeVerificationEmail(
  toNewEmail: string,
  token: string,
  expiresAt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!RESEND_API_KEY || !APP_BASE_URL) {
    return { ok: false, error: "Email not configured (RESEND_API_KEY, APP_BASE_URL)" };
  }
  const link = `${APP_BASE_URL.replace(/\/$/, "")}/confirm-email-change?token=${encodeURIComponent(token)}`;
  const expiresDate = new Date(expiresAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toNewEmail],
      subject: "Confirm your new email address — Clawkpit",
      html: `
        <p>You requested to change your Clawkpit account email to this address.</p>
        <p><a href="${link}">Confirm this email address</a></p>
        <p>This link expires at ${expiresDate}. If you didn't request this, you can ignore this email.</p>
      `.trim(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return { ok: false, error: message };
  }
}
