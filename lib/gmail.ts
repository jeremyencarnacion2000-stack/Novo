import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

/**
 * Gmail Service using Nodemailer and App Passwords
 */
export const gmailService = {
    /**
     * Send a recovery/re-engagement email
     * @param to - Recipient email address
     * @param subject - Email subject
     * @param body - Email body (HTML supported)
     */
    sendEmail: async (to: string, subject: string, body: string) => {
        if (!user || !pass) {
            console.warn('Gmail credentials not configured. Email sending is disabled.');
            return null;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass,
            },
        });

        const mailOptions = {
            from: `"Novo Productivity" <${user}>`,
            to,
            subject,
            html: body,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent: ' + info.response);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    },

    /**
     * Send a premium-styled re-engagement email
     */
    sendReengagement: async (to: string, userName: string) => {
        const title = "We miss you at Novo";
        const body = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: 'Inter', sans-serif; background-color: #050505; color: #fafafa; padding: 40px; }
              .container { max-width: 600px; margin: 0 auto; background: rgba(20, 20, 23, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 40px; backdrop-filter: blur(24px); }
              h1 { font-style: italic; font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; color: #6366f1; }
              p { color: rgba(255, 255, 255, 0.65); line-height: 1.6; }
              .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 9999px; font-weight: bold; margin-top: 20px; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Novo Premium</h1>
              <p>Hello ${userName || 'User'},</p>
              <p>It's been a while since your last focus session. Consistency is the key to mastering your productivity.</p>
              <p>Your projects and tasks are waiting for you. Ready to get back into the flow?</p>
              <a href="${process.env.APP_URL || 'https://novo-desktop-mvp.vercel.app'}" class="button">Return to Dashboard</a>
              <p style="margin-top: 40px; font-size: 12px; color: rgba(255, 255, 255, 0.45);">
                  Sent from Novo Productivity Hub
              </p>
          </div>
      </body>
      </html>
    `;

        return await gmailService.sendEmail(to, title, body);
    }
};
