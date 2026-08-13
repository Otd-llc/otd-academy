# Bed sound quality and jingle writing — research round, 2026-08-12

Five parallel web-research agents, one lens each: loudness/delivery, mix and master
technique, sound design and layering, sonic branding, loops and short-form audio.
Owner-authorised (the standing rule is to offload deep research off Claude).

**Read the provenance markers.** Everything under "MEASURED HERE" is a local
measurement of our own files and is primary. Everything under "FROM THE RESEARCH"
is secondary, and where a claim turned out to be an agency statistic or forum
folklore it is labelled as such rather than laundered into a recommendation. The
most valuable thing in this document is the section where the measurement
**contradicts** the research.

---

## 1. MEASURED HERE — the soft clipper is load-bearing, and nobody knew

`build()` ends with `tanh(v * (1.1/peak)) * 0.82`. `tanh` compresses, so it lifts
every quiet event relative to the loudest one. Because it is invertible, the
pre-clip buffer can be recovered exactly from a rendered file
(`x = atanh(y/0.82)`) — so the curve the arrangement WRITES and the curve that
SHIPS can both be measured, without editing the generator.

They are not the same curve, and the gap is not small. Peaks relative to PATCH,
against the design curve 0.55 / 0.78 / 0.70 / 1.00:

| kit | authored (pre-clip) | delivered @ drive 1.1 | rms err authored → delivered |
|---|---|---|---|
| plate | .556 / .791 / .645 | .656 / .861 / .740 | 0.028 → **0.069** |
| forge | .453 / .637 / .506 | .560 / .742 / .616 | 0.130 → **0.046** |
| machine | .384 / .531 / .365 | .498 / .657 / .476 | 0.225 → **0.130** |
| quiet | .431 / .602 / .450 | .551 / .724 / .572 | 0.165 → **0.070** |
| relay | .662 / .619 / .392 | .777 / .740 / .507 | 0.183 → 0.150 |

**For three kits the clipper is what brings them to the curve.** Their placement
gains were tuned by looking at rendered output, so the compression is silently
part of the arrangement. The research lens recommended lowering the drive to
protect the dynamics; taken at face value that would have made forge, machine and
quiet measurably *worse*. This is the one finding of the round that could only
come from measuring our own files.

`plate` — the picked kit — is the exception and the reverse case: its arrangement
writes the curve almost exactly (0.028) and the clipper then inflates it (0.069).

### What was done

`drive` is now a per-kit parameter, default 1.1, so every existing kit renders
byte-for-byte as before. A new kit `plate-soft` is plate at drive 0.6.

| | rms err vs curve | crest | master reaches |
|---|---|---|---|
| plate / master | 0.073 | 13.70 dB | −14.25 LUFS (0.25 short) |
| plate-soft / master | **0.030** | **15.66 dB** | −16.16 LUFS (2.16 short) |

**The trade is real and it is not free.** A first guess that a lower peak would
leave the master *more* linear gain to spend was wrong, and measurement caught it:
the clipper had been buying loudness by raising RMS against the peak, so backing it
off raises crest, and crest is exactly what linear gain runs out of true-peak room
against. The honest curve costs **1.9 dB of loudness in the feed**, and platforms
only ever turn material *down*, so nothing gives it back.

Both are in the audition rig. It is a listening call.

## 2. MEASURED HERE — we were 0.2 LU from a silent squash

The loudness lens read `af_loudnorm.c` directly and established that `linear=true`
survives only if **both** conditions hold, reverting to dynamic silently otherwise:

```
offset_tp = measured_tp + (target_i - measured_i)  <=  target_tp
measured_lra                                       <=  target_lra
```

`achievable_target()` in `hex-master.py` solves the **first** by construction. It
says nothing about the **second**. A bed whose loudness range exceeds `LRA=9` gets
squashed with the true-peak arithmetic looking perfectly correct — the same
incident as before wearing a different hat.

Measured on our two candidates: **LRA 8.40 and 8.80, against a ceiling of 9.0.**
plate-soft is 0.2 LU from tripping it. Backing the clipper off — the very change in
§1 — pushes LRA *up*, i.e. toward the cliff.

### What was done

`hex-master.py` now adds `print_format=json` to the apply pass, parses
`normalization_type` out of it, and **fails the build** if it is not `linear` while
`--preserve-arc` is set, naming which of the two conditions caused it. The mode is
printed on every run alongside input LRA and the achieved output. Inferring the
mode is how the first incident shipped; it is now read.

## 3. MEASURED HERE — the loop seam survives AAC

The loops lens flagged encoder priming/padding as an open risk it could not close
by reading, since no platform documents whether its transcode honours gapless
metadata. Half of it is testable locally:

| | length delta | dead air at seam | seam step \|last−first\| |
|---|---|---|---|
| source (tail-wrapped) | — | 0.0 ms | 0.00006 |
| AAC 192k round-trip | +256 samples (+5.3 ms) | 2.2 ms (0.07 frames) | 0.00653 |
| Opus 128k round-trip | 0 | 0.0 ms | 0.00055 |

