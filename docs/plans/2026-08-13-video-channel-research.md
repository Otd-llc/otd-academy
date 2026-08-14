# Video channel research: what the evidence actually says

Synthesis of a five-agent research round, 2026-08-13. Companion to
`2026-08-13-video-furniture-mixer.md`, which is the build plan.

**How to read this.** Every claim carries a grade. `[HARD]` = peer-reviewed or a
published standard. `[SOFT]` = industry practice with a traceable number.
`[CRAFT]` = convention, no evidence base. `[FAILS]` = widely repeated, does not
survive checking. The last category is as valuable as the first: it is the list
of things we would otherwise have built on.

**The agents were not trusted blind.** One recommendation from an earlier round
this project ran was contradicted by our own measurement for 3 of 5 cases. Two
claims below were re-verified locally before being written down, and are marked.

---

## 1. Things we have already built that this contradicts

Listed first because they are the expensive ones.

### 1.1 Do not animate the honeycomb

The `combwalk` set animates the comb. Flagged three independent ways:

- It is the enumerated AI-tech-video cliché (particle systems, pulsing node
  graphics, animated lattices). `[CRAFT]`
- A moving repeating high-frequency pattern is close to worst-case content for a
  block-transform codec, and aliases. `[HARD — codec behaviour]`
- Pattern motion across a large share of the field is a vestibular trigger.
  `[CRAFT — Val Head, authoritative practitioner]`

**Keep the honeycomb. Do not animate the honeycomb.** A static comb with the
current cell lit, changing on a cut, delivers the same information.

### 1.2 Effects on the ban list that we shipped

| Ours | Why it goes |
| --- | --- |
| `combwalk/count` (counting numerals) | Motion-graphics-template default; transient - the value is not readable until it stops |
| `blur` exit | Guarantees illegibility during the transition; straight transient-information penalty |
| `swipe off` exit | Full-frame slide: vestibular trigger, and reads as slide-deck software |
| `settle` exit (scale) | Scale/overshoot is the playful register the identity explicitly rejects |
| hex entrance `rotate(-12deg)` | Rotation is not in the permitted vocabulary |

### 1.3 The base unit is wrong, and this is the big one

**Every size constant must be a share of `min(width, height)` - the frame SHORT
edge - not of frame height.** `[HARD]`

BBC specifies subtitle size as **6.667% of frame height for landscape** and
**3.75% for 9:16**. Those are not two opinions; they are the same physical size.
At 1920x1080 and at 1080x1920 both resolve to a **72 px em**. The invariant is
the short edge.

Our furniture sizes in `cqw` - container WIDTH - which is the long edge at 16:9
and the short edge at 9:16. Carrying one constant across both therefore ships
type **1.78x wrong** in one of them. This is almost certainly the real cause of
the per-format type fudge factors the Logbook film needed (`QUIZ_NARROW_TYPE`
0.58, `QUIZ_TALL_TYPE` 0.52): those numbers are close to 1/1.78 = 0.56, which
means we were hand-tuning our way around a unit bug rather than fixing it.

### 1.4 Bebas has no slashed zero, and a 0.60 width-to-cap ratio

Measured from the repo's own TTFs. `[HARD - direct measurement]`

| | Bebas Neue | Saira Condensed XB | Roman reference |
| --- | ---: | ---: | ---: |
| advance `H` / capHeight | **0.600** | 0.754 | ~1.00 |
| slashed-zero feature | **none** | `zero` present | - |

Legibility at threshold is limited by counter width, not cap height, so a
condensed face needs scaling up to recover: **Bebas x1.67, Saira Condensed
x1.33**.

**Consequence for our lower thirds:** they set values like `AP2112K-3.3` in
`--font-display` (Bebas). A part designator has no lexical context to recover a
misread from - nobody recovers `C11` read as `CII` the way they recover a
misread `the`. **Designators, values and warnings go in Saira Condensed with
`font-feature-settings: "zero" 1, "tnum" 1`. Bebas is for words, not parts.**

