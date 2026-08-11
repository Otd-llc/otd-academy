"""Loop-locked percussion beds for the Hex Cluster clips, in several kits.

WHY THIS EXISTS AS CODE rather than a purchased loop: the clips are exact video
loops (300 frames, 10.000 s, seam-verified), and an audio bed that does not
divide that duration will click every lap even though the picture does not.
Synthesising it means the bar length is chosen to fit the clip instead of the
clip being trimmed to fit the bar.

120 BPM: beat = 0.5 s, bar = 2 s, so a 10 s clip is exactly 5 bars, and the
video choreography is laid on the same grid.

WHAT WAS WRONG WITH THE FIRST BED, measured rather than guessed. Crest factor
22.8 dB, 48% of 20 ms windows near-silent, 2.5 onsets/second: not squashed, not
clipped, not busy. The arithmetic was fine and the TIMBRES were bad. A pure
sine sweep reads as a beep rather than a skin, raw white noise reads as static
rather than a shaker, and every hit was bone dry, which is what made it sound
synthetic. Three fixes, in order of how much they matter:

  1. ROOM. A short reverb is the single biggest "sounds real" lever, because
     nothing in nature is dry. Schroeder: parallel combs into series allpasses.
  2. MEMBRANE, not sine. A drum head is an inharmonic plate: a pitch-swept
     fundamental plus partials at non-integer ratios plus a noise transient for
     the stick, all rolled off with a lowpass so it thumps instead of pings.
  3. BANDPASSED noise for shakers and slaps, so they occupy a band instead of
     hissing across the whole spectrum.

KITS let the bed be auditioned instead of argued about. They differ in
instrumentation and space, not just level.

LOOP SAFETY IS THE WHOLE POINT. Any hit whose decay would run past the end is
WRAPPED to the head of the buffer rather than truncated, and the reverb tail is
wrapped too. A truncated tail is the click.

Stdlib only, no numpy. 16-bit PCM WAV at 48 kHz, the rate YouTube asks for.

    python tools/hex-drums.py --kit tribal
    python tools/hex-drums.py --all              # every kit, for the sandbox
    python tools/hex-drums.py --kit deep --seconds 30
"""

import argparse
import math
import random
import struct
import wave

SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM
BAR = BEAT * 4
PHRASE_BARS = 5


