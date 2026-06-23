# Voice-consistency rollout — academy + apex copy (scoping + options)

> **For Claude (execution handoff):** this is a SCOPING doc with open decisions,
> not yet an approved task list. Resume via `[[voice-consistency-rollout]]` memory.
> Apply the **otd-content-writing** skill (`.claude/skills/otd-content-writing/`)
> as the voice authority. Use **superpowers:writing-plans** to turn the chosen
> option into a task list, then **executing-plans**.

**Goal:** one consistent house voice across all OTD copy — the academy's
non-library surfaces (this repo) and the apex `otd-site` — using the
`otd-content-writing` skill (voice absolutes: no em-dashes, no AI tells; honest
SEO as substance). The 12-lesson `/library` cluster is already done and live;
this extends the same voice to everything else.

---

## What exists (explored 2026-06-23)

### Academy (this repo, `project-foundry`)
Public, copy-heavy surfaces beyond the library, with an em-dash heatmap (proxy for
voice work; em-dashes + AI tells are what the skill strips):

| Surface | File | em-dash lines |
|---|---|---|
| Course detail / waitlist | `src/app/courses/[slug]/page.tsx` | 31 |
| Skill-tree / courses index | `src/app/courses/page.tsx` | 17 |
| Lesson-complete screen | `src/app/learn/[slug]/complete/page.tsx` | 13 |
| Home / landing | `src/app/page.tsx` | 12 |
| Sign-in | `src/app/sign-in/page.tsx` | 11 |
| Curriculum | `src/app/curriculum/page.tsx` | 5 |
| Certificate / exam / verify / license | `src/app/learn/**`, `src/app/{verify,license}` | scattered |

Plus marketing copy in `src/components/**` (~69 copy-ish em-dash lines). Rough
total: **~130 user-facing copy lines with em-dashes** across the academy UI, plus
AI-tell phrasing the skill also catches.

**Separately (bigger, decide in/out):** the **project guide content** (the L1.01
WROOM lessons, the gated-build lessons) is also academy prose, but it lives in the
prod DB via gitignored seed scripts — a large body of its own. Treat as a distinct
scope bucket.

### Apex `otd-site` (SEPARATE repo)
- **`c:\zzz\otd\otd-site-deploy`** — Next.js, **live** at onethousanddrones.com
  (last commit 2026-06-15, "new tagline 'One mind, many machines.'"). Copy
  surfaces: `app/page.tsx` (home), `app/about`, `app/contact`, components
  (`SiteHeader`, `SiteFooter`, `BriefingForm`, `BioScaleEmbed`). ~12 files with
  em-dashes. Compact marketing site.
- **`c:\zzz\otd\otd-site-v4-port`** — a parallel **v4 port** (last commit
  2026-06-14). Per `[[otd-ecosystem-site-rewrite]]` there is a "Brain-to-Swarm
  two-door hub" rewrite in flight (proto `c:\tmp\otd-hub-v4.html`).

---

## The two real complications

1. **Cross-repo: the skill isn't in the apex repo.** `otd-content-writing` lives
   only in `project-foundry/.claude/skills/`. A session working in
   `otd-site-deploy` cannot invoke it. To apply voice on the apex, first
   **replicate the skill + its research corpus** into the apex repo's
   `.claude/skills/` (or promote it to a user-level skill). Same for the
   `docs/research/2026-06-22-ai-tell-phrase-corpus.md` it points at.

2. **The disclosure boundary FLIPS.** The skill's boundary guardrail ("refuse the
   coined moat — EMI, vectorial intent, 1:N, cohorts, recipe, flywheel — on the
   academy") is **academy-only**. On the **apex**, that moat is *allowed and is
   the point* (it's where the whitepaper / Brain-to-Swarm thesis lives, per
   `[[academy-library-disclosure-policy]]`). The **voice absolutes and honest-SEO
   levers apply on both**; only the boundary differs. The skill needs a one-line
   "apex vs academy" note so it doesn't wrongly strip the moat on apex copy.

---

## Options

### A. Scope — what's in this rollout
- **A1 (recommended): academy UI/marketing copy only** (the table above). Contained,
  same-repo, the skill is right here. ~130 lines, a few sessions.
- **A2: + apex site.** Cross-repo; requires the skill-replication + boundary note
  + resolving which apex repo is canonical (see C).
- **A3: + academy project guide content** (L1.01 etc.). Large; arguably a separate
  initiative. Lower SEO/brand ROI than the public marketing copy.

### B. Sequencing
- **B1 (recommended): academy-first, then apex.** The skill + my context are here;
  prove the voice on the academy front door, then port to apex.
- **B2: apex-first** (the top-of-funnel brand site). Blocked on C + the skill
  replication.
- Within either: **highest-traffic first** — home → courses index → course detail
  → lesson-complete → sign-in → the rest.

### C. Apex repo — which one? (BLOCKER for any apex work)
- **C1: polish `otd-site-deploy` (the live site) now.** Immediate value, but wasted
  if the v4 rewrite replaces it soon.
- **C2: apply voice to `otd-site-v4-port` as part of the rewrite** (don't polish
  copy that's being replaced). Cleaner, but couples to the rewrite's timeline.
- **Needs Josh:** is the v4 rewrite shipping? If yes, do C2; if it's shelved, C1.

### D. Skill adaptation (do regardless, small)
- Add an "apex vs academy" clause to `otd-content-writing`: voice + SEO everywhere;
  the boundary guardrail is academy-scoped; on apex the coined moat is allowed.
- This lets the same skill serve both surfaces honestly.

---

## Recommended path
**A1 + B1 + D**, with C deferred to Josh: do the academy UI/marketing copy first
(home → courses → lesson-complete → sign-in → rest), add the skill's apex/academy
clause now, and decide the apex repo (C) before any cross-repo work. Then phase
the apex (C-dependent) and, optionally, the guide content (A3) as separate efforts.

## Open decisions (need Josh)
1. **Scope:** A1 only, or include apex (A2) and/or guide content (A3)?
2. **Apex repo:** is the v4 rewrite (`otd-site-v4-port`) shipping (→ C2), or polish
   the live `otd-site-deploy` (→ C1)?
3. **Where the skill lives for cross-repo use:** copy into each repo, or promote to
   a user-level skill?

## Done-when (once a scope is chosen)
Every targeted surface: zero em-dashes in copy, no AI tells, answer-first, honest
SEO; the apex keeps its moat, the academy stays generic; verified by loading the
real pages, not just grepping.
