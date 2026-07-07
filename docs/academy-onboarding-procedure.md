# Academy Onboarding — Industry Standards Review & Proposed Procedure

**Date:** 2026-07-06
**Scope:** New-learner onboarding for One Thousand Drones Academy (academy.onethousanddrones.com) — the journey from first arrival through account creation, first lesson, and activation.
**Author:** research + synthesis pass (web research, main-thread; grounded against the live codebase).

---

## 1. Executive summary

The academy already has a **best-in-class off-platform onboarding layer** — an 11-email, 6-sequence, behavior-triggered lifecycle system (`src/lib/lifecycle-emails.ts` / `lifecycle-triggers.ts`) that is consent-gated, idempotent, and keyed to real progress milestones. Against industry email standards it is ahead of most edtech.

**Scope-defining fact (verified against PROD):** only **one board is live** — `l1-01-wroom-breakout` (PUBLIC + published). Every other board is unpublished. So the entire learner funnel today is L1.01, and this procedure is scoped to **single-board activation** now, with multi-board steps written to switch on as boards publish. One live email (the L2 upsell) already points at a dead board — a same-day fix (§4 gap 0b).

The gap is **in-product onboarding**. The funnel *is* instrumented (`signed_up` → `lesson_started` → `board_activated` → `purchase_completed` all fire), but a new signed-in account is redirected to `/` and must self-navigate; there is no goal-setting, no personalization, no first-run guidance, no in-app progress checklist, no early-win moment, and sign-in does not preserve the page the user was trying to reach (three separate signup triggers all lose it). Every industry source treats these as the core of onboarding.

The academy's **activation event is already well-defined and unusually strong**: a clean DRC + valid gerbers on L1.01 ("you designed a real board"), validated server-side. The problem is distance — that milestone is hours away, while the industry benchmark for time-to-first-value is **under 5 minutes**. The fix is a **tiered activation model**: an early micro-win (first clean ERC) within the first session, sustained to the full gerber activation.

This report sets out the industry standards (with sources), audits current state, and proposes a concrete onboarding procedure with a phased build order and an instrumentation plan.

---

## 2. Industry standards (research findings)

### 2.1 Activation and the "aha moment"

- **Activation = the moment a user experiences the product's core value.** The operational definition is the specific first action that most reliably predicts the user is still active 30 days later. Companies that identify and optimize for this see **2–3x activation improvement within 90 days**. [appcues, digitalheroesco]
- **Minimize steps to value.** Cut every non-essential step between signup and the aha moment. [appcues, saasfactor]
- **Time-to-value (TTV) benchmarks (self-serve, 2026):** under 5 min = excellent (Figma, Linear, Canva); 5–20 min = acceptable; 20–60 min = too long. [insaim]
- **Business impact:** a 25% increase in activation is associated with a **34% rise in MRR over 12 months**; compounded, 25–50% increases in lifetime value. [saasfactor]

### 2.2 Personalization and segmentation

- Ask **"What are you hoping to accomplish with [product]?"** at first run. Map each answer to a distinct onboarding path — this consistently lifts activation by removing irrelevant steps. [appcues]
- **Segment early** (in edtech, learner vs teacher vs institution have different needs, features, even layouts). [productfruits, userpilot]
- **Keep the data ask minimal.** Asking for too many personal/irrelevant details up front disengages users. Collect only what routes them. [elearningindustry, nalashaa]
- **Progressive disclosure:** reveal features only when the user needs them, not all at once. [appcues]

### 2.3 EdTech-specific patterns

- **D7 (day-7) retention is the single most predictive metric** for edtech long-term success. Learners who **return in the first week are 5x more likely to complete** the course. A learning habit typically needs **5–7 consecutive days** of engagement to form. [userpilot, productgrowth]
- **Onboarding checklists** are near-universal in edtech (adoption ~50%); **resource centers** exceed 50%. A structured checklist is associated with a **~50% lift in satisfaction/retention**; monitoring drop-off with analytics correlates with a **~30% reduction in abandonment**. [productfruits, moldstud, lmspedia]
- **Interactive walkthroughs beat passive product tours** for activation — the user does the action rather than watching a highlight reel. [productfruits]
- **Gamification / progress indicators:** points/badges can lift engagement up to ~50%; **70% of learners report higher motivation when they can see progress**. Progress bars and streaks are the workhorses. [moldstud, elucidat]
- **Microlearning:** 3–6 minute focused modules. Micro-learning courses show **80–90% completion vs 15–20% for traditional long-form**. [moldstud, plotline]

