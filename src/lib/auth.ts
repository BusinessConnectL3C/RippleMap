import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { onboardingState: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.hashedPassword
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          onboardingCompleted: user.onboardingState?.completed ?? false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const u = user as unknown as { role: string; onboardingCompleted: boolean };
        token.role = u.role;
        token.onboardingCompleted = u.onboardingCompleted;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        const su = session.user as unknown as { role: string; onboardingCompleted: boolean };
        su.role = token.role as string;
        su.onboardingCompleted = token.onboardingCompleted as boolean;
      }
      return session;
    },
  },
});