> **CORRECTION, 2026-08-13, from measuring the fonts we actually SERVE** (the
> swap is built; commit `06240264`). The table above is right about the files
> and wrong about the delivery, and the real argument is stronger than the one
> stated.
>
> - **The advance/cap numbers reproduce exactly** against the CDN-served fonts:
>   Bebas 0.600, Saira 0.752, Arial 1.010. Nothing to change.
> - **The decisive fact is not the slashed zero. In Bebas, `0` and `O` are the
>   SAME DRAWING** - identical ink and identical advance at delivery size
>   (15.36/15.36) and at 300px (120.00/120.00), control pair differing at both.
>   A Bebas `C0` and a Bebas `CO` are one picture; no size, weight, contrast or
>   hold duration separates them. This needs no font feature, which is why the
>   swap stands on its own.
> - **`zero` is STRIPPED IN DELIVERY and does nothing today.** The upstream
>   `SairaCondensed-ExtraBold.ttf` carries it in GSUB (`aalt case ccmp dnom frac
>   liga locl ordn salt sups titl zero`), but the Google Fonts css2 API that
>   `globals.css` imports serves a woff2 without it: `0` is pixel-identical with
>   the feature on and off via the CDN, and DIFFERS when the upstream file is
>   injected directly. **Self-hosting that one file is what makes it work** -
>   an open owner decision, since `--font-numeral` is a product-wide token.
>   Saira's plain `0` is only ~6% narrower than its `O`, so the slashed glyph is
>   the difference between "distinguishable" and "unmistakable".
> - **`tnum` is not in the family at all**, and Saira's digits are PROPORTIONAL
>   (nine distinct advances; `1` is 53% narrower than `8`). Bebas's are
>   perfectly uniform. So `tabular-nums` on `--font-numeral` is a no-op
>   everywhere it appears, product included, and **a numeral that CHANGES in
>   Saira will reflow as it changes** - tolerable only because counting numerals
>   are already banned.
> - **Space Mono is already designator-safe** (`0`/`O`, `1`/`I`, `1`/`l` all
>   differ, both weights), so mono labels needed no change.

### 1.5 Light-mode gold fails AA, and its own comment says otherwise

**Re-verified locally, not taken on trust.** `globals.css:206` reads
`--color-command-gold: #9c7016; /* small gold text needs ~4.5:1 on ivory */`.

Computed WCAG ratios against `#faf7f0`:

| colour | ratio | AA body (4.5) |
| --- | ---: | --- |
| `#9c7016` (shipped) | **4.14** | FAIL |
| `#946a12` | 4.53 | pass |
| `#8f6510` | 4.86 | pass |

Dark-mode gold `#c8963e` on `#08090d` measures **7.48** and clears AAA. Only the
light token is wrong. Belongs to the light-mode track, not to this one, but it
is a live product defect with a false comment attached.

---

## 2. Motion: what the research supports

### 2.1 The numbers

Mayer's meta-analytic medians `[HARD]`:

| Principle | Median d | Meaning for furniture |
| --- | ---: | --- |
| **Coherence** (delete extraneous) | **0.86** | The strongest effect. Decorative motion is the thing being deleted |
| **Signalling** (highlight essential) | **0.70** | Motion that POINTS is strongly positive |
| **Segmenting** (break into parts) | **0.67** | A chapter card is a research-supported device |
| Redundancy (on-screen text duplicating narration) | **0.10** | A transcribing lower third buys nothing |

Seductive-details meta-analysis (177 effect sizes, 50 studies): **g = -0.16**,
mediated specifically through extraneous cognitive load. `[HARD]` Note this is
**small**. The case against decoration is cumulative and identity-based, not a
cliff - worth stating honestly rather than overselling.

**Redundancy has a boundary condition that rescues our use case:** the effect is
diminished or reversed when on-screen text is *short, reworded, or a technical
term*. A lower third reading `TQFP-48` while narration says "the quad flat pack"
is fine and probably good. One that transcribes the sentence is dead weight.

### 2.2 Transient information

Motion that is still finishing while the viewer is reading is a working-memory
tax. `[HARD]` **Reveal-then-hold beats reveal-during-read.** This is the direct
argument against blur-in, per-character reveal, and long decelerating tails.

### 2.3 Short and long form want OPPOSITE things

Lang's Limited Capacity work: as edit rate rises, arousal and **visual** memory
rise, while **verbal** memory falls; memory is worst when material is both
arousing and fast-paced. `[HARD]`

Instruction is verbal-propositional. **The fast-cut grammar of a Short must not
leak into the lesson.** One identity, two tempos - not one motion system scaled.

### 2.4 Curves and durations to encode

IBM Carbon *productive* easing `[SPEC]`, which is the register that matches
"console, not corporate":

```
entrance  cubic-bezier(0, 0, 0.38, 0.9)
exit      cubic-bezier(0.2, 0, 1, 0.9)
standard  cubic-bezier(0.2, 0, 0.38, 0.9)
```

