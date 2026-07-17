/**
 * server/services/emailService.ts
 * All outgoing email delivery. Uses Resend in production, logs to console in dev.
 *
 * Design Decision (confirmed): Resend as email provider.
 * - In NODE_ENV=development: emails are logged to console, never sent.
 * - In NODE_ENV=production: emails sent via Resend API.
 * - All templates are inlined here for simplicity. Extract to separate files when > 8 templates.
 */
import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set. Email delivery is unavailable.');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM = `Stellar Guardian <noreply@${process.env.EMAIL_DOMAIN || 'stellarguardian.app'}>`;

// ─── Email Template Types ─────────────────────────────────────────────────────

type EmailPayload =
  | { type: 'invite'; to: string; eventTitle: string; role: string; inviteLink: string; message?: string }
  | { type: 'membership_approved'; to: string; name: string; eventTitle: string; eventLink: string }
  | { type: 'membership_rejected'; to: string; name: string; eventTitle: string }
  | { type: 'password_reset'; to: string; name: string; resetLink: string }
  | { type: 'email_verify'; to: string; name: string; verifyLink: string }
  | { type: 'winner_announced'; to: string; name: string; eventTitle: string; place: string; prizeAmount: string; txHash?: string }
  | { type: 'event_cancelled'; to: string; name: string; eventTitle: string }
  | { type: 'new_announcement'; to: string; name: string; eventTitle: string; announcementTitle: string; announcementBody: string; eventLink: string };

// ─── Template Renderer ────────────────────────────────────────────────────────

function renderTemplate(payload: EmailPayload): { subject: string; html: string } {
  const base = (title: string, body: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0;">
        <div style="margin-bottom: 32px;">
          <span style="font-size: 20px; font-weight: 700; color: #4f46e5;">⭐ Stellar Guardian</span>
        </div>
        ${body}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          You received this email from Stellar Guardian. 
          If you have questions, reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const btn = (href: string, text: string) =>
    `<a href="${href}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0;">${text}</a>`;

  switch (payload.type) {
    case 'invite':
      return {
        subject: `You're invited to join "${payload.eventTitle}" as a ${payload.role}`,
        html: base(
          `Invitation to ${payload.eventTitle}`,
          `<h2 style="color: #1e293b; margin-top: 0;">You're invited! 🎉</h2>
           <p style="color: #475569;">You've been invited to join <strong>${payload.eventTitle}</strong> as a <strong>${payload.role}</strong>.</p>
           ${payload.message ? `<blockquote style="border-left: 3px solid #4f46e5; padding-left: 16px; color: #64748b; margin: 16px 0;">${payload.message}</blockquote>` : ''}
           <p>${btn(payload.inviteLink, 'Accept Invitation')}</p>
           <p style="color: #94a3b8; font-size: 13px;">This invitation expires in 14 days.</p>`,
        ),
      };

    case 'membership_approved':
      return {
        subject: `Your application to "${payload.eventTitle}" was approved ✅`,
        html: base(
          'Application Approved',
          `<h2 style="color: #1e293b; margin-top: 0;">You're in! 🚀</h2>
           <p style="color: #475569;">Hi ${payload.name}, your application to <strong>${payload.eventTitle}</strong> has been approved.</p>
           <p>${btn(payload.eventLink, 'View Event')}</p>`,
        ),
      };

    case 'membership_rejected':
      return {
        subject: `Update on your application to "${payload.eventTitle}"`,
        html: base(
          'Application Update',
          `<h2 style="color: #1e293b; margin-top: 0;">Application Update</h2>
           <p style="color: #475569;">Hi ${payload.name}, unfortunately your application to <strong>${payload.eventTitle}</strong> was not approved at this time.</p>
           <p style="color: #94a3b8; font-size: 13px;">Keep an eye out for other events that might be a great fit.</p>`,
        ),
      };

    case 'password_reset':
      return {
        subject: 'Reset your Stellar Guardian password',
        html: base(
          'Password Reset',
          `<h2 style="color: #1e293b; margin-top: 0;">Reset your password</h2>
           <p style="color: #475569;">Hi ${payload.name}, we received a request to reset your password.</p>
           <p>${btn(payload.resetLink, 'Reset Password')}</p>
           <p style="color: #94a3b8; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
        ),
      };

    case 'email_verify':
      return {
        subject: 'Verify your Stellar Guardian email address',
        html: base(
          'Verify Email',
          `<h2 style="color: #1e293b; margin-top: 0;">Verify your email</h2>
           <p style="color: #475569;">Hi ${payload.name}, please verify your email address to complete your account setup.</p>
           <p>${btn(payload.verifyLink, 'Verify Email Address')}</p>`,
        ),
      };

    case 'winner_announced':
      return {
        subject: `🏆 You placed ${payload.place} in "${payload.eventTitle}"!`,
        html: base(
          'Winner Announcement',
          `<h2 style="color: #1e293b; margin-top: 0;">Congratulations! 🏆</h2>
           <p style="color: #475569;">Hi ${payload.name}, you placed <strong>${payload.place}</strong> in <strong>${payload.eventTitle}</strong>!</p>
           <p style="font-size: 24px; font-weight: 700; color: #4f46e5;">Prize: ${payload.prizeAmount} XLM</p>
           ${payload.txHash ? `<p style="color: #64748b; font-size: 13px;">Transaction: <a href="https://stellar.expert/explorer/testnet/tx/${payload.txHash}" style="color: #4f46e5;">${payload.txHash.substring(0, 16)}...</a></p>` : ''}`,
        ),
      };

    case 'event_cancelled':
      return {
        subject: `Event cancelled: "${payload.eventTitle}"`,
        html: base(
          'Event Cancelled',
          `<h2 style="color: #1e293b; margin-top: 0;">Event Cancelled</h2>
           <p style="color: #475569;">Hi ${payload.name}, we're sorry to inform you that <strong>${payload.eventTitle}</strong> has been cancelled.</p>
           <p style="color: #94a3b8; font-size: 13px;">If a prize was funded, you should receive information about any refunds shortly.</p>`,
        ),
      };

    case 'new_announcement':
      return {
        subject: `New announcement in "${payload.eventTitle}": ${payload.announcementTitle}`,
        html: base(
          'New Announcement',
          `<h2 style="color: #1e293b; margin-top: 0;">${payload.announcementTitle}</h2>
           <p style="color: #475569;">Hi ${payload.name}, there's a new announcement in <strong>${payload.eventTitle}</strong>:</p>
           <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; color: #475569;">${payload.announcementBody}</div>
           <p>${btn(payload.eventLink, 'View Event')}</p>`,
        ),
      };
  }
}

// ─── Main Send Function ───────────────────────────────────────────────────────

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { subject, html } = renderTemplate(payload);

  if (process.env.NODE_ENV !== 'production') {
    // In development: log to console so devs can see email content without sending
    console.log(
      JSON.stringify({
        level: 'info',
        msg: '[EMAIL DEV MOCK] Would send email',
        to: payload.to,
        type: payload.type,
        subject,
        ts: new Date().toISOString(),
      }),
    );
    return;
  }

  try {
    await getResend().emails.send({
      from: FROM,
      to: payload.to,
      subject,
      html,
    });
  } catch (err) {
    // Log but don't throw — email failure should NOT break the primary API response
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'Email delivery failed',
        to: payload.to,
        type: payload.type,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
  }
}
