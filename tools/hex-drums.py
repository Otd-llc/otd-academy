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


def reverb(buf, mix=0.25, decay=0.55):
    """Schroeder: parallel combs into series allpasses.

    Nothing in nature is dry, and dryness was most of why the first bed sounded
    synthetic. The tail WRAPS to the head of the buffer, so the room does not
    truncate at the loop point.
    """
    n = len(buf)
    combs = [(1687, 0.805), (1601, 0.827), (2053, 0.783), (2251, 0.764)]
    acc = [0.0] * n
    for delay, fb in combs:
        g = fb * decay
        d = [0.0] * n
        for i in range(n):
            d[i] = buf[i] + g * d[i - delay]
        for i in range(n):
            acc[i] += d[i] * 0.25
    for delay, g in ((347, 0.7), (113, 0.7)):
        out = [0.0] * n
        for i in range(n):
            out[i] = -g * acc[i] + acc[i - delay] + g * out[i - delay]
        acc = out
    return [buf[i] * (1 - mix) + acc[i] * mix for i in range(n)]


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

    for bar_i in range(int(round(seconds / BAR))):
        b = bar_i * BAR
        stage = bar_i % PHRASE_BARS  # 0 sparse 1 stated 2 build 3 DROP 4 release
        kd, kf0, kf1, kg = k["kick"]
        RES = k.get("res", 0.0)
        LP = k.get("lp", 900)
        PART = k.get("partials", (1.0, 1.41))
        kick_gain = kg * (0.6, 0.85, 0.9, 1.0, 0.7)[stage]
        place(buf, membrane(kd, kf0, kf1, noise=0.35, lp=LP, partials=PART,
                            res=RES, res_dur=kd * 3.0), b, kick_gain)
        if stage >= 1 and not k.get("sparse_hits"):
            place(buf, membrane(kd * 0.7, kf0, kf1, noise=0.3, lp=LP, partials=PART,
                                res=RES * 0.6, res_dur=kd * 2.0),
                  b + BEAT * 2, kick_gain * 0.55)

        if stage == 3:
            for j in range(k["drop_layers"]):
                place(buf, membrane(kd * 1.2, kf0 * (1 + 0.25 * j), kf1, noise=0.7,
                                    lp=LP + 500 * j, partials=(1.0, 1.58, 2.3),
                                    res=RES * (1.0 if j == 0 else 0.0),
                                    res_dur=kd * 4.0), b, 0.85 - 0.18 * j)

        if k["riser"] and stage == 2:
            place(buf, riser(1.5), b + BAR - 1.5, 1.0)

        if k["tom"]:
            td, tf0, tf1 = k["tom"]
            if stage >= 1 and not k.get("sparse_hits"):
                place(buf, membrane(td, tf0, tf1, noise=0.45, lp=LP * 1.6, res=RES * 0.5,
                                    res_dur=td * 2.2), b + BEAT * 1.5, 0.42 + 0.09 * stage)
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

    # TWO LAPS, KEEP THE SECOND. Adding a scaled copy of the tail back onto the
    # head is an approximation, and it showed: on the sparsest kits the seam
    # step was 105 and 218 against p99s of 81 and 161, an audible tick in the
    # quiet. Running the reverb across two laps and discarding the first means
    # the tail arriving at the loop point IS the tail that just left it, so
    # there is nothing to approximate. Busy kits hid this; silence exposes it.
    wet = reverb(buf + buf, mix=k["space"], decay=k["decay"])
    buf = wet[len(buf):]
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
