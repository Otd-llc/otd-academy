# Inline formative checks: authoring spec

Status: draft, 2026-07-21. Scope: how to author in-lesson comprehension checks in
the guide `contentBlocks` system. Companion to the assessment-item rules in the
`otd-content-writing` skill (which this spec must not contradict) and the
seed/dry-run mechanics in `otd-guide-content`.

## Bottom line (read this first)

**Recommendation:** yes, add formative checks throughout lessons, additively (never
gating) alongside the one gate quiz. All four block types already ship, so authoring
can start now. But within-stage checks are the LOW-leverage axis; the retention
wins are cross-session spaced review, worked-example fading, and self-explanation
(section 12), and they need engineering.

**The one decision for the owner:** approve the build order below, and decide
whether to author inline density now or wait for the parse-resilience fix.

| Step | What | Effort | Status | Why this order |
| --- | --- | --- | --- | --- |
| 1 | Parse resilience (section 10) | M | DONE (2026-07-21) | Prerequisite + latent-correctness fix; one bad block silently blanks a card / blocks the gate today |
| 2 | Engagement telemetry (section 12) | S | DONE (2026-07-21) | Without it, scaling inline checks is blind |
| 3 | MCQ attempt-reward (section 8) | S | DONE (2026-07-21) | Stops the XP economy teaching "don't answer" before mass-authoring MCQ |
| 4 | Cross-session review deck (section 12) | L | open | The biggest retention lever; net-new, benefits from 1-3 |

**Owner / next action:** repo maintainer to approve step order; step 1 unblocks safe
inline authoring. Everything below is the detail behind this table.

The rest of this doc is the authoring how-to (sections 1-9, 11) and the engineering
detail behind the table (sections 8, 10, 12). Every block type ships today; the
psychometric bar is section 7.

## 1. What this covers

A "formative check" is an in-lesson prompt that makes the learner retrieve or
verify, mid-stage, before the stage gate. It is distinct from:

- the **stage gate** (the WORK: checklist, measurement, artifact, commit), and
- the **gate quiz** (the one MCQ block whose pass records the `QuizPass` the exit
  gate ANDs on).

Four block types serve formative checking. This is a MENU, not a ranking. Which
one fits depends on the item's quality and the learner's prior exposure, worked
out in section 3, not on the order listed here:

- `callout` labelled "Check yourself" -> `SelfCheckBlock` (write-then-compare).
- `traceList` (eyeball-it verify, help-on-not-sure).
- `doSteps` (each step carries its proof).
- `quiz` without `gate` (practice MCQ, auto-scored, awards XP).

## 2. Core principle: additive, exactly one gate

- Formative checks are **additive**. They never gate.
- Exactly **one** `quiz` block per stage carries `gate: true`. It is the only
  assessment that blocks advance. Everything else is practice. This is an
  AUTHORING rule, not a validated invariant: nothing in the schema or the save
  boundary rejects a second `gate: true`. If two are set, client and server both
  pick the FIRST (`GuideBlocks.tsx` and `quiz.ts` agree on `find(gate) ?? [0]`),
  so the second silently degrades to a practice quiz. Count before seeding.
- Do not gate on a "Check yourself", a `traceList`, or a practice MCQ. Gating
  formative checks adds friction without signal and invites brute-forcing.
- The gate stays anchored to the WORK plus the one gate quiz. That is the
  authoritative-done contract (`guide-completion.ts` / `learner-gates.ts`).

## 3. Format selection

Pick the check type by what you are testing. Rank by ITEM QUALITY, not by format
label: a recognition item with throwaway distractors is the weakest thing you can
ship, but an MCQ with competitive same-register distractors (section 7) forces
retrieval about every option and approaches cued-recall benefit (Little & Bjork
2015). So MCQ is not a lower caste; a lazy MCQ is. Reach for write-then-compare
and verify blocks first because they are hard to author badly, and hold MCQ to the
distractor bar before it earns a slot.