Durations: 70 / 110 / 150 / 240 / 400 / 700 ms, scaled by distance travelled.
NN/g: 100-500 ms overall, entrances slightly longer than exits. `[CRAFT]`

Ratios: **exit = 0.6-0.7 x entrance** · stagger 100-150 ms · travel &lt;= 16 px at
1080p · total entrance &lt;= 800 ms including stagger.

Hold time, from BBC subtitle guidance `[HARD]`:

```
hold = DUR_ACQUIRE + max(DUR_MIN, chars / CPS)
DUR_ACQUIRE = 0.4 s   // the eye has to land after a cut
DUR_MIN     = 1.0 s
CPS_PROSE   = 15      // BBC 180 wpm
CPS_TECHNICAL = 12    // designators, values, part numbers
```
plus the entrance duration, because nothing is readable mid-transition.

### 2.5 The permitted vocabulary

**Allowed:** cut · wipe along axis · register (short single-axis translation with
opacity) · dissolve · state change (colour/weight/opacity on a stationary
element).

**Forbidden:** scale, rotate, 3D, bounce, overshoot, elastic, anticipation,
morph, blur, parallax, full-frame movement, particle, glow, gradient sweep,
animated lattice, per-character reveal, counting numerals, whoosh.

### 2.6 The highest-value thing we are not doing

**A persistent mono chapter indicator** - `03 / 08`, top right, no animation,
changing on cut. It delivers signalling (0.70) and segmenting (0.67) at zero
motion budget, and almost nobody does it.

And: **the chapter card should be a hard cut to a static frame.** It is the one
piece of furniture with affirmative research behind it, and it earns that by
being a boundary rather than a performance.

---

## 3. Audio

### 3.1 We are mastering the wrong object

Platforms normalize **per video, one gain offset for the whole file**. A bed's
absolute LUFS is meaningless inside a mix; what matters is its level **in LU
relative to the voice**, and the loudness of the finished program. `[HARD]`

**Beds ship as unmastered stems at a documented reference level. Only the
finished program gets `loudnorm`.** Our existing bed at -16.94 LUFS is ~3 dB
below a -14 neighbour, and **YouTube attenuates but does not boost** - so that
deficit is unrecoverable for a standalone promo.

### 3.2 Integrated LUFS is invalid for a 2-second sting, and EBU says so

BS.1770 gating uses 400 ms blocks; a 2 s sting yields ~17 of them, and LRA is
explicitly useless below ~1 minute. **EBU R128 s1** is the short-form supplement:
characterise by **Max Short-term &lt;= target + 5 LU**, **max true peak -1 dBTP**,
and **drop LRA entirely**. `[HARD]`

### 3.3 Two ffmpeg traps, one of which we did not know

- `loudnorm` defaults **`dual_mono=false`**. A mono render measures ~**3 LU**
  quieter than it will play. `[HARD]`
- `loudnorm` defaults **`tp=-2.0`**, not -1.0.
- **`linear=true` has a THIRD silent-fallback condition we had not recorded:** it
  reverts to dynamic if the resulting true peak would exceed target, as well as
  the LRA condition we already knew. Read `normalization_type` from the JSON;
  never infer. (We already do this - the guard was added this month.)

### 3.4 BPM must be frame-legal

Frames per beat = `fps x 60 / BPM`. Non-integer means every accent rounds to a
fractional frame - a +/-1 frame jitter exactly the size of the effect we are
trying to control.

For integer frames per beat at 24, 30 **and** 60 fps, BPM must divide 360:
**40, 45, 60, 72, 90, 120, 180**.

**128 BPM - the reflex tempo - is frame-illegal at every common rate.** 120 is
legal. 112.5 is the only tempo giving a clean binary frame grid (32/16/8 frames
per beat/eighth/sixteenth) at 60 fps.

**Observation about our existing bed:** 10 s at 120 BPM is **5 bars**. Five is
not a phrase length. Either it is 4 bars plus a 2 s tail, or there is an odd bar
in the loop. Worth confirming, because everything downstream inherits that phrase
math.

### 3.5 One tempo, varied by subdivision

Fix 120 BPM across the whole system and vary energy by accent grid, not tempo:

| Format | Grid | Interval | Frames @60 |
| --- | --- | ---: | ---: |
| Short-form | 1/8 | 0.250 s | 15 |
| Long-form outro | 1/4 | 0.500 s | 30 |
| Long-form body | 1/2 | 1.000 s | 60 |
| Long-form bed | 1 bar | 2.000 s | 120 |