The tail-wrap works: last and first sample differ by 6e-5, a continuous waveform
rather than a butt-splice. AAC's added samples are priming the decoder's edit list
absorbs, leaving a step at −44 dBFS. Inaudible.

**CLOSED 2026-08-12.** The owner uploaded a cut, looped it on the platform and
confirmed the seam. The local round trip was ffmpeg talking to ffmpeg — both
honouring priming metadata — so it lowered the risk without closing it; a real
upload was the only thing that could, and it came back clean. The tail-wrap
approach is now verified end to end rather than by inference.

---

## 4. FROM THE RESEARCH — worth doing, not yet done

Ranked by value per line of code. None of these are implemented.

1. **Band ownership on the 8.0 stack.** Five samples land on one instant (impact,
   taiko/anvil, kick, gong, sub-drop). Practitioner consensus is unanimous: give
   each layer one role and high-pass everything except the sub above ~120–150 Hz,
   rather than stacking five full-range files and hoping. Note the lens corrected
   the premise while it was at it — different samples at zero offset do not
   "phase-cancel" in the comb-filter sense (that needs a delayed copy of the *same*
   waveform); what actually happens is uncorrelated low-end summing unpredictably.
   The fix is the same either way.
2. **Phone-speaker translation.** Handsets roll off below ~150–200 Hz, so our sub is
   largely not reproduced where most of this will be watched. The missing-fundamental
   effect is real psychoacoustics, not folklore: add harmonic content in
   **250–700 Hz** derived from the sub (a saturated copy at 3–5× the fundamental)
   rather than trusting energy below 100 Hz to carry weight. Two sources, both
   production blogs — the *mechanism* is textbook, the *numbers* are not measured.
3. **A short-term loudness ceiling.** EBU **R128 s1** is a purpose-built spec for
   short-form (idents, stingers, promos under 30 s) and its structure is the useful
   part: it pairs an integrated target with a **maximum short-term** ceiling at
   target +5 LU. Its own −23 LUFS figure is broadcast reference and does not
   transfer. Adding an LUFS-S measurement per landing to the master's QA output
   answers "how loud is my loudest landing allowed to be" with a standards-body
   pattern instead of a guess. (The R128 s1 numbers came via a search summary; the
   PDF would not extract cleanly. Verify before quoting.)
4. **True-peak ceiling to −1.5 dBTP.** Lossy encoders overshoot; our signal is
   already soft-clipped and hot. One secondary source, but coherent, and the cost
   is half a dB.
5. **ADAA1 antialiasing on the clipper.** `tanh` generates harmonics above Nyquist
   that fold back, reported as most audible on percussive transients. First-order
   antiderivative antialiasing has a closed form for `tanh` because
   `∫tanh = log(cosh)`, so it is a few lines and one state variable rather than an
   oversampling buffer. Whether it is *audible here* is unmeasured.
6. **TPDF dither on the 16-bit write.** Three lines. Noise shaping specifically is
   wasted before a lossy codec; plain dither still isn't.
7. **Taper the riser's last 50–100 ms.** The "gap before the hit" is described
   qualitatively by every source and quantified by none, but our risers currently
   ring flat into the landing.

**No change needed**, confirmed against sources: the reverb tail-wrap is documented
standard practice; placing risers by their end is standard; and the decelerating
wheel is right — widening the inter-onset interval is the physically grounded cue
for deceleration (Friberg & Sundberg 1999 found stopping-runner velocity curves and
performed final ritardandi follow strikingly similar curves), and our tick spacing
is an order of magnitude above the discrimination threshold.

## 5. FROM THE RESEARCH — the jingle question

We have no pitched motif at all. The bed is percussion plus a sine sub.

- **The academic literature is thinner than the agency copy suggests.** Two real
  peer-reviewed pieces exist (Keller & Spence 2023; Spence 2024) and both are
  narrative reviews, not controlled recall experiments. Neither could be read past
  the abstract. Treat sonic-branding "rules" as loose priors.
- **The tier pattern is well evidenced as industry practice**: a 1–3 s mnemonic, a
  3–5 s stinger, a longer bed, all sharing DNA. Mastercard published theirs; Intel's
  five notes have survived thirty years of re-arrangement because the *note sequence*
  is the constant, not the production. What should stay fixed across our family is
  **pitch content and timbre**, not tempo or arrangement.
- **Few, well-separated pitches has real grounding** (Miller 1956: untrained
  listeners reliably discriminate ~6 pitches). Cap a motif at 3–5 notes. **The
  specific-interval claims are folklore** — no experiment isolating "a rising fifth
  is more memorable" was found. Pick the interval for how it sits against the
  navy/gold instrumentation aesthetic, not because a blog said fifths.
- **Fully pitchless as a permanent identity has no precedent at scale.** THX's Deep
  Note is the nearest engineering-pedigree analogue and it is texture-based — 30
  randomised oscillators — but it *resolves to a pitched chord*. That is the cheap,
  precedented move for us: keep the percussion as the rhythmic fingerprint and let
  the **8.5 s gold plating resolve into a brief pitched cluster**, rather than
  writing a melody over the whole ten seconds.