### 2.4 The reference case — Duolingo

- **Delayed signup / gradual engagement:** the user experiences a real exercise and feels the value *before* being asked to create an account. Registration is pushed to the point where it is needed to save progress. [appcues, userguiding]
- **Goal + motivation up front:** language, reason for learning, level, daily commitment — set before signup. Doubles as personalization and as a commitment device. [userguiding]
- **Magic moment:** "I understood / answered something in a new language" — optimized for time-to-first-success, with account creation deferred behind it. [appcues]
- **Measured results of the redesigned flow:** first-week churn **−47%**, first-week completion **+30%**, satisfaction **+15%**. [appcues]

### 2.5 Onboarding email (where the academy is already strong)

- First email fires **immediately** at signup (peak intent). A sequence of **5–8 emails over ~14 days** is typical. [zanfia, prosperstack]
- **One CTA per email**; subject lines that promise a specific outcome see **+20–30% open**. [emailtooltester, adoptkit]
- **Behavior-triggered emails outperform time-based drips — 300%+ higher open rates** — because they respond to what the user did or failed to do. [adoptkit]
- The academy's lifecycle system already implements all of the above (single-CTA, behavior-keyed to stage milestones, consent-gated, once-only). **No changes required here beyond tying it to the in-product events below.**

### 2.6 Benchmarks to set expectations

- **B2C edtech annual retention averages ~40%** vs ~85% B2B; consumer learning apps run 30–50% because motivation is the real competitor. [greta, loyalty.cx]
- Median **D1 ~26%, D7 ~13%** across verticals (Adjust); education **D30 often <3%** because learning happens in structured, non-daily sessions — low daily numbers do not mean failure. [lovable, plotline]
- Implication: for a project-based build-along academy, **completion of the first project** is a far better north star than raw DAU/daily retention.

---

## 3. Current-state audit (grounded in the codebase + a live PROD query)

### 3.0 The single most important fact: only ONE board is live

A `SELECT slug, "accessTier", published FROM "Project"` against PROD (2026-07-06) shows the whole learner funnel today is **one board**:

| Board | Tier | Published? | Price |
|---|---|---|---|
| **l1-01-wroom-breakout** | **PUBLIC** | **yes** | free |
| l1-02…l1-05, l2-01-battery | FREE | **no** | free (when live) |
| l2-02…l2-05 | PREMIUM | no | $49 |
| l3-* | PREMIUM | no | $89 / $149 |
| bn-* (bench tools) | PREMIUM | no | $89 |

So the "entire L1 + one L2 free" you described is the **intended tier map** (those rows *are* set to FREE), but only **L1.01 is actually PUBLIC and published** — every other board is `published:false` and returns "not open for enrollment yet." **Onboarding today = getting a learner into L1.01 and activating there. There is no second board to send them to yet.** This bounds the whole procedure (see §5) and breaks one existing email (see §4).

### 3.1 The real access + enrollment architecture

- **Three access tiers** (`src/lib/public-access.ts` → `resolveLessonAccess`): **PUBLIC** = anonymous-readable; **FREE** = must sign in to *read*; **PREMIUM** = needs an Entitlement (except card 0, the free preview → else `Paywall`). The guide card page enforces this at `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx:261`.
- **L1.01 is PUBLIC**, so an anonymous visitor reads the whole lesson. This is what makes your "read free, sign up to download / pass gates" description correct — *for L1.01 specifically.* The other free L1/L2 boards are **FREE tier, so when published they will redirect anon to sign-in to even read** (`redirect("/sign-in")`, guide page line 268). That is an inconsistency to decide on (§8).
- **The gate/upload panel (`LearnerGate`, "YOUR TRACK") only renders for a signed-in learner with an enrollment whose `currentStage === stage`** (guide page line 762, `showLearnerAdvance`). Anonymous and non-enrolled viewers never see it. So the true "start" action is **creating an enrollment.**
- **Enrollment** is created by `EnrollButton` on `/learn/[slug]` (`src/lib/actions/enrollment.ts` → `enroll`). That page requires auth (`currentUserOrRedirect`), so it bounces anon to sign-in. `enroll` fires `lesson_started` once, enforces the prereq DAG, and gates PREMIUM on an Entitlement.
- **Two forced-signup triggers on L1.01**, whichever the reader hits first: (a) the **KiCad starter-pack download** on the SCHEMATIC card (`GuideActionButton` → funnels anon to `/sign-in` with value-forward copy already written), and (b) **enrolling / uploading an ERC** to pass a gate. Stage order (`Stage` enum): REQUIREMENTS → SCHEMATIC → BOM_SOURCING → LAYOUT → DRC_GERBER → …, so the starter download (SCHEMATIC) does precede the first ERC gate.

