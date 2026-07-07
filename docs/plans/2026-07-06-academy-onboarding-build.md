# Academy onboarding — build plan

**Date:** 2026-07-06
**Branch:** `fix/lifecycle-upsell-suppress-until-l2`
**Companion:** `docs/academy-onboarding-procedure.md` (research + procedure). This doc is the execution plan for building it.

## Decisions (locked by owner 2026-07-06)

1. **Goal micro-survey = motivation-based.** Question: "What brings you to OTD Academy?" Options: *Learn PCB design from scratch · Sharpen my KiCad skills · Build toward a specific project (drone / BCI / robotics) · Just exploring.* Skippable.
2. **All L1 boards PUBLIC on publish** (anon reads free, matching L1.01). L2.01 stays FREE. (Owner sets tiers at publish time; onboarding code is tier-agnostic.)
3. **First-run destination = dedicated `/start` page** (goal survey → single "Start L1.01" CTA + outcome promise; routes already-enrolled users onward).

## Scope note

Everything buildable now is in scope. Two items are value-limited until more boards publish (owner is finishing them in parallel): the D1/D7 habit loop has nowhere to return to yet, and the L2 upsell email stays suppressed (already shipped, `route.ts`). `returned_d1/d7` needs **no code** — it is a PostHog retention report off existing `$pageview` + user identity.

## Batches (each = its own commit(s); tsc after each; no merge)

### Batch 1 — friction + instrumentation (no DB change)
- **`safeCallbackPath(raw)`** helper (`src/lib/safe-callback.ts`) + unit test. Allows only same-origin relative paths (single leading `/`, not `//` or `/\`), else falls back. Prevents open redirect.
- **Sign-in server actions** (`src/app/sign-in/page.tsx`): read `callbackUrl` from searchParams, sanitize, pass as `redirectTo`; default `/start` (was `/`).
- **`GuideActionButton`**: link to `/sign-in?callbackUrl=<current lesson path>` (via `usePathname`).
- **`currentUserOrRedirect`** + guide page `redirect("/sign-in")`: append `?callbackUrl=<path>`.
- **`erc_clean` event**: in `recordEnrollmentProof`, fire once when an ERC proof first validates `true` for an enrollment (guard on no prior valid ERC of that subkind).

### Batch 2 — goal survey (DB change)
- **Migration** (hand-authored SQL, `prisma migrate deploy` → PROD; additive nullable): `User.onboardingGoal String?` + `User.onboardingGoalAt DateTime?`. Then `prisma generate`, restart dev, refresh test pool. **Full tsc + full vitest** (schema-change rule).
- **`saveOnboardingGoal`** server action (`use server`, async-only) + zod enum of the four options (+ a skip sentinel). Fires `onboarding_goal_selected`.
- **Goal survey UI** (`src/components/onboarding/GoalSurvey.tsx`, client): four motivation options + skip; house style.

### Batch 3 — /start + routing
- **`/start` page** (`src/app/start/page.tsx`, RSC): not signed in → `/sign-in?callbackUrl=/start`; signed in + no `onboardingGoal` → render `GoalSurvey`; signed in + goal set + no L1.01 enrollment → "Start L1.01" CTA (EnrollButton) + outcome promise; already enrolled → redirect to continue (`/learn/l1-01-wroom-breakout`).
- **Post-signin default** → `/start` (the smart router decides onward), unless a `callbackUrl` was supplied.

### Batch 4 — early win + progress framing
- **ERC micro-win**: after a validating ERC upload (`ProofUploadForm` knows `valid`), show a modest celebration ("First clean ERC — your schematic is real. Next: BOM."). Client, transient.
- **Onboarding checklist card**: first-board stage checklist (✓/○ from `enrollment.currentStage` via `resolveLearnerGuideProgress`) + % complete, onboarding-tone copy. Shown for the L1.01 learner (board page / start).

### Batch 5 — interactive first-run walkthrough
- **First-run coach overlay** on L1.01's REQUIREMENTS card: first-time-only (localStorage + optional user flag), orients ORIENT/DO/CHECK + the rail + the immediate next action, then hands off to the normal guide. Progressive disclosure; dismissible. Scoped modest.

### Final
- Document `returned_d1/d7` as a PostHog retention report (no code) in the procedure doc.
- Full tsc + full vitest + a drive-the-flow verify pass (`/start` → survey → enroll → REQUIREMENTS).
- Update `docs/academy-onboarding-procedure.md` status.

## Guardrails
- Prod DB: `.env.local` `DATABASE_URL` is PROD. Migration is additive/nullable only. `migrate deploy` (never dev). Refresh test pool after.
- `use server` files export only async functions.
- Voice via otd-content-writing (academy = generic disclosure); UI via otd-frontend-design (token colors, four faces, no em-dash on rendered glyphs).
- No merge without owner go-ahead; batch commits on this branch.
