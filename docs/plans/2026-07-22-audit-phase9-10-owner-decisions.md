# Audit remediation — Phases 9 & 10 (owner decisions required)

> Companion to `docs/plans/2026-07-22-six-lens-audit-remediation.md`. Phases 1–8
> shipped as PRs #333–#340. These last two are **blocked on a Josh decision** (an
> infra/vendor choice or a legal one), so they are written up here rather than
> coded. Nothing below is started.

## Phase 9 — R2 egress + author-hub query weight

**The finding (perf lens).** Public R2 assets are proxied byte-for-byte through
Vercel functions instead of served from R2 directly (zero-egress):

- `api/shot/[key]` streams screencast **video** (webm/mp4, Range) through the fn —
  video is the heaviest asset class, and the fn is held open for the whole stream.
- `api/part-model/[id]` buffers the full `.glb` into memory; a BOM card floats one
  model per row → N concurrent `.glb` streams.
- `api/avatar/[userId]` streams avatars through the fn AND runs a `db.user`
  lookup per miss, with `max-age=3600, must-revalidate` (not `immutable`) despite
  a `?v` cache-buster → recurring fn invocations + a Neon hit per avatar/hour/edge.

Cloudflare R2 egress is **$0**; routing through Vercel converts it to metered
Vercel bandwidth + fn GB-seconds, and the avatar path also keeps Neon awake.

**Why it's a Josh decision.** The real fix needs a **public R2 custom domain /
CDN URL** (DNS + R2 bucket settings on the Cloudflare side) — infra I can't
provision. All three assets are public and non-sensitive, so a direct R2 domain
is safe.

**Two tiers — pick one:**

1. **Full (needs the R2 domain):** serve `shot` / `part-model` / `avatar` from the
   R2 custom domain; keep the routes as fallbacks. Biggest egress + fn win.
2. **No-DNS partial (I can ship today on your word):**
   - avatar `Cache-Control` → `immutable` (the `?v` already busts on change) and
     drop the per-request `db.user.findUnique` — kills the steady Neon wake with
     zero infra change.
   - **Author-hub query collapse** (unrelated to R2, ready now): the guide hub's
     author view issues ~220 queries at 3 boards — `resolveGuideProgress` +
     per-design-cell `resolveCardCompletion` + the per-board matrix each reload
     the full gate context. Load `loadGateContext` **once per revision** and
     evaluate all 8 stage gates in memory. Author-only, so not a crawler-cost
     line, but it's the largest single query burst in the app and the owner lives
     on these pages while authoring.

**Ask:** provision the R2 domain (→ tier 1), or say "partial" and I ship the
avatar + author-hub wins now.

## Phase 10 — Analytics consent (blocked on the CMP decision)

**Already shipped** (Phase 3 / #335): raw email PII removed from all
`signed_up` / `email_captured` event props; unique anonymous distinct ids. That
was the part that needed no consent mechanism.

**Still blocked.** PostHog `init` + `$pageview` fire for **every** visitor on
mount with no consent gate — EU visitors are tracked pre-consent. The fix
(`opt_out` by default in the EU, `opt_in_capturing()` behind a consent signal)
needs a **consent mechanism to gate on**, which is the same CMP / cookie-consent
decision already open for the affiliate-link legal clearance (`internal-state.md`
Thread 2). One CMP choice unblocks both.

**Tiny SEO rider, unblocked** (can land in any phase): the anonymous root
redirect is a 307 (temporary) — `redirect()` → `permanentRedirect()` in
`src/app/(chrome)/page.tsx` so search consolidates `/` onto `/courses`.

**Ask:** which CMP (or "defer") — then I gate analytics init on it in one PR
alongside the affiliate cookie-consent work.
