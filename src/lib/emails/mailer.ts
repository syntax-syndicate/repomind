import { Resend } from 'resend';
import WelcomeEmail from './welcome';

// Make sure to add RESEND_API_KEY to .env.local
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail(to: string, username: string) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Skipping welcome email.');
        return;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'RepoMind <onboarding@resend.dev>', // Change to your verified domain in production E.g 'onboarding@repomind.co'
            to: [to],
            subject: 'Welcome to RepoMind!',
            react: WelcomeEmail({ username }),
        });

        if (error) {
            console.error('Error sending welcome email from Resend:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        return { success: false, error };
    }
}
