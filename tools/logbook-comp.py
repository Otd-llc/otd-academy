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


def deg(i):
    """Scale degree i (may exceed an octave) as a MIDI note."""
    return ROOT + 12 * (i // 7) + DORIAN[i % 7]


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


def finish(buf, sub, kicks, space=0.24, sub_gain=0.5):
    """The common ending: loop-safe reverb, sidechain, soft clip.

    IDENTICAL FOR EVERY COMPOSITION, deliberately. If the finishing chain varied
    per composition then an audition would be comparing two things at once, and
    the whole reason the palette is held fixed is to compare one.
    """
    n = len(buf)
    wet = reverb(buf + buf, space)
    buf = wet[n:]
    if sub:
        sub = sidechain(sub, kicks)
        buf = [buf[i] + sub[i] * sub_gain for i in range(n)]
    peak = max(abs(v) for v in buf) or 1.0
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
}


def report(name, s):
    pk = dict(landing_peaks(s))
    patch = pk["patch"] or 1.0
    rel = {k: v / patch for k, v in pk.items()}
    err = math.sqrt(sum((rel[k] - t) ** 2 for k, t in CURVE.items()) / len(CURVE))
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