### 3.2 What already exists (better than the first draft claimed)

| Area | Current state | Source |
|---|---|---|
| Sign-in | 3 providers (Google/GitHub/Resend magic-link), branded, returning-user fast-path. | `src/app/sign-in/page.tsx`, `src/auth.ts` |
| Value-forward signup gate | The starter-pack button already funnels anon to sign-up with "Free account · download the files + track your progress." | `src/components/guide/GuideActionButton.tsx` |
| Activation gate | Learner advance OUT of `DRC_GERBER` = clean DRC + valid gerbers, validated server-side (`validateDrcReport`/`validateErcReport`). | `src/lib/actions/enrollment.ts` |
| Lifecycle email | Strong: welcome (1.1) → build-along nudges (2.1–2.3) → activation upsell (3.1) → pay-the-difference (4.1) → launch window (5.1–5.4) → win-back (6.1). Behavior-triggered, consent-gated, once-only ledger. | `lifecycle-emails.ts`, `lifecycle-triggers.ts` |
| Funnel analytics (PostHog) | Already firing: `signed_up`, `email_captured` (`auth.ts`); `lesson_started` on first enroll, `board_activated` on the DRC-gate advance (`enrollment.ts`); `checkout_started` (`checkout.ts`), `purchase_completed` (stripe webhook), `pricing_viewed`/`cta_clicked` (client), `certificate_shared`. | grep `capture(` |
| Assets in place | PUBLIC L1.01 lesson, per-user enrollment + progress + resume state, teaching layer (glossary popovers, ModeBand, 3D), guide pacing rail, `/courses` skill-tree honeycomb (with a `locked-account` state that already funnels anon on FREE nodes). | prior PRs |

### 3.3 What is genuinely absent

- **No goal/motivation capture** anywhere (no personalization, no email segmentation input).
- **No first-run orchestration** — a brand-new signed-in account with zero enrollments lands on `/` (post-signin `redirectTo:"/"`) and must self-navigate; there is no "start L1.01" first-run state.
- **No `callbackUrl` preservation** at any signup trigger — three separate spots hard-redirect to `/sign-in` or `/` and lose the return target: the sign-in server actions (`redirectTo:"/"`), `GuideActionButton` (`href="/sign-in"`), and `currentUserOrRedirect` / the guide page's `redirect("/sign-in")`.
- **No early micro-win** — nothing marks the first clean ERC; the only celebrated moment is the terminal complete screen.
- **No in-app onboarding checklist framing** of the L1.01 stage sequence (the pacing rail exists but is not framed as a first-project onboarding checklist).
- **No intermediate funnel events** — the ERC-clean micro-aha and D1/D7 return are not instrumented (the endpoints exist: signup → enroll → activate → purchase).

---

## 4. Gap analysis (standard vs. academy)

**Product-reality gaps (from §3.0 — these bound everything):**

0a. **Only L1.01 is live**, so there is no "next board" to retain or upsell into. The T3 "start a second project in week 1" habit loop (§2.3) has nowhere to go until L1.02–05 / L2.01 are published. Single-board activation is the entire realistic scope today.

0b. **The activation-upsell email (3.1) points at L2, which is unpublished.** `activationUpsellEmail` sends a "Start L2" CTA to `ctx.l2Url`, and `activationUpsellAudience` fires the moment a learner passes L1.01's DRC gate. Today that link leads to an unpublished board ("not open for enrollment yet"). Either suppress 3.1 until L2.01 is live, or point it at the cert/exam instead. **This is a live defect, not a future concern.**

0c. **Tier inconsistency:** L1.01 is PUBLIC (anon reads) but L1.02–05 / L2.01 are FREE (anon redirected to sign-in to read). If the intent is "all of L1 is open and free," they should be PUBLIC on publish; if reading is meant to require an account, L1.01 is the outlier. Decide before publishing the rest (§8).

**Onboarding gaps (standard vs. current):**

