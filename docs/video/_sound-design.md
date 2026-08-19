# Sound design for the furniture — what was measured, and what is still open

**Date:** 2026-08-19 · **Status:** research done, twelve directions built, **two decisions open**

Four parallel research rounds. This is the surviving record; the conversation is not.
Everything here is graded — **MEASURED** (a study with numbers), **HARD** (primary
source), **SOFT** (practitioner consensus), **NONE** (no evidence exists).

---

## 0. The two open decisions

**A. Intro length. Currently 4.0 s. The evidence says ~1–2 s.**
See §3. This is an editorial call about whether the series carries an identity,
not a technical one. The bar-aligned compromise is **2.0 s = 1 bar** — still lands
on a downbeat, roughly a quarter of the current length. Below one bar there is no
grid left.

**B. Cadence, or no cadence.** The research contradicted itself and both sides are
defensible. See §2. `mallet-warm` (no cadence) and `mallet-cadence` (resolves) are
the same figure either way, and that A/B is the decision.

---

## 1. What killed the first attempt

The first bed used CC0 workshop recordings — anvil, hammer, relay, electrical arc.
It was called "odd factory noise", and there is a paper that describes the failure
almost exactly.

**MEASURED.** Moreno & Mayer (2000), *J. Ed. Psych.* 92(1). Experiment 2 used
literal, subject-matched sound design (static and crackle for a lightning lesson).
**Mechanical sounds significantly reduced retention on their own.** The authors'
diagnosis: *"repetitious mechanical sounds … too intrusive, arbitrary, and
ambiguous."*

Three independent causes stack:
1. **Unpitched.** Audio logos WITH a melody score ~25% higher and are >50% more
   memorable (Veritonic, n>1,600, 48-hour recall). The bed had no pitched content.
2. **Semantically arbitrary.** Under high involvement — and an audience operating
   CAD software is maximally high-involvement — musical *fit* drives processing;
   attention-getting music that does not fit interferes (MacInnis & Park 1991).
3. **Alarm-shaped envelope.** Fast-attack broadband metallic transients are the
   acoustic vocabulary of auditory warnings (Edworthy 1991, Patterson 1982).

**The nuance worth keeping:** literal *source material* is fine. Netflix's "ta-dum"
is a struck cabinet. What fails is a literal *result* — the source can be an
object, the output must read as music.

---

## 2. The design, and where it contradicts itself

**Tempo drives arousal; MODE drives mood; they are independent.** (Husain,
Thompson & Schellenberg 2002, MEASURED.) So never fix a cold sting by speeding it
up.

**120 BPM is right, arithmetically and emotionally.** 2 bars = 4.000 s and 4 bars
= 8.000 s with zero rounding, so every event sits on a sample-exact grid position.
And in a 3-tempo study (n=63) 120 sits mid-scale on every axis; 150 buys +0.68
happiness for +0.53 tension.

**Mode ranking**, forced-choice "which is happier" (Temperley & Tan 2013,
MEASURED, n=17):

```
Ionian .83 > Mixolydian .64 > Lydian .58 > Dorian .40 > Aeolian .34 > Phrygian .21
```

Lydian is out: not measurably happier than Mixolydian, and it costs a #4 that
reads as film-score wonder.

**~6 pitched events.** Willingness-to-pay against tone count is an inverted U —
3 and 9 both score below 6 (Krishnan et al. 2012).

### THE CONTRADICTION, left as a dial

- **One line argues for a real cadence.** Intro in Mixolydian ending ♭VII→I
  (arrival with no leading tone, so it hands over to speech); outro in Ionian with
  a root-position V→I, tonic in bass and melody — the maximum-closure
  configuration in Sears et al. (2014). The outro is then literally the intro
  completed, one scale degree apart, and that relationship *is* the brand.
- **The other argues for no cadence at all.** Pentatonic, no leading tone, because
  *"a cadence announces, and announcing 128 times is what makes people mute you."*

Both are defensible. They cannot both be followed. Shipped as an A/B.

---

## 3. The finding that challenges the whole intro

**MEASURED, n = 89 videos across 18 named channels.** Time-to-first-narrated-word,
extracted from YouTube caption word-timings:

