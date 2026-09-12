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
    "aeolian":    [0, 2, 3, 5, 7, 8, 10],   # natural minor; measured .34 on "happier"
    "phrygian":   [0, 1, 3, 5, 7, 8, 10],   # darkest measured (.21); the b2 is the whole colour
    "lydian":     [0, 2, 4, 6, 7, 9, 11],   # the #4 reads as film-score wonder
    "minor_pent": [0, 3, 5, 7, 10],         # no semitones at all; nothing to resolve
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
    zi = None
    for i in range(0, n, blk):
        u = i / max(1, n - 1)
        fc = cutoff[0] + (cutoff[1] - cutoff[0]) * u
        b, a = butter(2, min(fc, SR / 2 - 100) / (SR / 2), btype="low")
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)
        y[i:i + blk], zi = lfilter(b, a, out[i:i + blk], zi=zi)
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
    # Stupacher et al. (2016) shifted a bass drum's peak between 40 Hz and
    # 140 Hz with everything else fixed: the LOWER one was rated higher in
    # groove and people tapped HARDER with it. And Cameron et al. (2022) cycled
    # 8-37 Hz speakers on and off through a live concert -- movement rose 11.8%
    # when they were on, while a psychophysical follow-up showed the content was
    # undetectable. Low energy earns its place even when nobody can hear it.
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
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)
        y[i:i + blk], zi = lfilter(b, a, x[i:i + blk], zi=zi)
    return fade_edges(y * env(n, attack=0.15, tau=dur * 0.3) * 0.5)



# ---------------------------------------------------------------------------
# PERCUSSION AND BASS
#
# The owner's direction, and it is the synthesis the research actually pointed
# at: the FIRST bed was percussive and failed because it was unpitched, not
# because it was percussive. Netflix's "ta-dum" is a struck cabinet -- the
# percussive instinct was right, the missing thing was pitch. So these carry the
# figure IN the bass and IN tuned membranes, and the transients stay.
#
# Everything below is mixolydian by construction: the scale is passed in, and
# mixolydian's b7 means there is no leading tone and so no V-I pull. It arrives
# without concluding, which is what a piece that hands over to speech wants.
# ---------------------------------------------------------------------------

def kick(dur=0.5, f_nom=55.0, accent=1.0, body=True):
    """A drum, built the way the TR-808 actually builds one.

    THE PUNCH IS A ~6 ms CHIRP, and this is the finding that matters most. The
    808 raises its filter centre frequency by MORE THAN AN OCTAVE during attack
    -- measured 49.4 Hz nominal peaking near 130 Hz, a 2.63x ratio -- and it
    settles in about 6 ms. That is less than a single period at the top
    frequency, so it is NOT heard as a pitch glide; it is heard purely as
    impact. The DAFx paper is explicit that this is what makes the attack
    "punchier and crisper".

    Most synthesised kicks sweep a few semitones over 40-80 ms, which IS heard as
    a glide, and that is exactly why they sound like a synth rather than a drum.
    The previous version of this function did that.

    AND THE CHIRP IS WHY AN 808 SURVIVES A LAPTOP. The 56 Hz fundamental is
    below the ~200 Hz roll-off and inaudible there, but the ~130 Hz attack peak
    is not. The punch translates even when the weight cannot.

    THE RETRIGGER PULSE. A few ms in, when the frequency drops back to nominal,
    most of the energy at that frequency has already decayed -- leaving an
    audible hole between attack and body, which reads as "thin" or as two sounds
    stuck together. The 808 fires a second, smaller excitation to bridge it.

    THE PITCH SIGH. Leakage gives a continuous gentle downward drift across the
    whole note (measured: ~58 Hz settling toward 49.5 Hz over ~150 ms). A
    perfectly constant pitch is a giveaway.

    ACCENT IS NOT A VOLUME CONTROL. Verbatim from the service manual: with
    accent the time constant is halved and the filter "has a resonance on twice
    its inherent frequency for a half cycle period". So accent changes FREQUENCY
    and decay as well as amplitude -- and the amplitude change is +9 to +10.5 dB,
    not the 2-3 dB most programmers use.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR

    # Accent doubles the resonance for the first half cycle and shortens the
    # time constant; both are in the manual, neither is a volume change.
    acc = float(np.clip(accent, 0.0, 1.0))
    half_cycle = 0.5 / f_nom
    f = np.full(n, f_nom)
    f[t < half_cycle] *= 1.0 + acc          # -> 2f under full accent

    # The 6 ms chirp. tau chosen so it has settled by ~6 ms (3 tau).
    f = f + (f_nom * 1.63) * np.exp(-t / 0.0021)
    # The sigh: a few percent of downward drift over ~150 ms, on top.
    f = f * (1.0 + 0.055 * np.exp(-t / 0.15))

    ph = 2 * np.pi * np.cumsum(f) / SR
    decay = dur * (0.22 + 0.10 * (1.0 - acc))   # accent shortens the tail
    out = np.sin(ph) * np.exp(-t / decay)

    # The retrigger pulse, bridging the gap between attack and body.
    i = int(0.004 * SR)
    if i < n:
        out[i:] += 0.42 * np.sin(ph[: n - i]) * np.exp(-t[: n - i] / (decay * 0.7))

    # THE BODY LAYER, 200-800 Hz. This is the hole the beds had: sub is
    # inaudible on a laptop and the click sat at 1.2-6 kHz, which is stick
    # territory, so nothing occupied the band where a real drum's audible weight
    # actually lives. A real bass drum generates scores of partials between
    # 250 Hz and 1 kHz; that is not a compromise for small speakers, it is
    # closer to the instrument.
    if body:
        bt = np.exp(-t / (dur * 0.16))
        for fb, g in ((f_nom * 4.2, 0.78), (f_nom * 7.4, 0.46), (f_nom * 11.0, 0.24)):
            out += g * np.sin(2 * np.pi * fb * t) * bt

    # The first 5-10 ms carries most of what the ear reads as punch. A hard step
    # IS a click -- it does not need a separate noise layer to exist, only to be
    # coloured.
    k = int(SR * 0.004)
    out[:k] += np.random.default_rng(2).normal(0, 0.22, k) * np.linspace(1, 0, k)

    return fade_edges(out * (0.30 + 0.70 * acc))   # +10.5 dB, per the manual


def rim(dur=0.09, band=(250, 2000), f0=None, seed=4, decay=None):
    """One routine, many drums -- separated by DECAY, not by filter.

    The 808 gives its high tom and its low conga IDENTICAL frequencies
    (165/185/220 Hz) and distinguishes them only by decay time, 100 ms against
    180 ms. That is a direct proof that decay carries instrument identity, and
    the reason this takes a decay argument at all.

    THE BAND MOVED DOWN, and that was the biggest single error in the old beds.
    1.2-6 kHz is stick-and-hat territory; almost the entire 808 kit sits BELOW
    2.5 kHz. A click up there cannot read as a drum no matter what it plays.

    A second, non-octave partial is the cheapest way to make one routine sound
    like a different object -- the 808 rimshot is two bands (1667 + 455 Hz) and
    the cowbell is two squares (800 + 540).
    """
    n = int(dur * SR)
    lo, hi = band
    b, a = butter(2, [max(lo, 20) / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype="band")
    # Pink-ish noise: the -3 dB/oct tilt puts energy where membrane modes are.
    w = np.random.default_rng(seed).normal(0, 1, n)
    w = lfilter([0.049922, -0.095993, 0.050612, -0.004408], [1, -2.494956, 2.017265, -0.522189], w)
    x = lfilter(b, a, w)
    x = x / (np.max(np.abs(x)) or 1)
    tau = (decay if decay is not None else dur * 0.18)
    t = np.arange(n) / SR
    if f0:
        # Inharmonic pair, after the rimshot/cowbell: a non-octave second
        # partial reads as a different object rather than a transposed one.
        x = x * 0.5 + (np.sin(2 * np.pi * f0 * t) + 0.55 * np.sin(2 * np.pi * f0 * 3.66 * t)) \
            * np.exp(-t / tau) * 0.7
    return fade_edges(x * env(n, attack=0.0005, tau=tau))


def clap(dur=0.30):
    """The 808 handclap, fully specified by the service manual and circuit
    analysis: a 30 ms window holding THREE sawtooth-envelope bursts at 10 ms
    spacing, then a final 20 ms discharge, all through a 1 kHz bandpass, with a
    parallel decay-only tail of ~100 ms.

    Four envelope stages simulating several people clapping slightly out of
    time. It costs ten lines and sounds nothing like a click.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(21)
    src = rng.normal(0, 1, n)
    b, a = butter(2, [700 / (SR / 2), 1500 / (SR / 2)], btype="band")
    src = lfilter(b, a, src)
    out = np.zeros(n)
    for j in range(3):
        i = int(j * 0.010 * SR)
        seg = int(0.010 * SR)
        if i + seg < n:
            out[i:i + seg] += src[i:i + seg] * np.linspace(1.0, 0.0, seg)
    i = int(0.030 * SR)
    out[i:] += src[i:] * np.exp(-t[: n - i] / 0.020)
    out += src * np.exp(-t / 0.100) * 0.35        # the parallel tail
    return fade_edges(out / (np.max(np.abs(out)) or 1))