Prior knowledge conditions the choice (expertise-reversal / worked-example effect,
Sweller & Cooper 1985; Kalyuga 2007). On a concept at FIRST exposure, a beginner
often cannot generate an answer, so a forced-generation prompt just imposes load
with no encoding. Lead first-contact concepts with a worked example or a verify
block (`doSteps` / `traceList`); reserve "Check yourself" for a concept the learner
has already met once (later in the section, a later stage, a cumulative review).

| Testing | Prior exposure | Use | Why |
| --- | --- | --- | --- |
| Conceptual "why" a learner should be able to state | already met (taught earlier with a block between, same stage or prior) | Check yourself | forced generation of a known idea is the strongest retrieval |
| Conceptual "why" | FIRST exposure | worked-example prose, then a Check yourself later | a beginner can't generate what was never taught; teach first, test after a gap |
| "Did the step actually work" (a value read, a visual state) | any | `traceList` | ties the check to the real artifact, with a help reveal |
| A build action with a visible success tell | any | `doSteps` proof | confirmation per step |
| A discrete fact with one right answer | any | practice `quiz` (competitive distractors) | instant auto-scored recall, no author grading |
| The single stage comprehension gate | end of stage | gate `quiz` | the one that records `QuizPass` |

Rule of thumb per stage: one formative check per major section, its TYPE chosen by
the two columns above (Check yourself only for an already-met concept), plus two or
three discrete-fact practice MCQ where an XP hit is worth the distractor cost.

"Already met" means the idea was taught earlier in THIS stage with at least one
intervening block, or in a prior stage. If the concept is introduced and tested in
the same breath with nothing between, that is parroting (section 5), not retrieval.

## 4. Per-stage rhythm

A target, not a quota. A section with nothing worth retrieving takes no check;
skip it rather than invent filler. Filler = a check whose miss would not change
what the learner does next (confirming you named a file, re-reading a number just
shown). If you cannot write a wrong answer a real beginner would pick, there is
nothing to test.

A "major section" is a `heading` (level 2) that introduces a distinct idea or
task, not every sub-heading. A stage of three level-2 headings has three major
sections; a level-3 sub-heading under one of them does not add a fourth.

Two tiers of check, counted separately:

