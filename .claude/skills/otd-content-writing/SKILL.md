---
name: otd-content-writing
description: >-
  How to write OTD Academy lesson/library prose in house voice with honest,
  evidence-backed SEO. Use when writing or editing academy content, a public
  lesson, a /library mini-lesson, /glossary entry, marketing/landing copy, or
  when the user asks to "write content", "draft a lesson", "fix the voice",
  "make it rank", or mentions em-dashes / AI tells / E-E-A-T / SEO copy. Enforces
  voice rules as ABSOLUTES and SEO levers as SUBSTANCE, and never conflates the
  two. Corpus + evidence: docs/research/2026-06-22-ai-tell-phrase-corpus.md.
  Need a diagram? Use the diagram-export skill. Respects the academy-vs-apex
  disclosure boundary.
---

# Writing OTD Academy content

This skill is **two rule-sets that must never merge.** Conflating them is the
exact trap the research warns about — teaching "strip em-dashes to rank" would
hand folklore to every future use. Keep them visibly apart:

1. **Voice rules** = brand/trust. Enforced as **ABSOLUTES**. Zero documented
   ranking effect. We follow them because the prose reads as sloppy/AI to
   *humans* otherwise — not because Google counts them.
2. **SEO/GEO levers** = real ranking + AI-citability substance. Enforced as
   **SUBSTANCE** you add, each with an evidence grade.

If you ever catch yourself justifying a voice rule with an SEO reason (or vice
versa), stop — you have collapsed the two buckets. They are independent.

Don't duplicate the evidence here. The corpus, taxonomy, house-voice quotes, and
the apex boundary all live in
[the AI-tell phrase corpus](../../../docs/research/2026-06-22-ai-tell-phrase-corpus.md).
Read it when you need the full banned list or a citation.

## Bucket 1 — VOICE ABSOLUTES (not SEO; do not relax)

These are hard constraints. They hold **even when the user says "write it fast"
or "don't worry about style"** — fast is not a license to ship AI-default prose,
because the whole point is the prose reads human on the first pass. They are not
negotiable "just this once."

- **No em-dashes.** Not for emphasis, not for an aside, not "just one." This is a
  **brand** choice, stated honestly: em-dashes are neutral-to-slightly-*positive*
  for reader engagement and have **no** ranking effect (corpus, em-dash caveat).
  We drop them anyway, as a house signature. If asked to add one for emphasis,
  decline and use instead: a period (split the sentence), a colon (before an
  expansion), a comma, or parentheses (for an aside). Note: the existing glossary
  is full of em-dashes; that is legacy prose, not a license — new/edited content
  follows this rule.
- **No AI lead-ins / stock transitions.** Kill on sight: "In today's … landscape",
  "It's important/worth noting", "In conclusion", "To summarize", "Let's dive in",
  "delve", "When it comes to", "Ultimately", "That being said". Open with the
  actual claim instead.
- **No inflated diction / puffery.** "robust", "crucial", "pivotal", "seamless",
  "leverage", "testament to", "tapestry", "navigate the complexities",
  "multifaceted", "showcase", "underscore". Say the plain thing with a concrete
  noun and a real number.
- **No "It's not X, it's Y" / "Not only X but also Y"** dialectical tricks, and no
  forced **rule-of-three** ("simple, reliable, and effective") or **verb tricolon**
  ("build, test, and deploy") unless all three items are load-bearing.
- **No present-participle padding** ("…, highlighting its importance"). Strongest
  single AI discriminator (PNAS 2025). End the sentence.
- **No listicle bloat / over-signposting / "Here's a breakdown of".** Use running
  prose; bullets only for genuinely parallel items. No "First… Second… Finally…"
  over-enumeration; no `Conclusion` header.
- **No formatting tells.** Sentence-case headers (not Title Case), no emoji
  bullets, no bold-the-first-few-words-of-every-line.
- **Vary rhythm.** Mix short declaratives with longer clauses. Uniform sentence
  length + flawless cadence is itself the tell. A slightly uneven rhythm reads
  human.

