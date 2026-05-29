import { signIn } from "@/auth";
import { InlineBanner } from "@/components/InlineBanner";

// Auth.js redirects rejected signIn attempts to `/sign-in?error=AccessDenied`.
// We render an alert-red Space Mono banner when that param is present —
// design §6 calls this out as the "clear reject screen" requirement for M3.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const denied = params.error === "AccessDenied";

  return (
    <main className="flex min-h-screen items-center justify-center bg-deep-space px-4">
      <div className="w-full max-w-md text-center">
        {denied && (
          <div className="mb-6 text-left">
            <InlineBanner variant="error">
              ACCESS DENIED — this email is not on the allowlist.
            </InlineBanner>
          </div>
        )}
        <h1 className="mb-8 font-display text-4xl tracking-wide text-command-gold">
          PROJECT FOUNDRY
        </h1>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded border border-panel-border bg-navy-dark px-6 py-3 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:border-command-gold"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