1. **No goal/motivation capture** → no personalization, no segmentation, weaker commitment. (§2.2, §2.4)
2. **No "start here" orchestration** → a new signed-in account lands on `/` and self-navigates. Violates "minimize steps to value." (§2.1)
3. **Signup does not preserve intent** → three separate triggers (`redirectTo:"/"`, `GuideActionButton`→`/sign-in`, `currentUserOrRedirect`) drop the learner on home/sign-in and lose where they were. Friction at the exact commitment moment. (§2.1, §2.4)
4. **Activation is far (hours), no early micro-win** → nothing marks the first clean ERC; nothing satisfies the <5-min first-value benchmark. (§2.1)
5. **No in-app checklist / progress framing of the first project** → misses the ~50% satisfaction lift and the visible-progress motivation effect. (§2.3)
6. **First-week habit is nudged only by email, not reinforced in-app** → D7 is the predictive metric; in-app return cues are missing. (§2.3)
7. **Funnel gaps are narrow, not total** → signup → enroll (`lesson_started`) → activate (`board_activated`) → purchase already exist. Missing only the **ERC-clean micro-aha** and **D1/D7 return** events.

---

## 5. Proposed onboarding procedure

Design principle: **value first, commitment second, one next action at all times, and a fast early win on the way to the real (gerber) activation.**

> **Product context (verified against PROD, §3.0):** the *intended* model is that all of L1 (L1.01–05) and L2.01 are free, with paid boards from L2.02 up. **Today only L1.01 is actually live** (PUBLIC + published); the rest are unpublished. So this procedure is scoped to **single-board activation on L1.01** now, with the multi-board steps (T3 habit, upsell) written to switch on as boards publish. L1.01 is PUBLIC, so anon reads the whole lesson free; the account gate sits at the **action points** — **starter-pack download (SCHEMATIC card), enrolling, and uploading an ERC to pass a gate** — and the value-forward gate copy already exists on the starter button. The starter-pack download is the earliest forced-signup a reader hits (it precedes the first ERC), so first-run + goal survey + callbackUrl should anchor there.

### 5.1 The tiered activation model

| Tier | Milestone | Target time | Purpose |
|---|---|---|---|
| **T0 — Entry** | Visitor consumes L1.01 teaching content (free, no account), then hits the **starter-pack download** — the first signup trigger. | 0 min to first gate | Value-first: full free content, account demanded only when the learner acts (download the files). |
| **T1 — Micro-aha** | First real, gated success: **first clean ERC** (or completion of the REQUIREMENTS stage, whichever we pick). | < ~10 min into first session | Satisfies the early-TTV standard; the "I can do this" moment. Celebrate it. |
| **T2 — Activation** | **Clean DRC + valid gerbers on L1.01** ("you designed a real board" + verifiable cert). | First session or two | The real north-star. Already the email/entitlement activation gate. |
| **T3 — Habit / retention** | Returns within the first week; starts a second project or the L2 free board. | Days 1–7 | D7 is the predictive metric; feeds the upsell sequence. |

### 5.2 The flow, step by step

**Step 1 — Value-first entry (T0).**
Content is already free and consumable without an account (public lessons). No change to *what* is free. The onboarding job is to make the **starter-pack download** — the first natural signup trigger — a clean, value-forward gate: CTA reads "sign up to get your starter pack / save your board," not a wall. Same treatment at the later ERC-upload and gate-pass triggers.

**Step 2 — Preserve intent through the signup trigger.**
When any gate fires (starter-pack download, ERC upload, gate pass), carry the exact return target as `callbackUrl` and return the user *there* after auth — straight back to the download or upload they clicked — not to `/`. (Change the hard-coded `redirectTo: "/"` in `src/app/sign-in/page.tsx` to honor a `callbackUrl` param; default to the first-run destination below when absent.) This is the single highest-friction point today: the current flow drops a mid-lesson signup on the home page, forcing them to re-find where they were.

**Step 3 — One-question goal/motivation micro-survey (first run only).**
Immediately after first account creation (i.e. right after the starter-pack signup), a single lightweight question — e.g. *"What brought you to OTD Academy?"* with 3–5 options (e.g. *learn PCB design from scratch / build a specific board / brush up KiCad / exploring BCI/drones*). Store on the user; use it to (a) personalize the first-run copy, (b) segment lifecycle email, (c) pre-select a recommended path. Keep it skippable and to one screen (minimal-data-ask standard).

**Step 4 — "Start here" first-run destination.**
A zero-enrollment account lands not on the generic home but on a **first-run state with exactly one primary CTA: Start L1.01** (free, no PCB experience needed), plus a one-line promise of the outcome (fab-ready gerbers + verifiable certificate — reuse the welcome-email framing for consistency). No competing menu.

