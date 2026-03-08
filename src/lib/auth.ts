import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { kv } from "@vercel/kv";
import { sendWelcomeEmail } from "./emails/mailer";
import authConfig from "./auth.config";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, profile }) {
            if (user?.email) {
                const hasSentWelcomeEmail = await kv.get(`welcome_email_sent:${user.email}`);
                if (!hasSentWelcomeEmail) {
                    await kv.set(`welcome_email_sent:${user.email}`, true);
                    const username = profile?.login || user.name || user.email.split("@")[0];
                    sendWelcomeEmail(user.email, username as string).catch(console.error);
                }
            }

            if (user?.id && profile?.login) {
                await prisma.user
                    .update({
                        where: { id: user.id },
                        data: { githubLogin: profile.login },
                    })
                    .catch((error) => {
                        console.error("Failed to persist githubLogin:", error);
                    });
            }
            return true;
        },
    },
});
