"""Ten COMPOSITIONS for the Logbook cut, against one fixed sample palette.

WHY THIS IS A NEW AXIS AND NOT MORE KITS. tools/logbook-bed.py has five "kits",
and it is worth being honest about what they are: ONE arrangement wearing five
costumes. Same landings, same wheel, same layered drop, same sub line - only the
samples change. That axis is exhausted, and "plate is just okay" is what
exhausting it sounds like. The thing never varied is the COMPOSITION: what the
music actually does between the six fixed events.

So the palette is HELD FIXED here - plate's samples, because plate is the picked
kit - and the arrangement is the variable. Any difference you hear between two
compositions below is a difference in writing, not in sample choice. That is the
whole point of the control.

WHAT IS FIXED, BECAUSE THE PICTURE IS BUILT TO IT
  * 120 BPM, five bars, 10.000 s, frame for frame
  * the six events: 1.5 pickup, 2/4/6/8 landings, 8.5 plating, 10.0/0.0 seam
  * the weight curve 0.55 / 0.78 / 0.70 / 1.00, dip at the third
  * loop safety: two laps through the reverb, second kept, so the tail wraps

Every composition is measured against that curve on every render. A composition
that does not land it is not a style choice, it is a cut that fights its picture.

WHAT VARIES: whether the piece is struck, played, sustained, sequenced or
mechanical; whether it has a tonal centre at all; and where its argument lives.

THE PITCHED ONES EXIST BECAUSE OF A GAP, NOT A WHIM. The bed today is percussion
plus a sine sub - no melody, no chord, no motif. The nearest engineering-pedigree
sonic identity there is (THX's Deep Note) is texture rather than tune, but it
still RESOLVES TO A PITCHED CHORD, and the tiered-mnemonic pattern every serious
sonic-brand system uses (a bed, a stinger, a one-second ping, sharing pitch and
timbre) needs pitch content to share. Research round and its provenance:
docs/plans/2026-08-12-bed-sound-quality-research.md.

    python tools/logbook-comp.py --comp ladder
    python tools/logbook-comp.py --comp all
    python tools/hex-master.py --prefix logbook-comp --kit ladder

ASCII only.
"""