**Step 5 — Interactive first-run walkthrough inside L1.01.**
Lean on the existing teaching layer (glossary popovers, ModeBand ORIENT/DO/CHECK ribbon, 3D). Add a light *interactive* first-pass overlay (do-the-action, not a passive tour) that hands off to the normal guide once the user is oriented. Progressive disclosure — introduce ERC/DRC concepts at the stage where they matter, not up front.

**Step 6 — In-app onboarding checklist / progress rail.**
Surface the L1.01 stage sequence as a visible checklist with a progress indicator (REQUIREMENTS → SCHEMATIC → BOM → LAYOUT → DRC/gerbers). The guide pacing rail already exists; frame it explicitly as an onboarding checklist for a first-project learner, showing % complete. This is the single highest-leverage in-app addition per the research (~50% satisfaction/retention lift).

**Step 7 — Celebrate the micro-win (T1).**
At the first clean ERC (or first stage cleared), show an explicit success moment — a small celebration + a "you're on track, next is X" pointer. This is the early-TTV payoff that the current flow lacks entirely.

**Step 8 — Celebrate activation (T2).**
At clean DRC + valid gerbers: the existing lesson-complete screen + certificate + `/verify`. Ensure the in-app moment and the 3.1 activation-upsell email reinforce each other (same language: "you just designed a real board").

**Step 9 — First-week habit reinforcement (T3).**
In-app resume prompt on return (resume state already exists); optional lightweight streak/return cue; the lifecycle nudges (2.x) and win-back (6.1) already cover the email side. Goal: get the learner back inside the first week (the 5x-completion window).

### 5.3 What NOT to change

- The **lifecycle email system** — it already matches or exceeds every email standard in §2.5. Only wire it to the new in-app events (§6); do not rebuild it.
- The **activation definition** (gerbers) — it is an unusually strong, honest aha moment. Add the T1 micro-win *in front of it*; do not water it down.
- **Voice / disclosure rules** — any learner-facing copy in this flow goes through the `otd-content-writing` skill (house voice, academy = generic disclosure) and any UI through `otd-frontend-design`.

---

## 6. Instrumentation (funnel to measure)

Most of the funnel is already instrumented. Add only the two missing events:

| Event | Status | Fires when | Maps to |
|---|---|---|---|
| `signed_up` / `email_captured` | **exists** (`auth.ts`) | `createUser` | account created |
| `lesson_started` | **exists** (`enrollment.ts`) | first enrollment | T0→T1 entry |
| `board_activated` | **exists** (`enrollment.ts`) | advance OUT of `DRC_GERBER` (clean DRC + gerbers) | **T2 activation** |
| `purchase_completed` | **exists** (stripe webhook) | paid board | conversion |
| `onboarding_goal_selected` | **new** | goal micro-survey answered | personalization / segment |
| `erc_clean` | **new** | first clean ERC recorded (`recordEnrollmentProof`, `valid===true`) | **T1 micro-aha** |
| `returned_d1` / `returned_d7` | **new** | session on day 1 / within 7 days | **T3 habit** (the predictive metric) |

Target metrics: signup→enroll rate, enroll→ERC (micro-aha) rate + time, ERC→activation rate + time, and D7 return rate. The signup/enroll/activate/purchase legs can be charted **today** from existing events — worth doing before building anything, to see where L1.01 actually leaks.

---

## 7. Phased build order

**Phase 0 — Free / immediate (do this week):**
- Fix the **3.1 activation-upsell email defect** (§4 gap 0b): suppress it or repoint its CTA until L2.01 is published — it currently links to a dead board.
- Chart the existing signup→enroll→activate→purchase funnel in PostHog (no code) to baseline where L1.01 leaks.

**Phase 1 — Highest leverage, low cost:**
- Preserve `callbackUrl` at all three signup triggers (Step 2). Removes the sharpest friction point.
- First-run "Start L1.01" destination for zero-enrollment accounts (Step 4).
- Add `erc_clean` event (§6) — the one micro-aha metric we're blind to.

**Phase 2 — Personalization + early win:**
- One-question goal micro-survey (Step 3) + `onboarding_goal_selected`.
- Micro-win celebration at first clean ERC (Step 7).

