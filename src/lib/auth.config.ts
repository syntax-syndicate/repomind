import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

const authConfig: NextAuthConfig = {
    providers: [
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
    ],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false;
            }
            return true;
        },
        async jwt({ token, profile, account, user }) {
            if (user?.id) {
                token.id = user.id;
            }
            if (profile?.login) {
                token.username = profile.login;
            }
            if (account?.access_token) {
                token.accessToken = account.access_token;
            }
            if (account?.scope) {
                token.oauthScope = account.scope;
            }
            return token;
        },
        async session({ session, token }) {
            if (typeof token.id === "string" && session.user) {
                session.user.id = token.id;
            }
            if (typeof token.username === "string" && session.user) {
                session.user.username = token.username;
            }
            if (typeof token.accessToken === "string") {
                session.accessToken = token.accessToken;
            }
            if (typeof token.oauthScope === "string") {
                session.oauthScope = token.oauthScope;
            }
            return session;
        },
    },
    pages: {
        signIn: "/",
    },
};

export default authConfig;
