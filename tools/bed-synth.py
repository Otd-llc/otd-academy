"""Synthesised beds for the video furniture. No samples, no licence exposure.

WHY SYNTHESIS RATHER THAN A SAMPLE KIT. The first attempt built the bed from
CC0 workshop recordings -- anvil, hammer, relay, electrical arc -- and it was
correctly called "odd factory noise". The diagnosis, and it is worth keeping
because it explains the whole rewrite: those sources are unpitched or
inharmonically pitched, transient-heavy with nothing sustained binding them, and
semantically FACTORY rather than laboratory. The instructive counter-example is
the Netflix "ta-dum", which is also a struck real-world object -- a cabinet hit
with a ring -- but is TUNED and paired with a low harmonic bloom. The percussive
instinct was right; the missing thing was pitch.

Measured, and the reason this file exists at all: audio logos WITH a melody
score ~25% higher and are >50% more memorable than those without (Veritonic,
n>1,600, 48-hour recall). The old bed had no pitched content whatsoever.

Synthesising also removes the licence question completely. Several of the
obvious free libraries are traps: Sonatina is Sampling Plus 1.0, whose
advertising exclusion disqualifies a brand intro; the BBC library's "educational"
tier means YOU are a student, not that your product teaches; Salamander requires
attribution. None of that can bite a file made of arithmetic.

WHAT THE PARAMETERS ARE DRAWN FROM (all measured or primary):
  * 120 BPM. 2 bars = 4.000 s and 4 bars = 8.000 s with zero rounding, so every
    event sits on a sample-exact grid position. Also mid-scale on every emotion
    axis in a 3-tempo study (n=63): moderately positive, low tension. 150 BPM
    buys +0.68 happiness for +0.53 tension, the wrong trade for a course.
  * ~6 pitched events. Willingness-to-pay across logo length is an inverted U --
    3 and 9 tones both score below 6.
  * Tempo drives arousal, MODE drives mood, and they are independent. So the
    feel is chosen with the scale, never by speeding the piece up.
  * Mode ranking, forced-choice "which is happier": Ionian .83 > Mixolydian .64
    > Lydian .58 > Dorian .40 > Aeolian .34 > Phrygian .21.
  * Speech protection: consonants live at 1.5-4 kHz and carry the intelligibility
    while holding little energy, so the reverb TAIL is high-cut at 2 kHz. The
    dry sting can be as bright as it likes; the part that overlaps narration
    cannot.
  * The sub is a trap. Laptop speakers -- the actual delivery device, since
    KiCad is desktop-only -- roll off below ~150-200 Hz, so a 55 Hz fundamental
    is INAUDIBLE there while still consuming headroom and counting toward
    loudness normalisation, making the audible part quieter. Every sub here is
    rendered with explicit 2f and 3f partials so the pitch survives via the
    missing-fundamental effect.

THE ONE PLACE THE RESEARCH DISAGREED WITH ITSELF, left as a dial rather than
silently resolved: one line argues for a real cadence (mixolydian bVII-I opening,
root-position V-I closing) as maximum identity; another argues for pentatonic
with NO leading tone and no cadence, because "a cadence announces, and announcing
128 times is what makes people mute you". Both are defensible and they cannot
both be followed. `cadence` in each direction below picks one, and the set ships
examples of each so the choice is made by ear.

    python tools/bed-synth.py                    every direction, both pieces
    python tools/bed-synth.py --only mallet-warm
    python tools/bed-synth.py --list

ASCII only.
"""

import argparse
import json
import math
import os

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter

SR = 48000
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
BAR = BEAT * 4             # 2.0 s

# ---------------------------------------------------------------------------
# Scales. Semitone offsets from the tonic.
# ---------------------------------------------------------------------------
SCALES = {
    "ionian":     [0, 2, 4, 5, 7, 9, 11],   # happiest measured; has the leading tone
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],   # 2nd happiest, and UNRESOLVED (b7, no V-I pull)
    "pentatonic": [0, 2, 4, 7, 9],          # no leading tone, no tritone: nothing to resolve
    "dorian":     [0, 2, 3, 5, 7, 9, 10],   # minor-ish but not bleak
}

