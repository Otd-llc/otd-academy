import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/env";
import { isAdminEmail } from "@/lib/admin-allowlist";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  // session.maxAge caps absolute lifetime; jwt.maxAge forces re-mint of the
  // JWT (and thus the `jwt` callback's role re-check). Removing someone from
  // ALLOWED_EMAILS demotes them to LEARNER on their next token refresh.
  session: { strategy: "jwt", maxAge: 86_400 }, // 24h
  jwt: { maxAge: 3_600 }, // 1h
  callbacks: {
    // Open registration: any verified Google account may sign in. The admin
    // roster (ALLOWED_EMAILS) no longer gates the door — it sets the role.
    async signIn({ profile, account }) {
      if (account?.provider !== "google") return false;
      if (!profile?.email) return false;
      if (profile.email_verified !== true) return false;
      return true;
    },
    // Resolve the role from the admin roster on every refresh; on first sign-in
    // (when `user` is present) sync the DB `User.role` mirror that requireAdmin
    // reads. The mirror update is best-effort — the token role is authoritative
    // for the session either way.
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (!email) return token;
      const role: UserRole = isAdminEmail(email) ? "ADMIN" : "LEARNER";
      token.role = role;
      if (user) {
        await db.user.update({ where: { email }, data: { role } }).catch(() => {});
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as UserRole | undefined) ?? "LEARNER";
      }
      return session;
    },
  },
  pages: { signIn: "/sign-in" },
});