- **At most 1 DEEP check per major section.** A deep check is a Check yourself, a
  `traceList`, or a `doSteps` (the ones that sit inside the section's teaching).
  Choose its type by the section 3 table: a do/verify section takes `traceList` or
  `doSteps`; a concept section takes Check yourself ONLY if the concept was already
  met (else teach it here and place the Check yourself in a later section or stage).
- **2 to 3 practice MCQ per stage**, placed at section BOUNDARIES (opening a
  section as a recall beat for the previous one), each separated from any deep
  check by a heading or a teaching block. A boundary MCQ is spaced recall of the
  prior section, so it does not count against that section's one deep check.
- **Exactly 1 gate `quiz`**, near the end of the stage, before the "Exit this
  stage" block, and after the WORK its scenario stems assume (see section 5). The
  gate is terminal and exempt from the adjacency rule.
- A short single-concept stage may legitimately carry only the gate quiz. A
  first-exposure concept with no later section to test it in gets NO Check
  yourself; do not force one. Do not pad to hit the numbers.

## 5. Placement, and the two spacing scales

Two different spacing concerns. The within-stage one below is really an
ANTI-PARROTING rule (a desirable-difficulty gap of seconds); the true retention
lever is the BETWEEN-session one, which this system currently has no surface for.
Do not conflate them.

Within a stage (anti-parroting):

- **Place the check after the concept, never adjacent to the sentence that
  states it.** A check that parrots the line directly above tests the short-term
  buffer and teaches nothing. Put it at the end of the section, after a `heading`,
  or after an intervening block.
- Put practice MCQ at section boundaries, not mid-paragraph.
- The gate quiz comes last, immediately before "Exit this stage". Its questions may
  only assume what the learner knows AT that point. Do not write a scenario stem
  about an artifact state the learner produces AFTER the gate (an ERC run, a DRC
  result gated in "Exit this stage"): they would have to diagnose a step they have
  not taken. Test the reasoning the stage taught, not the outcome of the next one.
- Never place two formative checks with no heading or teaching block between them.
  A boundary MCQ opening a new section is legal because the heading separates it
  from the prior section's deep check; two checks touching directly are not. The
  gate quiz is terminal and exempt. Let a multi-part explanation COHERE before the
  first check: interrupting a beginner mid-schema imposes extraneous load. "One
  deep check per section" is a ceiling, not a rhythm to fill.

Across stages and sessions (the real spacing effect, currently MISSING):

- The spacing and interleaving effects (Cepeda et al. 2006; Rohrer & Taylor 2007)
  operate over minutes to days, by re-testing the SAME idea at expanding
  intervals. This spec, as built, optimizes density inside one stage, which is the
  low-leverage axis. The higher-leverage additions live in section 12.

## 6. Authoring each type

Exact block shapes (validated by `src/lib/schemas/guide.ts`). Every string is a
content surface: voice absolutes apply (no em-dashes anywhere, including options
and captions). Use `·` as a separator, never an em-dash.

The SCHEMA bounds (what a save actually rejects) are wider than the authoring
targets below. Schema: `traceList` items 1 to 12, `doSteps` steps 1 to 20, `quiz`
questions 1 to 10, quiz options 2 to 6. The counts in the sub-sections are
authoring guidance INSIDE those bounds, not validation limits, so a reviewer must
not enforce them as hard rejects.

**Common silent failures** (each renders wrong or nukes the card with NO error, so
render-verify catches them, a schema check does not):

- A literal `/* comment */` in the JSON fails the parse and today drops the WHOLE
  card to blank. Ship valid JSON only.
- A `quiz` `answer` is a ZERO-BASED index. `answer: 1` is the SECOND option. Off by
  one ships a silently-wrong key.
- A "Check yourself" callout whose label is not `/^check yourself/i` ("Checkpoint",
  "Self check") renders as a plain callout, no write-then-compare, no error.
- A `?` inside a Check-yourself answer moves the last-`?` split; the block renders
  with the wrong question/answer boundary.
- A second `gate: true` quiz silently degrades to practice (only the first gates).
- An always-index-0 answer key is a free pass (no client shuffle).

### 6.1 Check yourself (write-then-compare)

A `callout` whose label matches `/^check yourself/i`. The renderer splits `body`
at the **last** `?`: everything up to and including it is the question, the rest
is the authored answer that unlocks after the learner writes an attempt. Session
only, re-attemptable, not persisted.

```json
{
  "type": "callout",
  "severity": "info",
  "label": "Check yourself",
  "body": "Why does a decoupling cap sit as close to the chip's power pin as the layout allows? Because the loop between the cap and the pin has inductance, and a longer loop means the cap can't supply fast current fast enough to hold the rail steady during a switching edge."
}
```

Authoring rules:

- One `?` that ends the question. Extra prose after it is the answer. The answer
  text must contain NO `?`: the renderer splits at the LAST `?`, so a question mark
  anywhere in the answer moves the boundary and the block renders wrong.
- The label must start with "Check yourself" (matched `/^check yourself/i`). A
  variety name ("Checkpoint", "Self check", "Quick check") silently renders a plain
  callout with no write-then-compare and no error.
- Ask for a statement the learner should be able to generate, not a yes/no.
- `severity: "critical"` colours the kicker red for a safety-critical check;
  any non-critical value (`"info"` or `"warn"`) renders gold
  (`SelfCheckBlock.tsx:31`).
- Omit the answer (no text after the `?`) only for a pure reflection prompt with
  no single right answer.

### 6.2 traceList (eyeball-it verify)

For "look and confirm" checks. Each item is a thing to verify; `help` opens only
when the learner says they are not sure.

```json
{
  "type": "traceList",
  "headline": "Eyeball it · the power section",
  "body": "Before you run ERC, confirm these three by eye.",
  "items": [
    { "text": "The LDO input pin goes to the 5 V net, not the 3V3 net.", "help": "Follow the wire from VIN. It should originate at the USB 5 V rail." },
    { "text": "The output cap sits on the 3V3 net, between the LDO output and ground.", "help": "One leg on VOUT, one on GND. If both legs read the same net, it's shorted." },
    { "text": "Every ground symbol is the same GND net.", "help": "A stray second ground net is the classic ERC error the next step catches." }
  ]
}
```

Rules: three to six items. Match them to what the stage gate asks for where the
gate is a visual check (so the learner rehearses the exact thing the gate scores).
`help` is the answer-key line, so make it the concrete "what right looks like",
not a restatement.

### 6.3 doSteps (proof per step)

For a build action where each step has a visible success tell. Ticking a step
reveals its proof.

```json
{
  "type": "doSteps",
  "title": "Place the decoupling caps",
  "body": "One per power pin, closest first.",
  "steps": [
    { "text": "Drop a 100 nF cap next to the MCU's VDD pin.", "proof": "The cap's pad sits inside the pin's courtyard, no trace detour." },
    { "text": "Route its ground leg straight to the nearest ground pour.", "proof": "The return path is a short stub to the nearest pour." }
  ]
}
```

`proof` is what the learner should SEE, phrased as an observable, not an
instruction.

### 6.4 Practice MCQ (non-gate quiz)

A `quiz` block with **no** `gate` flag. Auto-scored client-side for instant
feedback; each correct pick awards `STAGE_QUIZ_CORRECT` XP. Does not open the
gate.

```json
{
  "type": "quiz",
  "prompt": "Quick check · power",
  "questions": [
    {
      "q": "You read 5.0 V at the LDO input and 0 V at its output. What's the most likely cause?",
      "options": [
        "The input cap is the wrong value",
        "The enable pin is tied low or floating",
        "The board is drawing too much current",
        "The USB cable is data-only"
      ],
      "answer": 1,
      "explain": "No output with good input points at the LDO being held off. Check the EN pin before you suspect the load."
    }
  ]
}
```

- `answer` is a ZERO-BASED index into `options`: `0` = first option, `1` = second.
  Here `answer: 1` marks "The enable pin is tied low or floating". Off-by-one here
  ships a silently-wrong key that passes every other check. Count from zero.
- One to three questions per practice block.
- Every distractor is a real misconception at the same register as the answer
  (section 7). No throwaway options.
- `explain` is shown after the learner checks. Make it teach the miss.
- Required fields per question: `q`, `options` (2 to 6), `answer`. Optional: `id`
  (stable XP key; else a hash of `q` is used), `explain`. Block-level `prompt` is
  optional; `gate` is absent on a practice block.

### 6.5 Gate quiz

Same shape, plus `gate: true`. Exactly one per stage. Its pass records the
`QuizPass`; scoring is server-authoritative in `recordQuizPass`.

A complete, valid, drop-in object (no comments: a literal `/* ... */` in the JSON
fails the parse and drops the whole card):

```json
{
  "type": "quiz",
  "gate": true,
  "prompt": "Stage check",
  "questions": [
    {
      "q": "You need a steady 3.3 V for the MCU from the 5 V USB rail. Which part does that job?",
      "options": ["A pull-up resistor", "A decoupling cap", "A linear regulator (LDO)", "A signal diode"],
      "answer": 2,
      "explain": "An LDO takes a higher input voltage and holds a fixed lower output. A resistor or cap cannot regulate a rail."
    },
    {
      "q": "Your board reads 5.0 V at the LDO input and 0 V at its output. What do you check first?",
      "options": ["The enable pin", "The USB cable", "The MCU firmware", "The output cap value"],
      "answer": 0,
      "explain": "Good input, no output points at the LDO being held off. The EN pin comes before you suspect the load."
    },
    {
      "q": "Why does the output cap sit right at the LDO output pin?",
      "options": ["To set the output voltage", "To keep the regulator stable", "To store energy for the whole board", "To smooth ripple on the 5 V input"],
      "answer": 1,
      "explain": "Most LDOs need a minimum output capacitance to stay stable, or the output rings and oscillates. Smoothing the input is the INPUT cap's job."
    }
  ]
}
```

- Three to five questions. Enough to mean something, short enough to not wall the
  gate.
- This sample keys 2 / 0 / 1: a spread, no always-index-0. Extend that across the
  full bank and count before seeding, because the exam renders options in stored
  order with no client shuffle, so an always-A key is a free pass.
- No math or edge-case numbers in an L1 gate stem (section 7). These stems are
  scenario and concept, which is the L1 bar.

## 7. Assessment-item canon (hard rules for any MCQ)

From the `otd-content-writing` skill. These are not optional and they cost real
authoring effort. A bad MCQ is worse than none.

- **Every distractor is a real, same-register misconception.** Usually a concept
  from a neighbouring stage or the exact error the lesson warns about (ERC vs DRC,
  "gerbers are zipped project files", powered vs unpowered continuity). Never a
  joke option: a throwaway is a free elimination and reads as filler.
- **Spread the answer key.** No client shuffle. Distribute correct positions
  evenly across a bank and count before seeding (e.g. answers at 2, 0, 1, 3 across
  four questions, not 0, 0, 0, 0).
- **Scenario stems beat definition stems** where the lesson taught a diagnostic.
  "TP1 reads 4.9 V, what failed?" beats "What is an LDO?".
- **Match the audience bar.** L1 targets true beginners: plain core ideas, no math
  or edge-cases in the question. Cross-stage distractors are fair only when the
  lesson itself teaches the distinction (that is recall, not a trick).
- **Voice absolutes apply to every string:** prompts, options, `explain`,
  `prompt`. No em-dashes, no antithesis flourish, no jokes.

## 8. XP and anti-cheat (already wired): author implications

The economy exists. "Author to it" means understand what XP fires and when, so a
lesson does not promise XP that never lands. It does NOT mean chase the incentive:
choose check types by section 3 (pedagogy), and treat XP as an orthogonal reward,
not the reason to prefer one format. Where the incentive and the pedagogy disagree
(below), the pedagogy wins and the XP gap is a known defect, not a signal to author
more MCQ.

- Correct practice pick -> `STAGE_QUIZ_CORRECT` XP via `recordStageQuizAnswer`.
  Full rate first-ever, repop rate after (keyed off the durable `QuizPass`, so an
  admin XP reset re-enables practice at repop, never full-rate re-inflation).
- Wrong pick locks that question for the day (`quizLock`), so a learner can't
  farm XP by cycling options. A correct pick on a locked question scores 0.
- Implication for authors: because a wrong pick locks the question, the `explain`
  has to teach on the first miss. The learner won't get a same-day retry for XP.
- The gate quiz records one `QuizPass` per (enrollment, stage); a re-pass is
  idempotent.

**Known tension (economy design, beyond this spec's authority to fix).** The XP
gradient points AGAINST the pedagogy above: XP rides only on the practice MCQ,
nothing on "Check yourself" (which persists nothing today), and a wrong FIRST pick
locks the item for the day at 0 XP. Rewarding only a correct first guess penalizes
errorful generation, which improves retention even when the guess is wrong
(Kornell, Hays & Bjork 2009), and teaches an unsure beginner to not answer rather
than commit and learn from the correction. This is shipped code (`guide-awards.ts`
+ `quizLock`), so an author cannot fix it here.

Recommended economy change (feasibility-checked): award XP on the FIRST answer
regardless of correctness. The anti-farm is already the per-day dedupe key
(`stageQuiz(user, questionKey, day)` in `economy.ts`), not correctness, so
decoupling XP from a right pick does NOT open farming as long as that daily cap
stays. That half is a small edit to `recordStageQuizAnswer` plus a client tick on
a rewarded wrong attempt. Awarding a "Check yourself" attempt is larger: it
persists nothing today, so it needs a stable key, a new `XpSource` enum value
(Prisma enum migration, full tsc + vitest per the schema-change rule), and a
server action wired into the currently server-free island. Track separately from
this authoring spec.

**SHIPPED 2026-07-21 (the MCQ half only).** `recordStageQuizAnswer` now rewards the
FIRST answer of the day regardless of correctness: a wrong first pick awards XP and
still writes the day-lock (greys the slot, library parity), and the per-day dedupe
key is the farm cap, so a wrong-then-right cycle can't double-pay. `StageQuizResult`
widened (a wrong answer can carry `xp > 0`), and `QuizBlock` shows the XP tick
whenever `xp > 0`. Source stays `STAGE_QUIZ_CORRECT` (no migration; the name now
reads "answered", documented in-code). LIBRARY `recordQuizAnswer` is deliberately
UNCHANGED — a separate surface, bigger blast radius (lesson completion). The
"Check yourself" attempt-reward (enum migration) remains deferred.

## 9. Worked example: one stage authored to the rhythm

Ordering of blocks within a stage's `contentBlocks`, abbreviated. Shows the
rhythm, not full prose.

1. `heading` · "The power section"
2. `prose` · what an LDO does AND why it needs an output cap, answer-first. (This
   is where the output-cap concept is TAUGHT.)
3. `image` (boxed) · the LDO sub-schematic. (An intervening block, so block 4 is
   retrieval, not parroting.)
4. **`callout` "Check yourself"** · "Why does the LDO need an output cap? ..."
   [DEEP check, section 1.] Legal because the concept was taught in block 2 with
   block 3 between (section 3 "already met"). If the output cap were genuinely
   first-contact here, this check would move to a later section or drop.
5. `heading` · "Decoupling"
6. **practice `quiz`** (1 question) · recall from the power section (what an LDO
   does). [BOUNDARY MCQ: opens section 2, separated from block 4 by heading 5.]
7. `prose` · one cap per power pin, closest first.
8. `doSteps` · place the caps, proof per step. [DEEP check, section 2. Separated
   from the boundary MCQ by teaching block 7.]
9. `heading` · "Verify before ERC"
10. **practice `quiz`** (1 question) · the EN-pin diagnostic from 6.4. [BOUNDARY
    MCQ: opens section 3, separated from block 8 by heading 9.]
11. `prose` · what ERC checks and how to read the report.
12. **`traceList`** · the three eyeball checks from 6.2. [DEEP check, section 3.
    Separated from the boundary MCQ by teaching block 11.]
13. **gate `quiz`** (`gate: true`, 3 questions, key spread 2/0/1). Terminal, exempt
    from adjacency. Stems test what the stage taught, not the ERC run that "Exit
    this stage" gates next.
14. `callout` "Exit this stage".

Three major sections, one deep check each (blocks 4, 8, 12), two boundary MCQ
(6, 10), one terminal gate. No two formative checks touch: a heading or a teaching
block sits between every pair. Each deep check follows a concept the learner has
already met, never parroting the line above.

## 10. Ship mechanics and the code prerequisite

Getting a block into a lesson (WHAT to write is above; this is HOW to ship it):

- Guide content lives in the **PROD DB**, not git. The `otd-guide-content` skill
  owns the mechanics; read it before writing. The pattern: an idempotent script
  (see `scripts/_l101-*.ts` for worked examples) that finds the card by
  `(project slug, revision label, stage)` and edits its `contentBlocks`, run as a
  dry-run first, then for real.
- **Render-verify the PAGE, not the DB write.** A block that parses in your script
  can still drop the whole card at render (below). View the actual learner page at
  `/projects/<slug>/<revLabel>/guide/<stage>` after seeding and confirm the card
  renders with your new block present.

**Code prerequisite: per-block parse resilience.** The learner render path safe-
parses the whole `contentBlocks` array at
`src/app/(chrome)/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` (~L397) and,
because `guideContentBlocksSchema` is a single `z.array(...)`, a Zod array parse is
all-or-nothing: one malformed block fails the whole array and the card renders
`[]`. Adding many inline check blocks widens that blast radius. The fix is a per-
element parse that keeps the survivors, but it is **M, not S**, for three reasons
the feasibility pass surfaced:

- **Four parse sites, not one.** The same array is consumed all-or-nothing at the
  render page, the gate scorer (`quiz.ts` ~L67), the per-pick XP path
  (`lesson-content.ts` `quizQuestions`), and the capture writer
  (`guide-block-write.ts`). Fixing only render produces a WORSE failure: a card
  with one bad block renders fine but its gate quiz can never pass and per-pick XP
  silently returns nothing. Apply the tolerance at all four.
- **Preserve original indices.** The admin capture tool addresses a block by its
  array position (`blockIndex`), and the server writes back to
  `blocks[blockIndex]`. A filter that renumbers survivors makes a capture land on
  the wrong image. The resilient parse must carry each survivor's ORIGINAL index.
- **A silent skip needs an author signal.** Dropping a block quietly is the
  today-failure inverted: the author never learns a typo deleted a live check.
  Surface an admin-only "N blocks skipped (malformed)" marker (the render already
  has `isAdmin`) and/or a `lesson-readiness` warning.

This is the load-bearing prerequisite for scaling inline checks. It is not the ONLY
engineering the roadmap needs: section 12 telemetry is a second, independent gate
on scaling content.

**SHIPPED 2026-07-21.** Implemented as `src/lib/guide-blocks-parse.ts`
(`parseGuideBlocks` keeps survivors + their storage indices + a `dropped` list;
`parseBlockAt` validates one block by storage index). Wired at all consumers: the
render page (`page.tsx`, survivors render, storage index threaded through
`GuideBlocks` -> `GuideBlock` -> the capture `blockIndex`, admin-only "N skipped"
banner), the gate scorer (`quiz.ts`), the per-pick XP path
(`lesson-content.ts`), and the capture read/write path (`guide-block-write.ts`,
`guide-images.ts`, `api/capture/{session,status}`). Tests:
`src/lib/__tests__/guide-blocks-parse.test.ts` + a lesson-content sibling-resilience
case. Full suite 1812 green, tsc + lint clean. Remaining manual check: render a card
with an intentionally malformed block and confirm the admin banner + surviving
blocks.

## 11. Author self-check (run every line against the actual draft)

- [ ] Exactly one `quiz` has `gate: true` in the stage. No other block gates.
- [ ] Every Check yourself is on an already-met concept (taught earlier, block
      between), never first-exposure or parroting the line above.
- [ ] No two checks adjacent; at most one per major section.
- [ ] Every MCQ distractor is a real same-register misconception (no jokes).
- [ ] `answer` is the correct ZERO-BASED index (option 1 = index 0). Verify each.
- [ ] Answer key spread across positions, counted before seeding (not always 0).
- [ ] Gate stems test what THIS stage taught, not the post-gate work.
- [ ] Stems match the audience bar (L1 = plain core ideas, no math/edge-cases).
- [ ] Every `explain` teaches the miss (wrong pick locks for the day).
- [ ] JSON is valid (no comments); labels, `?` placement, single `gate` all clean
      (see Common silent failures in section 6).
- [ ] Zero em-dashes in any string (prompt, options, explain, bodies, headlines).
- [ ] Render-verified the PAGE at `/projects/<slug>/<revLabel>/guide/<stage>` after
      seeding, not just the DB write.

## 12. Higher-leverage additions (beyond within-stage checks)

Within-stage density is the low-leverage axis. These three moves outweigh any
tuning above for actual retention, ranked by leverage. They need product/engine
work, so they are roadmap, not authoring guidance.

1. **Cross-session spaced + interleaved cumulative retrieval.** The single biggest
   lever and this system's largest blind spot: every check today is within-stage.
   Add "carryover" checks that re-test a prior stage's key idea later, at expanding
   intervals, interleaving concepts rather than blocking them. This is effort **L**,
   net-new, and the substrate is thinner than it looks. What exists (`XpEvent`
   keyed by `questionKey` + `earnedOn`; `QuizLock` per day) can BOOTSTRAP an initial
   schedule but cannot DRIVE one: it covers only MCQ (the other three formats
   persist nothing), it is a day-granularity event log with no per-item interval /
   due / ease state, and there is no queryable question bank (items live inside
   `GuideCard.contentBlocks` JSON). A real review deck needs a new SRS scheduling
   model (per user × question), an item registry, and a deck surface. (Spacing
   effect, Cepeda et al. 2006; interleaving, Rohrer & Taylor 2007.)
2. **Worked-example fading for beginners.** `doSteps` is always fully worked, with
   no bridge to independent performance. Fade the scaffolding across a lesson
   (fully worked step, then a completion step with a blank, then solo) so a novice
   transitions off the proofs. For a true-beginner audience this rivals lever 1.
   (Worked-example + faded-worked-example effect, Sweller & Cooper 1985; Renkl &
   Atkinson 2003.)
3. **Structured self-explanation prompts inside worked steps.** Cheap, high-yield:
   ask the learner to state WHY a step works or why a value is what it is, during
   `doSteps`, not only at "Check yourself". (Self-explanation effect, Chi et al.
   1994.)

Engagement telemetry is the prerequisite for evaluating any of this. The formative
checks are session-only by design (re-attemptable), so today there is no signal on
whether learners use them. Lightest path (effort **S**, no schema): fire client
PostHog events from the existing session-only islands (`posthog-js` is already
wired, see `analytics-client.ts`) on reveal / help-open / step-tick. That gives an
aggregate attempted/revealed signal without per-user persistence. Do it before
scaling inline-check content, or the rollout is blind.

**SHIPPED 2026-07-21.** `trackFormativeCheck(kind, action)` in
`analytics-client.ts` fires a single `formative_check_engaged` PostHog event, wired
into all four islands at the engagement moment, once per block per session (a
`firedRef` guard): SelfCheckBlock on reveal, TraceListBlock on first "not sure",
DoStepsBlock on first step tick, QuizBlock on first pick (anon included). No schema,
no per-user persistence; a no-op without a PostHog key (so local dev is silent).
Segmenting by stage/card is a deliberate follow-up (would need threading cardId
through the islands) — this v1 answers "are checks used, and which types".

**Build order** (across section 10 and this section):

1. **Parse resilience (section 10):** infra; unblocks safe authoring and is also
   a latent-correctness fix (one bad quiz block silently blocks the gate today).
2. **Telemetry (S):** infra; you need the attempted/revealed signal in place
   before scaling content or judging whether the rest pays off.
3. **MCQ attempt-reward (S):** economy; land it before mass-authoring practice
   MCQ so the incentive stops teaching "don't answer". Defer the Check-yourself
   award (enum migration) until telemetry shows the usage justifies it.
4. **Review deck (L):** net-new product surface; benefits from all three above and
   bootstraps its schedule from the log they populate. Last.

Citations here (Cepeda, Sweller, Little & Bjork, Kornell, Chi, Renkl, Rohrer) are
landmark learning-science references named from memory to ground the reasoning.
They are NOT web-verified. This is an internal spec; verify author/year/venue by
search before any of this text migrates to a learner-facing or public surface, per
the otd-content-writing citation rule.
