/**
 * Email Service for Collaboration Invitations
 * MVP Phase 1 - Basic email sending stub
 * 
 * For production, integrate with:
 * - Resend (recommended): https://resend.com
 * - SendGrid: https://sendgrid.com
 * - Postmark: https://postmarkapp.com
 * - AWS SES: https://aws.amazon.com/ses/
 */

export interface SendInvitationEmailParams {
  to: string;
  invitationUrl: string;
  projectId: string;
  projectName: string;
  inviterName: string;
}

export class EmailService {
  /**
   * Send project invitation email
   * 
   * MVP Implementation: Logs to console
   * Production: Send actual email via email service provider
   */
  static async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    const { to, invitationUrl, projectName, inviterName } = params;

    // MVP: Log invitation details
    console.log('======================================');
    console.log('[EMAIL] Project Invitation');
    console.log('======================================');
    console.log(`To: ${to}`);
    console.log(`From: ${inviterName}`);
    console.log(`Project: ${projectName}`);
    console.log(`Invitation URL: ${invitationUrl}`);
    console.log('======================================');
    console.log('');
    console.log('Email Content:');
    console.log('');
    console.log(`Subject: ${inviterName} invited you to collaborate on ${projectName}`);
    console.log('');
    console.log('Body:');
    console.log(`Hi there,`);
    console.log('');
    console.log(`${inviterName} has invited you to collaborate on the project "${projectName}".`);
    console.log('');
    console.log(`Click the link below to accept the invitation:`);
    console.log(`${invitationUrl}`);
    console.log('');
    console.log(`This invitation will expire in 7 days.`);
    console.log('');
    console.log(`If you weren't expecting this invitation, you can safely ignore this email.`);
    console.log('');
    console.log('======================================');

    // TODO: Production implementation
    // Example with Resend:
    // 
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // 
    // await resend.emails.send({
    //   from: 'Dyad Collaborative <noreply@your-domain.com>',
    //   to,
    //   subject: `${inviterName} invited you to collaborate on ${projectName}`,
    //   html: renderInvitationEmailTemplate(params),
    // });
  }

  /**
   * Send invitation accepted notification to project owner
   */
  static async sendInvitationAcceptedEmail(params: {
    to: string;
    projectName: string;
    collaboratorName: string;
    collaboratorEmail: string;
  }): Promise<void> {
    const { to, projectName, collaboratorName, collaboratorEmail } = params;

    console.log('======================================');
    console.log('[EMAIL] Invitation Accepted');
    console.log('======================================');
    console.log(`To: ${to}`);
    console.log(`Project: ${projectName}`);
    console.log(`New Collaborator: ${collaboratorName} (${collaboratorEmail})`);
    console.log('======================================');
  }

  /**
   * Send invitation rejected notification to project owner
   */
  static async sendInvitationRejectedEmail(params: {
    to: string;
    projectName: string;
    rejectedEmail: string;
  }): Promise<void> {
    const { to, projectName, rejectedEmail } = params;

    console.log('======================================');
    console.log('[EMAIL] Invitation Rejected');
    console.log('======================================');
    console.log(`To: ${to}`);
    console.log(`Project: ${projectName}`);
    console.log(`Rejected By: ${rejectedEmail}`);
    console.log('======================================');
  }
}

/**
 * HTML Email Template for Invitation
 * Production-ready responsive email template
 */
function renderInvitationEmailTemplate(params: SendInvitationEmailParams): string {
  const { invitationUrl, projectName, inviterName } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                Project Collaboration Invitation
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #4a4a4a;">
                Hi there,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #4a4a4a;">
                <strong>${inviterName}</strong> has invited you to collaborate on the project <strong>"${projectName}"</strong>.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: #4a4a4a;">
                Click the button below to accept the invitation and start collaborating:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${invitationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #0070f3; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: #6a6a6a;">
                Or copy and paste this link into your browser:
              </p>

              <p style="margin: 0 0 30px; font-size: 14px; line-height: 1.5; color: #0070f3; word-break: break-all;">
                ${invitationUrl}
              </p>

              <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: #6a6a6a;">
                This invitation will expire in 7 days.
              </p>

              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #6a6a6a;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9a9a9a;">
                Sent by Dyad Collaborative
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