def bass_sine(f0, dur):
    """Sub with explicit 2f and 3f partials, percussive envelope.

    Laptops -- the delivery device, KiCad being desktop-only -- reproduce almost
    nothing below ~150-200 Hz, so on the actual audience's hardware the HARMONICS
    are the bass. The fundamental is for headphones."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f0 * t
    y = np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.22 * np.sin(3 * ph)
    return fade_edges(y * env(n, attack=0.004, tau=dur * 0.34))


def bass_saw(f0, dur, res=(90, 700)):
    """Filtered saw bass. Additive so nothing aliases -- a naive ramp folds
    partials that sweep DOWNWARD as pitch rises, which the ear catches at once."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    kmax = min(int((SR / 2) / f0), 48)
    saw = sum(np.sin(2 * np.pi * k * f0 * t) / k for k in range(1, kmax + 1))
    saw /= np.max(np.abs(saw)) or 1
    # THE FILTER STATE IS CARRIED ACROSS BLOCKS. Without `zi` every 256-sample
    # block restarts the filter from zero, which is a discontinuity every 5.3 ms
    # -- a buzz at the block rate. It was inaudible against a lowpassed bass but
    # it is still wrong, and it would not stay inaudible on a brighter voice.
    #
    # THE CEILING CAME DOWN from 1400 Hz to 700. The click already lives at
    # 250-2000 Hz; a bass whose filter opens to 1400 competes with it directly,
    # and two sources fighting in the same band is what reads as harsh.
    y = np.zeros(n); blk = 256
    zi = None
    for i in range(0, n, blk):
        u = i / max(1, n - 1)
        fc = res[1] + (res[0] - res[1]) * u        # opens then closes
        b, a = butter(3, min(max(fc, 60), SR / 2 - 100) / (SR / 2), btype="low")
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)
        y[i:i + blk], zi = lfilter(b, a, saw[i:i + blk], zi=zi)
    return fade_edges(y * env(n, attack=0.006, tau=dur * 0.38))


def bass_fm(f0, dur):
    """FM bass: a metallic bite on the attack over a pitched body. The index
    decays far faster than the amplitude, which is what makes it a struck bass
    rather than a synth pad."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    # Index reduced from 5.0: at 5 the sidebands put 16.7% of the voice into
    # 500-1500 Hz, which is the click's band. A bass has no business there.
    idx = 2.2 * np.exp(-t / (dur * 0.06))
    y = np.sin(2 * np.pi * f0 * t + idx * np.sin(2 * np.pi * 2.0 * f0 * t))
    return fade_edges(y * env(n, attack=0.002, tau=dur * 0.30))


def bass_pluck(f0, dur):
    """Short Karplus-Strong in the bass register.

    MEASURED AND CORRECTED: the first version was 52.7% energy in 1.5-4 kHz and
    1.3% below 200 Hz -- not a bass at all, a bright treble instrument sitting
    exactly on top of the click. Karplus-Strong's noise excitation is broadband
    and the loop filter alone does not remove enough of it, so the output is
    lowpassed to keep the voice in the register its name claims.
    """
    x = pluck(f0, min(dur, 0.9), rho=0.975)
    b, a = butter(4, 320 / (SR / 2), btype="low")
    x = lfilter(b, a, x)
    return x / (np.max(np.abs(x)) or 1)


def tuned_tom(f0, dur):
    """A membrane that carries pitch: a sine dropping a fourth into the note,
    plus a noise transient. The percussion IS the melody here."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1.0 + 0.34 * np.exp(-t / 0.045))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.30 * np.sin(2 * ph)
    k = int(SR * 0.004)
    y[:k] += np.random.default_rng(6).normal(0, 0.30, k)
    return fade_edges(y * env(n, attack=0.001, tau=dur * 0.26))


