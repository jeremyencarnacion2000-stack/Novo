import { Resend } from 'resend';

// Initialize Resend only if API key is available
// This allows build to succeed even without the key configured
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Email Service using Resend
 * Replaces Gmail API to avoid restrictive OAuth scopes
 * 
 * To enable: Set RESEND_API_KEY environment variable in Vercel
 * Get your key at: https://resend.com/api-keys
 */
export const emailService = {
    /**
     * Send a reminder email
     * @param to - Recipient email address
     * @param subject - Email subject
     * @param body - Email body (HTML supported)
     */
    sendReminder: async (to: string, subject: string, body: string) => {
        if (!resend) {
            console.warn('RESEND_API_KEY not configured - email sending is disabled');
            throw new Error('Email service not configured. Please set RESEND_API_KEY environment variable.');
        }

        const { data, error } = await resend.emails.send({
            from: 'Novo Productivity Hub <onboarding@resend.dev>', // Change to your verified domain later
            to: [to],
            subject: subject,
            html: body,
        });

        if (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }

        return data;
    },

    /**
     * Send a formatted reminder with consistent styling
     */
    sendFormattedReminder: async (to: string, title: string, message: string) => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">🔔 ${title}</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
                    <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                        ${message}
                    </div>
                    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">
                        Sent from Novo Productivity Hub
                    </p>
                </div>
            </body>
            </html>
        `;

        return await emailService.sendReminder(to, title, html);
    },

    /**
     * Check if email service is configured
     */
    isConfigured: () => {
        return !!resend;
    }
};