Same tempo, key, mode and frame grid: a 4:1 energy range with zero identity
drift, and every asset stays beat-matchable to every other.

### 3.6 Do not put music under technical narration

The strongest single result in the round, and it points against a bed.

Moreno &amp; Mayer (2000): narrated animations with background music performed
**worse on both retention and transfer**; median transfer decrement **d = 1.11**.
`[HARD]` The field effect is much smaller - a 2023 meta-analysis of 71 effect
sizes gives **g = -0.19** `[HARD]` - but the direction is consistent, and it is
worse for fast/loud music and for lyrics.

**Music as punctuation, not wallpaper.** Stings at boundaries, a bed after the
teaching ends, and beds only under sections with no speech.

If a bed must run under speech: the ANSI S3.5 octave-band importance function
puts **72% of speech intelligibility in the 1k / 2k / 4k octaves**. Carve
**700 Hz - 5.6 kHz, deepest at 2 kHz**. Better, since we synthesise rather than
license: **compose the hole in** - band-limit the pads so there is nothing to
duck.

### 3.7 Mode: our ordering is right, one distinction is not

Temperley &amp; Tan (2013) is the correct source and our reading of it is broadly
right, with one correction that matters:

- **Ionian is measured happiest. Lydian is the explicit EXCEPTION** to the
  raise-the-scale-degrees rule and is *less* happy than Ionian. Every chart that
  puts Lydian at the top of a brightness axis is repeating theory, not
  measurement. `[HARD]`
- **The Lydian/Mixolydian ordering is unstable** - almost half of participants
  ordered them opposite to prediction. **Do not automate an affect decision on
  that distinction.** `[HARD]`
- Key-mood association remains a confirmed myth (Powell &amp; Dibben 2005): no
  ability to identify mood from key or key from mood, and no perceived mood
  change under transposition. Transpose freely. `[HARD]`

Design rule from Husain/Thompson/Schellenberg: **tempo drives arousal, mode
drives valence, and the two dissociate.** `[HARD]`

### 3.8 Transitions

`[CRAFT]` throughout - there is no measurement literature on transition sound.

**Use:** silence before impact (the one device with a perceptual basis - contrast
is real) · filter open (reads as mechanism coming online, on-brand) ·
downlifter for exits.

**Avoid:** reverse cymbal (explicitly tired) · stock white-noise riser · braaam
(also reads ominous, which the brief forbids) · tape stop (reads as a joke).

**One device per boundary.** Riser + impact + reverse cymbal is the signature of
stock-library editing.

---

## 4. Sync: our practice is right, the usual explanation is backwards

Craft blogs say "cut early because the brain processes visuals faster than
audio." **That is inverted.** `[FAILS]` Audio reaches cortex **30-50 ms faster**
(cochlea to brainstem ~8-10 ms; V1 onset 50-70 ms). That is *why* the visual
must lead.

Four real anchors, all `[HARD]`: the point of subjective simultaneity sits at
visual-lead; Vatakis &amp; Spence found piano clips need visual lead for perceived
simultaneity, and that JNDs are larger for music than speech; the temporal
binding window is asymmetric and favours visual-lead (~273 ms vs ~198 ms); and
negative mean asynchrony shows humans spontaneously tap *ahead* of a metronome.

**Answering the agent's open question:** our 2-4 frame finding was measured at
**30 fps**, which is **67-133 ms** - larger than the AV-latency explanation
covers. So something else is doing most of the work, and the likely cause is
**perceptual attack time**: both the audio event and the visual event have a
perceptual centre later than their physical onset, and its position depends on
attack/rise time.

**Consequence: the offset is a property of the accent's attack, not a global
constant.** A percussive hit's P-centre is near its onset; a filtered or soft
accent's is tens of ms later. `preRoll` should be per accent class in the mixer,
not one number.

---

## 5. Channel: the video types

The 127 planned videos are **not one type**. They are six, and the furniture
differs sharply:

| Type | Furniture consequence |
| --- | --- |
| Explainer | diagrams, no step counter |
| Walkthrough | cursor highlight, callouts, no step counter |
| Tutorial | step counter, chapters == steps |
| **Build-along ("with me")** | all of the above **plus** "pause here" cards, progress bar, real-time vs speed-up label, timer |
| Technique demo | macro insert, spec chip, before/after |
| Troubleshooting | symptom -&gt; cause -&gt; fix card triad |

Deciding which each of the 127 is, before production, is what makes the
furniture spec finite.