# ---------------------------------------------------------------- filters ---
def lowpass(buf, cutoff):
    """One-pole. Rolls the fizz off noise and the ping off membranes."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = 0.0
    out = []
    for x in buf:
        y = (1 - a) * x + a * y
        out.append(y)
    return out


def highpass(buf, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = 0.0
    px = 0.0
    out = []
    for x in buf:
        y = a * (y + x - px)
        px = x
        out.append(y)
    return out


def bandpass(buf, lo, hi):
    return highpass(lowpass(buf, hi), lo)


def env(n, attack, decay, curve=3.0):
    out = []
    a = max(1, int(attack * SR))
    for i in range(n):
        out.append(i / a if i < a else math.exp(-curve * (i - a) / max(1, decay * SR)))
    return out


# ------------------------------------------------------------ instruments ---
def resonance(dur, f, gain=0.35, curve=1.4, detune=1.006):
    """The shell ringing on after the strike.

    A taiko is a hollowed trunk, and most of what makes a big one sound BIG is
    the long low boom that keeps going once the stick has gone. The membrane
    function models the head hit and nothing else, which is why the first taiko
    kit read as loud rather than deep. This is a slowly-decaying low pair,
    detuned against itself so it beats gently instead of sitting dead still.
    """
    n = int(dur * SR)
    e = env(n, 0.004, dur * 0.8, curve)
    out = []
    p1 = p2 = 0.0
    for i in range(n):
        p1 += 2 * math.pi * f / SR
        p2 += 2 * math.pi * f * detune / SR
        out.append((math.sin(p1) + math.sin(p2) * 0.8) * e[i] * gain * 0.5)
    return lowpass(out, f * 4)


def membrane(dur, f0, f1, noise=0.5, lp=1800, curve=3.2, partials=(1.0, 1.58, 2.14),
             res=0.0, res_dur=0.0):
    """A drum head rather than a tone.

    The partial ratios are deliberately NON-INTEGER. A harmonic stack sounds
    like a pitched instrument; a real membrane's modes are inharmonic, and that
    is most of the difference between "drum" and "beep". The noise burst on the
    front is the stick or hand, and the lowpass stops the whole thing pinging.
    """
    n = int(dur * SR)
    e = env(n, 0.0006, dur * 0.45, curve)
    rng = random.Random(int(f0 * 977) & 0xFFFF)
    hit = int(0.008 * SR)
    out = []
    phases = [0.0] * len(partials)
    for i in range(n):
        t = i / n
        f = f1 + (f0 - f1) * math.exp(-5.0 * t)
        v = 0.0
        for k, ratio in enumerate(partials):
            phases[k] += 2 * math.pi * f * ratio / SR
            v += math.sin(phases[k]) / (1.6**k)
        if i < hit:
            v += rng.uniform(-1, 1) * (1 - i / hit) * noise * 2.2
        out.append(v * e[i] * 0.42)
    out = lowpass(out, lp)
    if res > 0.0:
        tail = resonance(res_dur or dur * 2.4, f1 * 0.85, gain=res)
        for i, v in enumerate(tail):
            if i < len(out):
                out[i] += v
            else:
                out.append(v)
    return out



def saturate(buf, drive=2.2, mix=0.7):
    """Soft saturation, for HARMONICS rather than loudness.

    A 60 Hz fundamental put through a nonlinearity generates 120, 180, 240 Hz.
    That is the cheapest honest way to fill the low-mid body a synthesised hit
    lacks, and it is why a saturated kick reads as bigger on a small speaker
    even though the sub is unchanged: the speaker cannot move 60 Hz but it can
    move the harmonics, and the ear infers the fundamental from them.
    """
    return [b * (1 - mix) + math.tanh(b * drive) * mix for b in buf]


def thunder_hit(dur, f0, f1, body=0.55, lp=1500, sat=2.4, seed=3):
    """A big drum with a chest, not just a floor.

    The measurement that prompted this: 86% of the bed's energy sat below
    200 Hz with 0.7% between 500 and 1500, which is a scooped spectrum. Scooped
    reads as HOLLOW, and the leftover top over an empty middle reads as TINNY.
    Thunder is broadband; it is not a sine with the mids removed.

    Three parts, where the old membrane had one and a half:
      1. a pitch-swept fundamental, mostly on its own harmonics, swept SLOWLY
         so it stays low long enough to be felt rather than clicking past
      2. a NOISE BODY that lasts the whole decay, bandpassed into the chest
         range, which is the rumble the old hits had no equivalent of
      3. saturation across the sum, generating the harmonic ladder that lets a
         phone speaker imply the bottom it cannot reproduce
    """
    n = int(dur * SR)
    rng = random.Random(seed)
    e = env(n, 0.001, dur * 0.55, 2.6)
    body_e = env(n, 0.004, dur * 0.7, 2.0)
    out = []
    p1 = p2 = 0.0
    prev_in = prev_out = 0.0
    for i in range(n):
        t = i / n
        # Slow sweep: a fast one is a click, a slow one is a boom.
        f = f1 + (f0 - f1) * math.exp(-2.6 * t)
        p1 += 2 * math.pi * f / SR
        p2 += 2 * math.pi * f * 1.5 / SR
        tone = math.sin(p1) + 0.18 * math.sin(p2)
        x = rng.uniform(-1, 1)
        y = 0.86 * (prev_out + x - prev_in)
        prev_in, prev_out = x, y
        out.append(tone * e[i] * 0.75 + y * body_e[i] * body)
    out = lowpass(out, lp)
    return saturate(out, drive=sat, mix=0.72)


def shaker(dur=0.07, seed=0, lo=2600, hi=9000, gain=0.22):
    """Bandpassed noise. Raw white noise is what made the old one hiss."""
    rng = random.Random(seed)
    n = int(dur * SR)
    e = env(n, 0.002, dur * 0.3, 4.5)
    return [
        v * gain for v in bandpass([rng.uniform(-1, 1) * e[i] for i in range(n)], lo, hi)
    ]


def riser(dur=1.5, seed=7):
    """Filtered noise opening up into a hit. Ends ON the drop, never through it."""
    rng = random.Random(seed)
    n = int(dur * SR)
    raw = [rng.uniform(-1, 1) * ((i / n) ** 2.3) for i in range(n)]
    return [v * 0.30 for v in bandpass(raw, 300, 6000)]


def reverb(buf, mix=0.25, decay=0.55, room=1.0, damp=0.42):
    """Schroeder-Moorer: damped parallel combs into series allpasses.

    THE DAMPING IS THE POINT, and its absence is what made every kit sound
    metallic. An undamped comb re-injects the full signal on every pass, so the
    highs recirculate forever and the delay's resonant peaks ring: that is how
    you build a tin can, not a room. A real surface absorbs treble on every
    bounce, so each reflection returns duller than the last. One lowpass inside
    each feedback loop is the whole difference between "hall" and "trashcan".

    `room` scales the delay lengths. The old fixed set ran 33 to 47 ms, which is
    a small hard space, and small hard spaces are alleyways. Above about 1.6
    this reads as a hall.

    Eight combs rather than four, on mutually prime lengths, so the resonant
    peaks of one do not stack on another's. Four allpasses rather than two, for
    enough diffusion that individual reflections stop being audible as echoes.
    """
    n = len(buf)
    base = [1214, 1293, 1390, 1475, 1548, 1622, 1694, 1759]
    combs = [max(64, int(d * room)) for d in base]
    fb = 0.80 + 0.16 * decay
    acc = [0.0] * n
    for delay in combs:
        d = [0.0] * n
        store = 0.0
        for i in range(n):
            out = d[i - delay]
            # One-pole lowpass INSIDE the loop: this is the absorption.
            store = out * (1 - damp) + store * damp
            d[i] = buf[i] + store * fb
        for i in range(n):
            acc[i] += d[i] * 0.125
    for delay, g in ((605, 0.7), (480, 0.7), (371, 0.7), (245, 0.7)):
        dl = max(32, int(delay * room))
        out = [0.0] * n
        for i in range(n):
            out[i] = -g * acc[i] + acc[i - dl] + g * out[i - dl]
        acc = out
    return [buf[i] * (1 - mix) + acc[i] * mix for i in range(n)]



# ------------------------------------------------------------------ bass ----
# A SEPARATE CHANNEL, not a deeper drum. The drums own the transient and the
# bass owns the sustain; trying to get both from one hit is what makes a mix
# sound like a synth patch rather than a rhythm section.
#
# Tuned to A1 = 55 Hz. Low enough to be felt, high enough that a phone speaker
# renders SOMETHING of it rather than nothing (the taiko-sub lesson: energy at
# 25 Hz is energy nobody hears).
A1 = 55.0
BASS_ROOT = A1


def bass_note(dur, f, f_from=None, gain=1.0, curve=1.6, lp=150):
    """A sub note, optionally gliding into pitch.

    Two detuned sines rather than one: a single sine at 55 Hz is a test tone,
    and the slow beating between a pair is most of what makes it read as an
    instrument. Lowpassed hard, because anything above ~150 Hz here fights the
    toms for the same space.
    """
    n = int(dur * SR)
    e = env(n, 0.008, dur * 0.75, curve)
    out = []
    p1 = p2 = 0.0
    for i in range(n):
        t = i / n
        # Glide is exponential, so it lands on pitch early and holds.
        fr = f if f_from is None else f + (f_from - f) * math.exp(-6.0 * t)
        p1 += 2 * math.pi * fr / SR
        p2 += 2 * math.pi * fr * 1.004 / SR
        out.append((math.sin(p1) + 0.7 * math.sin(p2)) * e[i] * gain * 0.5)
    return lowpass(out, lp)


def sidechain(buf, hit_times, depth=0.72, dur=0.3):
    """Duck the bass under every kick.

    Without this the sub and the kick occupy the same instant and the kick
    stops reading as an attack: you hear one muddy low event instead of a
    strike over a note. Ducking is what lets both exist. The recovery is
    exponential, which is what gives the bass its characteristic pump.
    """
    n = len(buf)
    gain = [1.0] * n
    w = int(dur * SR)
    for t in hit_times:
        start = int(t * SR)
        for i in range(w):
            k = (start + i) % n
            g = 1.0 - depth * math.exp(-4.0 * i / w)
            if g < gain[k]:
                gain[k] = g
    return [buf[i] * gain[i] for i in range(n)]


# Each mode is a different bass PART over the same drums, not a different tone.
BASS_MODES = {
    "drone": "Sustained root under the whole loop, swelling with the arc.",
    "808": "Pitched notes on the bar lines, dropping a fourth for the explode.",
    "swell": "One long breath: rises through the build, peaks on the drop, falls away.",
    "pulse": "A short note on every kick. The most rhythmic of the five.",
    "drop": "Silent until the explode, then a single sub fall. Maximum contrast.",
}


def bass_layer(seconds, mode, build_mode="riser", drop_mode="layers"):
    n = int(round(seconds * SR))
    buf = [0.0] * n
    bars = int(round(seconds / BAR))
    root, fourth = BASS_ROOT, BASS_ROOT * 0.75  # a fourth down for the drop

    for bar_i in range(bars):
        b = bar_i * BAR
        stage = bar_i % PHRASE_BARS
        if mode == "drone":
            g = (0.30, 0.42, 0.55, 0.85, 0.5)[stage]
            f = fourth if stage == 3 else root
            # Overlaps the next bar so there is no gap at the bar line.
            place(buf, bass_note(BAR * 1.15, f, gain=g, curve=0.5, lp=140), b, 1.0)
        elif mode == "808":
            g = (0.45, 0.65, 0.75, 1.0, 0.6)[stage]
            # WHERE THE DROP GOES. A fourth down is the default and reads as a
            # resolution; an octave down reads as the floor giving way, which
            # is a different feeling for the same beat.
            drop_f = root * 0.5 if drop_mode == "octave" else fourth
            f = drop_f if stage == 3 else root
            place(buf, bass_note(BAR * 0.8, f, f_from=f * 1.6, gain=g), b, 1.0)
            if stage >= 2 and stage != 3:
                place(buf, bass_note(BEAT * 1.2, f, gain=g * 0.5), b + BEAT * 2.5, 1.0)
            # A sub that FALLS through the drop rather than landing on it.
            if stage == 3 and drop_mode == "subfall":
                place(buf, bass_note(BAR * 1.4, root * 0.5, f_from=root * 3.0,
                                     gain=1.0, curve=0.8), b, 1.0)
            # The build bar's bass climbs instead of restating the root.
            if stage == 2 and build_mode == "sweep":
                place(buf, bass_note(BAR, root * 1.5, f_from=root,
                                     gain=g * 0.9, curve=0.4), b, 1.0)
        elif mode == "swell":
            g = (0.22, 0.4, 0.62, 0.95, 0.45)[stage]
            place(buf, bass_note(BAR * 1.2, root, gain=g, curve=0.35, lp=130), b, 1.0)
        elif mode == "pulse":
            g = (0.4, 0.55, 0.65, 0.9, 0.5)[stage]
            f = fourth if stage == 3 else root
            place(buf, bass_note(BEAT * 1.1, f, gain=g), b, 1.0)
            if stage >= 1:
                place(buf, bass_note(BEAT * 0.9, f, gain=g * 0.7), b + BEAT * 2, 1.0)
        elif mode == "drop":
            if stage == 3:
                # One event: a fall from well above the root down through it.
                place(buf, bass_note(BAR * 1.6, fourth, f_from=root * 2.6,
                                     gain=1.0, curve=0.9, lp=150), b, 1.0)
    return buf


def place(buf, sound, at_s, gain=1.0):
    """Mix a hit in, WRAPPING any tail past the end back to the head."""
    start = int(at_s * SR)
    n = len(buf)
    for i, v in enumerate(sound):
        buf[(start + i) % n] += v * gain


# ------------------------------------------------------------------ kits ----
# Each kit is a character, not a level. `space` is the reverb mix, which is what
# separates "in a room" from "in a booth".
KITS = {
    "pulse": dict(
        desc="Heartbeat. Kick and sub only, enormous space, almost nothing else.",
        space=0.34, decay=0.62, kick=(0.7, 105, 40, 1.0), tom=None,
        conga=None, shaker_div=0, riser=False, drop_layers=2,
    ),
    "deep": dict(
        desc="Slow low toms with air between them. No shaker at all.",
        space=0.30, decay=0.60, kick=(0.62, 100, 42, 0.95), tom=(0.9, 150, 70),
        conga=None, shaker_div=0, riser=True, drop_layers=3,
    ),
    "tribal": dict(
        desc="Hand drums forward, congas in 3-over-4, shaker on eighths.",
        space=0.22, decay=0.50, kick=(0.55, 110, 44, 0.9), tom=(0.5, 190, 95),
        conga=(0.9, 300), shaker_div=8, riser=True, drop_layers=3,
    ),
    "taiko": dict(
        desc="Big, wide, few hits. Every strike lands like a door closing.",
        space=0.38, decay=0.68, kick=(0.9, 130, 48, 1.0), tom=(1.1, 165, 72),
        conga=None, shaker_div=0, riser=True, drop_layers=3,
    ),
    "chest-hall": dict(
        desc="CHEST in a hall. Long damped reflections instead of a small hard room.",
        space=0.30, decay=0.60, kick=(0.85, 150, 58, 1.0), tom=(0.85, 210, 95),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.7, sat=2.0, hit_lp=2400,
        room=1.9, damp=0.52, open_beat="hit",
    ),
    "chest-open": dict(
        desc="CHEST in a hall, with the downbeat of the loop removed so it flows through.",
        space=0.30, decay=0.60, kick=(0.85, 150, 58, 1.0), tom=(0.85, 210, 95),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.7, sat=2.0, hit_lp=2400,
        room=1.9, damp=0.52, open_beat="none",
    ),
    "chest-soft": dict(
        desc="CHEST in a hall, opening beat at 42% so the seam is felt rather than struck.",
        space=0.30, decay=0.60, kick=(0.85, 150, 58, 1.0), tom=(0.85, 210, 95),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.7, sat=2.0, hit_lp=2400,
        room=1.9, damp=0.52, open_beat="soft",
    ),
    "chest-dry": dict(
        desc="CHEST barely wet. Almost no room at all, for a bed that sits under speech.",
        space=0.30, decay=0.60, kick=(0.85, 150, 58, 1.0), tom=(0.85, 210, 95),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.7, sat=1.8, hit_lp=2400,
        room=1.2, damp=0.60, open_beat="soft",
    ),
    "chest-cave": dict(
        desc="CHEST in a much larger, darker space. Heavy absorption, very long tail.",
        space=0.30, decay=0.60, kick=(0.85, 150, 58, 1.0), tom=(0.85, 210, 95),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.7, sat=1.7, hit_lp=2400,
        room=2.6, damp=0.66, open_beat="soft",
    ),
    "808-thunder": dict(
        desc="Broadband hits with a real chest. The scooped middle filled in.",
        space=0.30, decay=0.60, kick=(0.9, 120, 44, 1.0), tom=(0.9, 170, 80),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.55, sat=2.4, hit_lp=1500,
    ),
    "808-storm": dict(
        desc="Heaviest of the set. More noise body, more drive, longer decay.",
        space=0.34, decay=0.66, kick=(1.2, 135, 40, 1.0), tom=(1.2, 185, 76),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.8, sat=3.2, hit_lp=1900,
    ),
    "808-chest": dict(
        desc="Mid-forward. Less sub, more of the 200 to 800 band you feel in the ribs.",
        space=0.26, decay=0.55, kick=(0.85, 150, 58, 1.0), tom=(0.85, 210, 95),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.7, sat=2.8, hit_lp=2400,
    ),
    "808-deeproll": dict(
        desc="Slow sweep, long tail, minimal top. The most distant thunder.",
        space=0.40, decay=0.72, kick=(1.4, 100, 34, 1.0), tom=(1.4, 150, 62),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="808",
        thunder=True, body=0.5, sat=2.0, hit_lp=900,
    ),
    "808-roll": dict(
        desc="Accelerating tom roll into the drop. The gap closes and the ear sees it coming.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, bass="808",
        build_mode="roll", drop_mode="layers", drop_layers=3,
    ),
    "808-hush": dict(
        desc="Everything stops for a beat, then the drop lands out of silence.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, bass="808",
        build_mode="hush", drop_mode="layers", drop_layers=3,
    ),
    "808-sweep": dict(
        desc="The bass climbs a fifth through the build and gives way an octave on the drop.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, bass="808",
        build_mode="sweep", drop_mode="octave", drop_layers=3,
    ),
    "808-double": dict(
        desc="Riser in, then two impacts an eighth apart. The second confirms the first.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, bass="808",
        build_mode="riser", drop_mode="double", drop_layers=2,
    ),
    "808-fall": dict(
        desc="Roll in, and the sub FALLS through the drop instead of landing on it.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, bass="808",
        build_mode="roll", drop_mode="subfall", drop_layers=2,
    ),
    "808-hush-double": dict(
        desc="Silence, then a double impact. The most dramatic pairing of the six.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, bass="808",
        build_mode="hush", drop_mode="double", drop_layers=3,
    ),
    "sparse-drone": dict(
        desc="Sparse drums over a sustained root. The bass is the floor, the drums are events on it.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=False, drop_layers=2, bass="drone",
    ),
    "sparse-808": dict(
        desc="Sparse drums with pitched sub notes on the bar lines, dropping a fourth for the explode.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=False, drop_layers=2, bass="808",
    ),
    "sparse-swell": dict(
        desc="Sparse drums over one long bass breath that peaks on the drop.",
        space=0.32, decay=0.60, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, drop_layers=2, bass="swell",
    ),
    "sparse-pulse": dict(
        desc="Sparse drums with a short sub note on every kick. The most rhythmic of the bass set.",
        space=0.28, decay=0.55, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=False, drop_layers=2, bass="pulse",
    ),
    "sparse-drop": dict(
        desc="Sparse drums, no bass at all until the explode, then one sub fall. Maximum contrast.",
        space=0.32, decay=0.60, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=True, drop_layers=3, bass="drop",
    ),
    "taiko-odaiko": dict(
        desc="Odaiko. The lowest fundamental of the set and a very long ring. The biggest drum in the room.",
        space=0.42, decay=0.74, kick=(1.3, 95, 34, 1.0), tom=(1.5, 120, 52),
        conga=None, shaker_div=0, riser=True, drop_layers=3, res=0.55, lp=520,
    ),
    "taiko-hall": dict(
        desc="Same drum, much bigger room. The tail is most of what you hear.",
        space=0.58, decay=0.86, kick=(1.0, 120, 44, 1.0), tom=(1.2, 150, 66),
        conga=None, shaker_div=0, riser=True, drop_layers=3, res=0.34, lp=700,
    ),
    "taiko-sub": dict(
        desc="A sub layer under every strike, tuned to where a phone can actually move air.",
        # 30 Hz was the first guess and it was wasted energy: the resonance sits
        # at f1 * 0.85, so a 30 Hz fundamental rings at 25 Hz, under almost every
        # phone and laptop speaker. Measured, it had LESS usable sub than odaiko
        # despite the name. 52 Hz rings at 44 Hz, which small speakers reproduce.
        space=0.34, decay=0.66, kick=(1.1, 110, 52, 1.0), tom=(1.3, 135, 62),
        conga=None, shaker_div=0, riser=True, drop_layers=4, res=0.62, lp=460,
    ),
    "taiko-wide": dict(
        desc="Fewer strikes, maximum air. Two hits a bar and a long decay between them.",
        space=0.50, decay=0.80, kick=(1.4, 100, 36, 1.0), tom=(1.6, 128, 55),
        conga=None, shaker_div=0, riser=False, drop_layers=2, res=0.5, lp=560,
        sparse_hits=True,
    ),
    "taiko-shell": dict(
        desc="Woodier. More body in the mid, so the strike has grain as well as depth.",
        space=0.36, decay=0.70, kick=(1.0, 125, 46, 1.0), tom=(1.15, 175, 78),
        conga=None, shaker_div=0, riser=True, drop_layers=3, res=0.40, lp=1100,
        partials=(1.0, 1.47, 2.09, 2.78),
    ),
    "driver": dict(
        desc="Tighter and busier. Sixteenth shaker, dry, keeps a scroll moving.",
        space=0.14, decay=0.40, kick=(0.5, 115, 46, 0.95), tom=(0.42, 200, 100),
        conga=(0.7, 330), shaker_div=16, riser=True, drop_layers=3,
    ),
    "sparse": dict(
        desc="Two hits a bar and a lot of room. Lets the picture carry it.",
        space=0.30, decay=0.58, kick=(0.7, 100, 40, 0.9), tom=(0.7, 160, 78),
        conga=None, shaker_div=0, riser=False, drop_layers=2,
    ),
}


def build(seconds, kit_name):
    k = KITS[kit_name]
    n = int(round(seconds * SR))
    buf = [0.0] * n
    kick_times = []

    for bar_i in range(int(round(seconds / BAR))):
        b = bar_i * BAR
        stage = bar_i % PHRASE_BARS  # 0 sparse 1 stated 2 build 3 DROP 4 release
        kd, kf0, kf1, kg = k["kick"]
        RES = k.get("res", 0.0)
        LP = k.get("lp", 900)
        PART = k.get("partials", (1.0, 1.41))
        kick_gain = kg * (0.6, 0.85, 0.9, 1.0, 0.7)[stage]
        TH = k.get("thunder", False)
        HLP, BODY, SAT = k.get("hit_lp", 1500), k.get("body", 0.55), k.get("sat", 2.4)
        hit = (lambda d_, a, b_, sd=0: thunder_hit(d_, a, b_, BODY, HLP, SAT, sd)) if TH else \
              (lambda d_, a, b_, sd=0: membrane(d_, a, b_, noise=0.35, lp=LP,
                                                partials=PART, res=RES, res_dur=d_ * 3.0))
        # THE FIRST BEAT OF THE LOOP is the one the ear judges the seam by. A
        # full-strength strike at t=0 arrives on top of the previous lap's
        # decaying tail and reads as a restart rather than a continuation, which
        # is what "the first beat needs to go" describes. `open_beat` lets it be
        # dropped entirely, softened, or left alone.
        OPEN = k.get("open_beat", "hit")
        first = bar_i == 0
        if not (first and OPEN == "none"):
            g = kick_gain * (0.42 if (first and OPEN == "soft") else 1.0)
            place(buf, hit(kd, kf0, kf1, 3), b, g)
            kick_times.append(b)
        if stage >= 1 and not k.get("sparse_hits"):
            place(buf, hit(kd * 0.7, kf0, kf1, 5), b + BEAT * 2, kick_gain * 0.55)
            kick_times.append(b + BEAT * 2)

        # THE DOUBLE. Two impacts an eighth apart: the first lands, the second
        # confirms it. Reads harder than one hit at the same level.
        if stage == 3 and DROP == "double":
            for j in range(2):
                place(buf, membrane(kd * 1.1, kf0 * 1.15, kf1, noise=0.7, lp=LP + 400,
                                    partials=(1.0, 1.58, 2.3), res=RES, res_dur=kd * 3.0),
                      b + j * (BEAT * 0.5), 0.9 - 0.15 * j)

        if stage == 3:
            for j in range(k["drop_layers"]):
                place(buf, hit(kd * 1.25, kf0 * (1 + 0.22 * j), kf1, 11 + j), b,
                      0.9 - 0.16 * j)

        BUILD = k.get("build_mode", "riser")
        DROP = k.get("drop_mode", "layers")

        if k["riser"] and stage == 2 and BUILD in ("riser", "sweep"):
            place(buf, riser(1.5), b + BAR - 1.5, 1.0)

        # ACCELERANDO. Hits crowding together is the oldest tension device
        # there is, and it works because the ear extrapolates the gap closing
        # and expects the collision before it arrives.
        if stage == 2 and BUILD == "roll":
            t = b
            gap = BEAT * 0.75
            g = 0.28
            while t < b + BAR - 0.02:
                place(buf, membrane(0.26, 210, 105, noise=0.5, lp=LP * 1.8), t, g)
                gap *= 0.74
                g = min(0.85, g * 1.24)
                t += gap

        if k["tom"]:
            td, tf0, tf1 = k["tom"]
            if stage >= 1 and not k.get("sparse_hits"):
                place(buf, hit(td, tf0, tf1, 21), b + BEAT * 1.5, 0.42 + 0.09 * stage)
            if stage >= 2 or (k.get("sparse_hits") and stage >= 1):
                place(buf, membrane(td, tf0 * 0.8, tf1 * 0.82, noise=0.45, lp=LP * 1.6,
                                    res=RES * 0.5, res_dur=td * 2.2),
                      b + BEAT * (2 if k.get("sparse_hits") else 3.5), 0.40 + 0.09 * stage)
            if stage == 4:
                for j, g in enumerate((0.5, 0.6, 0.72, 0.82)):
                    place(buf, membrane(td * 0.7, tf0 * (1.25 - 0.12 * j), tf1, noise=0.5),
                          b + BEAT * 2 + j * (BEAT / 2), g)

        # THREE against the bar's FOUR. The polyrhythm is the groove; without it
        # this is a metronome with skins on.
        if k["conga"] and stage >= 2:
            cg, cf = k["conga"]
            g = cg * (0.55 if stage == 2 else 0.8)
            for k3 in range(3):
                place(buf, membrane(0.19, cf * (1.0 if k3 else 0.82), cf * 0.55,
                                    noise=0.8, lp=3200, curve=5.0), b + k3 * (BAR / 3), g)

        div = k["shaker_div"]
        if div and stage >= 1:
            sh = (0.0, 0.42, 0.62, 0.78, 0.4)[stage]
            step = div if stage >= 2 else 8
            for j in range(step):
                t = b + j * (BAR / step)
                if t >= seconds or j == 0:
                    continue
                place(buf, shaker(seed=int(t * 997)), t, sh * (1.0 if j % 2 else 0.55))

    # THE HUSH. Everything stops for the last beat of the build, so the drop
    # arrives out of silence. It is the most effective tension device available
    # and it costs nothing: the ear reads the gap as the held breath. Applied to
    # the DRY bed so the reverb tail cuts with it, which is what makes it read
    # as a stop rather than a duck.
    if k.get("build_mode") == "hush":
        for bar_i in range(int(round(seconds / BAR))):
            if bar_i % PHRASE_BARS != 2:
                continue
            b = bar_i * BAR
            s0, s1 = int((b + BAR - BEAT) * SR), int((b + BAR) * SR)
            for i in range(s0, min(s1, len(buf))):
                t = (i - s0) / max(1, s1 - s0)
                buf[i] *= max(0.0, 1.0 - t * 1.15)

    # TWO LAPS, KEEP THE SECOND. Adding a scaled copy of the tail back onto the
    # head is an approximation, and it showed: on the sparsest kits the seam
    # step was 105 and 218 against p99s of 81 and 161, an audible tick in the
    # quiet. Running the reverb across two laps and discarding the first means
    # the tail arriving at the loop point IS the tail that just left it, so
    # there is nothing to approximate. Busy kits hid this; silence exposes it.
    wet = reverb(buf + buf, mix=k["space"], decay=k["decay"],
                 room=k.get("room", 1.6), damp=k.get("damp", 0.45))
    buf = wet[len(buf):]

    # BASS IS ADDED AFTER THE REVERB, and stays dry. Sub through a room is mud:
    # the reverb tail smears the low end across the bar and the kick loses its
    # floor. Ducking it under every kick is what lets a strike still read as an
    # attack rather than merging with the note underneath it.
    if k.get("bass"):
        bass = sidechain(
            bass_layer(seconds, k["bass"], k.get("build_mode", "riser"),
                       k.get("drop_mode", "layers")),
            kick_times,
        )
        buf = [buf[i] + bass[i] * 0.55 for i in range(len(buf))]
    peak = max(abs(v) for v in buf) or 1.0
    # Gentle drive only. Normalising to the drop would duck every other bar to
    # make room for one hit, flattening the arc that is the point.
    pre = 1.15 / peak
    return [math.tanh(v * pre) * 0.8 for v in buf]


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(
            b"".join(struct.pack("<h", max(-32768, min(32767, int(v * 32767)))) for v in samples)
        )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", default="tribal", choices=sorted(KITS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--outdir", default="C:/zzz/_hex-promo/kits")
    a = ap.parse_args()
    bars = a.seconds / BAR
    if abs(bars - round(bars)) > 1e-9 or abs(bars / PHRASE_BARS - round(bars / PHRASE_BARS)) > 1e-9:
        raise SystemExit(
            f"{a.seconds}s is {bars:g} bars, not whole {PHRASE_BARS}-bar phrases at "
            f"{BPM:g} BPM. The loop would click or the arc would cut mid-build."
        )
    import os
    os.makedirs(a.outdir, exist_ok=True)
    for name in sorted(KITS) if a.all else [a.kit]:
        path = f"{a.outdir}/hex-drums-{name}.wav"
        write_wav(path, build(a.seconds, name))
        print(f"{path}  {a.seconds:g}s  {KITS[name]['desc']}")
