import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/env";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { resolveSignIn } from "@/lib/auth-link-guard";

// GitHub's OAuth profile carries no "email verified" flag, and the default
// provider will use a public (possibly unverified) email. We only ever link
// accounts on a VERIFIED email, so override `userinfo` to resolve the verified
// primary email from GitHub's /user/emails endpoint, make THAT the account email,
// and stamp `email_verified` onto the raw profile — so the signIn callback reads
// it uniformly with Google's OIDC `email_verified`. Fail closed: no verified
// primary (or a fetch error) → `email_verified: false`, which the guard rejects.
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

const github = GitHub({
  clientId: env.AUTH_GITHUB_ID,
  clientSecret: env.AUTH_GITHUB_SECRET,
  // Safe here: the signIn callback runs BEFORE Auth.js links the account and
  // rejects any non-verified email, so this only ever links a verified address.
  allowDangerousEmailAccountLinking: true,
  userinfo: {
    url: "https://api.github.com/user",
    async request({ tokens }: { tokens: { access_token?: string } }) {
      const headers = {
        Authorization: `Bearer ${tokens.access_token}`,
        "User-Agent": "otd-academy",
        Accept: "application/vnd.github+json",
      };
      const profile = (await fetch("https://api.github.com/user", { headers }).then(
        (r) => r.json(),
      )) as Record<string, unknown>;

      let verifiedPrimary: string | undefined;
      try {
        const res = await fetch("https://api.github.com/user/emails", { headers });
        if (res.ok) {
          const emails = (await res.json()) as GitHubEmail[];
          verifiedPrimary =
            emails.find((e) => e.primary && e.verified)?.email ??
            emails.find((e) => e.verified)?.email;
        }
      } catch {
        verifiedPrimary = undefined;
      }

      return {
        ...profile,
        email: verifiedPrimary ?? null,
        email_verified: Boolean(verifiedPrimary),
      };
    },
  },
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // Always show Google's account chooser. Without this, Google silently
      // returns whichever account the browser is already logged into — so a
      // user with one active Google session can never pick a different account
      // (e.g. to sign in as a learner instead of an admin).
      authorization: { params: { prompt: "select_account" } },
      // One identity per verified email — link a same-email Google login onto an
      // existing (GitHub/magic-link) user instead of throwing OAuthAccountNotLinked.
      // Safe because the signIn guard enforces email_verified before any linking.
      allowDangerousEmailAccountLinking: true,
    }),
    github,
    // Email magic-link. type:"email" → resolves to any existing same-email user
    // (Google/GitHub-created) via the adapter, no linking flag needed; this is
    // what enables a clean guest-purchase claim. Verified by construction.
    Resend({
      apiKey: env.AUTH_RESEND_KEY,
      from: env.AUTH_RESEND_FROM,
    }),
  ],
  // session.maxAge caps absolute lifetime; jwt.maxAge forces re-mint of the
  // JWT (and thus the `jwt` callback's role re-check). Removing someone from
  // ALLOWED_EMAILS demotes them to LEARNER on their next token refresh.
  session: { strategy: "jwt", maxAge: 86_400 }, // 24h
  jwt: { maxAge: 3_600 }, // 1h
  callbacks: {
    // Open registration: any verified account (Google, GitHub, or magic-link)
    // may sign in. The admin roster (ALLOWED_EMAILS) no longer gates the door —
    // it sets the role (resolved by email in `jwt`).
    //
    // This callback computes the provider-specific "email verified" fact and
    // delegates the allow/reject/bounce decision to the pure `resolveSignIn`
    // guard. It ALSO reads the currently-signed-in user so we can refuse to LINK
    // a different account onto an active session — Auth.js does that linking
    // silently (no veto at its `linkAccount` call), which once permanently
    // attached a learner's login to an admin's user. See auth-link-guard. The
    // `auth()` read is wrapped so that if it ever throws we fall back to allowing
    // the sign-in rather than locking everyone out.
    async signIn({ profile, account, user, email }) {
      // Auth.js invokes this on the magic-link SEND step with
      // `email.verificationRequest === true` and no profile — nothing to verify.
      const isVerificationRequest = email?.verificationRequest === true;
      const provider = account?.provider;

      // Magic-link click carries `user.email`, not `profile`. OAuth carries both.
      const profileEmail =
        (typeof profile?.email === "string" ? profile.email : undefined) ??
        (typeof user?.email === "string" ? user.email : undefined);

      let emailVerified: boolean | undefined;
      if (provider === "resend") {
        // Send step: nothing verified yet. Click: possession of the token proves it.
        emailVerified = isVerificationRequest ? undefined : true;
      } else {
        // Google (OIDC) and GitHub (our userinfo override) both expose email_verified.
        emailVerified =
          (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      }

      let activeUserEmail: string | undefined;
      try {
        const active = await auth();
        activeUserEmail = active?.user?.email ?? undefined;
      } catch {
        activeUserEmail = undefined;
      }

      return resolveSignIn({
        provider,
        emailVerified,
        profileEmail,
        activeUserEmail,
        isVerificationRequest,
      });
    },
    // Resolve the role from the admin roster on every refresh; on first sign-in
    // (when `user` is present) sync the DB `User.role` mirror that requireAdmin
    // reads. The mirror update is best-effort — the token role is authoritative
    // for the session either way. Provider-agnostic: keys on the lowercased email.
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
  // verifyRequest renders our branded "check your inbox" state after a magic
  // link is sent, instead of the default Auth.js page.
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in?check=email" },
});