import argparse
import importlib.util
import math
import os

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, filename):
    spec = importlib.util.spec_from_file_location(name, os.path.join(_HERE, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_HB = _load("hex_bed", "hex-bed.py")
_LB = _load("logbook_bed", "logbook-bed.py")

SR, BEAT, BAR = _HB.SR, _HB.BEAT, _HB.BAR
SAMPLES = _HB.SAMPLES
place, place_end, place_peak = _HB.place, _HB.place_end, _HB.place_peak
sub_note, sub_rise = _HB.sub_note, _HB.sub_rise
sidechain, reverb, lowpass = _HB.sidechain, _HB.reverb, _HB.lowpass
read_wav, write_wav = _HB.read_wav, _HB.write_wav

# EVENT TIMES COME FROM THE BED MODULE, NOT FROM LITERALS HERE. One definition
# of where 8.5 is, so a composition cannot drift from the film or from the
# measurement that judges it.
SECONDS = _LB.SECONDS
ANSWER, PLATE = _LB.ANSWER, _LB.PLATE
WEIGHT = _LB.WEIGHT
LEARN, GAIN, RANK, PATCH = _LB.LEARN, _LB.GAIN, _LB.RANK, _LB.PATCH
LANDINGS = [LEARN * BAR, GAIN * BAR, RANK * BAR, PATCH * BAR]
landing_peaks = _LB.landing_peaks
CURVE = {"learn": 0.55, "gain": 0.78, "rank": 0.70, "patch": 1.00}

# The palette, held fixed. plate's samples, lifted from KITS so there is no
# second copy of the paths to drift.
PAL = _LB.KITS["plate"]

# AUTHORED HONEST, NOT CLIPPER-CORRECTED. The five kits' placement gains were
# tuned by eye against post-tanh output, so their soft clipper is silently part
# of the arrangement and backing it off makes three of them WORSE. These are
# written fresh, so they are written to hit the curve BEFORE the clipper and the
# drive stays in tanh's near-linear region. See the research doc, section 1.
DRIVE = 0.6
OUT = 0.82


# ---- tonal DSP ---------------------------------------------------------------
#
# Everything the sampled rounds never had. Kept cheap on purpose: a wavetable
# built once per timbre, then phase accumulation into it, rather than summing
# harmonics per sample - which at five detuned oscillators a note is the
# difference between a render and a coffee break.

TABLE_N = 2048
_TABLES = {}


def table(wave):
    """One cycle, BAND-LIMITED BY CONSTRUCTION. The harmonics are summed once
    into a table rather than generated per sample, so there is nothing above the
    highest partial to alias - which is the cheap way to avoid the problem a
    naive phase-ramp saw creates and a soft clipper then folds back down."""
    if wave in _TABLES:
        return _TABLES[wave]
    harm = {
        "sine": [(1, 1.0)],
        # 12 partials at 1/h: a saw that is rich without being a razor.
        "saw": [(h, 1.0 / h) for h in range(1, 13)],
        "square": [(h, 1.0 / h) for h in range(1, 17, 2)],
        # Odd partials falling fast - a hollow, woodwind-ish tone that reads as
        # an instrument rather than as a synth preset.
        "hollow": [(h, 1.0 / (h * h)) for h in range(1, 13, 2)],
        # A struck/metallic set: inharmonic-ish ratios, for the mnemonic.
        "bell": [(1, 1.0), (2, 0.6), (3, 0.32), (4.2, 0.28), (5.4, 0.18), (6.8, 0.1)],
        # ---- the serious end of the shelf --------------------------------
        # A steep rolloff: fundamental-dominant with just enough second and
        # third to have a body. This is what a low note needs to read as WEIGHT
        # rather than as mud - the partials that make a saw exciting at A4 are
        # the ones that make it a smear at A1.
        "dark": [(1, 1.0), (2, 0.34), (3, 0.14), (4, 0.06), (5, 0.03)],
        # Fifth-heavy, no third at all. An organ stop, and the reason it reads
        # as institutional rather than as happy or sad: a bare fifth refuses to
        # declare a mode.
        "open": [(1, 1.0), (2, 0.5), (3, 0.42), (4, 0.2), (6, 0.14), (8, 0.07)],
    }[wave]
    t = [0.0] * TABLE_N
    for h, a in harm:
        for i in range(TABLE_N):
            t[i] += math.sin(2 * math.pi * h * i / TABLE_N) * a
    peak = max(abs(v) for v in t) or 1.0
    _TABLES[wave] = [v / peak for v in t]
    return _TABLES[wave]


def midi(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


def voice(dur, f, gain=1.0, wave="saw", n=5, cents=7.0, atk=0.008, dec=0.9,
          sus=0.55, rel=0.35, drift=0.35):
    """A note as a STACK OF DETUNED OSCILLATORS with slow independent drift.

    This is the difference between "a synth" and "a cheap synth", and it is not
    a matter of taste: a single oscillator is a static spectrum and the ear reads
    static as artificial. THX's Deep Note is thirty oscillators with independent
    randomised motion, and the reason it still sounds expensive forty years on is
    that nothing in it is ever perfectly still.

    THE DRIFT IS DETERMINISTIC - an LFO per oscillator at an irrational-ish rate,
    not an RNG. A promo asset that renders differently every time is a bug, and
    the loop point in particular has to be reproducible.
    """
    n_s = int(dur * SR)
    tb = table(wave)
    out = [0.0] * n_s
    for k in range(n):
        # Symmetric detune around the centre, widest pair outermost.
        off = 0.0 if n == 1 else (k / (n - 1) - 0.5) * 2.0
        ratio = 2.0 ** (off * cents / 1200.0)
        rate = 0.17 + 0.11 * k  # each oscillator drifts at its own slow rate
        phase = 0.0
        amp = 1.0 / n
        for i in range(n_s):
            t = i / SR
            fi = f * ratio * (1.0 + drift * 0.01 * math.sin(2 * math.pi * rate * t + k))
            phase += fi * TABLE_N / SR
            idx = phase % TABLE_N
            i0 = int(idx)
            frac = idx - i0
            s = tb[i0] * (1 - frac) + tb[(i0 + 1) % TABLE_N] * frac
            out[i] += s * amp
    # ADSR, computed rather than transitioned, same discipline as the picture.
    a_n = max(1, int(atk * SR))
    r_n = max(1, int(rel * SR))
    for i in range(n_s):
        t = i / SR
        if i < a_n:
            e = i / a_n
        else:
            d = math.exp(-(t - atk) / max(1e-4, dec))
            e = sus + (1.0 - sus) * d
        if i > n_s - r_n:
            e *= (n_s - i) / r_n
        out[i] *= e * gain
    return out


def chord(dur, notes, gain=1.0, **kw):
    """Several voices, summed, gain-compensated so a triad is not three times a
    single note."""
    buf = [0.0] * int(dur * SR)
    g = gain / math.sqrt(max(1, len(notes)))
    for m in notes:
        v = voice(dur, midi(m), gain=g, **kw)
        for i, s in enumerate(v):
            buf[i] += s
    return buf


def glide(dur, f0, f1, gain=1.0, wave="saw", n=7, cents=14.0, curve=2.0):
    """A converging cluster: n oscillators spread WIDE at the start and arriving
    together at f1. The Deep Note move, which is the one piece of prior art for
    an engineering brand whose sound is texture rather than tune."""
    n_s = int(dur * SR)
    tb = table(wave)
    out = [0.0] * n_s
    for k in range(n):
        off = 0.0 if n == 1 else (k / (n - 1) - 0.5) * 2.0
        phase = 0.0
        for i in range(n_s):
            t = i / n_s
            # Spread collapses as t rises: wide, wandering, then locked.
            spread = (1.0 - t**curve)
            f = (f0 + (f1 - f0) * (t**curve)) * (
                2.0 ** (off * (cents + 900.0 * spread) / 1200.0)
            )
            phase += f * TABLE_N / SR
            idx = phase % TABLE_N
            i0 = int(idx)
            frac = idx - i0
            out[i] += (tb[i0] * (1 - frac) + tb[(i0 + 1) % TABLE_N] * frac) / n
    for i in range(n_s):
        out[i] *= gain * min(1.0, (i / (0.25 * SR)) if i < 0.25 * SR else 1.0)
    return out


# ---- the fixed scaffolding ---------------------------------------------------
#
# THE PICKUP AND THE SEAM BELONG TO THE FILM, NOT TO A COMPOSITION. The answer at
# 1.5 is the cause of the whole clip and the seam has to hand back to bar one, so
# every composition gets them and none of them gets to omit them. What a
# composition decides is what happens BETWEEN.

# A tonal centre for the ones that have one. A, because the sub line in
# logbook-bed.py already resolves to 55 / 41.25 / 36.7 Hz - A1, E1, D1 - so a
# pitched composition that picked a different root would be arguing with the
# bass that is already there. Dorian rather than natural minor: the raised sixth
# keeps it from reading as sad, which a badge-earning film is not.
ROOT = 45  # A2
DORIAN = [0, 2, 3, 5, 7, 9, 10, 12]
# AEOLIAN FOR THE SERIOUS SET. Dorian's raised sixth is what keeps it from
# reading as sad, which was right for a badge-earning film and is wrong for a
# defense register - "not sad" and "grave" are different requests. The natural
# minor sixth is the one note that separates them.
AEOLIAN = [0, 2, 3, 5, 7, 8, 10, 12]
MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10, 12]
IONIAN = [0, 2, 4, 5, 7, 9, 11, 12]
LYDIAN = [0, 2, 4, 6, 7, 9, 11, 12]
PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12]

# In the order Temperley & Tan measured, happiest first. Locrian is left out:
# its fifth is diminished, so a composition voiced on open fifths has no stable
# fifth to voice ON - it is not a mood option here, it is a broken one.
MODES = {
    "ionian": IONIAN,
    "lydian": LYDIAN,
    "mixolydian": MIXOLYDIAN,
    "dorian": DORIAN,
    "aeolian": AEOLIAN,
    "phrygian": PHRYGIAN,
}

# THE MODE IS THE DIAL, AND THE KEY IS NOT.
#
# "Ominous" is a mode problem, and it is worth writing down why the obvious
# other answer is a dead end. Powell & Dibben (2005), "Key-Mood Association: A
# Self Perpetuating Myth", Musicae Scientiae: on an equal-tempered instrument
# listeners cannot identify mood from key or key from mood, and transposing a
# piece does not change its perceived mood. Historical key characters were real
# but they were artifacts of UNEQUAL temperaments, and they do not survive equal
# temperament. Every oscillator in this file is equal-tempered, so moving the
# root from A to C to F# transposes the register and changes nothing else.
#
# Mode does the work instead, and it has an ordering. Temperley & Tan,
# "Emotional Connotations of Diatonic Modes", Music Perception 30(3): the same
# melodies rendered in six modes on a fixed tonic, judged pairwise for which is
# happier, come out in line-of-fifths order - Ionian, Mixolydian, Dorian,
# Aeolian, Phrygian, happiest to saddest, with happiness rising as scale degrees
# are raised (Lydian is the exception, less happy than Ionian).
#
# The serious set is in AEOLIAN, which is the second-saddest of the six. That is
# not a subtle mis-set: it is two full steps down that ordering from where
# "serious, professional, but fun" sits. Mixolydian is the answer the ordering
# gives - major third and major sixth restored, only the seventh still lowered,
# which is why film scoring reaches for it when it wants confident and heroic
# without the saccharine of straight major.
_MODE = [AEOLIAN]


def deg(i, mode=DORIAN):
    """Scale degree i (may exceed an octave) as a MIDI note."""
    return ROOT + 12 * (i // 7) + mode[i % 7]


def low(i):
    """A degree in the register the serious set lives in: an octave below the
    root rather than an octave above it. Everything in round one sat at +12 or
    +24, which is a range that sounds capable and young. This is the same
    material a twelfth lower.

    Reads the current mode, so a composition is written once and heard in any
    of them."""
    return deg(i, _MODE[0]) - 12


def bright():
    """True when the current mode has a MAJOR third.

    THIS IS LOAD-BEARING AND IT IS EASY TO MISS. The serious set voices almost
    everything in open fifths, which is exactly the interval that refuses to
    declare a mode - so changing the mode underneath a fifths-only arrangement
    changes almost nothing you can hear. The third is the note that CARRIES the
    mode, and the reason round two came out ominous is that it removed the third
    and then set the remaining notes to the second-saddest scale there is.
    Getting the ominousness out means re-admitting the third, not just relabelling
    the scale.
    """
    return _MODE[0][2] == 4


def seq_bars():
    """The sequence's harmony. In a bright mode the third is added to the bare
    fifths, so the mode is audible in the figure rather than only in the motif."""
    if bright():
        return [[0, 2, 4], [0, 2, 4], [2, 4, 6], [1, 3, 5], [0, 2, 4, 7]]
    return [[0, 4], [0, 4], [2, 6], [1, 5], [0, 4, 7]]


def warm(buf, cutoff=1400.0):
    """Take the top off. A low saw with its upper partials intact is a buzz, and
    a defense register is not a buzz."""
    return lowpass(buf, cutoff)


def saturate(buf, amount=0.4, k=3.2):
    """HARMONICS SO THE BASS SURVIVES A PHONE.

    Handsets roll off below roughly 150-200 Hz, so the sub is largely not
    reproduced where most of this gets watched - and "more bass" delivered as
    more energy under 100 Hz is more of something the listener's speaker will
    never make. Saturating a sine generates odd harmonics: at a 55 Hz
    fundamental the third and fifth land at 165 and 275 Hz, inside the 250-700 Hz
    band where a small speaker can actually put out level, and the ear infers
    the missing fundamental from them.

    So this is not a distortion effect. It is the only way the gravity travels.
    """
    return [v * (1 - amount) + math.tanh(v * k) * amount * 0.7 for v in buf]


def pedal(dur, m, gain=0.3, wave="open"):
    """A held low note. The oldest way to make something sound consequential:
    one pitch that does not move while everything above it does."""
    return warm(voice(dur, midi(m), gain=gain, wave=wave, n=5, cents=5.0,
                      atk=0.25, dec=3.0, sus=0.85, rel=0.7, drift=0.2), 900.0)


def bass_note(dur, m, gain=0.8):
    """The bass as a PLAYED note rather than a fixed sub plan, so harmony and
    low end move together. Saturated, per the note above."""
    v = voice(dur, midi(m), gain=gain, wave="dark", n=3, cents=4.0,
              atk=0.006, dec=0.55, sus=0.35, rel=0.25, drift=0.15)
    return saturate(warm(v, 700.0), 0.45)


def bass_plan(n, plan, gain=1.0):
    """(time, midi, dur, gain) -> a buffer, wrapped at the loop point.

    NOTHING IS ALLOWED TO SUSTAIN THROUGH THE PLATING. A bass note under the
    8.0 landing that runs 1.6 s is still at full level at 8.5, and the sidechain
    cannot help because there is no kick at 8.5 to duck it - so the plating
    measured 0.964 against a PATCH of 1.000, i.e. the payoff and the landing
    were the same size and the piece had nowhere left to go. Any note overlapping
    the plating is faded across the half beat before it.
    """
    out = [0.0] * n
    fade_from, fade_to = PLATE - BEAT * 0.5, PLATE + 0.35
    for t, m, d, g in plan:
        # THE BASS FOLLOWS THE CURVE TOO, and forgetting that is what inverted
        # four of these on the first render. A flat-gain bass line is as loud
        # under LEARN as under PATCH, and once the bass is the loudest thing in
        # the window it is the bass being measured, not the landing - keel came
        # back with LEARN 0.652 over GAIN 0.609 while the same arrangement
        # measured 0.619 against 0.831 with the bass taken out. The low end is
        # part of the arrangement, so it is subject to the arrangement's shape.
        w = WEIGHT.get(int(t // BAR) % 5, 0.42)
        v = bass_note(d, m, gain=g * gain * (0.35 + 0.65 * w))
        s = int(t * SR)
        for i, x in enumerate(v):
            k = (s + i) % n
            ts = k / SR
            if fade_from <= ts < fade_to:
                x *= max(0.28, 1.0 - (ts - fade_from) / (fade_to - fade_from))
            out[k] += x
    return out


def scaffold(buf, S, click_gain=0.42, kick=True):
    """The pickup, and the top-of-loop kick. Returns the kick times for the
    sidechain."""
    kicks = []
    if kick:
        # HELD BACK at the top: at full weight the first bar reads as a restart,
        # which is exactly what a loop must not do.
        place(buf, S["kick"], 0.0, 0.4)
        kicks.append(0.0)
    place(buf, S["click"], ANSWER, click_gain)
    place(buf, S["kick"], ANSWER, 0.22)
    kicks.append(ANSWER)
    return kicks


# THE ARRANGEMENT WITHOUT ITS BASS, kept by finish() for the report.
#
# PEAK-IN-A-WINDOW STOPS MEASURING THE LANDINGS ONCE THE BASS IS LOUD. A
# sustained, saturated low end raises the level inside EVERY window, so the
# landings have less room to separate above it and the measured ratios compress
# toward each other - the curve looks broken when the arrangement is fine. Round
# one never hit this because its sub was quiet and its landings were the peak.
#
# So the serious set is measured twice: what ships, and the same arrangement
# with the bass taken out. The second is where "did I write the curve" actually
# gets answered; the first is what a listener's meter sees. A big gap between
# them is not a defect, it is a description of how bass-forward the piece is.
_DRY = []


def finish(buf, sub, kicks, space=0.24, sub_gain=0.5):
    """The common ending: loop-safe reverb, sidechain, soft clip.

    IDENTICAL FOR EVERY COMPOSITION, deliberately. If the finishing chain varied
    per composition then an audition would be comparing two things at once, and
    the whole reason the palette is held fixed is to compare one.
    """
    n = len(buf)
    wet = reverb(buf + buf, space)
    buf = wet[n:]
    dry = list(buf)
    if sub:
        sub = sidechain(sub, kicks)
        buf = [buf[i] + sub[i] * sub_gain for i in range(n)]
    peak = max(abs(v) for v in buf) or 1.0
    # The dry copy is clipped at the SAME drive, so the two measurements are
    # comparable rather than one being a louder version of the other.
    dpk = max(abs(v) for v in dry) or 1.0
    _DRY[:] = [math.tanh(v * (DRIVE / dpk)) * OUT for v in dry]
    return [math.tanh(v * (DRIVE / peak)) * OUT for v in buf]


def sub_line(n, plan=None):
    """The bass, as a plan of (bar, freq, gain). Default is the inherited one:
    down to the fourth under the heaviest landing, resolving on the last bar so
    the loop has somewhere to come back FROM."""
    root, fourth, fifth = 55.0, 41.25, 36.7
    plan = plan or [
        (0, root, 0.4), (1, root, 0.58), (2, root, 0.72),
        (3, fifth, 0.60), (4, fourth, 1.0),
    ]
    sub = [0.0] * n
    for bar_i, f, g in plan:
        b = bar_i * BAR
        for i, v in enumerate(sub_note(BAR * 0.85, f, gain=g)):
            sub[(int(b * SR) + i) % n] += v
    return sub


# ---- the compositions --------------------------------------------------------
#
# Each returns a finished buffer. Each gets the same six events and the same
# curve to land; what differs is the argument.


def comp_strike(S):
    """The control: the arrangement logbook-bed.py already makes, at the honest
    drive. Everything below is measured against this."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S)
    place(buf, S["click"], ANSWER + BEAT * 0.25, 0.2)
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        if i == 2:
            place(buf, S["click"], at, w)
            place(buf, S["kick"], at, w * 0.5)
            for j, off in enumerate(_LB.WHEEL):
                last = j == len(_LB.WHEEL) - 1
                place(buf, S["wheel"], at + off,
                      max(0.08, 0.42 * (1.0 if last else 0.62 - 0.06 * j)))
        elif i == 3:
            place(buf, S["drop"], at, w * 0.78)
            place(buf, S["hit"], at, w * 0.55)
            place(buf, S["kick"], at, w * 0.7)
            place(buf, S["gong"], at, w * 0.43)
            place(buf, S["subdrop"], at, w * 0.62)
        else:
            place(buf, S["kick"], at, w)
            place(buf, S["hit"], at, w * 0.75)
        kicks.append(at)
        if i < 3:
            place_end(buf, _LB.tail(S["reverse"], 1.0), LANDINGS[i + 1], 0.3 + 0.16 * (i + 1))
        place(buf, S["kick"], at + BEAT * 2, w * 0.45)
        kicks.append(at + BEAT * 2)
        place(buf, S["hit"], at + BEAT * 1.5, w * 0.42)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.42)
    place(buf, S["gong"], PLATE, 0.2)
    return finish(buf, sub_line(n), kicks)


def comp_ladder(S):
    """PITCH IS RANK. The one composition whose musical idea is the film's idea:
    each landing is a step up the scale, and the wheel at 6.0 is the ladder being
    run through rather than a mechanism ticking. It ends a seventh above where it
    started, so the loop drops back down to bar one - the climb resets, which is
    what a rank ladder does to everyone who finishes it."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S)
    steps = [0, 2, 4, 7]  # up the mode, the third step the smallest interval
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        hold = 1.7 if i < 3 else 2.0
        place(buf, voice(hold, midi(deg(steps[i]) + 12), gain=w * 0.5,
                         wave="hollow", dec=1.1, sus=0.45), at)
        place(buf, S["kick"], at, w * 0.72)
        if i != 2:
            place(buf, S["hit"], at, w * 0.42)
        kicks.append(at)
        if i == 2:
            # The wheel, PLAYED: the same widening spacing, but running up the
            # scale, so the mechanism and the melody are the same object.
            for j, off in enumerate(_LB.WHEEL):
                last = j == len(_LB.WHEEL) - 1
                place(buf, voice(0.5 if last else 0.24, midi(deg(steps[2] + j)),
                                 gain=(0.34 if last else 0.2), wave="bell", dec=0.3),
                      at + off)
        if i == 3:
            place(buf, S["drop"], at, w * 0.6)
            place(buf, S["subdrop"], at, w * 0.5)
    # The plating: the octave, arriving over the top of the last step.
    place(buf, voice(1.4, midi(deg(steps[3]) + 24), gain=0.34, wave="bell",
                     atk=0.02, dec=0.9), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
    return finish(buf, sub_line(n), kicks)


def comp_converge(S):
    """THE DEEP NOTE MOVE. A cluster of detuned oscillators wanders wide for
    eight seconds and locks into a chord exactly on the plating. Almost no
    percussion: the landings are marked by the cluster TIGHTENING, so the film
    escalates by focus rather than by volume - which is the same argument the
    weight curve's dip already makes, taken as far as it goes.

    The one composition where the payoff is not an impact."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.3)
    # The cluster runs from the pickup to the plating and resolves there.
    cl = glide(PLATE + 1.4 - ANSWER, midi(deg(0)) * 0.5, midi(deg(0)),
               gain=0.5, wave="saw", n=9, curve=2.4)
    place(buf, cl, ANSWER)
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        # A tightening: a short consonant stack on each landing, closer each time.
        #
        # THE THIRD VOICE ARRIVES AT THE FOURTH LANDING, NOT THE THIRD. First cut
        # added it at RANK, and adding a note is adding energy - so the dip
        # measured 0.632 against GAIN's 0.594 and the climb's deliberate step
        # DOWN became a step up. The tightening now happens in the attack and the
        # spacing rather than in the note count, which is what "tightening" was
        # supposed to mean in the first place.
        stack = [deg(0), deg(4), deg(7)][: 2 + (i >= 3)]
        place(buf, chord(0.9, [m + 12 for m in stack], gain=w * (0.4 if i == 2 else 0.52),
                         wave="hollow", atk=0.05 if i == 2 else 0.03, dec=0.5), at)
        place(buf, S["kick"], at, w * (0.4 if i == 2 else 0.6))
        kicks.append(at)
        if i == 3:
            # THE PAYOFF IS THE LOCK, NOT THE THUMP. A full sub-drop here made
            # the last landing so much bigger than the others that the climb
            # measured flat underneath it - which in the one composition that
            # argues escalation-by-focus is the arrangement contradicting its
            # own thesis, not just a number being off.
            place(buf, S["subdrop"], at, w * 0.28)
    place(buf, chord(1.5, [deg(0), deg(2), deg(4), deg(7)], gain=0.42,
                     wave="saw", atk=0.06, dec=1.2, sus=0.7), PLATE)
    return finish(buf, sub_line(n), kicks, space=0.3, sub_gain=0.45)


def comp_sequence(S):
    """AN INSTRUMENT IDLING. A sixteenth-note figure runs the whole ten seconds
    like a machine that was already on before the film started, and the landings
    are harmonic changes in it rather than events on top of it. Closest to the
    console/telemetry read of the house aesthetic, and the one that would survive
    being cut to a different length."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.34)
    # One chord per bar; the arpeggio walks it.
    bars = [[0, 2, 4], [0, 2, 4], [2, 4, 6], [1, 3, 5], [0, 4, 7]]
    step = BEAT / 4
    for bar_i in range(5):
        ch = bars[bar_i]
        w = WEIGHT.get(bar_i, 0.42)
        for s in range(16):
            t = bar_i * BAR + s * step
            if t >= SECONDS:
                break
            m = deg(ch[s % len(ch)] + (12 if (s // 4) % 2 else 0) // 12 * 7)
            # Accent the downbeat and the backbeat, duck the rest.
            g = (0.3 if s == 0 else 0.16 if s % 4 == 0 else 0.1) * (0.7 + w * 0.5)
            place(buf, voice(0.16, midi(m + 12), gain=g, wave="hollow",
                             atk=0.004, dec=0.09, sus=0.1, rel=0.05), t)
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        place(buf, S["kick"], at, w * 0.85)
        place(buf, S["hit"], at, w * 0.5)
        kicks.append(at)
        if i == 3:
            place(buf, S["drop"], at, w * 0.62)
            place(buf, S["subdrop"], at, w * 0.55)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.34)
    place(buf, chord(1.2, [deg(0) + 12, deg(4) + 12], gain=0.3, wave="bell"), PLATE)
    return finish(buf, sub_line(n), kicks, space=0.2)


def comp_fanfare(S):
    """CEREMONIAL. Stacked saw stabs, a real cadence into 8.0, and the plating as
    the resolution rather than as a sweep. The badge-earning read taken
    literally - this is the one that sounds like something is being AWARDED.

    The risk is obvious and worth stating: a fanfare is the most generic thing a
    gamification promo can do, and it will either read as earned or as an advert
    for itself. That is a listening question."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.4)
    # Dominant preparation across bars 3-4, resolving on 8.0.
    stabs = [[0, 4], [0, 4, 7], [1, 5, 8], [0, 4, 7, 11]]
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        dur = 0.55 if i < 3 else 1.6
        place(buf, chord(dur, [deg(d) + 12 for d in stabs[i]], gain=w * 0.42,
                         wave="saw", atk=0.012, dec=0.35, sus=0.3), at)
        place(buf, S["kick"], at, w * 0.9)
        place(buf, S["hit"], at, w * (0.4 if i == 2 else 0.66))
        kicks.append(at)
        # An answering stab off the beat, the call-and-response a fanfare needs.
        if i < 3:
            place(buf, chord(0.3, [deg(d) + 24 for d in stabs[i][:2]], gain=w * 0.2,
                             wave="saw", dec=0.18, sus=0.15), at + BEAT * 1.5)
            place(buf, S["kick"], at + BEAT * 2, w * 0.42)
            kicks.append(at + BEAT * 2)
        if i == 3:
            place(buf, S["drop"], at, w * 0.7)
            place(buf, S["gong"], at, w * 0.4)
            place(buf, S["subdrop"], at, w * 0.6)
    place(buf, chord(1.5, [deg(0) + 12, deg(4) + 12, deg(7) + 12, deg(0) + 24],
                     gain=0.38, wave="saw", atk=0.05, dec=1.0, sus=0.6), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
    return finish(buf, sub_line(n), kicks)


def comp_pulse(S):
    """AUSTERE. One low pulse a bar and almost nothing else, so the four landings
    are the only things that happen and the silence between them is the
    arrangement. The film has one subject per beat; this is the bed that agrees
    with it rather than filling in around it."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.5)
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        # THE DIP HAS TO BE CARRIED BY THE ONE EVENT THERE IS. In a composition
        # this sparse the landing IS the kick, so a 10% weight difference between
        # GAIN and RANK is the only thing distinguishing them - and the first
        # tick of the wheel, landing 20 ms in, sat inside the same 0.25 s
        # measuring window and pushed RANK back over GAIN (0.622 vs 0.611).
        # Austerity leaves nothing else to absorb that, so the kick takes the dip
        # explicitly and the first tick gets out of the window's way.
        place(buf, S["kick"], at, w * (0.78 if i == 2 else 0.95))
        kicks.append(at)
        if i == 2:
            # Even the dip's mechanism is thinned: three ticks, not seven.
            for off in (_LB.WHEEL[0], _LB.WHEEL[3], _LB.WHEEL[6]):
                place(buf, S["wheel"], at + off, 0.2 if off < 0.9 else 0.42)
        elif i == 3:
            # AUSTERITY CUTS BOTH WAYS. When every other landing is a bare kick,
            # a fully layered drop is not "the heaviest landing", it is a
            # different instrument arriving - and the curve it has to sit on says
            # PATCH is 1.28x GAIN, not four times it. So the payload here is
            # modest by arithmetic, not by taste.
            place(buf, S["drop"], at, w * 0.34)
            place(buf, S["subdrop"], at, w * 0.42)
        else:
            place(buf, S["hit"], at, w * 0.62)
    place(buf, voice(1.8, midi(deg(0) + 12), gain=0.26, wave="hollow",
                     atk=0.15, dec=1.4, sus=0.6), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.38)
    # A quieter, longer sub so the space reads as depth rather than as absence.
    return finish(buf, sub_line(n), kicks, space=0.32, sub_gain=0.62)


def comp_drone(S):
    """ESCALATE BY COLOUR, NOT VOLUME - the instruction the weight curve already
    carries, applied to the whole piece. One sustained pad runs the full ten
    seconds and its HARMONY changes on each landing: open fifth, add the third,
    darken to the sixth degree, resolve. The percussion is almost incidental.

    If the curve holds here it holds anywhere, because nothing in this
    composition gets louder on purpose."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.38)
    voicings = [[0, 4], [0, 2, 4], [1, 3, 5], [0, 4, 7], [0, 2, 4, 7]]
    for bar_i in range(5):
        at = bar_i * BAR
        dur = min(BAR + 0.9, SECONDS - at)
        w = WEIGHT.get(bar_i, 0.4)
        place(buf, chord(dur, [deg(d) + 12 for d in voicings[bar_i]],
                         gain=0.2 + 0.16 * w, wave="saw", atk=0.12, dec=1.6,
                         sus=0.75, rel=0.5), at)
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        place(buf, S["kick"], at, w * 0.62)
        place(buf, S["hit"], at, w * (0.28 if i == 2 else 0.44))
        kicks.append(at)
        if i == 3:
            place(buf, S["subdrop"], at, w * 0.55)
            place(buf, S["drop"], at, w * 0.44)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.36)
    return finish(buf, sub_line(n), kicks, space=0.3)


def comp_motif(S):
    """THE MNEMONIC CANDIDATE. Four notes, stated at 2.0, answered at 4.0,
    inverted at 6.0, resolved at 8.0 - and the same four notes are what a
    three-second stinger or a one-second app ping would be cut down to.

    This is the only composition here designed to survive being SHORTENED. Every
    serious sonic-brand system is tiered - a bed, a stinger, a ping, sharing
    pitch and timbre rather than arrangement - and none of the others have a
    figure small enough to be the top of that pyramid. Four notes, well
    separated, because a listener reliably holds about six distinct pitches."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.4)
    FIG = [0, 4, 2, 7]              # the statement
    ANS = [7, 4, 5, 2]              # the answer, falling
    INV = [7, 3, 5, 0]              # inverted
    RES = [0, 4, 7, 11]             # resolved, arriving as a stack
    step = BEAT * 0.5
    for i, (at, notes) in enumerate(zip(LANDINGS, (FIG, ANS, INV, RES))):
        w = WEIGHT[i + 1]
        if i == 3:
            place(buf, chord(1.7, [deg(d) + 12 for d in notes], gain=w * 0.38,
                             wave="bell", atk=0.01, dec=1.1, sus=0.4), at)
        else:
            # THE FIGURE IS THE SUBJECT, so it is loud enough to BE one. At 0.34
            # the four notes measured 0.462 against a curve asking 0.55 - the
            # mnemonic was quieter than the percussion carrying it, which for the
            # one composition whose whole purpose is a memorable figure is the
            # wrong way round. The first note of each statement is accented, so
            # the phrase has a head.
            for j, d in enumerate(notes):
                place(buf, voice(0.42, midi(deg(d) + 12),
                                 gain=w * (0.52 if j == 0 else 0.4),
                                 wave="bell", atk=0.005, dec=0.28, sus=0.2),
                      at + j * step)
        place(buf, S["kick"], at, w * 0.8)
        place(buf, S["hit"], at, w * (0.34 if i == 2 else 0.55))
        kicks.append(at)
        if i == 3:
            # Pulled back, because the payoff here is the figure RESOLVING, not
            # the drop arriving - and at 0.66 the drop was flattening every
            # landing before it into a ratio against itself.
            place(buf, S["drop"], at, w * 0.5)
            place(buf, S["subdrop"], at, w * 0.5)
    # The plating states the figure ONCE more, high and bare: the shape you would
    # keep if you had one second.
    for j, d in enumerate(FIG):
        place(buf, voice(0.5, midi(deg(d) + 24), gain=0.2, wave="bell",
                         dec=0.4, sus=0.25), PLATE + j * (BEAT * 0.25))
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.28)
    return finish(buf, sub_line(n), kicks)


def comp_mechanism(S):
    """NO TONAL CENTRE AT ALL. The wheel's idea - spacing as meaning - extended
    over the whole piece: relays, ticks and clank, escalating by DENSITY rather
    than by pitch or by volume. The anti-melodic option, and the honest test of
    whether this film wants music or wants a machine.

    It is also the only one that could not be confused with any other brand's
    bed, which is the argument for it."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.46)
    # Density per bar: the escalation, and the third bar THINS - the dip.
    density = {0: 3, 1: 5, 2: 8, 3: 4, 4: 11}
    for bar_i in range(5):
        b = bar_i * BAR
        d = density[bar_i]
        for j in range(d):
            # Deterministic, uneven placement: a machine, not a metronome.
            frac = ((j * 7 + bar_i * 3) % d) / d
            t = b + frac * BAR
            g = 0.1 + 0.14 * (j % 3)
            place(buf, S["wheel" if j % 2 else "click"], t, g)
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        place(buf, S["kick"], at, w * 0.9)
        place(buf, S["alt"] if i == 2 else S["hit"], at, w * 0.6)
        kicks.append(at)
        if i == 2:
            for j, off in enumerate(_LB.WHEEL):
                last = j == len(_LB.WHEEL) - 1
                place(buf, S["wheel"], at + off,
                      max(0.1, 0.46 * (1.0 if last else 0.6 - 0.055 * j)))
        if i == 3:
            place(buf, S["drop"], at, w * 0.74)
            place(buf, S["gong"], at, w * 0.4)
            place(buf, S["subdrop"], at, w * 0.6)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.42)
    return finish(buf, sub_line(n), kicks, space=0.18)


def comp_duet(S):
    """CALL AND RESPONSE. The click asks and the bed answers, all the way
    through: every landing is a two-part figure where percussion states and a
    pitched voice replies half a beat later. It makes the quiz's one click at 1.5
    the grammatical subject of the whole piece rather than a pickup that happens
    early.

    The cost is that nothing lands cleanly on a downbeat except the answer, which
    is either the idea or the problem."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.5)
    # The very first answer: the film's own click, replied to.
    place(buf, voice(0.6, midi(deg(0) + 12), gain=0.22, wave="hollow",
                     atk=0.006, dec=0.4, sus=0.25), ANSWER + BEAT * 0.5)
    replies = [4, 2, 5, 7]
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        place(buf, S["kick"], at, w * 0.88)
        place(buf, S["hit"], at, w * (0.36 if i == 2 else 0.6))
        kicks.append(at)
        place(buf, voice(0.7 if i < 3 else 1.5, midi(deg(replies[i]) + 12),
                         gain=w * 0.32, wave="hollow", atk=0.008, dec=0.45,
                         sus=0.3), at + BEAT * 0.5)
        if i == 2:
            for j, off in enumerate(_LB.WHEEL[::2]):
                place(buf, S["wheel"], at + off, 0.26)
        if i == 3:
            place(buf, S["drop"], at, w * 0.68)
            place(buf, S["subdrop"], at, w * 0.58)
    place(buf, voice(1.3, midi(deg(0) + 24), gain=0.24, wave="bell",
                     atk=0.02, dec=0.9), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.32)
    return finish(buf, sub_line(n), kicks)


# ---- round two: the serious set ---------------------------------------------
#
# Owner, 2026-08-12: duet, motif and sequence are the interesting three - more
# bass, gravity, seriousness, "this is a defense company."
#
# WHAT THAT CHANGES, CONCRETELY, because "make it more serious" is not a note you
# can act on and four specific things are:
#
#   REGISTER. Round one put every pitched voice at +12 or +24 above a root of
#   A2. That range sounds capable and young. All of these sit an octave to a
#   twelfth lower, where the same intervals read as consequential.
#
#   MODE. Dorian's raised sixth was chosen so the film would not read as sad.
#   "Not sad" and "grave" are different requests, and that one note is the
#   difference, so the serious set is aeolian.
#
#   HARMONY. Open fifths and octaves, mostly. A bare fifth declines to be major
#   or minor, which is why it is the sound of institutions - and it leaves the
#   low end uncluttered in a way a triad at this register cannot.
#
#   BASS THAT TRAVELS. "More bass" delivered as more energy below 100 Hz is more
#   of something a phone will never reproduce. The bass here is PLAYED (harmony
#   and low end move together) and saturated, so its third and fifth harmonics
#   land in the 250-700 Hz band a small speaker can actually drive and the ear
#   infers the fundamental. See saturate().
#
# Three are the interesting three, taken down. Four are the combinations asked
# for. One is the austere extreme, because a defense register's strongest move
# is usually restraint and the set should contain its own limit case.


def _serious_perc(buf, S, i, at, w, kicks, heavy=1.0):
    """The percussion floor the serious set shares: dry, low, and less of it.
    Round one's layered five-sample drop is a trailer move; this keeps the body
    and drops the top, because a bright transient is the fastest way to make a
    low arrangement sound like a toy again."""
    place(buf, S["kick"], at, w * 1.05 * heavy)
    kicks.append(at)
    if i == 2:
        place(buf, S["click"], at, w * 0.34)
    else:
        place(buf, S["low"], at, w * 0.6 * heavy)
    if i == 3:
        # PULLED WAY BACK, and this is the lesson round one already taught twice.
        # A loud bass floor raises the level in EVERY measuring window, so the
        # landings have less room to separate above it - and a fully layered
        # drop on top of that floor does not read as "the heaviest landing", it
        # reads as the only one. First cut measured LEARN at 0.364 against a
        # curve asking 0.55. The curve says PATCH is 1.28x GAIN; the payload has
        # to be sized to that, not to how big a drop can be made.
        place(buf, S["drop"], at, w * 0.34 * heavy)
        place(buf, S["subdrop"], at, w * 0.4 * heavy)


# The figure the sequence-family shares: EIGHTHS, NOT SIXTEENTHS. Halving the
# rate is most of the seriousness - a sixteenth pattern is busy by nature and
# busy is the opposite of the brief.
# Now returned by seq_bars(), which adds the third in a bright mode.

# Four notes, aeolian, low. Same shape as round one's motif - stated, answered,
# inverted, resolved - so it is recognisably the same idea and not a new one.
MOT = [0, 4, 2, 7]
MOT_ANS = [7, 4, 5, 2]
MOT_INV = [7, 3, 5, 0]
MOT_RES = [0, 4, 7, 9]


def _seq_figure(buf, bar_i, gain=1.0, oct_up=12):
    ch = seq_bars()[bar_i]
    step = BEAT / 2
    for s in range(8):
        t = bar_i * BAR + s * step
        if t >= SECONDS:
            break
        m = low(ch[s % len(ch)]) + oct_up
        g = (0.34 if s == 0 else 0.2 if s % 2 == 0 else 0.13) * gain
        place(buf, warm(voice(0.3, midi(m), gain=g, wave="dark", n=4, cents=6.0,
                              atk=0.006, dec=0.18, sus=0.15, rel=0.09), 1100.0), t)


def comp_keel(S):
    """SEQUENCE, TAKEN DOWN. The same idling machine an octave lower, in eighths
    instead of sixteenths, on open fifths. What was a console ticking over
    becomes something with a displacement - the figure is now in the register
    where you feel it rather than follow it."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.34)
    for bar_i in range(5):
        _seq_figure(buf, bar_i, gain=0.85 + 0.3 * WEIGHT.get(bar_i, 0.4))
    for i, at in enumerate(LANDINGS):
        _serious_perc(buf, S, i, at, WEIGHT[i + 1], kicks)
    place(buf, pedal(1.9, low(0) + 12, gain=0.24), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
    bass = bass_plan(n, [(b * BAR, low(seq_bars()[b][0]), BAR * 0.9, 0.9)
                         for b in range(5)])
    return finish(buf, bass, kicks, space=0.22, sub_gain=0.8)


def comp_grave(S):
    """MOTIF, TAKEN DOWN AND SLOWED. The four notes on whole beats rather than
    half beats, an octave lower, each one doubled by the bass. Slower is the
    other half of serious: the round-one motif moved at the speed of a jingle
    because it was written as one."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.36)
    figs = (MOT, MOT_ANS, MOT_INV, MOT_RES)
    bplan = []
    for i, (at, notes) in enumerate(zip(LANDINGS, figs)):
        w = WEIGHT[i + 1]
        if i == 3:
            place(buf, warm(chord(2.0, [low(d) + 12 for d in notes], gain=w * 0.4,
                                  wave="open", atk=0.02, dec=1.3, sus=0.5), 1200.0), at)
            bplan.append((at, low(notes[0]), BAR * 0.95, 1.0))
        else:
            for j, d in enumerate(notes[:3]):
                place(buf, warm(voice(0.8, midi(low(d) + 12),
                                      gain=w * (0.46 if j == 0 else 0.36),
                                      wave="dark", atk=0.008, dec=0.5, sus=0.3),
                                1300.0), at + j * BEAT)
                bplan.append((at + j * BEAT, low(d), BEAT * 0.9, 0.55 + 0.2 * w))
        _serious_perc(buf, S, i, at, w, kicks)
    place(buf, pedal(1.8, low(0), gain=0.26), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.28)
    return finish(buf, bass_plan(n, bplan), kicks, space=0.26, sub_gain=0.85)


def comp_sentry(S):
    """DUET, TAKEN DOWN. Percussion states and the answer comes back a fifth
    below rather than an octave above - the reply is now heavier than the call,
    which inverts round one's relationship and is most of why it reads as
    authority instead of as conversation."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.46)
    place(buf, warm(voice(0.9, midi(low(0)), gain=0.3, wave="open", atk=0.01,
                          dec=0.6, sus=0.3), 800.0), ANSWER + BEAT * 0.5)
    replies = [4, 2, 5, 0]
    bplan = [(ANSWER + BEAT * 0.5, low(0), BEAT, 0.7)]
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        _serious_perc(buf, S, i, at, w, kicks)
        d = replies[i]
        place(buf, warm(voice(1.0 if i < 3 else 1.9, midi(low(d) + 12),
                              gain=w * 0.4, wave="open", atk=0.01, dec=0.6,
                              sus=0.35), 1000.0), at + BEAT * 0.5)
        bplan.append((at + BEAT * 0.5, low(d), BAR * 0.7, 0.75 + 0.25 * w))
    place(buf, pedal(1.7, low(0), gain=0.24), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
    return finish(buf, bass_plan(n, bplan), kicks, space=0.26, sub_gain=0.85)


def comp_brief(S):
    """MOTIF x DUET. The percussion asks on every downbeat and THE MNEMONIC IS
    THE ANSWER, half a beat later, every time. Four statements of the same
    figure in four harmonic positions, each one arriving as a reply rather than
    as an announcement.

    This is the combination with the most to gain: duet gives the motif a
    reason to keep recurring, and the motif gives duet something worth
    repeating. It is also the one that would cut down cleanest - the reply
    alone, with its call, is a three-second stinger."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.44)
    figs = (MOT, MOT_ANS, MOT_INV, MOT_RES)
    step = BEAT * 0.5
    bplan = []
    for i, (at, notes) in enumerate(zip(LANDINGS, figs)):
        w = WEIGHT[i + 1]
        _serious_perc(buf, S, i, at, w, kicks)
        # The reply begins half a beat after the call and IS the figure.
        for j, d in enumerate(notes[: 4 if i == 3 else 3]):
            place(buf, warm(voice(0.55 if i < 3 else 1.1, midi(low(d) + 12),
                                  gain=w * (0.46 if j == 0 else 0.34),
                                  wave="dark", atk=0.007, dec=0.34, sus=0.25),
                            1300.0), at + BEAT * 0.5 + j * step)
        bplan.append((at + BEAT * 0.5, low(notes[0]), BAR * 0.8, 0.8 + 0.2 * w))
    # The plating answers one last time, unaccompanied.
    for j, d in enumerate(MOT):
        place(buf, warm(voice(0.5, midi(low(d) + 12), gain=0.22, wave="open",
                              dec=0.4, sus=0.25), 1100.0), PLATE + j * (BEAT * 0.3))
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.28)
    return finish(buf, bass_plan(n, bplan), kicks, space=0.24, sub_gain=0.85)


def comp_watch(S):
    """SEQUENCE x DUET. The machine idles all the way through, and at each
    landing IT STOPS for half a beat and something answers into the hole it
    leaves. The call is the silence.

    A running figure cannot make room by getting louder; it makes room by
    stopping, which is the one gesture round one's sequence never had."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.36)
    step = BEAT / 2
    bplan = []
    for bar_i in range(5):
        ch = seq_bars()[bar_i]
        for s in range(8):
            t = bar_i * BAR + s * step
            if t >= SECONDS:
                break
            # THE HOLE: the first beat of each landing bar is left empty so the
            # answer has somewhere to be.
            if bar_i >= 1 and s in (1, 2):
                continue
            m = low(ch[s % len(ch)]) + 12
            g = 0.3 if s == 0 else 0.18 if s % 2 == 0 else 0.12
            place(buf, warm(voice(0.3, midi(m), gain=g, wave="dark", n=4,
                                  atk=0.006, dec=0.18, sus=0.15, rel=0.09),
                            1100.0), t)
    replies = [4, 2, 5, 0]
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        _serious_perc(buf, S, i, at, w, kicks)
        place(buf, warm(voice(1.0 if i < 3 else 1.8, midi(low(replies[i]) + 12),
                              gain=w * 0.42, wave="open", atk=0.012, dec=0.6,
                              sus=0.35), 1000.0), at + BEAT * 0.5)
        bplan.append((at, low(seq_bars()[i + 1][0]), BAR * 0.9, 0.85 + 0.15 * w))
    bplan.insert(0, (0.0, low(seq_bars()[0][0]), BAR * 0.9, 0.6))
    place(buf, pedal(1.8, low(0) + 12, gain=0.22), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
    return finish(buf, bass_plan(n, bplan), kicks, space=0.22, sub_gain=0.8)


def comp_standard(S):
    """MOTIF x SEQUENCE. The figure is not laid on top of the machine, it is the
    machine's TOP LINE - the sequence runs underneath and the motif's four notes
    are picked out of it, louder, at each landing. One texture, two readings.

    The claim is that a mnemonic buried in working material is more convincing
    than one announced over it, which is roughly the difference between a
    signature and a slogan."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.34)
    for bar_i in range(5):
        _seq_figure(buf, bar_i, gain=0.6)
    figs = (MOT, MOT_ANS, MOT_INV, MOT_RES)
    step = BEAT * 0.5
    bplan = []
    for i, (at, notes) in enumerate(zip(LANDINGS, figs)):
        w = WEIGHT[i + 1]
        _serious_perc(buf, S, i, at, w, kicks, heavy=0.92)
        for j, d in enumerate(notes[: 4 if i == 3 else 3]):
            place(buf, warm(voice(0.6 if i < 3 else 1.4, midi(low(d) + 24),
                                  gain=w * (0.4 if j == 0 else 0.29),
                                  wave="open", atk=0.007, dec=0.4, sus=0.28),
                            1500.0), at + j * step)
        bplan.append((at, low(notes[0]), BAR * 0.9, 0.85 + 0.15 * w))
    bplan.insert(0, (0.0, low(0), BAR * 0.9, 0.55))
    place(buf, pedal(1.8, low(0) + 12, gain=0.22), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.28)
    return finish(buf, bass_plan(n, bplan), kicks, space=0.24, sub_gain=0.82)


def comp_hull(S):
    """ALL THREE, AT WEIGHT. The sequence idles and stops; the motif answers into
    the stop; the bass plays the motif's root under it. Duet's structure,
    sequence's continuity, motif's figure, in the lowest register any of these
    use.

    The honest risk of a combination is that it is three ideas competing rather
    than one idea with three parts, and this is the one to listen to hardest for
    that."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    kicks = scaffold(buf, S, click_gain=0.4)
    step = BEAT / 2
    figs = (MOT, MOT_ANS, MOT_INV, MOT_RES)
    for bar_i in range(5):
        ch = seq_bars()[bar_i]
        for s in range(8):
            t = bar_i * BAR + s * step
            if t >= SECONDS or (bar_i >= 1 and s in (1, 2, 3)):
                continue
            place(buf, warm(voice(0.28, midi(low(ch[s % len(ch)]) + 12),
                                  gain=0.26 if s == 0 else 0.13, wave="dark",
                                  n=4, atk=0.006, dec=0.16, sus=0.13, rel=0.08),
                            1000.0), t)
    bplan = [(0.0, low(0), BAR * 0.9, 0.6)]
    for i, (at, notes) in enumerate(zip(LANDINGS, figs)):
        w = WEIGHT[i + 1]
        _serious_perc(buf, S, i, at, w, kicks, heavy=1.05)
        for j, d in enumerate(notes[: 4 if i == 3 else 3]):
            place(buf, warm(voice(0.6 if i < 3 else 1.5, midi(low(d) + 12),
                                  gain=w * (0.44 if j == 0 else 0.32),
                                  wave="open", atk=0.008, dec=0.42, sus=0.3),
                            1200.0), at + BEAT * 0.5 + j * step)
        bplan.append((at, low(notes[0]), BAR * 0.95, 0.9 + 0.1 * w))
    place(buf, pedal(2.0, low(0), gain=0.28), PLATE)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
    return finish(buf, bass_plan(n, bplan), kicks, space=0.24, sub_gain=0.9)


def comp_anchor(S):
    """THE LIMIT CASE. One low pedal for the whole ten seconds, three fragments
    of the motif, and almost no percussion. Gravity by subtraction.

    A serious register's strongest move is restraint, and a set that explores
    seriousness without containing its own extreme has not actually bracketed
    the question. If this is too little, it says how much of the others is
    load-bearing; if it is not, it says the rest were overwritten."""
    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    # QUIETER PICKUP THAN THE OTHERS, because austerity changes what a pickup
    # competes with. Everywhere else the click sits under a landing built of
    # three or four sounds; here the landing is one kick and a reply that
    # arrives at 2.25 - outside the window that measures 2.0 - so at the shared
    # 0.5 the pickup out-peaked the landing it exists to lead into.
    kicks = scaffold(buf, S, click_gain=0.34, kick=True)
    # The pedal runs the entire clip and wraps, so the loop has no seam at all.
    ped = pedal(SECONDS + 1.2, low(0), gain=0.34)
    for i, v in enumerate(ped):
        buf[i % n] += v
    for i, at in enumerate(LANDINGS):
        w = WEIGHT[i + 1]
        place(buf, S["kick"], at, w * 0.92)
        kicks.append(at)
        if i == 2:
            place(buf, S["click"], at, w * 0.4)
        if i == 3:
            place(buf, S["drop"], at, w * 0.38)
            place(buf, S["subdrop"], at, w * 0.46)
        # Three notes only, and the third landing gets none - the dip is a
        # silence here rather than a smaller sound.
        #
        # ROOT, THIRD, FIFTH - and the THIRD is not optional. The first cut used
        # the motif's first, second and fourth degrees, which are root, fifth
        # and octave: intervals that are IDENTICAL in every diatonic mode. So
        # anchor had no mode at all, and its mixolydian render came back
        # byte-identical to its aeolian one. A mode variant that is the same
        # file is worse than no variant, because it looks like a choice.
        if i != 2:
            d = (MOT[0], MOT[2], MOT[1])[min(i if i < 2 else i - 1, 2)]
            place(buf, warm(voice(1.3, midi(low(d) + 12), gain=w * 0.4,
                                  wave="open", atk=0.03, dec=0.9, sus=0.4),
                            1000.0), at + BEAT * 0.5)
    place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.34)
    bass = bass_plan(n, [(0.0, low(0), BAR * 1.8, 0.7),
                         (LANDINGS[1], low(0), BAR * 1.8, 0.8),
                         (LANDINGS[3], low(0), BAR * 1.4, 1.0)])
    return finish(buf, bass, kicks, space=0.34, sub_gain=0.9)


# ---- round five: variations on keel / mixolydian ----------------------------
#
# Owner picked keel in mixolydian and asked for variations, so the base is held
# and ONE property of the figure moves at a time. Everything outside the figure
# - percussion, bass, pedal, plating, mode, register of the harmony - is
# untouched, which is what makes these comparable to each other and to the base.
#
# WHAT IS ACTUALLY VARIABLE IN AN IDLING MACHINE. The composition's argument is
# that something was already running before the film started. That leaves four
# real dials and one false one. The real ones: how finely it subdivides, what
# shape the figure traces, what register it runs in, and what its timbre does
# over ten seconds. The false one is loudness - a machine that gets louder is
# not idling any more, it is performing, which is a different composition and
# already exists as fanfare.


def keel_figure(buf, bar_i, spec, gain=1.0):
    """One bar of the figure, under a spec. See KEEL_VARS."""
    if bar_i in spec.get("skip", ()):
        return
    ch = seq_bars()[bar_i]
    div = spec.get("div", 8)
    step = BAR / div
    per_beat = max(1, div // 4)
    dur = min(0.34, step * 1.35)
    for s in range(div):
        t = bar_i * BAR + s * step + spec.get("shift", 0.0)
        if t >= SECONDS:
            break
        # CONTOUR IS AN INDEX FUNCTION, not a second note list, so every shape
        # runs over whatever harmony the bar already has and a mode change still
        # reaches all of them.
        c = spec.get("contour", "cycle")
        n = len(ch)
        if c == "fall":
            idx = (n - 1) - (s % n)
        elif c == "pendulum":
            span = max(1, 2 * n - 2)
            k = s % span
            idx = k if k < n else span - k
        else:
            idx = s % n
        oct_up = spec.get("oct", 12)
        # A leap every fourth note, for the variation that wants range rather
        # than a run.
        if spec.get("leap") and s % 4 == 3:
            oct_up += 12
        # RISE walks up an octave across the bar instead of cycling in place.
        if c == "rise" and div >= 8:
            oct_up += 12 * (s // (div // 2))
        g = (0.34 if s == 0 else 0.2 if s % per_beat == 0 else 0.13) * gain
        # A filter that OPENS across the clip is escalation without volume -
        # the one way an idle can build and still be an idle.
        c0, c1 = spec.get("filter", (1100.0, 1100.0))
        cut = c0 + (c1 - c0) * (t / SECONDS)
        place(buf, warm(voice(dur, midi(low(ch[idx]) + oct_up), gain=g,
                              wave=spec.get("wave", "dark"), n=4, cents=6.0,
                              atk=0.006, dec=min(0.2, dur * 0.6), sus=0.15,
                              rel=0.09), cut), t)


def comp_keel_var(spec):
    """keel, with one property of the figure changed."""
    def run(S):
        n = int(round(SECONDS * SR))
        buf = [0.0] * n
        kicks = scaffold(buf, S, click_gain=0.34)
        for bar_i in range(5):
            keel_figure(buf, bar_i, spec, gain=0.85 + 0.3 * WEIGHT.get(bar_i, 0.4))
        for i, at in enumerate(LANDINGS):
            _serious_perc(buf, S, i, at, WEIGHT[i + 1], kicks)
        place(buf, pedal(1.9, low(0) + 12, gain=0.24), PLATE)
        place(buf, _LB.tail(S["sweep"], 0.9), PLATE, 0.3)
        bass = bass_plan(n, [(b * BAR, low(seq_bars()[b][0]), BAR * 0.9, 0.9)
                             for b in range(5)])
        return finish(buf, bass, kicks, space=0.22, sub_gain=0.8)
    return run


KEEL_VARS = {
    "k-16th": (dict(div=16), "SIXTEENTHS. Twice the rate of the base - the machine running hot. The risk it takes is that busy is the opposite of the brief, and this is where you find out how much of keel's gravity was the SPACING rather than the register."),
    "k-quarter": (dict(div=4), "QUARTERS. Half the rate: the gravest possible idle, one note a beat and nothing between. If keel was still too busy, this is the answer."),
    "k-triplet": (dict(div=12), "TRIPLETS. Twelve to the bar instead of eight, so the figure rolls rather than marches. The one variation that changes the FEEL of the pulse rather than its density."),
    "k-sync": (dict(div=8, shift=BEAT * 0.25), "SYNCOPATED. The same eighths displaced a sixteenth late, so the figure pushes against the landings instead of agreeing with them. The landings stay exactly where they are - only the machine is off the grid."),
    "k-rise": (dict(div=8, contour="rise"), "ASCENDING. The figure climbs an octave across each bar instead of cycling in place. The film is about a ladder; this is the only keel that goes anywhere."),
    "k-fall": (dict(div=8, contour="fall"), "DESCENDING. The mirror, and worth hearing because falling reads as settling rather than as climbing - which may suit a bed whose job is to sit under a picture that does the climbing."),
    "k-pendulum": (dict(div=8, contour="pendulum"), "UP AND BACK. Neither climbing nor settling - the figure turns around at the top, which is what an instrument actually doing something looks like rather than one going somewhere."),
    "k-wide": (dict(div=8, leap=True), "LEAPS. Every fourth note jumps an octave, so the figure has range instead of being a run. More obviously a MELODY, less obviously a mechanism."),
    "k-deep": (dict(div=8, oct=0), "AN OCTAVE DOWN. The figure in the bass's own register rather than above it. The limit of 'more weight' for this composition - at some point the figure stops being a figure and becomes the low end."),
    "k-open": (dict(div=8, filter=(500.0, 2600.0)), "THE FILTER OPENS. Same notes, same gains: the lowpass travels from 500 Hz to 2.6 kHz across the ten seconds, so the piece escalates by BRIGHTNESS and never by volume. The only variation whose build survives the weight curve untouched."),
    "k-bell": (dict(div=8, wave="bell"), "STRUCK, NOT BOWED. The same figure on the bell timbre - inharmonic partials, faster decay. Turns the idle into something being counted out rather than something running."),
}


def in_mode(fn, mode_name):
    """The same composition, in another mode. ONE variable.

    The serious set is written once and heard in several scales rather than
    rewritten per mode, so an A/B between two of these compares the mode and
    nothing else - the same control the fixed palette gives the compositions.
    """
    def run(S):
        prev = _MODE[0]
        _MODE[0] = MODES[mode_name]
        try:
            return fn(S)
        finally:
            _MODE[0] = prev
    return run


COMPS = {
    "strike": (comp_strike, "The control: the arrangement we already have, at the honest drive. Percussion only, no tonal content beyond the sub."),
    "ladder": (comp_ladder, "PITCH IS RANK. Each landing steps up the mode and the wheel runs the ladder. The film's own idea, as music."),
    "converge": (comp_converge, "The Deep Note move: a wide detuned cluster wanders for eight seconds and locks into a chord on the plating. The payoff is focus, not impact."),
    "sequence": (comp_sequence, "An instrument idling. Sixteenths run the whole clip; the landings are harmonic changes inside the figure, not events on top of it."),
    "fanfare": (comp_fanfare, "Ceremonial. Stacked stabs, a real cadence into 8.0, the plating as resolution. Sounds like something is being awarded - or like an advert."),
    "pulse": (comp_pulse, "Austere. One pulse a bar; the silence between the landings is the arrangement. Agrees with a film that shows one subject per beat."),
    "drone": (comp_drone, "Escalate by COLOUR, not volume. One sustained pad whose harmony changes on each landing. Nothing in it gets louder on purpose."),
    "motif": (comp_motif, "Four notes: stated, answered, inverted, resolved. The only one built to survive being cut down to a 3s stinger or a 1s ping."),
    "mechanism": (comp_mechanism, "No tonal centre at all. Relays and ticks, escalating by DENSITY. The one that could not be mistaken for another brand's bed."),
    "duet": (comp_duet, "Call and response. Percussion states, a voice replies half a beat later, making the quiz's click the subject of the piece."),

    # Round two: aeolian, an octave to a twelfth lower, open fifths, played and
    # saturated bass. The three the owner kept, taken down - then combined.
    "keel": (comp_keel, "SEQUENCE taken down. The idling machine an octave lower, eighths not sixteenths, on open fifths - a figure you feel rather than follow."),
    "grave": (comp_grave, "MOTIF taken down and slowed. Whole beats, an octave lower, every note doubled by the bass. Slow is the other half of serious."),
    "sentry": (comp_sentry, "DUET taken down. The answer comes back BELOW the call instead of above it, so the reply is heavier than the question."),
    "brief": (comp_brief, "MOTIF x DUET. The percussion asks and the mnemonic answers, every downbeat. The combination with the most to gain, and the one that cuts down cleanest to a stinger."),
    "watch": (comp_watch, "SEQUENCE x DUET. The machine idles all the way through and STOPS for half a beat at each landing; something answers into the hole. The call is the silence."),
    "standard": (comp_standard, "MOTIF x SEQUENCE. The figure is the machine's top line rather than a layer above it - a signature buried in working material rather than a slogan over it."),
    "hull": (comp_hull, "ALL THREE at weight: sequence idles and stops, motif answers into the stop, bass plays its root. Listen hard for three ideas competing instead of one with three parts."),
    "anchor": (comp_anchor, "THE LIMIT CASE. One low pedal for ten seconds, three motif fragments, almost no percussion. The dip is a silence rather than a smaller sound."),

    # Round three: the same serious arrangements, moved UP the mode ordering.
    # Aeolian is the second-saddest of the six diatonic modes and that is why
    # round two reads ominous; mixolydian keeps the weight and drops the gloom.
    # Register, timbre, bass and percussion are untouched - mode is the only
    # variable, and in a bright mode the sequence figure re-admits the third,
    # without which the change would be inaudible under open fifths.
    "standard-mixo": (in_mode(comp_standard, "mixolydian"), "STANDARD in mixolydian. Major third and sixth restored, only the seventh still lowered - the mode film scoring uses for confident and heroic without the saccharine of straight major."),
    "hull-mixo": (in_mode(comp_hull, "mixolydian"), "HULL in mixolydian. All three ideas at weight, two steps up the happiness ordering from where round two sat."),
    "brief-mixo": (in_mode(comp_brief, "mixolydian"), "BRIEF in mixolydian. The mnemonic answering every downbeat, in the mode that reads as capable rather than as a warning."),
    "grave-mixo": (in_mode(comp_grave, "mixolydian"), "GRAVE in mixolydian - which makes the name a lie, and that is the point: same slow low four notes, no longer funereal."),
    "keel-mixo": (in_mode(comp_keel, "mixolydian"), "KEEL in mixolydian. The idling machine with the third in it, so the figure has a mode at all."),
    "standard-dor": (in_mode(comp_standard, "dorian"), "STANDARD in dorian - the halfway house. Minor third kept, major sixth restored: serious with a shade of hope, one step up from aeolian rather than two."),
    "hull-dor": (in_mode(comp_hull, "dorian"), "HULL in dorian. If mixolydian reads too pleased with itself, this is the same weight one step darker."),

    # THE FULL SWEEP, on the two strongest arrangements. Six diatonic modes minus
    # locrian, in the order Temperley & Tan measured them, so the ordering can be
    # heard end to end rather than argued about - including the two ends nobody
    # is going to pick, because a sweep that omits its extremes does not tell you
    # where the middle is.
    "standard-ion": (in_mode(comp_standard, "ionian"), "STANDARD in ionian - straight major, the happiest of the six. Almost certainly too pleased with itself for a defense brand; here so the top of the range is audible rather than assumed."),
    "standard-lyd": (in_mode(comp_standard, "lydian"), "STANDARD in lydian. The raised fourth - wonder and altitude rather than confidence. Rated LESS happy than ionian despite being higher up the ordering, which is the one place the line-of-fifths rule breaks."),
    "standard-phr": (in_mode(comp_standard, "phrygian"), "STANDARD in phrygian - the flat SECOND. Saddest of the six and frankly menacing. The far end of the sweep, for calibration: if aeolian read ominous, this is what ominous actually is."),
    "hull-ion": (in_mode(comp_hull, "ionian"), "HULL in ionian. The full weight of all three ideas, in straight major."),
    "hull-lyd": (in_mode(comp_hull, "lydian"), "HULL in lydian. Weight plus altitude - the closest this set gets to aspirational without going saccharine."),
    "hull-phr": (in_mode(comp_hull, "phrygian"), "HULL in phrygian. The bottom of the range, for calibration."),

    # Mixolydian for the three serious arrangements that had not had it yet, so
    # the brighter option exists for every one of them.
    "sentry-mixo": (in_mode(comp_sentry, "mixolydian"), "SENTRY in mixolydian. The heavier-than-the-call reply, without the gloom that made it read as a warning."),
    "watch-mixo": (in_mode(comp_watch, "mixolydian"), "WATCH in mixolydian. The machine stops and something confident answers into the hole."),
    "anchor-mixo": (in_mode(comp_anchor, "mixolydian"), "ANCHOR in mixolydian. The limit case, lit: one pedal and three fragments, no longer a dirge."),
    "brief-dor": (in_mode(comp_brief, "dorian"), "BRIEF in dorian. The stinger candidate at the halfway house - the version most likely to survive being the thing you hear every time."),
}

# Round five: eleven variations on keel / mixolydian, one property each. Built
# from the table rather than written out, so a twelfth is a line and the base
# cannot drift away from its variations.
for _name, (_spec, _desc) in KEEL_VARS.items():
    COMPS[_name] = (in_mode(comp_keel_var(_spec), "mixolydian"), _desc)


def curve_of(s):
    pk = dict(landing_peaks(s))
    patch = pk["patch"] or 1.0
    rel = {k: v / patch for k, v in pk.items()}
    err = math.sqrt(sum((rel[k] - t) ** 2 for k, t in CURVE.items()) / len(CURVE))
    return rel, err


def report(name, s):
    rel, err = curve_of(s)
    rms = math.sqrt(sum(v * v for v in s) / len(s))
    crest = 20 * math.log10(max(abs(v) for v in s) / rms)
    flags = []
    if rel["learn"] >= rel["gain"]:
        flags.append("CLIMB INVERTED")
    if rel["rank"] >= rel["gain"]:
        flags.append("DIP MISSING")
    if rel["answer"] >= rel["learn"]:
        flags.append("PICKUP OVER LANDING")
    print(f"  {SECONDS:.3f} s  peak {max(abs(v) for v in s):.3f}  rms {rms:.4f}  crest {crest:.2f} dB")
    print("  " + "  ".join(f"{k}={rel[k]:.3f}" for k in
                           ("answer", "learn", "gain", "rank", "patch", "plate")))
    print(f"  curve err {err:.4f}" + ("   *** " + ", ".join(flags) if flags else "   curve clean"))
    if _DRY:
        drel, derr = curve_of(_DRY)
        # Only worth printing when the bass is actually moving the answer.
        if abs(derr - err) > 0.012:
            print("  over the bass floor: "
                  + "  ".join(f"{k}={drel[k]:.3f}" for k in ("learn", "gain", "rank", "patch"))
                  + f"   curve err {derr:.4f}")
    return err


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--comp", default="ladder", choices=sorted(COMPS) + ["all"])
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(SAMPLES), "kits"))
    a = ap.parse_args()

    roles = ("kick", "hit", "alt", "low", "drop", "click", "gong", "subdrop",
             "riser", "reverse", "wheel", "sweep")
    S = {r: read_wav(os.path.join(SAMPLES, PAL[r])) for r in roles if PAL.get(r)}

    names = sorted(COMPS) if a.comp == "all" else [a.comp]
    os.makedirs(a.out_dir, exist_ok=True)
    for name in names:
        fn, desc = COMPS[name]
        s = fn(S)
        path = os.path.join(a.out_dir, f"logbook-comp-{name}.wav")
        write_wav(path, s)
        print(f"{path}")
        report(name, s)
        print(f"  {desc}")