**Derived vertical clips must DROP most furniture, not reflow it:** no intro
sting, no lower third, no chapter cards, no end screen. Those consume the 0-3 s
window that decides the clip. They need instead: hook text in the first 2 s,
burned-in captions, a cover frame, a loop point, and a CTA in pixels - because
end screens are a 16:9 affordance that does not exist on Shorts.

**Two platform features we were not using:** YouTube **Shows** natively stacks
videos into seasons with episode numbers - the shape a 127-video curriculum wants
- and **Corrections** fixes an error via a description line without re-uploading
or losing view count. For a channel teaching people to build hardware that can
hurt them, the second is not optional.

**Intro length.** Direction is well supported, magnitude is invented. Netflix's
Skip Intro is pressed ~136 M times/day and was built because ~15% of viewers were
manually scrubbing the first five minutes `[SOFT]`. Every specific retention
percentage in circulation traces to content marketing. **Take the direction:
1-2 s (half a bar to a bar at 120), placed after the hook, not before it.**

---

## 6. Safe areas and legibility

**The current standards are 93% / 90%, not the 80% / 90% pair we might remember**
- EBU R95, ITU-R BT.1848-1 and SMPTE ST 2046-1 all agree: action safe = 3.5%
inset, graphics/title safe = 5% inset. `[HARD]` The 80%/80% pair is pre-2009
analogue convention, **except** for CEA-708 captions, which still render inside
the old 80x80 box - so on TV/OTT the caption band is roughly
**y in [0.72, 0.90], centre width**, and that band is not ours.

Our lower thirds currently sit at about y = 0.83. **Inside the caption band.**

9:16 platform chrome (community-measured, no vendor spec, so treat as a starting
point and re-measure): union of TikTok/Reels/Shorts is roughly **900 x 1400
centred in 1080 x 1920**, i.e. top 8%, bottom 23%, left 6%, right 17%. The right
rail and bottom caption stack mean **a vertical safe area is not an inset** -
anchor left and treat the bottom quarter as unusable.

> **SUPERSEDED by section 9.2/9.7, 2026-08-13.** These 9:16 numbers are the
> community-measured ones; section 9 measured the same geometry from Google's
> OWN published safe-zone asset and from live players, and its preamble claims
> precedence - but this paragraph was never edited to match, so a reader landing
> here got the old figures with no marker. **The top differs by roughly 2x**
> (8% here, 15% there) and the bottom by 12 points of frame height (23% vs 35%).
> Use section 9.7's table. This paragraph is the traceable origin of
> `formats.ts`'s stale `top: 0.08`.

**Condensed all-caps is defensible for glanced display type** - Sawyer et al.
found uppercase **26% faster** and condensed **11.2% slower** for glance reading,
which is what a title card is. It is a liability for small type and for
alphanumerics. `[HARD]`

**Case B is the finding that constrains us:** a 16:9 video played inline in a
portrait feed, sized to BBC's own landscape rule, lands at **16.3 arcmin** -
exactly on the ISO 9241-303 minimum with nothing spare, and it cannot be fixed by
sizing without exceeding BBC's own ceiling. **Do not design the 16:9 cut for
phone reading, and never put a part designator only in the 16:9 version.**

---

## 7. Claims that did not survive checking

Recorded because they are what we would otherwise have built on.

| Claim | Verdict |
| --- | --- |
| "Cut early because the brain processes visuals faster than audio" | **Backwards.** Audio is 30-50 ms faster to cortex. Practice right, mechanism inverted |
| "Lydian is the brightest mode" | **False.** Ionian measured happiest; Lydian is the explicit exception |
| "Lydian vs Mixolydian differ reliably" | **Not supported.** Population splits ~50/50 |
| "60-80 BPM is optimal for focus" | **Folklore.** Same family as the Mozart Effect |
| "Musical keys have characteristic moods" | **Myth, confirmed** (Powell &amp; Dibben) |
| "-14 LUFS is YouTube's official standard" | **Half true.** It is a playback reference, not published by YouTube, and not an upload requirement |
| "All short-form platforms normalize to -14" | **Not established.** Meta and TikTok publish nothing; third-party figures span -10 to -16 |
| "Intros reduce retention by X%" | **Direction supported, magnitude invented** |
| "LRA is a useful spec for stings" | **False, and EBU says so.** Use max short-term |
| "Cut on the blink" (Murch) | **Craft.** Influential, unfalsified, unsupported |
| Template-video reach statistics (18% penalty, 42% engagement gap, etc.) | **Likely fabricated.** Appeared only on AI-written SEO pages citing nothing |
| "Saira Condensed gives us a slashed zero" (this report, 1.4) | **True of the FILE, false of what we SERVE.** Google Fonts strips `zero` from the woff2; measured on/off pixel-identical via CDN, differs with the upstream TTF |
| "Set `tnum` on our numerals" (this report, 1.4) | **The feature does not exist in the family**, and Saira's digits are proportional. Every `tabular-nums` on `--font-numeral` is a no-op |

