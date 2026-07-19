/**
 * Email service using Resend (Req 16.2, 28.5).
 * Sends transactional emails for high-priority notifications.
 */
import "server-only";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend API.
 * Falls back gracefully if RESEND_API_KEY is not configured.
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured, skipping email send.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const from = params.from ?? "Stellar Guardian <noreply@stellarguardian.app>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }));
      return { success: false, error: err.message ?? `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email] Failed to send:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Send a notification email with standard template.
 */
export async function sendNotificationEmail(
  to: string,
  title: string,
  body: string,
  actionUrl?: string,
): Promise<EmailResult> {
  const actionHtml = actionUrl
    ? `<p style="margin-top: 16px;"><a href="${actionUrl}" style="background: #0066ff; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Details</a></p>`
    : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="font-size: 18px; font-weight: 600; color: #111; margin: 0 0 12px;">${title}</h2>
      <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0;">${body}</p>
      ${actionHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
      <p style="font-size: 12px; color: #999;">Stellar Guardian — Powered by Stellar</p>
    </div>
  `;

  return sendEmail({ to, subject: title, html });
}