def stab(f0, dur):
    """A short resonant stab -- pitched, but with a percussion envelope."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    kmax = min(int((SR / 2) / f0), 40)
    x = sum(np.sin(2 * np.pi * k * f0 * t) / (k ** 1.2) for k in range(1, kmax + 1))
    x /= np.max(np.abs(x)) or 1
    b, a = butter(4, min(f0 * 6, SR / 2 - 100) / (SR / 2), btype="low")
    return fade_edges(lfilter(b, a, x) * env(n, attack=0.002, tau=dur * 0.16))


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


# ---------------------------------------------------------------------------
# REAL ROOMS
#
# WHY THIS REPLACES THE SYNTHESISED IR. The verdict on the previous beds was
# "amateur MIDI from 1985", and that is substantially what the method was:
# instruments built from scratch in numpy, every hit byte-identical, and a
# reverb made of shaped noise. All three are period-correct for 1985 hardware.
#
# A synthesised IR gives you a decay envelope. A recorded one gives you the
# modal structure of an actual space -- the early reflections off real surfaces
# at real distances, and the frequency-dependent absorption of real materials.
# It is the single cheapest thing that stops a bed sounding assembled, and the
# library already carried six of them, CC0, unused.
# ---------------------------------------------------------------------------

ROOMS = {
    "church":  ("579154", "Clap at Two Church 1 -- the largest space here."),
    "church2": ("579205", "Clap at Two Church 6 -- same room, different position."),
    "kitchen": ("579163", "One Church Kitchen -- smaller, harder surfaces."),
    "couch":   ("843704", "Echo pop, couch position -- small and damped."),
    "desk":    ("843705", "Desk chair position -- the driest of the six."),
    "untreated": ("843706", "Untreated kitchen -- boxy, and honest about it."),
}

_IR_CACHE = {}


def real_ir(name="church", rt_scale=1.0, hicut=2000):
    """Load a recorded impulse response.

    The wet return is still high-cut: consonants live at 1.5-4 kHz and carry the
    intelligibility of the narration that follows, so the TAIL must not reach
    into that band however real the room is.
    """
    key = (name, rt_scale, hicut)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    sid, _ = ROOMS[name]
    x = load_sample("ir", sid)
    if x is None:
        _IR_CACHE[key] = synth_ir()
        return _IR_CACHE[key]
    x = x.copy()
    if rt_scale != 1.0:                       # shorten a big room without re-recording it
        t = np.arange(len(x)) / SR
        x *= np.exp(-t / max(0.05, (len(x) / SR) * rt_scale / 6.91))
    b, a = butter(2, hicut / (SR / 2), btype="low")
    x = lfilter(b, a, x)
    x /= np.max(np.abs(x)) or 1
    _IR_CACHE[key] = x
    return x


def room(x, rt60, wet=0.28, hicut=2000, ir_name=None):
    """Convolve, HIGH-CUT THE WET RETURN, and never truncate the tail.

    The tail is high-cut at 2 kHz so it cannot mask consonants (1.5-4 kHz),
    which are the low-energy, high-information part of speech that the narration
    immediately after depends on.

    Truncating a convolution to the dry length guillotines the tail, which is the
    signature "generated by a script" artifact. The full length is kept and the
    caller trims WITH a fade.
    """
    ir = real_ir(ir_name, rt_scale=rt60 / 1.3) if ir_name else synth_ir(rt60)
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

# ---------------------------------------------------------------------------
# THE 16TH GRID
#
# A beat written as a string, one character per 16th note, 16 per bar:
#
#     X   accent      full weight
#     x   normal
#     o   ghost       the quiet hits that make a pattern feel played
#     .   rest
#
# WHY A GRID AND NOT THE GENERATOR FUNCTIONS IT REPLACES. The generators could
# express meter changes and phasing, and produced things that were rhythmically
# interesting and did not groove. A beat is not a distribution of onsets; it is
# a small number of onsets with the RIGHT ACCENTS. With two sounds, accent is
# most of the expressive range available, so the notation has to carry it.
#
# MICROTIMING IS PART OF THE PATTERN, not a post-process. `push` moves every
# offbeat 16th late by a fraction of a step -- swing -- and `humanise` adds a
# small random deviation per hit. Both are in the direction, both default to
# something conservative, and the PAYOFF is never moved by either.
# ---------------------------------------------------------------------------

STEP = BEAT / 4          # one 16th at 120 BPM = 0.125 s
# MEASURED, and this is the largest single correction in the file. Dahl (2004)
# put four professional percussionists under optical motion capture with a force
# plate: unaccented vs accented strokes measured ~50 vs ~75 dB(A) on a normal
# surface, and ~80 vs ~105 dB(A) on a snare. That is a 25 dB SPREAD on both.
#
# 25 dB means the ghost sits at 10^(-25/20) = 5.6% of the accent's amplitude.
# The tiers here were 1.00 / 0.62 / 0.28 -- a spread of 11 dB, under half of it,
# and the beats sounded flat.
#
# Note this contradicts most production guidance, which puts ghost notes at MIDI
# velocity 90-110 against a 127 accent -- a spread of 3-4 dB, which is not a
# ghost note at all. The acoustic measurement wins.
#
# The physical dynamic range available to a player is wider still: peak forces
# across p/mf/f spanned 1.8 N to 106.8 N, about 35 dB.
ACCENT = {"X": 1.00, "x": 0.30, "o": 0.056, ".": 0.0}


def grid_events(pattern, bars_s, push=0.0, humanise=0.0, seed=0):
    """Expand a grid string across the piece.

    `push` is swing, as a fraction of a 16th, applied to ODD steps only -- the
    offbeats. Pushing every step just moves the bar and reads as sloppy rather
    than as feel.

    `humanise` is a per-hit deviation in seconds, seeded so a render is
    reproducible. A capture pipeline that scrubs cannot tolerate a bed that
    differs between renders.
    """
    rng = np.random.default_rng(seed)
    pat = pattern.replace(" ", "").replace("|", "")
    ev = []
    n_steps = int(bars_s / STEP)
    for i in range(n_steps):
        c = pat[i % len(pat)]
        g = ACCENT.get(c, 0.0)
        if g <= 0:
            continue
        t = i * STEP
        if push and (i % 2) == 1:
            t += push * STEP
        if humanise:
            t += float(rng.normal(0, humanise))
        ev.append((max(0.0, t), g))
    return ev


# ---------------------------------------------------------------------------
# KITS -- REAL SAMPLES, NOT ONLY SYNTHESIS
#
# The vendored library at _hex-promo/samples carries 182 sounds and
# provenance.json records id, uploader, licence and source page for every one.
# ALL 182 ARE CC0 -- verified by reading the manifest, not by assuming -- so
# there is no attribution requirement and commercial use is clean. That matters
# because the obvious alternatives are not: Sonatina's Sampling Plus licence
# excludes advertising and a brand intro IS advertising, and the BBC library's
# "educational" tier means the USER is a student, not that the product teaches.
#
# WHY SAMPLES AT ALL, given the synthesis works. Two reasons. A real taiko or
# clave carries inharmonic partials and hit-to-hit variation that modal
# synthesis approximates and does not reproduce. And the whole "programmed"
# quality comes partly from every hit being byte-identical -- a library gives
# several takes of the same instrument, so consecutive hits differ for the same
# reason they differ in a room.
#
# `synth` is kept as a kit so the two can be compared directly rather than
# argued about.
# ---------------------------------------------------------------------------

SAMPLES = "C:/zzz/_hex-promo/samples"

KITS = {
    "synth":  dict(low=None, click=None,
                   desc="Pure synthesis. No samples -- the reference."),
    "taiko":  dict(low=("taiko", ["801857", "801832", "802248"]),
                   click=("rim", ["368520", "368521", "368522"]),
                   desc="Real taiko toms against claves. The most literally primal kit here."),
    "taiko-deep": dict(low=("taiko", ["347126", "840564"]),
                   click=("rim", ["132417", "517609"]),
                   desc="The big taiko bass drum. Slowest and heaviest."),
    "wood":   dict(low=("tom", ["685559", "808592"]),
                   click=("rim", ["368520", "368523"]),
                   desc="Low toms and claves. Warm, dry, close."),
    "metal":  dict(low=("hammer", ["784152", "784154"]),
                   click=("clank", ["340615", "825095"]),
                   desc="Struck metal plate and dropped steel. The workshop palette, but TUNED by the beat rather than scattered."),
    "machine": dict(low=("kick", ["673502", "584787"]),
                   click=("snap", ["556631", "556632", "827344"]),
                   desc="Switch flips and door latches over a dry kick. Mechanical, closest to a control panel."),
    "kit909": dict(low=("kick", ["78815", "581454"]),
                   click=("snare", ["459213", "459179", "556743"]),
                   desc="A drum-machine kit: 909-adjacent snare and a sampled kick."),
    "hybrid": dict(low=None,
                   click=("rim", ["368520", "368521", "368522", "368523"]),
                   desc="Synthesised sub for the weight, real claves for the transients. Best of both."),
}

_SAMPLE_CACHE = {}


def load_sample(cat, sid):
    """Read one CC0 sample, mono, at SR. Cached, because a bed re-reads the same
    handful of files hundreds of times."""
    key = (cat, sid)
    if key in _SAMPLE_CACHE:
        return _SAMPLE_CACHE[key]
    import wave
    import struct
    path = os.path.join(SAMPLES, cat, "wav", f"{sid}.wav")
    if not os.path.exists(path):
        _SAMPLE_CACHE[key] = None
        return None
    w = wave.open(path, "rb")
    n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    raw = w.readframes(n)
    w.close()
    fmt = {1: "b", 2: "h", 4: "i"}.get(sw)
    if fmt is None:
        _SAMPLE_CACHE[key] = None
        return None
    x = np.array(struct.unpack("<%d%s" % (n * ch, fmt), raw), dtype=np.float64)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    x /= float(1 << (8 * sw - 1))
    if sr != SR:                                  # cheap resample; these are one-shots
        x = np.interp(np.linspace(0, len(x), int(len(x) * SR / sr)), np.arange(len(x)), x)
    _SAMPLE_CACHE[key] = x
    return x


def all_takes(cat):
    """Every take of an instrument, so round-robin has something to rotate.

    The hand-written kits listed two to four ids each; the library holds six to
    twelve per instrument. Identical repeated samples are a named cause of the
    "machine gun" quality, and the fix costs nothing because the takes are
    already on disk.
    """
    import glob
    d = os.path.join(SAMPLES, cat, "wav")
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(d, "*.wav")))


def kit_voice(kit, role, accent, idx):
    """One hit from a kit.

    ROUND-ROBIN IS THE POINT, not a nicety. A bed where every hit is the same
    bytes is the "machine gun effect"; cycling through several takes of the same
    instrument makes consecutive hits differ for the same reason they differ in
    a room. `idx` is the hit counter, so this is deterministic -- a capture
    pipeline that scrubs cannot tolerate a bed that changes between renders.
    """
    spec = KITS[kit].get(role)
    if spec is None:
        return None
    cat, ids = spec
    # Prefer every take in the category over the hand-listed subset.
    pool = all_takes(cat) or ids
    x = load_sample(cat, pool[idx % len(pool)])
    if x is None:
        return None
    x = x.copy()
    # Velocity must change TIMBRE, not only level: a hard hit is brighter and
    # rings longer. Approximated by shortening and dulling quiet hits.
    if accent < 0.9:
        cut = 1200 + 6000 * accent
        b, a = butter(2, min(cut, SR / 2 - 100) / (SR / 2), btype="low")
        x = lfilter(b, a, x)
        keep = int(len(x) * (0.25 + 0.75 * accent))
        if keep > 64:
            x = x[:keep]
    return fade_edges(x * accent)


# ---------------------------------------------------------------------------
# BASSLINES -- the lane that was missing
#
# WHY THE BEDS SOUNDED DRONING, diagnosed rather than guessed: the sub played
# `bass(root, ...)` -- ONE NOTE, re-struck each bar, for the whole piece -- and
# the "sub" lane of the beat grid triggered a kick DRUM, not a pitched note. So
# every bed was a kick pattern, a click pattern, and a sustained pedal. That is
# a drone with drums on it, and no amount of rhythmic variation fixes it.
#
# The first thing the research established is that an audio logo WITH a melody
# scores ~25% higher and is >50% more memorable. A melodic set was built, the
# palette was rejected in favour of percussive-and-bass, and melody was then
# dropped altogether instead of being moved into the bass. This puts it back
# where it belongs for this palette.
#
# EVERYTHING IS MIXOLYDIAN, so the b7 is the colour and there is no leading tone
# pulling to a resolution -- which is what a piece that hands over to speech, and
# that will be heard 128 times, wants.
#
# Each riff is (step, scale-degree, accent) on the 16-step grid. Degrees index
# the mixolydian scale: 0=root, 2=third, 3=fourth, 4=fifth, 6=b7.
# ---------------------------------------------------------------------------

RIFFS = {
    "pedal":   dict(notes=[(0, 0, "X")],
                    desc="One note, held. THE DRONE -- kept as the counter-example, not as an option."),
    "b7-hook": dict(notes=[(0, 0, "X"), (6, 6, "x"), (10, 0, "x"), (14, 4, "o")],
                    desc="Leans on the b7 and falls back to the root. The most mixolydian thing available."),
    "tres-move": dict(notes=[(0, 0, "X"), (3, 6, "x"), (6, 0, "x"), (8, 4, "X"), (11, 6, "x"), (14, 0, "x")],
                      desc="The 3+3+2 cell with every onset a DIFFERENT degree -- the owner's rhythm, finally carrying pitch."),
    "walk":    dict(notes=[(0, 0, "X"), (4, 3, "x"), (8, 4, "x"), (12, 6, "x")],
                    desc="Root, fourth, fifth, b7. One note per beat -- the plainest movement that is still movement."),
    "climb":   dict(notes=[(0, 0, "X"), (4, 2, "x"), (8, 3, "x"), (12, 4, "X")],
                    desc="Rises through the scale and lands on the fifth. Opens outward."),
    "fall":    dict(notes=[(0, 6, "X"), (4, 4, "x"), (8, 3, "x"), (12, 0, "X")],
                    desc="Descends from the b7 to the root. Settles -- the natural outro shape."),
    "octave":  dict(notes=[(0, 0, "X"), (6, 7, "x"), (10, 0, "x"), (14, 7, "o")],
                    desc="Root against its own octave. Movement with no harmonic commitment at all."),
    "fifth":   dict(notes=[(0, 0, "X"), (4, 4, "x"), (8, 0, "x"), (12, 4, "x")],
                    desc="Root and fifth alternating. Mode-neutral, and it survives any speaker."),
    "riff-3":  dict(notes=[(0, 0, "X"), (3, 0, "o"), (6, 6, "x"), (8, 6, "o"), (11, 4, "x"), (14, 3, "x")],
                    desc="A six-note figure with ghosts. The busiest, and the closest to a hook."),
    "drop-4":  dict(notes=[(0, 4, "X"), (6, 0, "x"), (10, 6, "x"), (12, 0, "X")],
                    desc="Starts on the fifth and drops to the root. Arrives already moving."),
    "pump":    dict(notes=[(0, 0, "X"), (2, 0, "o"), (6, 6, "x"), (8, 0, "x"), (10, 0, "o"), (14, 4, "x")],
                    desc="Repeated root punctuated by the b7. Insistent rather than melodic."),
}

# ---------------------------------------------------------------------------
# ARCS -- development across the piece, not a loop played four times
#
# THE GAP THIS FILLS. Every beat above is a ONE-BAR pattern, and the outro
# simply repeated it four times. That is why the outro reads flat: nothing
# develops, so the last bar carries no more weight than the first and the payoff
# has not been approached, only reached.
#
# AN ARC IS DENSITY, NOT A VOLUME FADER. Turning bar 1 down 6 dB is a mix move
# and the ear hears the same busy pattern, quieter. Removing its GHOST notes is
# an arrangement move and the ear hears a sparser bar that fills in. Both are
# applied here, and the density half is what actually reads.
#
# Each arc is one entry per bar: (gain, density). Density is a threshold -- at
# 0.5 the ghosts drop out, at 0.25 only accents survive -- so a bar thins from
# the bottom of the dynamic range upward, the way a player would add rather than
# subtract.
# ---------------------------------------------------------------------------

ARCS = {
    "flat":   dict(bars=[(1.0, 1.0)] * 4,
                   desc="No development. The loop, four times."),
    "build":  dict(bars=[(0.45, 0.25), (0.68, 0.55), (1.00, 1.0), (0.80, 0.8)],
                   desc="Accents only, then ghosts arrive, then full, then ease off."),
    "swell":  dict(bars=[(0.35, 0.25), (0.70, 0.6), (1.00, 1.0), (0.55, 0.5)],
                   desc="A wider swell with a real drop after the peak."),
    "late":   dict(bars=[(0.30, 0.2), (0.45, 0.35), (0.70, 0.6), (1.00, 1.0)],
                   desc="Holds back and keeps building to the very end."),
    "two":    dict(bars=[(0.40, 0.3), (0.85, 0.9), (0.50, 0.4), (1.00, 1.0)],
                   desc="Two peaks -- states it, withdraws, then states it bigger."),
    "drop":   dict(bars=[(1.00, 1.0), (0.55, 0.5), (0.85, 0.9), (0.40, 0.3)],
                   desc="Opens at full and empties out. The reverse shape."),
    "pulse":  dict(bars=[(0.55, 0.5), (1.00, 1.0), (0.55, 0.5), (1.00, 1.0)],
                   desc="Alternating bars: breathes in two-bar units."),
}


def arc_at(arc, bar_i, bars_total):
    """Gain and density threshold for a bar. Arcs are written for four bars; a
    one-bar intro takes the LAST entry, which is the fullest, because an intro
    has no room to develop and should arrive already committed."""
    a = ARCS[arc]["bars"]
    if bars_total <= 1:
        return a[-1]
    return a[min(bar_i, len(a) - 1)]


# ---------------------------------------------------------------------------
# THE BEATS
#
# THE ROLE ASSIGNMENT IS A MEASURED RESULT, and it is the reverse of the obvious
# one. Witek et al. (PLoS ONE 2014) analysed 50 funk breaks against a
# syncopation index and found an INVERTED U -- medium syncopation gives peak
# desire-to-move and peak pleasure, not maximum. Structurally, in those breaks
# the hi-hat holds a CONSTANT subdivision and the bass drum and snare carry ALL
# of the syncopation. So here: the CLICK is an invariant grid, and the SUB is
# where every asymmetric cell lives. Putting the clever pattern in the click and
# four-on-the-floor in the sub -- the first thing I built -- is upside down.
#
# AND THE SUB IS THE BEAT CARRIER, not accompaniment. Duncan & Orgs (2024, 179
# participants) found groove peaked at high low-frequency amplitude AND high
# syncopation, and was LOWEST at low LFA regardless of syncopation. Lenc et al.
# found cortical beat-tracking is selectively enhanced when the rhythm is
# carried by low rather than high frequencies. Sub level is the single strongest
# lever available.
#
# MICROTIMING IS NOT WHERE "PHYSICAL" COMES FROM, which is worth stating because
# every production tutorial says otherwise. Fruehauf et al. (N=93) found the
# FULLY QUANTIZED version scored highest for groove. Senn et al. found quantized
# and real-performance stimuli scored similarly, and that exaggerated microtiming
# DIMINISHES groove. Kilchenmann & Senn found shifting a whole layer had no
# measurable effect at all (f-squared 0.003-0.013). Humanisation is therefore
# off by default here. Where a beat does swing, it swings by a MEASURED amount
# from real records -- and systematically, the same offset every bar, because
# drummers repeat their microtiming to within a few milliseconds.
#
# VELOCITY IS THREE TIERS, NOT A CONTINUUM. Every taiko notation system encodes
# exactly this -- CAPITALS loud, mixed medium, lowercase soft, (parens) very
# soft -- and with two sounds, dynamics are most of the expressive range.
#
# Grid: 16 steps per bar. X = 1.00, x = 0.62, o = 0.28, . = rest.
# ---------------------------------------------------------------------------

BEATS = {
    # --- TAIKO. The idiom is LONG-SHORT-SHORT, which is the opposite of an
    # --- evenly-distributed Euclidean rhythm and is why it reads as primal.
    "miyake": dict(
        click="x.x.x.x.x.x.x.x.",          # invariant 8ths
        sub="X...x.o.X...x.o.",            # [0,4,6] per half bar: LOUD soft soft
        swing=0.0, desc="MIYAKE / sukeroku. DON (su) koko DON -- long, short, short at half-bar scale. The single highest-value primal cell."),
    "don-tsuku": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X.ooX.ooX.ooX.oo",            # [0,2,3] per beat: LOUD, soft, soft
        swing=0.0, desc="DON TSUKU. The core taiko cell -- an accent followed by two quick softs, once per beat."),
    "uma": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X.ooX.ooX.ooX.oo",
        swing=0.16, desc="UMA-JI, the horse beat. Don doko don doko -- the same cell, swung, so it gallops."),
    "doro-tsuku": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="XXooXXooXXooXXoo",            # LOUD LOUD soft soft
        swing=0.0, desc="DORO TSUKU. Two loud, two soft, all sixteen -- the densest taiko cell."),

    # --- THE BELL TIMELINES, in the SUB where the syncopation belongs.
    # --- Onsets verbatim from Toussaint; the accent on the 2nd stroke of the
    # --- 3-side is the bombo, "the most often accented clave stroke".
    "gahu": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="x..X..o...o...x.",            # 0,3,6,10,14 -- bombo (3) accented
        swing=0.0, desc="GAHU. Toussaint singles it out as the timeline that 'rolls along'; Locke calls it rhythmically potent, with a spiralling effect. The most primal of the six."),
    "son": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="x..X..o...x.o...",            # 0,3,6,10,12
        swing=0.0, desc="SON CLAVE. The most familiar asymmetry in the world. Pressing complexity 14.5."),
    "rumba": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="x..X...o..x.o...",            # 0,3,7,10,12
        swing=0.0, desc="RUMBA CLAVE. Complexity 17 -- harder than son, and it leans later."),
    "bembe": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X..x..Xo..x.o..x",            # the standard bell in its 16-pulse duple form
        swing=0.0, desc="THE STANDARD BELL, duple form. Intervals 2-2-1-2-2-2-1: the asymmetry IS the propulsion."),
    "cascara": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X.....o.....X...",
        swing=0.0, desc="CASCARA, reduced: a continuous stream accented only at clave positions -- what cascara perceptually does."),

    # --- THE ELECTRONIC REDUCTIONS. Same rule: click invariant, sub carries it.
    "dub": dict(
        click="..x...x...x...x.",          # offbeat 8ths -- the lift
        sub="X...x...X...x...",
        swing=0.0, desc="DUB TECHNO. The offbeat is the only thing contradicting the kick, at maximum distance from it."),
    "ebm": dict(
        click="X...X...X...X...",          # DOUBLES the pulse: nothing pulls
        sub="XoooXoooXoooXooo",            # all sixteen, gated short
        swing=0.0, desc="EBM. The click doubles the pulse instead of contradicting it, and density replaces syncopation. Marches rather than swings."),
    "detroit": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X..x..o....x..o.",            # never lands where the click accents
        swing=0.13, desc="DETROIT. The rule, verbatim: the rimshot never hits on the same beat as a kick. Counterpoint. Swing 55-60%."),
    "tresillo": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X..x..X.X..x..X.",            # 3+3+2, the additive cell
        swing=0.0, desc="TRESILLO 3+3+2. The additive cell underneath most of this list."),
    "onedrop": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="........X.......",            # beat 1 EMPTY -- defined by absence
        swing=0.0, desc="ONE DROP. The kick refuses beat 1 entirely. The most space of anything here."),
    "heartbeat": dict(
        click="................",          # nothing at all
        sub="X.o.....X.o.....",            # S1 loud, S2 quieter/shorter, 0.3/0.7 spacing
        swing=0.0, desc="HEARTBEAT, with the real 0.3/0.7 asymmetry -- S1 then a quieter, shorter S2. NOTE: cardiac entrainment is folklore and fails to replicate; this is here for the SHAPE, not the theory."),
    # --- MORE FROM THE CANON -------------------------------------------
    "amen": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X.o.X..o.oX.X...",
        swing=0.0, desc="AMEN. Accents on beats 2 and 4, ghosts between, and the two consecutive 16ths on the kick. Measured straight to within 7 ms -- its life is accent and timbre, not microtiming."),
    "amen-late": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X.o.X..o.oX...X.",
        swing=0.0, desc="AMEN, last bar: the final backbeat migrates from step 13 to 15 -- an 8th note late. The single highest-confidence structural fact about the break."),
    "funky-drummer": dict(
        click="xxxxxxxxxxxxxxxx",
        sub="X.X.....o.X.o.x.",
        swing=0.06, desc="FUNKY DRUMMER. The ghost one 16th BEFORE the accent is the whole trick. Beat 2 lags 2.8%, beat 4 is the most accurate in the bar."),
    "cinquillo": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="XX.XX.X.XX.XX.X.",
        swing=0.0, desc="CINQUILLO. Five onsets in eight -- denser than tresillo and older than most of this list."),
    "habanera": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X..XX.X.X..XX.X.",
        swing=0.0, desc="HABANERA. Tresillo with the second onset doubled; the bass figure that crossed the Atlantic."),
    "matsuri": dict(
        click="x.x.x.x.x.x.x.x.",
        sub="X...x.o.x...X...",
        swing=0.0, desc="MATSURI JI. Festival taiko: DON doko don DON. Long-short-short with the accent returning."),
    "paradiddle": dict(
        click="xoxxoxooxoxxoxoo",
        sub="X...X...X...X...",
        swing=0.0, desc="PARADIDDLE, RLRR LRLL. The rudiment's own accent shape does the work -- note 1 of each group of four."),
    "double-stroke": dict(
        click="XoXoXoXoXoXoXoXo",
        sub="X...x...X...x...",
        swing=0.0, desc="DOUBLE-STROKE ROLL. The second of every pair is a rebound and naturally quieter -- free non-uniformity, no humanisation."),
    # --- THE TRESILLO FAMILY. The owner's direction, varied at the cell.
    "tres-332": dict(click="x.x.x.x.x.x.x.x.", sub="X..x..X.X..x..X.", swing=0.0,
                     desc="3+3+2, the canonical cell."),
    "tres-233": dict(click="x.x.x.x.x.x.x.x.", sub="X.x..x..X.x..x..", swing=0.0,
                     desc="2+3+3. The long groups last, so it leans forward instead of settling."),
    "tres-323": dict(click="x.x.x.x.x.x.x.x.", sub="X..x.x..X..x.x..", swing=0.0,
                     desc="3+2+3. Symmetrical -- the short group in the middle."),
    "tres-ghost": dict(click="x.x.x.x.x.x.x.x.", sub="X.ox.oX.X.ox.oX.", swing=0.0,
                       desc="3+3+2 with ghosts filling the gaps. Denser, and the ghosts sit 25 dB down."),
    "tres-open": dict(click="x.x.x.x.x.x.x.x.", sub="X.....X.X.....X.", swing=0.0,
                      desc="The cell stripped to its two widest onsets. Maximum space."),
    "tres-double": dict(click="x.x.x.x.x.x.x.x.", sub="XX.x..X.XX.x..X.", swing=0.0,
                        desc="A doubled downbeat -- a flam at 16th scale, weight without density."),
    "tres-16": dict(click="xoxoxoxoxoxoxoxo", sub="X..x..X.X..x..X.", swing=0.0,
                    desc="The same cell over a 16th click stream instead of 8ths. Busier surface."),
    "tres-4": dict(click="x...x...x...x...", sub="X..x..X.X..x..X.", swing=0.0,
                   desc="Quarter-note click. The sparsest surface -- the cell has to carry everything."),
    "tres-swing": dict(click="x.x.x.x.x.x.x.x.", sub="X..x..X.X..x..X.", swing=0.13,
                       desc="Swung, at the breakbeat-canon median of 1.2:1 (+11 ms on offbeats)."),
    "tres-swing-hard": dict(click="x.x.x.x.x.x.x.x.", sub="X..x..X.X..x..X.", swing=0.24,
                            desc="Swung to 1.5:1 (+25 ms). Near the top of what real records do."),
    "threat": dict(
        click="xxxxxxxxxxxxxxxx",          # pinned flat, relentless
        sub="X..x..X.X..x..X.",
        swing=0.0, desc="THREAT. Measured (JASA 2023): terrifying music is faster, denser and has MORE CONSISTENT loudness than anxious music. Pinned, not swelling."),
}

for _b in BEATS.values():
    _b.setdefault("swing", 0.0)
    # Humanisation OFF by default -- see the header. Quantized scored highest.
    _b.setdefault("humanise", 0.0)


def _gap_report(pattern):
    """Toussaint's two numbers: how many DISTINCT interval lengths the pattern
    uses, and its largest silent gap. His drive criterion is that a rhythm
    should not contain silent intervals that are too long, and his quality
    metric is interval variety -- so both are printed for every beat rather than
    asserted."""
    p = pattern.replace(" ", "")
    on = [i for i, c in enumerate(p) if c != "."]
    if len(on) < 2:
        return 0, len(p)
    gaps = [(on[(i + 1) % len(on)] - on[i]) % len(p) for i in range(len(on))]
    gaps = [g for g in gaps if g > 0]
    return len(set(gaps)), max(gaps)


# The audition set. A full cross-product would be 24 beats x 8 kits = 192, which
# is a catalogue rather than a choice -- so the four strongest beats are offered
# in every kit, and the rest come in the taiko kit, which is the most primal
# default. Any other pairing is one line away.
CORE = ("gahu", "miyake", "tresillo", "amen")

# THE OWNER'S PICK, varied. tresillo-taiko-early is the direction, so every axis
# that can be varied around it is offered rather than a spread across beats.
TRES_CELLS = ("tresillo", "tres-332", "tres-233", "tres-323", "tres-ghost",
              "tres-open", "tres-double", "tres-16", "tres-4",
              "tres-swing", "tres-swing-hard")

DIRECTIONS = {}
# 0. THE RIFF varied -- the axis that was missing entirely. Rhythm, kit, arc and
#    envelope all held at the owner's pick, so what changes is the melody.
for _r, _rv in RIFFS.items():
    DIRECTIONS[f"R-{_r}"] = dict(
        octave=-1, beat="tresillo", kit="taiko", rt60=0.9, timing="early",
        arc="build", fade_in=0.12, cresc=0.35, riff=_r, bass="saw",
        desc=f"[riff] {_rv['desc']}")

# 0b. The bass VOICE varied, riff held at the one that moves most.
for _bv, _bd in (("sine", "Pure sine sub. Roundest, and the least present on a laptop."),
                 ("saw", "Filtered saw. Most midrange, so it survives small speakers."),
                 ("fm", "FM bass -- a metallic bite on the attack over a pitched body."),
                 ("pluck", "Plucked bass. Shortest, most articulate, least sustain.")):
    DIRECTIONS[f"R-voice-{_bv}"] = dict(
        octave=-1, beat="tresillo", kit="taiko", rt60=0.9, timing="early",
        arc="build", fade_in=0.12, cresc=0.35, riff="tres-move", bass=_bv,
        desc=f"[bass] {_bd}")

# 0c. THE ROOM varied. Real recorded impulse responses instead of shaped noise
#     -- the single cheapest change away from sounding assembled.
for _rm, (_sid, _rd) in ROOMS.items():
    DIRECTIONS[f"X-room-{_rm}"] = dict(
        octave=-1, beat="tresillo", kit="taiko", rt60=0.9, timing="early",
        arc="build", fade_in=0.12, cresc=0.35, riff="tres-move", bass="saw",
        room=_rm, desc=f"[room] {_rd}")

# 0d. The same, with NO room, so the difference is audible rather than assumed.
DIRECTIONS["X-room-none"] = dict(
    octave=-1, beat="tresillo", kit="taiko", rt60=0.9, timing="early",
    arc="build", fade_in=0.12, cresc=0.35, riff="tres-move", bass="saw",
    desc="[room] Synthesised IR -- the old shaped-noise reverb, for comparison.")

# 1. The cell varied, arc and envelope held.
for _c in TRES_CELLS:
    DIRECTIONS[f"T-{_c.replace('tres-','').replace('tresillo','base')}"] = dict(
        octave=-1, beat=_c, kit="taiko", rt60=0.9, timing="early",
        arc="build", fade_in=0.12, cresc=0.35, riff="tres-move", bass="saw",
        desc=f"[cell] {BEATS[_c]['desc']}")

# 2. The arc varied, cell held at the canonical tresillo.
for _a, _av in ARCS.items():
    DIRECTIONS[f"T-arc-{_a}"] = dict(
        octave=-1, beat="tresillo", kit="taiko", rt60=0.9, timing="early",
        arc=_a, fade_in=0.12, cresc=0.35, riff="tres-move", bass="saw",
        desc=f"[arc] {_av['desc']}")

# 3. The envelope varied -- fade-in length and crescendo depth.
for _n, _fi, _cr in (("dry", 0.0, 0.0), ("fade", 0.30, 0.0), ("cresc", 0.0, 0.55),
                     ("both", 0.30, 0.55), ("steep", 0.06, 0.85), ("long", 0.55, 0.35)):
    DIRECTIONS[f"T-env-{_n}"] = dict(
        octave=-1, beat="tresillo", kit="taiko", rt60=0.9, timing="early",
        arc="build", fade_in=_fi, cresc=_cr, riff="tres-move", bass="saw",
        desc=f"[env] fade-in {_fi:.2f}s, crescendo +{int(_cr*100)}% into the landing.")

# 4. The kit varied, everything else held at the pick.
for _kk in KITS:
    DIRECTIONS[f"T-kit-{_kk}"] = dict(
        octave=-1, beat="tresillo", kit=_kk, rt60=0.9, timing="early",
        arc="build", fade_in=0.12, cresc=0.35, riff="tres-move", bass="saw",
        desc=f"[kit] {KITS[_kk]['desc']}")

for _k, _v in BEATS.items():
    if _k.startswith("tres-"):
        continue                      # covered by the T- family above
    _kits = ("taiko", "synth") if _k in CORE else ("taiko",)
    for _kit in _kits:
        for _t in ("", "early"):
            # The timing variants are only worth carrying on the core beats;
            # 24 beats x 8 kits x 2 timings is a catalogue, not a choice.
            if _t and _k not in CORE:
                continue
            _base = f"{_k}-{_kit}" if _k in CORE else _k
            _name = f"{_base}-early" if _t else _base
            DIRECTIONS[_name] = dict(octave=-1, beat=_k, kit=_kit, rt60=0.9, timing=_t,
                                     desc=("[EARLY] " if _t else "") + f"[{_kit}] {_v['desc']}")


# Defaults every direction shares. The rhythm family varies ONE thing -- the
# rhythmic idea -- so everything else is pinned here rather than restated 23
# times, and a difference you hear is a difference in the rhythm.
for _d in DIRECTIONS.values():
    _d.setdefault("scale", "mixolydian")   # owner's pick; the b7 keeps it unresolved
    _d.setdefault("cadence", False)
    _d.setdefault("voice", None)           # the sub carries the pitch in this family
    _d.setdefault("pad", False)
    _d.setdefault("sub", True)
    _d.setdefault("sub_kind", "sine")
    _d.setdefault("sub_moves", False)
    _d.setdefault("rim_tuned", False)
    _d.setdefault("swing", 0.0)
    # THE BAND MOVED DOWN, and this was the biggest single error in the earlier
    # beds. 1.2-6 kHz is stick-and-hat territory; almost the entire 808 kit sits
    # BELOW 2.5 kHz. A click up there cannot read as a drum whatever it plays.
    _d.setdefault("rim_band", (250, 2000))


VOICES = {"marimba": lambda f, d: marimba(f, d, "marimba"),
          "xylophone": lambda f, d: marimba(f, d, "xylophone"),
          "vibes": lambda f, d: marimba(f, d, "vibes"),
          "fm_bell": fm_bell, "pluck": pluck, "sine_click": sine_click,
          "bass_sine": bass_sine, "bass_saw": bass_saw, "bass_fm": bass_fm,
          "bass_pluck": bass_pluck, "tuned_tom": tuned_tom, "stab": stab}

# bars, and where the payoff lands. Read off the retimed furniture.
# TWO TIMINGS PER PIECE, because the research disagreed with itself and with
# what the picture does.
#
# INTRO. The channel measurement -- 89 videos across 18 technical channels, time
# to the first narrated word -- gives a median of 0.48s and recommends ~1-1.5s.
# The default here is 2.0s because that is ONE BAR at 120 BPM and below a bar
# there is no bar to land on. `early` is 1.5s: three beats, still on the beat
# grid, and the measured recommendation.
#
# OUTRO. The sonic-branding line says land the payoff at t=4.0s and give it four
# full seconds of decay. The default here puts it at 6.0s instead, because that
# is where the PICTURE lands -- the jaws close on the hex. `early` follows the
# recommendation, which also leaves the lock to land in silence: the loudest
# sound and the biggest picture event stop competing for the same moment.
TIMINGS = {
    "":      dict(intro=(2.0, BEAT * 3), outro=(8.0, BAR * 3)),
    "early": dict(intro=(1.5, BEAT * 2), outro=(8.0, BAR * 2)),
}

PIECES = {
    "intro": dict(bars=1, payoff=BEAT * 3),
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
        degrees = [0, 2, 4] if cad else [0, 2]
        onsets = [BEAT * i for i in range(len(degrees))]
        land_deg = 4 if cad else 4          # bVII->I resolves onto the tonic above
    else:
        degrees = [0, 2, 4, 2, 4, 7] if cad else [0, 2, 4, 2, 4]
        onsets = [BEAT * i for i in (0, 1, 2, 5, 6, 8)][: len(degrees)]
        land_deg = 7 if cad else 4
    ev = [(o + float(rng.uniform(-0.010, 0.010)), g, 0.55) for o, g in zip(onsets, degrees)]
    ev.append((PIECES[piece]["payoff"], land_deg, 1.0))   # dead on grid, loudest
    return [(t, hz(scale, g, d.get("octave", 0)), a) for t, g, a in ev]


def build(name, piece):
    d = DIRECTIONS[name]
    p = dict(PIECES[piece])
    seconds, p["payoff"] = TIMINGS[d.get("timing", "")][piece]
    n = int(seconds * SR)
    buf = np.zeros(n)

    # PERCUSSION. Two lanes: the click holds an invariant subdivision, the sub
    # carries the syncopation. See the BEATS header for why that is not a
    # preference.
    bt = BEATS[d["beat"]]
    clk_ev = grid_events(bt["click"], seconds, bt["swing"], bt["humanise"], seed=2)
    sub_ev = grid_events(bt["sub"], seconds, 0.0, bt["humanise"], seed=1)
    clk_times = {round(t, 3) for t, _ in clk_ev}

    # THE SUB IS THE BEAT CARRIER, mixed forward rather than as support: groove
    # is lowest at low low-frequency amplitude regardless of how good the
    # pattern is.
    kitname = d.get("kit", "synth")
    arc = d.get("arc", "flat")
    bars_total = max(1, int(round(seconds / BAR)))

    def shape(t_, g):
        """Arc gain and density for an event, plus the crescendo into the payoff.

        Returns None when the arc's density threshold silences this hit -- that
        is the arrangement half of the arc, and it is what makes a quiet bar read
        as sparser rather than merely turned down.
        """
        bar_i = int(t_ // BAR)
        gain, dens = arc_at(arc, bar_i, bars_total)
        if g < dens * 0.9 and g < 0.9:      # accents always survive
            return None
        # CRESCENDO INTO THE LANDING. A payoff that is merely loud has not been
        # approached; the last beat before it swells so the arrival is the top of
        # a ramp rather than a step.
        cr = d.get("cresc", 0.0)
        if cr:
            lead = p["payoff"] - t_
            if 0 < lead <= BEAT * 2:
                gain *= 1.0 + cr * (1.0 - lead / (BEAT * 2))
        return g * gain

    for j, (t_, g) in enumerate(sub_ev):
        i = int(t_ * SR)
        gg = shape(t_, g)
        if i >= n or gg is None:
            continue
        v = kit_voice(kitname, "low", gg, j)
        if v is None:
            v = kick(accent=gg)
        buf[i:i + len(v)] += v[: max(0, n - i)]

    for j, (t_, g) in enumerate(clk_ev):
        i = int(t_ * SR)
        gg = shape(t_, g)
        if i >= n or gg is None:
            continue
        if round(t_, 3) in {round(x, 3) for x, _ in sub_ev}:
            gg *= 0.45
        v = kit_voice(kitname, "click", gg, j)
        if v is None:
            v = rim(dur=0.10, band=d["rim_band"], decay=0.016 + 0.040 * gg, seed=4)
        buf[i:i + len(v)] += v[: max(0, n - i)] * (0.16 + 0.42 * gg)

    # And one deliberate kick ON the payoff, so the landing is felt as well as heard.
    i = int(p["payoff"] * SR)
    v = kick(dur=0.5) * 1.0
    buf[i:i + len(v)] += v[: max(0, n - i)]

    if d.get("voice"):
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

    # THE BASSLINE. A pitched lane, separate from the kick lane, playing a riff
    # that MOVES -- which is the whole difference between a bed and a drone.
    riff = RIFFS[d.get("riff", "b7-hook")]["notes"]
    bassv = {"saw": bass_saw, "fm": bass_fm, "pluck": bass_pluck}.get(d.get("bass", "sine"), bass_sine)
    bars_n = max(1, int(round(seconds / BAR)))
    for b_i in range(bars_n):
        b0 = b_i * BAR
        gain_bar, dens_bar = arc_at(d.get("arc", "flat"), b_i, bars_n)
        for st, deg, acc in riff:
            g = ACCENT[acc] * gain_bar
            if ACCENT[acc] < dens_bar * 0.9 and ACCENT[acc] < 0.9:
                continue
            t_ = b0 + st * STEP
            if t_ >= seconds:
                continue
            # Length runs to the next note so the line is legato rather than a
            # row of blips -- a bassline that never sustains reads as percussion.
            nxt = min([n2 for n2, _, _ in riff if n2 > st] or [st + 6])
            dur = min((nxt - st) * STEP * 1.15, seconds - t_)
            f0 = hz(d["scale"], deg, d["octave"])
            v = bassv(f0, max(0.08, dur)) * (0.30 + 0.34 * g)
            i = int(t_ * SR)
            buf[i:i + len(v)] += v[: max(0, n - i)]


    buf /= np.max(np.abs(buf)) or 1
    wet = room(buf, d["rt60"], ir_name=d.get("room"))

    # THE TAIL IS FADED, NOT CUT. The piece is exactly `seconds` long because the
    # picture is, so the reverb has to be brought down rather than guillotined --
    # an abrupt reverb cut is the signature script artifact.
    out = wet[:n].copy()

    # FADE IN. Not a mix nicety -- it stops the first transient arriving at full
    # level against silence, which is the single most "edited-in" sounding thing
    # a bed can do. Short, so it does not eat the first event.
    fi = d.get("fade_in", 0.0)
    if fi > 0:
        k = int(fi * SR)
        out[:k] *= np.linspace(0, 1, k) ** 1.4

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
    """16-bit mono PCM at SR. Clipped rather than normalised: the tanh stage has
    already set the level, and re-normalising here would undo the relative
    weighting between an accent and a ghost that the whole file exists to get
    right."""
    import wave
    import struct
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    w = wave.open(path, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
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
            print(f"  {k:16s} {v['desc']}")
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
                _t = DIRECTIONS.get(kit, {}).get("timing", "")
                _sec, _pay = TIMINGS[_t][piece]
                beds.setdefault(piece, []).append(dict(
                    kit=kit, file=fn, bars=PIECES[piece]["bars"],
                    seconds=_sec,
                    landings=[_pay],
                    desc=DIRECTIONS.get(kit, {}).get("desc", ""),
                ))
    with open(os.path.join(a.out_dir, "index.json"), "w", encoding="ascii") as fh:
        json.dump(dict(bpm=int(BPM), beat=BEAT, bar=BAR, pieces=beds), fh, indent=2)
    print(f"\n  manifest: {sum(len(v) for v in beds.values())} beds")
