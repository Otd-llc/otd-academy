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
import { pickVerifiedGithubEmail, type GitHubEmail } from "@/lib/github-verified-email";
import { magicLinkEmail } from "@/lib/auth-magic-link-email";
import { fieldGuideMagicLinkEmail } from "@/lib/field-guide-email";
import { guideFromWelcomeUrl } from "@/lib/library/field-guide-links";
import { capture } from "@/lib/analytics";

// GitHub's OAuth profile carries no "email verified" flag, and the default
// provider will use a public (possibly unverified) email. We only ever link
// accounts on a VERIFIED email, so override `userinfo` to resolve the verified
// primary email from GitHub's /user/emails endpoint, make THAT the account email,
// and stamp `email_verified` onto the raw profile — so the signIn callback reads
// it uniformly with Google's OIDC `email_verified`. Fail closed: no verified
// primary (or any fetch/parse error) → `email_verified: false`, which the guard
// rejects (or, if even the /user fetch failed, an unparseable profile that
// Auth.js bounces to sign-in — either way no unverified linking).
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

      let profile: Record<string, unknown> = {};
      try {
        const res = await fetch("https://api.github.com/user", { headers });
        if (res.ok) profile = (await res.json()) as Record<string, unknown>;
      } catch {
        profile = {};
      }

      let verifiedPrimary: string | undefined;
      try {
        const res = await fetch("https://api.github.com/user/emails", { headers });
        if (res.ok) {
          verifiedPrimary = pickVerifiedGithubEmail((await res.json()) as GitHubEmail[]);
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
    // sendVerificationRequest is overridden to send a branded email (the default
    // Resend template is unbranded); same Resend POST as the built-in provider.
    Resend({
      apiKey: env.AUTH_RESEND_KEY,
      from: env.AUTH_RESEND_FROM,
      async sendVerificationRequest({ identifier: to, provider, url }) {
        const parsed = new URL(url);
        const host = parsed.host;
        // Lead-magnet capture: when the magic link's post-verification target is a
        // field-guide download, brand the email for that guide (one click signs
        // them in AND opens the guide). Any other target = the plain sign-in email.
        const cbRaw = parsed.searchParams.get("callbackUrl");
        const fg = cbRaw ? guideFromWelcomeUrl(cbRaw) : null;
        const { subject, html, text } = fg
          ? fieldGuideMagicLinkEmail({ url, guideLabel: fg.label, host })
          : magicLinkEmail({ url, host });
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: provider.from, to, subject, html, text }),
        });
        if (!res.ok) {
          throw new Error("Resend error: " + JSON.stringify(await res.json()));
        }
      },
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
  // Funnel instrumentation. `createUser` fires EXACTLY ONCE — the first time the
  // Prisma adapter creates a User row for a verified identity — so it is the
  // authoritative "signed_up" signal (and, since the row always carries the
  // address, the "email_captured" signal too). Best-effort: wrapped so a
  // telemetry failure can never break sign-in, and a no-op when PostHog is
  // unconfigured (see capture()).
  events: {
    async createUser({ user }) {
      try {
        const props = user.email ? { email: user.email } : undefined;
        capture("signed_up", props, user.id);
        if (user.email) capture("email_captured", { source: "signup", email: user.email }, user.id);
      } catch {
        // never block account creation on telemetry
      }
    },
    // Stamp the account's stored theme onto THIS device as a cookie.
    //
    // This is what makes `User.theme` mean anything under Cache Components. The root
    // layout is a prerendered static shell, so `<html data-theme>` ships as a constant
    // and CANNOT read the session or the DB — the only thing that resolves the real
    // theme before first paint is THEME_BOOTSTRAP (src/app/layout.tsx), which reads
    // the cookie. So the account preference has to BECOME a cookie, and sign-in is the
    // one moment we know both the account and the device.
    //
    // Precedence matches the pre-PPR layout exactly: an existing device cookie wins
    // (it is the most recent explicit choice on this machine); the account value only
    // fills a device that has none. The redirect that follows carries the Set-Cookie,
    // so the very first page after sign-in already paints the right palette.
    //
    // Residual gap vs. the old server-side read: clearing cookies mid-session drops
    // the preference until the next sign-in (rather than being restored on the next
    // render). Clearing cookies also drops the session cookie, so in practice the
    // re-sign-in that restores it happens immediately.
    //
    // Dynamic import: src/proxy.ts (middleware) imports this module, and next/headers
    // has no business in a middleware bundle. Events only ever run inside the auth
    // route handler, where cookies() is writable.
    async signIn({ user }) {
      try {
        const email = user.email?.toLowerCase();
        if (!email) return;
        const { cookies } = await import("next/headers");
        const jar = await cookies();
        if (jar.get("theme")) return; // device choice wins
        const row = await db.user.findUnique({
          where: { email },
          select: { theme: true },
        });
        if (row?.theme !== "light" && row?.theme !== "dark") return;
        jar.set("theme", row.theme, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365, // one year — mirrors ThemeToggle's applyTheme
          sameSite: "lax",
        });
      } catch {
        // never block sign-in on a theme preference
      }
    },
  },
  // verifyRequest renders our branded "check your inbox" state after a magic
  // link is sent, instead of the default Auth.js page. Auth.js CONCATENATES its
  // own query (`?provider=…&type=email`) onto this path, so it must be query-free
  // (a query here would collide into a second `?`). The page keys the banner off
  // the appended `type=email`.
  //
  // error → /sign-in so an auth error lands on our branded page, not the raw
  // /api/auth/error. Auth.js appends `?error=<code>`; the page maps Configuration
  // (a locus throw: Turnstile / rate limit / degradation) and rate_limited (the
  // callback IP pre-check) to ONE generic banner (design §5, §6).
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in", error: "/sign-in" },
});
