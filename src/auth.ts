import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";

// Allowlist parsed once at module load. Comma-separated emails, trimmed and
// lowercased. The `jwt` callback re-reads this on every token refresh (every
// `jwt.maxAge` seconds), so updating `ALLOWED_EMAILS` invalidates removed
// users within ~1h — see design §6.
const allowlist = new Set(
  env.ALLOWED_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0),
);

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  // session.maxAge caps absolute lifetime; jwt.maxAge forces re-mint of the
  // JWT (and thus the `jwt` callback's allowlist re-check). Both values are
  // load-bearing per design §6 — do not change without re-reading that section.
  session: { strategy: "jwt", maxAge: 86_400 }, // 24h
  jwt: { maxAge: 3_600 }, // 1h
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.provider !== "google") return false;
      if (!profile?.email) return false;
      if (profile.email_verified !== true) return false;
      return allowlist.has(profile.email.toLowerCase());
    },
    async jwt({ token }) {
      // Re-check allowlist on every JWT refresh. Throwing here invalidates the
      // token, forcing the user back through `signIn` (which will also reject).
      if (!token.email || !allowlist.has(token.email.toLowerCase())) {
        throw new Error("Email no longer allowlisted");
      }
      return token;
    },
  },
  pages: { signIn: "/sign-in" },
});