- **There is no aerospace/instrumentation sonic-branding genre to copy.** Searched;
  it does not exist. Genuine white space. The two legitimate analogues are Intel
  (make invisible engineering audible) and THX (precise, converging, resolved), both
  pure-synthesis-friendly.
- **Avoiding a cheap-synth sound is a known technique, not a talent**: 3–7 detuned
  oscillators per note with independent slow pitch drift, then space. That is how
  Deep Note was built and it is implementable in the same pure Python we already use.
- **Land the mnemonic on the existing visual beats**, do not re-cut picture to music.
  Our four word-landings and the plating sweep are already locked.

## 6. STOP REPEATING THESE

Claims that came back marked as unsourced, misattributed, or platform-unconfirmed.
Several are things we have said internally.

- **"85% of social video is watched with sound off."** Facebook-specific, 2016,
  publisher-sourced, never platform-confirmed, and about News Feed autoplay.
  TikTok's own published research points the *other* way (62% say sound is on all or
  most of the time). Do not apply the 85% figure to short-form vertical video. No
  comparable data exists for Reels, Shorts, or X — so a sound-off read is still worth
  having *there*, on the honest grounds that we do not know.
- **"−14 LUFS is the platform spec."** It is reverse-engineered consensus, not a
  published contract. No official Google page states it. TikTok, Instagram, X and
  LinkedIn publish **no** numeric target at all, and the third-party estimates for
  them contradict each other. Meta's own engineering blog describes *adaptive,
  context-dependent* loudness via xHE-AAC rather than a fixed target. YouTube's
  normalisation is **one-directional** — it turns loud material down and never turns
  quiet material up, which is exactly why the 1.9 dB in §1 is a real cost.
- **"Sonic branding lifts recall 96%" / "sound is recognised in 0.146 s."**
  Untraceable to any primary source. The Veritonic/Audacy study (14% podcast, 17%
  radio recall lift) is real and measured — cite that one or nothing.
- **"7–15 seconds is the optimal loop length."** Blogspam, no platform data. Our
  10.000 s is fine; do not defend it with this.
- **"Visual hits should land 2–4 frames before the beat."** Widely repeated craft
  wisdom with **no** standards authority behind it — searched for one and found
  none; ITU-R BT.1359 is about lip-sync error tolerance and is a category error if
  cited here. Our `preRoll` of 0.1 s sits inside the range multiple independent
  editing sources converge on, and is comfortably inside BT.1359's detectability
  window either way. Keep it, describe it as informed convention, do not claim a
  standard.

## 6b. Key and mode — a second, narrower round

Asked after the serious set came back "cool, but ominous." Two direct lookups
rather than a fan-out, because the question is narrow.

**Key is not the lever, and this is settled rather than arguable.** Powell &
Dibben, *Key-Mood Association: A Self Perpetuating Myth*, Musicae Scientiae
9(2), 2005: on an equal-tempered instrument listeners cannot identify mood from
key or key from mood, and a piece's perceived mood does not change when it is
transposed. About three-quarters of people questioned *believed* they had
key-mood associations, and those beliefs correlated strongly with late
eighteenth-century published key characters — sharps bright, flats mellow. Those
characters were real, and they were artifacts of **unequal temperaments**, where
the quality of the major third varied around the circle of fifths. Equal
temperament removes the mechanism. Every oscillator in `logbook-comp.py` is
equal-tempered, so moving the root from A to C to F# transposes the register and
changes nothing else.

**Mode is the lever, and it has an order.** Temperley & Tan, *Emotional
Connotations of Diatonic Modes*, Music Perception 30(3): the same melodies
rendered in six modes over a fixed tonic, judged pairwise for which is happier.
The result follows line-of-fifths order — **Ionian, Mixolydian, Dorian, Aeolian,
Phrygian**, happiest to saddest — with happiness rising as scale degrees are
raised. Lydian is the one exception, rated less happy than Ionian despite being
"higher".

The serious set was written in **aeolian: second-saddest of the six**. That is
not a subtle mis-set, it is two full steps below where "serious, professional,
but fun" sits. Mixolydian restores the major third and major sixth and lowers
only the seventh, which is why film scoring reaches for it for confident and
heroic without the saccharine of straight major.

**The implementation caveat that nearly made this a no-op:** the serious set
voices almost everything in open fifths, and a bare fifth is exactly the
interval that refuses to declare a mode. Relabelling the scale under a
fifths-only arrangement would have changed almost nothing audible. The third is
the note that *carries* mode, so bright modes re-admit it to the sequence
figure. Removing the third and then choosing the second-saddest scale is, between
them, the whole of why round two read ominous.

Seven variants rendered, mode as the only variable. Two of the round-two
measurement flags cleared as a side effect, because admitting the third changes
which partials peak inside the landing windows.

## 7. Open, needs empirical work

- ~~Upload → download → listen at the loop seam.~~ **Done 2026-08-12, clean.**
- Whether the ADAA1 change is audible on this material.
- Whether plate or plate-soft is the one. Numbers cannot settle 2 dB of level
  against 2 dB of crest.
