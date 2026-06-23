import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const u = user as unknown as { role: string; orgId: string; onboardingCompleted: boolean };
        token.role = u.role;
        token.orgId = u.orgId;
        token.onboardingCompleted = u.onboardingCompleted;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        const su = session.user as unknown as { role: string; orgId: string; onboardingCompleted: boolean };
        su.role = token.role as string;
        su.orgId = token.orgId as string;
        su.onboardingCompleted = token.onboardingCompleted as boolean;
      }
      return session;
    },
  },
};