**Phase 3 — Framing + habit (partly blocked on publishing more boards):**
- Onboarding checklist framing of the pacing rail (Step 6).
- Interactive first-run walkthrough overlay (Step 5).
- D1/D7 return cues + `returned_d7` (Step 9) — full value needs a second live board to return *to*.

Phase 0 is a same-day correctness fix. Phase 1 is measurable within a week of shipping.

---

## 8. Decisions needed (owner: Josh)

1. **3.1 email fix (Phase 0):** suppress the activation-upsell email, or repoint its CTA to the cert/exam, until L2.01 is live? (Recommend repoint — keep the celebratory touch, drop the dead link.)
2. **Tier consistency (§4 gap 0c):** when L1.02–05 / L2.01 publish, are they PUBLIC (anon reads, like L1.01) or FREE (anon must sign in to read)? Decide before publishing so the "all of L1 is open" promise is coherent.
3. **T1 micro-win milestone:** first clean **ERC**, or completion of the **REQUIREMENTS** stage? (ERC is the stronger "real" win; REQUIREMENTS is faster. Starter-pack download is the signup anchor, not the micro-aha.)
4. **Goal micro-survey question + option set:** exact wording and the 3–5 options (must map to real lifecycle segments).
5. **First-run UI scope:** minimal ("Start L1.01" card + ERC celebration) vs. full (checklist widget + interactive overlay). Recommend minimal first (Phase 1), then expand.

---

## 9. Sources

- appcues — SaaS/EdTech onboarding best practices; edtech onboarding examples; Duolingo onboarding breakdown. https://www.appcues.com/blog/user-onboarding-best-practices , https://www.appcues.com/blog/edtech-onboarding-examples , https://goodux.appcues.com/blog/duolingo-user-onboarding
- saasfactor — SaaS user activation / onboarding strategies; drop-off. https://www.saasfactor.co/blogs/saas-user-activation-proven-onboarding-strategies-to-increase-retention-and-mrr , https://www.saasfactor.co/blogs/why-users-drop-off-during-onboarding-and-how-to-fix-it
- insaim.design — SaaS onboarding best practices 2025 + TTV benchmarks. https://www.insaim.design/blog/saas-onboarding-best-practices-for-2025-examples
- digitalheroesco — SaaS onboarding metrics / aha-moment guide. https://digitalheroesco.com/journal/saas-onboarding-metrics/
- productfruits — educational platform onboarding (edtech). https://productfruits.com/blog/educational-platform-onboarding-edtech
- userpilot — customer onboarding in edtech; edtech retention crisis. https://userpilot.com/blog/customer-onboarding-in-edtech/ , https://userpilot.com/blog/edtech-retention-crisis/
- productgrowth.in — edtech onboarding, signup to first learning win. https://productgrowth.in/insights/edtech/edtech-onboarding-india-guide/
- elearningindustry — onboarding practices for edtech. https://elearningindustry.com/best-user-onboarding-practices-for-edtech-companies
- moldstud — seamless onboarding in e-learning platforms. https://moldstud.com/articles/p-creating-a-seamless-onboarding-experience-in-e-learning-platforms-best-strategies
- lmspedia — LMS onboarding best practices. https://lmspedia.org/lms-onboarding-best-practices/
- elucidat — designing onboarding e-learning. https://www.elucidat.com/blog/elearning-onboarding/
- userguiding — Duolingo UX & onboarding breakdown. https://userguiding.com/blog/duolingo-onboarding-ux
- emailtooltester — email welcome series best practices. https://www.emailtooltester.com/en/blog/email-welcome-series-best-practices/
- zanfia — onboarding email sequence examples. https://zanfia.com/blog/onboarding-email-sequence-examples/
- adoptkit — onboarding email drip campaigns / behavioral vs time-based. https://www.adoptkit.com/posts/onboarding-emails-drip-campaigns
- prosperstack — first-30-days onboarding email sequence. https://prosperstack.com/blog/onboarding-email-sequence/
- lovable — app retention benchmarks by category. https://lovable.dev/guides/what-is-a-good-retention-rate-for-an-app
- greta.agency — retention for edtech. https://greta.agency/resources/blog/retention/edtech/
- plotline — retention rates for mobile apps by industry. https://www.plotline.so/blog/retention-rates-mobile-apps-by-industry
- loyalty.cx — edtech churn rate case study. https://loyalty.cx/edtech-churn-rate/
- nalashaa — edtech app onboarding guide for developers. https://www.nalashaa.com/onboarding-stage-for-education-app-development-companies/