---

## 8. What to do about it

In rough order of leverage:

1. **Re-base every size constant on `min(w, h)`.** This is a correctness fix, not
   a preference, and it probably retires the per-format type fudge factors.
2. ~~**Designators and values move to Saira Condensed with `zero` on.**~~ **DONE**
   (`06240264`), with the correction in 1.4: the swap is justified by `0` and
   `O` being one drawing in Bebas, not by the slashed zero, which the CDN
   strips. **Leaves one owner decision: self-host
   `SairaCondensed-ExtraBold.ttf` to make `zero` live?**
3. **Stop animating the comb.** Static, current cell lit, changes on cut.
   **DEFERRED by the owner 2026-08-13:** the comb sets may not be used at all
   and would be restyled first, so patching them now is work that gets thrown
   away. The two animated scales left in the sandbox (`section/guide-solo`'s
   hex seat and `combwalk/pulse`) sit inside that deferral.
4. ~~**Drop `blur`, `swipe off`, `count`; reconsider `settle`.** Add the Carbon
   productive curves as the default pair.~~ **DONE** (`3d487aee`). The wider
   audit this prompted found the un-named violations recorded in the mixer
   plan: a `scale` push at fourteen call sites, and `drop` travelling ~172 px
   against this report's own 16 px ceiling.
5. **Add a persistent `NN / NN` chapter indicator.** Highest value per unit of
   effort in the whole report.
6. ~~**Move lower thirds out of `y in [0.70, 0.92]`.**~~ **DONE** (`772e83fd`).
   `LOWER_THIRD_BOTTOM` is derived from the band rather than typed, and the
   binding constraint is now the caption band, not the player bar. Verified
   across the whole scrub of all 20 variants (1620 frames): worst edge
   y = 0.7000, zero in the band.
7. **Beds become unmastered stems.** Only finished programs get `loudnorm`.
8. **`preRoll` becomes per accent class**, not a global constant.
9. **Fix `#9c7016`** (light-mode track, not this one).
10. **Confirm the 5-bar loop** in the existing bed.

---

## 9. Platform geometry, measured rather than cited

The fifth agent did not take blog numbers. It downloaded Google's own published
safe-zone PNGs and read their alpha channels, and drove Playwright at the live
players to measure chrome. That distinction is why this section outranks every
safe-area table we have used so far.

### 9.1 YouTube's chrome is a CONSTANT, not a fraction

`[MEASURED]` The bottom control row sits **62 CSS px** from the player bottom,
and it does not scale with the player. So the share of OUR frame it eats is
inversely proportional to how big the player is:

| Player | Chrome | % of frame height |
| --- | ---: | ---: |
| Fullscreen 1080p | 62 px | **5.74 %** |
| Theater | 62 px | 6.81 % |
| Default watch @1920 viewport | 62 px | **8.20 %** |
| ~1366 laptop (derived) | 62 px | **~12.9 %** |
| Mobile web, inline | 48 top / 44 bottom | **21.7 % / 19.9 %** |

**This inverts the usual trap.** The instinct is to size for fullscreen; our
audience is instructional and skews laptop, so the default-window viewer is the
one to protect. Size the 16:9 bottom inset for the SMALL player.

Caveat the agent flagged honestly: the player carried ten live experiment
classes, including `ytp-disable-bottom-gradient` (the 98 px scrim is currently
OFF) and `ytp-delhi-modern-compact-controls` (implying a taller non-compact arm
exists). **62 px is an experiment-arm measurement, not a constant of nature.**

### 9.2 The official geometry, from Google's own assets

`[OFFICIAL-ASSET]` Measured from the alpha channel of
`services.google.com/fh/files/misc/youtubesafezoneoverlay_vertical_final.png`:

| 9:16 (1080x1920) | Top | Bottom | Left | Right |
| --- | ---: | ---: | ---: | ---: |
| Google vertical template | **288** | **672** | **48** | **192** |
| Meta Reels + Stories (unified Mar 2026) | 269 | **672** | 65 | 65 |

Safe box 840 x 960 - exactly 77.8 % of width and **50.0 % of height**.