| | |
|---|---|
| median | **0.48 s** |
| under 1 s | 71% |
| under 4 s | **87%** |

| Channel | First spoken word |
|---|---|
| 3Blue1Brown | 0.00–0.24 s |
| **Phil's Lab** (closest analogue) | **0.24–0.40 s** |
| **Bald Engineer** (his KiCad series) | **0.08–0.56 s** |
| Ben Eater | 0.08–1.52 s |
| Blender Guru | 0.24–0.80 s |
| Applied Science | 0.48–0.80 s |

**15 of 18 leave no room for a musical intro at all.** The three that do are not
software-tutorial screencasts.

**Trap:** Phil's Lab and Bald Engineer both label a chapter `0:00 Intro` while
speaking at 0.40 s and 0.12 s. In this genre "Intro" means the *spoken framing*,
not a bumper. Do not read chapter lists as evidence of a sting.

### Repetition is the harder constraint

**MEASURED.** Szpunar et al. (2004): under **focused** listening — headphones,
following along, i.e. our audience — liking peaks around **8 exposures and returns
to baseline by 32**. At 128 we are 4× past the point the benefit was gone.

**HARD.** Rankin et al. (2009) characteristic #5: *very intense stimuli may yield
no observable response decrement*. Groves & Thompson (1970): at high intensity
**sensitization dominates habituation** — the response GROWS with repetition.

> A quiet sting becomes furniture. A loud, impulsive one may never habituate and
> can get worse across 128 plays. That is categorical, not a matter of degree.

**The two reference classes disagree and both are right.** 4 s is dead centre of
the audio-logo cluster (Netflix ~3 s, HBO ~5 s) and ~8× the median for THIS genre.
Our 4 s is a good audio logo and a bad technical-YouTube intro.

**The outro is not exposed the same way** — drop-off has happened, no narration
competes. That is the safe place to spend brand character.

---

## 4. Constraints that are settled

- **Protect 1.5–4 kHz.** Consonants live there, carry the intelligibility, and
  hold little energy. The reverb **wet return is high-cut at 2 kHz** so the tail
  cannot mask the narration that follows. The dry sting may be as bright as it likes.
- **RT60 ≤ 1.5 s**, or the tail *is* the sting.
- **300–500 ms of near-silence before the first phoneme.** Forward masking decays
  over ~100–200 ms.
- **The sub is a trap.** Laptop speakers — the actual delivery device, since KiCad
  is desktop-only — roll off below ~150–200 Hz. A 55 Hz fundamental is inaudible
  there while still eating headroom and counting toward loudness normalisation,
  making the audible part quieter. Render explicit **2f and 3f partials** so the
  pitch survives via the missing-fundamental effect. Master high-pass at 30 Hz.
- **Loudness.** EBU R128 s1 names "stingers" as short-form explicitly: max
  short-term **+5 LU** over programme. With narration anchored at −14 LUFS that is
  a sting at **−11 to −9 LUFS short-term**. Do NOT judge a 4 s sting by integrated
  LUFS — too few gating blocks for the measurement to mean anything.

### Failure modes that betray a generated file

Each of these is cheap to avoid and expensive to notice late:

1. **Truncated reverb tail.** `convolve(...)[:n]` guillotines it. *This bug was
   real here* — the first bed ended mid-waveform at 0.6% FS. Fade, never cut.
2. **Clicks at element boundaries.** ≥5 ms fade on every element; sines start at
   phase 0.
3. **Aliasing.** A naive saw or square folds partials back that sweep *downward*
   as pitch rises. Use additive synthesis with the partial count capped below
   Nyquist — offline rendering has no reason to accept aliasing.
4. **Sub drop written as `sin(2π·f(t)·t)`.** The instantaneous frequency becomes
   `f + t·df/dt`, so it lands at the wrong pitch and clicks. **Integrate frequency
   to get phase.**
5. Everything uniformly quantised and uniformly loud. Humanise the approach
   ±10 ms; the payoff stays dead on the grid and is the loudest event.

---

## 5. Licensing — three traps that would have cost real money

