import { Resend } from 'resend';

const FROM_EMAIL = process.env.EMAIL_FROM || 'Popper <noreply@regain.ai>';

// Lazy-load Resend client to avoid errors when API key is not set
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  inviteUrl,
  role,
}: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  const resend = getResendClient();

  if (!resend) {
    console.warn('RESEND_API_KEY not set, skipping email send');
    return { success: false }; // Email not configured
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "You've been invited to Popper Dashboard",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="display: inline-block; width: 48px; height: 48px; background: #0f172a; border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 20px;">P</div>
  </div>

  <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; text-align: center;">You're invited to Popper</h1>

  <p style="margin-bottom: 16px;">
    <strong>${inviterName}</strong> has invited you to join the Popper Safety Operations Dashboard as a <strong>${role}</strong>.
  </p>

  <p style="margin-bottom: 24px;">
    Click the button below to set up your account. This invite expires in 48 hours.
  </p>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${inviteUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
      Accept Invitation
    </a>
  </div>

  <p style="font-size: 14px; color: #666; margin-bottom: 16px;">
    Or copy and paste this link into your browser:
  </p>
  <p style="font-size: 14px; color: #666; word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 6px;">
    ${inviteUrl}
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="font-size: 12px; color: #999; text-align: center;">
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
</body>
</html>
      `.trim(),
      text: `
You've been invited to Popper Dashboard

${inviterName} has invited you to join the Popper Safety Operations Dashboard as a ${role}.

Click the link below to set up your account. This invite expires in 48 hours.

${inviteUrl}

If you didn't expect this invitation, you can safely ignore this email.
      `.trim(),
    });

    if (error) {
      console.error('Failed to send invite email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error sending invite email:', err);
    return { success: false, error: 'Failed to send email' };
  }
}