**Google and Meta independently land on a 672 px bottom.** Two platforms, two
methods, same number. That is the strongest signal in the round for a default.

### 9.3 A flat four-side inset is the wrong model

Neither official template is a rectangle:

- **TikTok's right rail is not a column.** About 120 px above the vertical
  midpoint and 300 px below it, because the action rail sits in the lower half.
  `[3P]`
- **Google's 16:9 template has an upper notch** - rows 38-132 masked outside
  x 496-1443 for the headline and badge. `[OFFICIAL-ASSET]`

Our `formats.ts` models `safe` as four scalars. **Make the 9:16 inset an
L-shape.** A flat rectangle either over-reserves (surrendering the whole lower
left of a TikTok frame) or under-reserves (clipping into Google's notch).

### 9.4 What the outro may no longer assume

- **End screens do not render on mobile web at all**, iPad excepted.
  `[OFFICIAL-TEXT]`
- YouTube documents end-screen rendering as **explicitly non-deterministic**:
  "may not always show, or may show differently than designed... based on
  performance, viewer behavior, device, and context." `[OFFICIAL-TEXT]`

**So the outro must read as complete with no end-screen elements present.** Ours
composes around reserved wells; it must also be right when nothing lands in
them. That is a stronger requirement than the one we built to.

### 9.5 Format drift since we last looked

- **Instagram Feed VIDEO ads are now 9:16**, not 4:5 or 1:1. 4:5 survives as an
  IMAGE format (1440x1800). `[OFFICIAL-TEXT]`
- **The IG profile grid moved 1:1 to 3:4.** A 4:5 crop of 1080x1920 keeps
  **y 285-1635**; anything needed in the grid or home feed must sit inside that
  band, which is TIGHTER vertically than the Reels safe zone.
- **Meta unified Stories and Reels in March 2026** - Stories tightened from 20 %
  to 35 % bottom. Cached 14/20 guidance is now wrong.
- **Shorts went to 3 minutes**, with a 60 s playback cap in the Shorts feed and
  an overlay at 50 s.
- **YouTube now accepts Opus and Eclipsa Audio** alongside AAC-LC.

### 9.6 Encode targets

`[OFFICIAL-TEXT]` YouTube: MP4, moov atom at front, **no edit lists**, H.264
High, 2 consecutive B-frames, closed GOP at half the frame rate, CABAC, 4:2:0.
**1080p SDR: 8 Mbps at 24-30 fps, 12 Mbps at 48-60.** Audio 48 kHz, stereo
384 kbps.

**No video platform publishes a LUFS target.** Every figure in circulation is
reverse-engineered. YouTube attenuates but never boosts; Meta's xHE-AAC is
adaptive, bidirectional, and deliberately declines to name a number; TikTok is in
direct conflict across sources. Encode a **band of -14 to -16 LUFS, -1.0 dBTP**,
widest for TikTok.

### 9.7 The revised inset table

Conservative = official or asset-derived. Optimistic = live measurement. Encode
both, because the gap between them is the honest uncertainty.

| Format | Side | Conservative | Optimistic |
| --- | --- | ---: | ---: |
| YouTube 16:9 desktop | bottom | **12.9 %** (laptop window) | 5.74 % (fullscreen) |
| YouTube 16:9 mobile web | top / bottom | 21.7 % / 19.9 % | 0 (controls autohide) |
| Shorts 9:16 | T/B/L/R px | **288 / 672 / 48 / 192** | 184 / 294 / 44 / 132 |
| Reels 9:16 | T/B/L/R px | **269 / 672 / 65 / 65** | 250 / 280 / 60 / 90 |
| TikTok 9:16 | T/B/L/R px | **254 / 707 / 122 / 300** | 120 / 250 / 60 / 100 |
| TikTok right rail | - | **L-shaped**: ~120 above midpoint, ~300 below | - |
| YouTube 1:1 | T/B/L/R px | 48 / 390 / 48 / 101 | - |
| 4:5 crop of a 9:16 | keep | y 285-1635 | - |

Added to the action list in section 8:

11. ~~**Size the 16:9 bottom inset for the SMALL player (12.9 %), not
    fullscreen.**~~ **DONE** (`772e83fd`): `PLAYER_BAR_BOTTOM` 0.12 -> 0.129,
    with the experiment-arm caveat kept in the comment.
12. **Make the 9:16 inset an L-shape**; 672 px bottom as the default.
13. **The outro must be complete with no end-screen elements rendered.**

---

## 10. The OPENING, measured against what platforms publish (2026-08-14)

A second round, scoped to the first seconds. Same grading. It changes two things
about the intro and confirms one number we had derived rather than read.

### 10.1 The opening must read MUTED, and that is not a preference

`[OFFICIAL]` YouTube's Home-feed inline player: videos *"begin to play on mute
with captions auto-enabled."* So the surface that feeds a long-form video the
most impressions plays it silent AND draws its own caption band over the
opening, with no author control.

`[OFFICIAL]` Reels/Facebook ads default to **sound ON**. Shorts-feed and TikTok
FYP sound-on is universally assumed and **neither platform states it** - treat as
unverified rather than repeating it.

**Consequence: an opening whose meaning is carried by audio is invisible exactly
where it is most often seen.** The picture has to say it alone.

### 10.2 YouTube flattens a silence-then-sting by default

`[OFFICIAL]` YouTube applies **Stable volume** by default - it *"continuously
adjust[s] volume levels to reduce variations in sound"* - plus Voice boost and
automatic mixing. Music videos are exempted; instructional content is not.

Section 3.8 names *silence before impact* as the one transition device with a
perceptual basis. **On YouTube, with default settings, that contrast is
compressed away on the way to the viewer.** An opt-out exists (Studio →
Settings → Channel → Advanced → uncheck "Let YouTube enhance audio quality") but
it does not affect already-uploaded videos and it also removes viewer-side Voice
boost, which is an accessibility loss on a technical channel.

### 10.3 A sponsorship disclosure owns frames 0 to 10 s

`[OFFICIAL]` For paid product placement YouTube *"automatically show[s] viewers a
disclosure message for 10 seconds at the beginning of the video,"* and the policy
covers **Shorts** as well as long-form. If the channel ever takes a part
sponsorship, the platform's own chip lands directly on the hook window. Reserve
for it rather than discover it.

### 10.4 Frame 0 is not a cover, but the first HALF is harvestable

`[OFFICIAL]` Shorts/Reels/TikTok all let the author pick or upload a cover - and
YouTube's blog of 2026-07-24 now allows YPP creators to upload a custom Shorts
thumbnail outright, which contradicts the still-live help page saying you cannot.
**The help page is stale.**

But `[OFFICIAL]` YouTube *video previews* are a 3-second clip and *"A clip from
the first half of your video is automatically selected."* Machine-chosen,
uncontrollable, silent. **No frame in the first half may be embarrassing as a
silent three-second autoplay.**

And `[OFFICIAL]` TikTok Ads Manager defaults a sub-video cover to *"the first
frame of video"* - so frame 0 IS the cover on the paid surface.

### 10.5 Loops, and what nobody publishes

`[OFFICIAL]` Shorts count a view on every start OR replay; Instagram counts
replays inside watch time; TikTok's ad metrics all state *"replays are
excluded."* So a loop is free watch time on two platforms and invisible on the
third - the same tactic, three accountings.

**No platform publishes loop-point guidance, and none publishes how fast a
viewer decides or how early watch time is weighted.** All three publish that
COMPLETION is weighted. The step from that to "the first N seconds decide" is
inference, not documentation.

### 10.6 Added to section 7 - claims that did not survive

| Claim | Verdict |
| --- | --- |
| "65% who watch 3 s watch to 10 s" (attributed to Facebook) | Not locatable on any Meta property. Marketing blogs only |
| "63% of highest-CTR videos hook within 3 s" (attributed to TikTok) | Not on ads.tiktok.com or the newsroom. Unverified |
| Meta's "3-second rule" | **Published guidance with zero evidence offered.** An instruction, not a finding |
| TikTok's "50% of impact in 2 s / 90% of ad recall in 6 s" | Traces to a VENDOR-COMMISSIONED Ipsos study of PAID AD RECALL. Method and sample unpublished. Not a fact about a tutorial |
| "You have 2 seconds before they leave" | Launders Krishnan & Sitaraman (ACM IMC 2012), which measures **startup LATENCY**, not content. Real study, wrong claim |
| "Attention span is 8 seconds, less than a goldfish" | The 2015 Microsoft mis-citation, still circulating |

### 10.7 One number upgraded

`[OFFICIAL]` Meta states its Reels safe zone in words: *"roughly 14% of the top,
35% of the bottom, and 6% on each side."* At 1080x1920 that is **269 / 672 / 65 /
65 px** - exactly the asset-derived row in 9.2. That row is now **text-confirmed
by Meta**, and the 672 px bottom has three independent derivations.