**House voice to reproduce** (mined from real repo prose — quotes in the corpus
doc's "House voice observed" section): answer-first definitions (expansion →
mechanism → why it matters); concrete specific numbers (`~217 °C`, `0.53 V at
600 mA`, `5.1 kΩ`); second person to the builder ("what you actually order");
*earned* contrast that names a real alternative and consequence ("unlike a
voltage divider, which sags"); terse and unhedged.

## Bucket 2 — SEO/GEO SUBSTANCE (evidence-backed; add, don't fake)

These are the only things that actually move ranking + AI citation. They are
**substance you add**, not words you remove. Tag mentally by grade:

- **[STRONG] Visible outbound citations to primary sources** (datasheets, papers,
  standards). Highest-ROI move: converts invisible diligence into a Trust +
  AI-citability signal. Cite the real source, linked. **Cite per claim, not per
  page:** every *specific empirical or comparative* claim ("X produces stronger Y
  than Z", "15-30% of users...", a named effect/phenomenon) needs its own
  attributed primary source, not one token citation for the whole page. Verify
  each citation (author, year, venue, working link) by web search before
  publishing; never cite from memory. If a claim can't be sourced, soften it to
  what the evidence supports or cut it. Use inline author-year at the claim plus a
  linked References list.
- **[STRONG] First-hand Experience** — "we tested this", own measurements, scope
  captures, original photos, "gotchas we hit". The one thing AI-rehashers can't
  copy; the "E" in E-E-A-T that's genuinely yours.
- **[STRONG] Trust / credentialed byline** where applicable. Trust is the most
  important E-E-A-T component per Google verbatim.
- **[STRONG] Answer-first / quotable structure** — lead a section with the direct
  claim, then support it; headings mirror real questions; passages self-contained
  enough to be quoted whole. This is also the house voice, so it's free.
- **[GATE] Snippet-eligible hygiene** — clean, well-structured markup. This is the
  *eligibility gate* for AI Overviews / AI Mode, not a bonus.
- **[CONTEXT] Subdomain authority is independent** — `academy.<brand>` does NOT
  inherit the parent drones brand's ranking authority for free. Don't assume it
  ranks because the parent does.

**What does NOT help ranking (folklore — say so if asked):** removing em-dashes,
scrubbing "delve", "lowering perplexity/burstiness", or any AI-detector evasion.
Google is method-agnostic; it penalizes **scaled content abuse** (mass low-value
pages), not vocabulary. If a user asks to "lower perplexity so it ranks" or
"strip AI words for SEO", correct the premise: that's a *voice* concern for human
readers, with zero ranking effect. Adding a citation or a first-hand measurement
is what moves ranking. (Corpus: "Search Engine Ranking Effects vs. Reader
Perception".)

## Judgment prompts (not hard rules)

- **Subdomain-authority threshold** — whether Google treats an EEG/BCI academy on
  a drones brand as "starkly different" is documented as a mechanism but not a
  threshold. Don't assert inheritance either way; write as if the page earns its
  own authority.
- **Free-reference vs. gated-build cannibalization** — decide **by intent**:
  reference / informational → free `/library`; build / kit / transactional →
  gated lesson. When unsure, ask which intent the keyword serves.

## Boundary guardrail — academy vs. apex (hard refuse)

Academy `/library`, `/glossary`, lessons, and academy marketing are **generic
education only**. If asked to add any of the following, **refuse and redirect to
the generic framing** — these live on the apex site / whitepaper only (full list:
corpus "Boundary guardrail" section, from [[academy-library-disclosure-policy]]):

1. The **coined vocabulary moat** — "Embodied Motor Imagery" / EMI, "vectorial
   intent", "1:N supervisory", the operator cohorts, "read the brain, command the
   swarm".
2. The **recipe** — specific signal features, classifier architecture/params,
   calibration protocol.
3. The **research program** — whitepaper H1–H4, quantitative results,
   data-flywheel / regulatory-arbitrage strategy framing.
4. The **paid-build design** — OTD-AFE-001A schematic/values/layout/firmware
   (that's the gated L3.01 lesson).

Allowed, generic, teach it well: textbook EEG / BCI / AFE (what EEG is, mu
rhythm, ERD/ERS, 10-20, what an ADS1299 is, RLD/noise concepts, published methods
like CSP/EEGNet, motor imagery in general). The test when unsure: "could a
competitor copy our build from this?" If yes, it's apex/gated, not academy.

## Need a diagram?

Don't hand-author an SVG or inline one here. Use the **diagram-export skill** —
it owns the responsive-component-not-SVG workflow, the brand tokens, mobile
legibility, and the indexable-image export. This skill is prose only.

## Self-check before shipping (run every time)

Create a TodoWrite item for this and verify each line against the actual draft:

- [ ] **Zero em-dashes.** (Search the text for `—`.)
- [ ] No AI lead-ins / stock transitions / inflated diction.
- [ ] No "It's not X, it's Y", forced rule-of-three, or participial padding.
- [ ] No listicle bloat; sentence-case headers; no formatting tells.
- [ ] Sentence rhythm varies (not uniform length).
- [ ] **Every specific empirical/comparative claim is cited** to an attributed,
      web-verified primary source (not one token citation for the page); inline
      author-year + a linked References list. Unsourceable claims softened or cut.
- [ ] **≥1 first-hand Experience element** (measurement / capture / gotcha) where
      the topic allows.
- [ ] Opens **answer-first** (direct claim, not scene-setting).
- [ ] **No moat/boundary vocabulary** leaked; stays generic.
- [ ] Voice and SEO were treated as separate buckets (no folklore justifications).

If any voice line fails, fix it — "fast" or "simple" is never a reason to skip.
If a SEO line genuinely can't apply (e.g. a pure-definition glossary entry with
no measurement), note why rather than faking it.