| Source | Verdict |
|---|---|
| **VCSL** (Versilian Community) | **CC0, clean.** Verbatim in the repo LICENSE. 106 instrument folders, incl. marimba/vibes/glock/tubular bells |
| **VSCO 2 Community Edition** | **CC0, clean.** ~3,000 samples; where the strings/brass/winds are |
| University of Iowa MIS | Unconditional — *"used for any projects, without restrictions"* — but an **informal web-page grant, not a licence instrument.** Archive the page text with a date stamp |
| Philharmonia | Permits commercial use, no attribution — but **MP3 all the way down**. Lossy under YouTube's encoder |
| **Sonatina Symphonic** | **DISQUALIFIED.** Sampling Plus 1.0 excludes using the work to *"advertise for or promote anything but the work you create from it"* — a brand intro is advertising. The trap: the deed permits commercial sampling, so a casual read says yes. Also a **retired** CC tool |
| **BBC Sound Effects** | **DISQUALIFIED.** RemArc is personal/educational/research only. "Educational" means **you are a student**, not "my product teaches" |
| **Salamander Grand Piano** | **CC BY** — attribution required. Claims of a 2022 relicense to public domain are unverified at both canonical locations |
| OpenAIR (IRs) | Site suspended; was per-contribution licensing anyway |

**The way out of all of it: synthesise.** `tools/bed-synth.py` is pure numpy —
marimba by modal synthesis, pad by additive supersaw, reverb by a synthesised IR.
No sample has any terms attached to arithmetic.

---

## 6. Where the evidence does NOT support a decision

Say so rather than reaching for a weak study:

- **Timbre → perceived competence/expertise: NONE.** The "77% more trustworthy"
  figures are vendor market research, not peer-reviewed. Pick the palette on brand
  fit and say that is why.
- **A specific "correct" BPM: NONE.** Only *don't go slow* — 66 BPM was badly
  harmful across six measures; 138 BPM was **not better than silence** on anything.
- **Tempo matched to speech rate: NONE.** *Regularity* has thin neural support
  (a rhythmically regular cue before speech modulated entrainment and correlated
  with memory for the following sentence) — which argues for a gridded sting over
  an ambient swell, the opposite of the usual instinct.
- **Music at instructional boundaries: NONE.** All the coherence-principle evidence
  is music playing UNDER narration. A sting that ends before speech has no stream
  to compete with. That is "untested", not "therefore fine".
- **Intro length vs retention: NONE.** No controlled published study isolates it.
  Anyone citing a number is citing a blog. §3's measurement is the better footing.

**Discount headline effect sizes from a principle's own advocates.** The famous
coherence d = 0.86 is a narrative tally by the originating lab; an independent
meta-analysis (177 effects, 50 studies) gives **g = −0.16**. The same pattern shows
up in the Mozart-effect literature.

---

## 7. Background music under long working segments — the weakest idea on the table

Considered for long, quiet wiring stretches. The honest expected effect on
comprehension is **≈ zero** (instrumental: d = −0.23 to +0.14, none credible).
Risk concentrates in **lyrics** (d ≈ −0.32) and in **acoustic change** — a bed that
modulates disrupts more than one that sits still.

The asymmetry that decides it: **every positive background-music finding used
self-selected, preferred music.** A bed imposed on a viewer has neither property,
and it blocks the music they would have chosen. The audience is also novice at the
task, and load-reduction matters most for novices (expertise reversal).

And: people's metacognition about instrumental music is **wrong** — they perceive
it as helping when it does nothing. That includes us, auditioning it.

Not a veto. But it is a taste call made on the viewer's behalf.

---

## 8. What exists now

- `tools/bed-synth.py` — twelve directions, pure numpy, both pieces, writes
  `public/_beds/` plus a manifest. `--list` prints the set.
- `/sandbox/video-furniture/r2/preview` — plays the piece in real time with its
  bed, swaps beds without stopping, both themes. **The audio clock is the master**
  so picture and bed cannot drift.
- `tools/furniture-bed.py` — the original sample-based bed. Kept only as the
  record of what "odd factory noise" was; superseded by `bed-synth.py`.