TONIC = 220.0  # A3. Fundamental sits in 200 Hz-1.5 kHz, which is what laptops reproduce.


def hz(scale, degree, octave=0):
    """Frequency of a scale degree, wrapping across octaves."""
    s = SCALES[scale]
    st = s[degree % len(s)] + 12 * (octave + degree // len(s))
    return TONIC * (2.0 ** (st / 12.0))


def env(n, attack=0.005, decay=None, tau=0.4):
    """Attack then exponential decay. The 5 ms floor on the attack is not taste:
    a waveform that starts at full amplitude is a step discontinuity, which is a
    broadband click."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    d = np.exp(-t / tau) if decay is None else decay
    return a * d


def fade_edges(x, ms=5.0):
    """>=5 ms fade on both ends of every element before it is summed. Cheap, and
    it removes the entire class of boundary clicks."""
    k = int(SR * ms / 1000)
    if len(x) < 2 * k or k < 2:
        return x
    w = np.linspace(0, 1, k)
    x = x.copy()
    x[:k] *= w
    x[-k:] *= w[::-1]
    return x


# ---------------------------------------------------------------------------
# VOICES
# ---------------------------------------------------------------------------

def marimba(f0, dur, kind="marimba"):
    """Modal synthesis, NOT FM.

    A marimba bar is deliberately tuned so its partials sit near 1 : 4 : 10;
    measured on real bars they land at about 1.00, 3.92, 9.24. Three modes is
    enough -- partials above the third are not deliberately tuned.

    The mallet transient is what separates this from a bell: a few ms of
    bandpassed noise at onset. Without it the result is a sine bell.
    """
    ratios, amps, taus = {
        "marimba":  ([1.0, 3.9, 9.2], [1.0, 0.35, 0.12], [0.55, 0.22, 0.10]),
        "xylophone": ([1.0, 3.0, 6.16], [1.0, 0.45, 0.20], [0.30, 0.14, 0.07]),
        "vibes":    ([1.0, 3.9, 9.2], [1.0, 0.28, 0.08], [2.2, 0.9, 0.4]),
    }[kind]
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for r, a, tau in zip(ratios, amps, taus):
        # tau scales with 1/f0: high notes really do die faster.
        out += a * np.sin(2 * np.pi * r * f0 * t) * np.exp(-t / (tau * (220.0 / f0)))
    # The mallet: 4 ms of noise through a 1-4 kHz bandpass.
    k = int(SR * 0.004)
    if k > 8:
        b, a = butter(2, [1000 / (SR / 2), 4000 / (SR / 2)], btype="band")
        click = lfilter(b, a, np.random.default_rng(0).normal(0, 1, k))
        out[:k] += click / (np.max(np.abs(click)) or 1) * 0.16
    if kind == "vibes":
        out *= 1.0 + 0.12 * np.sin(2 * np.pi * 5.5 * t)  # the rotating discs
    return fade_edges(out * env(n, attack=0.001, tau=99))


def fm_bell(f0, dur):
    """Chowning 2-op FM. The rule that matters: the index envelope must decay
    FASTER than the amplitude envelope -- bright at onset, near-pure sine in the
    tail. Reversed, it sounds like a kazoo."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ratio = 1.4                                   # non-integer => bell, not organ
    idx = 8.0 * np.exp(-t / (dur * 0.10))         # fast
    amp = np.exp(-t / (dur * 0.38))               # slow
    y = np.sin(2 * np.pi * f0 * t + idx * np.sin(2 * np.pi * ratio * f0 * t))
    return fade_edges(y * amp * np.clip(t / 0.002, 0, 1))


def pluck(f0, dur, rho=0.992):
    """Karplus-Strong. `N = fs/f0 - 0.5` -- the half sample accounts for the
    two-point averager's phase delay, and skipping it puts the note a few cents
    off, which is audible the moment it is layered against a tuned voice."""
    n = int(dur * SR)
    N = max(2, int(round(SR / f0 - 0.5)))
    rng = np.random.default_rng(int(f0) % 9973)
    # Lowpass the excitation: raw white noise reads as a rubber band.
    b, a = butter(2, 3000 / (SR / 2), btype="low")
    buf = lfilter(b, a, rng.normal(0, 1, N))
    buf /= np.max(np.abs(buf)) or 1
    out = np.zeros(n)
    hist = list(buf)
    for i in range(n):
        v = rho * 0.5 * (hist[-N] + hist[-N - 1]) if len(hist) > N else buf[i % N]
        hist.append(v)
        out[i] = v
    return fade_edges(out)


def pad(f0, dur, detune=0.02, mix=0.7, cutoff=(300, 4000)):
    """Seven detuned saws, additive so there is no aliasing at all, through a
    swept resonant lowpass. Offsets and gains are the measured JP-8000 values.

    Additive rather than a naive ramp: `2*(f*t % 1) - 1` aliases audibly, and
    the folded partials sweep DOWNWARD as pitch rises, which the ear catches
    instantly. Offline rendering has no reason to accept that.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR
    offs = [-0.11002313, -0.06288439, -0.01952356, 0.0, 0.01991221, 0.06216538, 0.10745242]
    g_centre = -0.55366 * mix + 0.99785
    g_side = -0.73764 * mix * mix + 1.2841 * mix + 0.044372
    rng = np.random.default_rng(7)
    out = np.zeros(n)
    for o in offs:
        f = f0 * (1.0 + o * detune)
        g = g_centre if o == 0.0 else g_side
        ph = rng.uniform(0, 2 * np.pi)             # free-running oscillators
        kmax = int((SR / 2) / f)
        saw = np.zeros(n)
        for k in range(1, min(kmax, 60) + 1):
            saw += np.sin(2 * np.pi * k * f * t + ph) / k
        out += g * saw
    out /= np.max(np.abs(out)) or 1
    # Swept lowpass, recomputed per block. A static filter loses the point.
    y = np.zeros(n)
    blk = 256
    for i in range(0, n, blk):
        u = i / max(1, n - 1)
        fc = cutoff[0] + (cutoff[1] - cutoff[0]) * u
        b, a = butter(2, min(fc, SR / 2 - 100) / (SR / 2), btype="low")
        y[i:i + blk] = lfilter(b, a, out[i:i + blk])
    return fade_edges(y * env(n, attack=0.08, tau=dur * 0.7))


def sine_click(f0, dur):
    """Two pure sines an octave apart plus a dry click. Nearly unwearable, and
    nearly unmemorable -- the hedge direction."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f0 * t) + 0.4 * np.sin(2 * np.pi * f0 * 0.5 * t)
    k = int(SR * 0.003)
    y[:k] += np.random.default_rng(1).normal(0, 0.5, k)
    return fade_edges(y * env(n, attack=0.001, tau=dur * 0.22))


def sub(f0, dur):
    """A sub that survives a laptop.

    Phase comes from INTEGRATING frequency. Writing sin(2*pi*f(t)*t) for a glide
    is the classic bug: the instantaneous frequency becomes f + t*df/dt, so the
    note lands at the wrong pitch and clicks.

    2f and 3f partials are explicit, because below ~150-200 Hz the delivery
    device reproduces nothing -- on a laptop these harmonics ARE the sub.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 + (f0 * 1.6 - f0) * np.exp(-t / 0.30)
    phase = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(phase) + 0.40 * np.sin(2 * phase) + 0.20 * np.sin(3 * phase)
    return fade_edges(y * env(n, attack=0.02, tau=dur * 0.45))


def noise_sweep(dur, lo=200, hi=8000):
    n = int(dur * SR)
    x = np.random.default_rng(3).normal(0, 1, n)
    y = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        u = i / max(1, n - 1)
        fc = lo * ((hi / lo) ** u)
        b, a = butter(2, min(fc, SR / 2 - 100) / (SR / 2), btype="high")
        y[i:i + blk] = lfilter(b, a, x[i:i + blk])
    return fade_edges(y * env(n, attack=0.15, tau=dur * 0.3) * 0.5)


# ---------------------------------------------------------------------------
# ROOM
# ---------------------------------------------------------------------------

def synth_ir(rt60=1.3, predelay=0.022):
    """A synthesised impulse response, so no IR library's terms apply.

    tau = RT60 / 6.91 (-60 dB is ln(1000) time constants). Decay is made
    FREQUENCY DEPENDENT -- high bands decay at ~0.4x the low band -- which is the
    single thing that stops a synthetic IR sounding like a noise gate. Early
    reflections are randomly spaced; regular spacing combs.
    """
    n = int(SR * (rt60 + predelay))
    t = np.arange(n) / SR
    rng = np.random.default_rng(11)
    out = np.zeros(n)
    bands = [(80, 400, 1.0), (400, 1600, 0.7), (1600, 6000, 0.4)]
    for lo, hi, k in bands:
        b, a = butter(2, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype="band")
        band = lfilter(b, a, rng.normal(0, 1, n))
        out += band * np.exp(-t / ((rt60 * k) / 6.91))
    pre = int(predelay * SR)
    out[:pre] = 0.0
    for _ in range(9):
        i = pre + int(rng.uniform(0.002, 0.055) * SR)
        if i < n:
            out[i] += rng.uniform(0.2, 0.55) * rng.choice([-1, 1])
    return out / (np.max(np.abs(out)) or 1)


def room(x, rt60, wet=0.28, hicut=2000):
    """Convolve, HIGH-CUT THE WET RETURN, and never truncate the tail.

    The tail is high-cut at 2 kHz so it cannot mask consonants (1.5-4 kHz),
    which are the low-energy, high-information part of speech that the narration
    immediately after depends on.

    Truncating a convolution to the dry length guillotines the tail, which is the
    signature "generated by a script" artifact. The full length is kept and the
    caller trims WITH a fade.
    """
    ir = synth_ir(rt60)
    w = fftconvolve(x, ir)[: len(x) + len(ir) - 1]
    b, a = butter(2, hicut / (SR / 2), btype="low")
    w = lfilter(b, a, w)
    w /= np.max(np.abs(w)) or 1
    out = np.zeros(len(w))
    out[: len(x)] += x
    out += w * wet
    return out


# ---------------------------------------------------------------------------
# DIRECTIONS
# ---------------------------------------------------------------------------
# `voice` picks the pitched timbre. `scale` picks the mood (independent of tempo,
# which is fixed). `cadence` decides whether the piece resolves -- the one place
# the research disagreed with itself, so both are shipped.

DIRECTIONS = {
    "mallet-warm":   dict(voice="marimba",  scale="pentatonic", pad=True,  cadence=False, sub=True,  rt60=1.3,
                          desc="Marimba figure over a warm pad. The safest default: mallet decay is fast, so nothing sustains in the speech band."),
    "mallet-dry":    dict(voice="marimba",  scale="pentatonic", pad=False, cadence=False, sub=False, rt60=0.9,
                          desc="The same figure with no pad and a small room. Nearly nothing to wear out."),
    "mallet-cadence": dict(voice="marimba", scale="mixolydian", pad=True,  cadence=True,  sub=True,  rt60=1.3,
                          desc="Mallets, but resolving. Tests the cadence side of the disagreement."),
    "xylo-bright":   dict(voice="xylophone", scale="pentatonic", pad=True, cadence=False, sub=False, rt60=1.0,
                          desc="Harder, brighter mallet. More crisp, less warm."),
    "vibes-soft":    dict(voice="vibes",    scale="ionian",     pad=True,  cadence=True,  sub=True,  rt60=1.6,
                          desc="Vibraphone with its tremolo. Longer sustain -- the wear-out risk is real here."),
    "bell-glass":    dict(voice="fm_bell",  scale="mixolydian", pad=False, cadence=False, sub=False, rt60=1.2,
                          desc="Glassy FM bell. Instrument-grade and faintly cold."),
    "bell-warm":     dict(voice="fm_bell",  scale="ionian",     pad=True,  cadence=True,  sub=True,  rt60=1.5,
                          desc="The same bell with a pad under it, resolving."),
    "pluck-open":    dict(voice="pluck",    scale="pentatonic", pad=True,  cadence=False, sub=False, rt60=1.2,
                          desc="Plucked string, harp-like. Light and approachable."),
    "pluck-dorian":  dict(voice="pluck",    scale="dorian",     pad=True,  cadence=False, sub=True,  rt60=1.4,
                          desc="The same pluck in dorian. Cooler, more considered."),
    "sine-minimal":  dict(voice="sine_click", scale="pentatonic", pad=False, cadence=False, sub=False, rt60=0.8,
                          desc="Two sines and a click. Essentially unwearable, and close to unmemorable -- the hedge."),
    "sine-sub":      dict(voice="sine_click", scale="mixolydian", pad=True, cadence=False, sub=True,  rt60=1.1,
                          desc="Minimal, but with a pad and sub so it has some body."),
    "pad-only":      dict(voice=None,       scale="ionian",     pad=True,  cadence=False, sub=True,  rt60=1.8,
                          desc="No melody at all -- the control. Measured to score ~25% worse; here to hear that."),
}

VOICES = {"marimba": lambda f, d: marimba(f, d, "marimba"),
          "xylophone": lambda f, d: marimba(f, d, "xylophone"),
          "vibes": lambda f, d: marimba(f, d, "vibes"),
          "fm_bell": fm_bell, "pluck": pluck, "sine_click": sine_click}

# bars, and where the payoff lands. Read off the retimed furniture.
PIECES = {
    "intro": dict(bars=2, payoff=BAR * 1),   # t=2.0, where the three names arrive
    "outro": dict(bars=4, payoff=BAR * 3),   # t=6.0, where the jaws close
}


def figure(d, piece):
    """The pitched events. About six of them -- the measured optimum, with 3 and
    9 both scoring worse.

    The APPROACH is humanised by a few ms; the PAYOFF is exactly on the grid and
    is the loudest event. That contrast is what reads as intentional rather than
    as a sequencer.
    """
    scale, cad = d["scale"], d["cadence"]
    rng = np.random.default_rng(5)
    if piece == "intro":
        degrees = [0, 2, 4, 6] if cad else [0, 2, 4]
        onsets = [BEAT * i for i in range(len(degrees))]
        land_deg = 4 if cad else 4          # bVII->I resolves onto the tonic above
    else:
        degrees = [0, 2, 4, 2, 4, 7] if cad else [0, 2, 4, 2, 4]
        onsets = [BEAT * i for i in (0, 1, 2, 5, 6, 8)][: len(degrees)]
        land_deg = 7 if cad else 4
    ev = [(o + float(rng.uniform(-0.010, 0.010)), g, 0.55) for o, g in zip(onsets, degrees)]
    ev.append((PIECES[piece]["payoff"], land_deg, 1.0))   # dead on grid, loudest
    return [(t, hz(scale, g, 0), a) for t, g, a in ev]


def build(name, piece):
    d = DIRECTIONS[name]
    p = PIECES[piece]
    seconds = BAR * p["bars"]
    n = int(seconds * SR)
    buf = np.zeros(n)

    if d["voice"]:
        vf = VOICES[d["voice"]]
        for onset, f, amp in figure(d, piece):
            dur = min(1.8, seconds - onset)
            if dur <= 0.05:
                continue
            v = vf(f, dur) * amp
            i = int(onset * SR)
            buf[i:i + len(v)] += v[: max(0, n - i)]

    if d["pad"]:
        pv = pad(hz(d["scale"], 0, -1), seconds) * 0.30
        buf += pv[:n]

    if d["sub"]:
        # Under the payoff only. On the intro it is shorter, so the tail is gone
        # before the first phoneme of narration.
        s = sub(55.0, min(2.2, seconds - p["payoff"])) * 0.42
        i = int(p["payoff"] * SR)
        buf[i:i + len(s)] += s[: max(0, n - i)]

    buf /= np.max(np.abs(buf)) or 1
    wet = room(buf, d["rt60"])

    # THE TAIL IS FADED, NOT CUT. The piece is exactly `seconds` long because the
    # picture is, so the reverb has to be brought down rather than guillotined --
    # an abrupt reverb cut is the signature script artifact.
    out = wet[:n].copy()
    tail = int(min(0.35, seconds * 0.12) * SR)
    out[-tail:] *= np.linspace(1, 0, tail) ** 1.5

    if piece == "intro":
        # 300-500 ms of near-silence before narration. Forward masking decays
        # over ~100-200 ms, so this puts the first phoneme safely clear.
        q = int(0.42 * SR)
        out[-q:] *= np.linspace(1, 0, q) ** 2.0

    # Master high-pass at 30 Hz: nothing below is audible on any target device
    # and it only costs headroom. Also removes accumulated DC.
    b, a = butter(2, 30 / (SR / 2), btype="high")
    out = lfilter(b, a, out)

    peak = np.max(np.abs(out)) or 1.0
    return np.tanh(out * (1.05 / peak)) * 0.80


def write_wav(path, x):
    import wave
    import struct
    d = np.clip(x, -1, 1)
    pcm = (d * 32767).astype(np.int16)
    w = wave.open(path, "wb")
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(struct.pack("<%dh" % len(pcm), *pcm))
    w.close()


if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, choices=sorted(DIRECTIONS))
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--out-dir", default=os.path.join(here, "public", "_beds"))
    a = ap.parse_args()

    if a.list:
        for k, v in sorted(DIRECTIONS.items()):
            print(f"  {k:16s} {v['scale']:11s} cadence={str(v['cadence']):5s}  {v['desc']}")
        raise SystemExit

    os.makedirs(a.out_dir, exist_ok=True)
    names = [a.only] if a.only else sorted(DIRECTIONS)
    for name in names:
        for piece in PIECES:
            x = build(name, piece)
            path = os.path.join(a.out_dir, f"{piece}-bed-{name}.wav")
            write_wav(path, x)
            rms = float(np.sqrt(np.mean(x ** 2)))
            print(f"  {piece:5s} {name:16s} {len(x)/SR:5.3f}s  peak {np.max(np.abs(x)):.3f}  rms {rms:.4f}")

    beds = {}
    for fn in sorted(os.listdir(a.out_dir)):
        if not fn.endswith(".wav"):
            continue
        stem = fn[:-4]
        for piece in PIECES:
            pre = f"{piece}-bed-"
            if stem.startswith(pre):
                kit = stem[len(pre):]
                beds.setdefault(piece, []).append(dict(
                    kit=kit, file=fn, bars=PIECES[piece]["bars"],
                    seconds=BAR * PIECES[piece]["bars"],
                    landings=[PIECES[piece]["payoff"]],
                    desc=DIRECTIONS.get(kit, {}).get("desc", ""),
                ))
    with open(os.path.join(a.out_dir, "index.json"), "w", encoding="ascii") as fh:
        json.dump(dict(bpm=int(BPM), beat=BEAT, bar=BAR, pieces=beds), fh, indent=2)
    print(f"\n  manifest: {sum(len(v) for v in beds.values())} beds")
