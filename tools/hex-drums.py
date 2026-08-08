"""A loop-locked percussion bed for the Hex Cluster clips.

WHY THIS EXISTS AS CODE rather than a purchased loop: the clips are exact video
loops (300 frames, 10.000 s, seam-verified), and an audio bed that does not
divide that duration will click every lap even though the picture does not.
Synthesising it means the bar length is chosen to fit the clip instead of the
clip being trimmed to fit the bar.

120 BPM: beat = 0.5 s, bar = 2 s, so the default 10 s clip is exactly 5 bars,
and the video choreography is laid on the same grid.

IT HAS AN ARC, WHICH THE FIRST VERSION DID NOT. That one played an identical
pattern in every bar: correct length, no music. A bed with no dynamics makes
the picture feel flat even when the picture is not, because the ear is told
nothing is happening. The five bars now map onto what the clip is doing:

    bar 1  0-2 s   SPARSE     someone is deciding. Kick and a quiet shaker.
    bar 2  2-4 s   STATED     first tile lands on the downbeat, tom answers.
    bar 3  4-6 s   BUILD      shaker doubles to 16ths, congas enter in 3-over-4,
                              toms walk up, and a noise riser runs into the drop.
    bar 4  6-8 s   DROP       the explode. Layered accent on the downbeat, every
                              layer playing, the busiest bar by a distance.
    bar 5  8-10 s  RELEASE    caps come off, a descending tom fill on eighths
                              thins back to the kick so it flows into bar 1.

The technique is the standard one for this idiom: mid-range hand-drum timbres
(toms, congas) carry it, bright cymbals are absent entirely, and the interest
comes from interlocking polyrhythm rather than from more notes. The congas run
three evenly-spaced hits against the bar's four beats, which is what stops the
groove sounding like a metronome.

LOOP SAFETY IS THE WHOLE POINT. Any hit whose decay would run past the end is
WRAPPED to the head of the buffer rather than truncated. A truncated tail is
the click; a wrapped one is what makes the last lap flow into the first.

This is a scratch bed, not a produced track. Stdlib only, no numpy: it writes
16-bit PCM WAV at 48 kHz, the rate YouTube's spec asks for.

    python tools/hex-drums.py                 # 10 s, one 5-bar phrase
    python tools/hex-drums.py --seconds 30    # three phrases, for a Shorts cut
"""

import argparse
import math
import random
import struct
import wave

SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM  # 0.5 s
BAR = BEAT * 4  # 2.0 s
PHRASE_BARS = 5  # one 10 s arc


def env(n, attack, decay, curve=3.0):
    """Percussive envelope: near-instant attack, exponential decay."""
    out = []
    a = max(1, int(attack * SR))
    for i in range(n):
        if i < a:
            out.append(i / a)
        else:
            t = (i - a) / max(1, decay * SR)
            out.append(math.exp(-curve * t))
    return out


def kick(dur=0.55, f0=110.0, f1=44.0):
    """Pitch-swept sine. The sweep is what reads as a drum rather than a beep."""
    n = int(dur * SR)
    e = env(n, 0.001, dur * 0.5, 3.4)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / n
        f = f1 + (f0 - f1) * math.exp(-4.5 * t)
        phase += 2 * math.pi * f / SR
        out.append(math.sin(phase) * e[i])
    return out


def tom(dur=0.45, f0=190.0, f1=95.0):
    n = int(dur * SR)
    e = env(n, 0.001, dur * 0.55, 3.0)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / n
        f = f1 + (f0 - f1) * math.exp(-5.5 * t)
        phase += 2 * math.pi * f / SR
        # A little second harmonic gives the skin some body.
        out.append((math.sin(phase) + 0.22 * math.sin(2 * phase)) * e[i] * 0.7)
    return out


def conga(dur=0.16, f=310.0, seed=0):
    """Hand drum: a short tuned body with a noise slap on the front.

    The slap is most of what makes it read as a hand rather than a mallet, so
    it is mixed in for the first few milliseconds only.
    """
    rng = random.Random(seed)
    n = int(dur * SR)
    e = env(n, 0.0008, dur * 0.3, 5.0)
    slap_n = int(0.006 * SR)
    out = []
    phase = 0.0
    for i in range(n):
        phase += 2 * math.pi * (f * (1 + 0.35 * math.exp(-40 * i / SR))) / SR
        v = math.sin(phase) * 0.8 + 0.18 * math.sin(2.7 * phase)
        if i < slap_n:
            v += rng.uniform(-1, 1) * (1 - i / slap_n) * 0.9
        out.append(v * e[i] * 0.5)
    return out


def shaker(dur=0.09, seed=0):
    """Noise through a one-pole high pass, so it sits above the toms."""
    rng = random.Random(seed)
    n = int(dur * SR)
    e = env(n, 0.002, dur * 0.35, 4.0)
    out = []
    prev_in = prev_out = 0.0
    a = 0.92
    for i in range(n):
        x = rng.uniform(-1.0, 1.0)
        y = a * (prev_out + x - prev_in)
        prev_in, prev_out = x, y
        out.append(y * e[i] * 0.28)
    return out


def riser(dur=1.5, seed=7):
    """Filtered noise that opens up and gets louder into a hit.

    The tension device. It ENDS on the drop rather than continuing through it,
    because the point is the silence-then-impact, and a riser that overlaps the
    hit just muddies it.
    """
    rng = random.Random(seed)
    n = int(dur * SR)
    out = []
    prev_in = prev_out = 0.0
    for i in range(n):
        t = i / n
        # Filter opens from dull to bright as the level comes up.
        a = 0.55 + 0.4 * t
        x = rng.uniform(-1.0, 1.0)
        y = a * (prev_out + x - prev_in)
        prev_in, prev_out = x, y
        out.append(y * (t**2.2) * 0.34)
    return out


def accent(seed=11):
    """The drop: kick, low tom and a noise transient on the same downbeat.

    Layering is what makes a hit feel big. One louder kick just sounds louder.
    """
    k = kick(dur=0.7, f0=140, f1=40)
    t = tom(dur=0.7, f0=150, f1=62)
    rng = random.Random(seed)
    n = len(k)
    e = env(n, 0.001, 0.12, 5.0)
    out = []
    for i in range(n):
        noise = rng.uniform(-1, 1) * e[i] * 0.35
        out.append(k[i] * 1.0 + (t[i] if i < len(t) else 0.0) * 0.8 + noise)
    return out


def place(buf, sound, at_s, gain=1.0):
    """Mix a hit in at `at_s`, WRAPPING any tail past the end back to the head.

    Truncating instead is the click. Wrapping is what makes the bed a loop
    rather than a clip that happens to be the right length.
    """
    start = int(at_s * SR)
    n = len(buf)
    for i, v in enumerate(sound):
        buf[(start + i) % n] += v * gain


def build(seconds):
    n = int(round(seconds * SR))
    buf = [0.0] * n
    total_bars = int(round(seconds / BAR))

    for bar_i in range(total_bars):
        b = bar_i * BAR
        stage = bar_i % PHRASE_BARS  # 0 sparse, 1 stated, 2 build, 3 drop, 4 release

        # ---- kick: the spine. Present in every bar, hardest on the drop. ----
        kick_gain = (0.62, 0.85, 0.9, 1.0, 0.7)[stage]
        place(buf, kick(), b, kick_gain)
        if stage >= 1:
            place(buf, kick(dur=0.4), b + BEAT * 2, kick_gain * 0.6)
        if stage == 3:
            # Doubled on the "and" of 3, which is what makes the drop bar drive.
            place(buf, kick(dur=0.34), b + BEAT * 2.5, 0.5)

        # ---- the drop itself ----
        if stage == 3:
            place(buf, accent(), b, 1.0)

        # ---- riser into the drop, living in the build bar ----
        if stage == 2:
            place(buf, riser(dur=1.5), b + BAR - 1.5, 1.0)

        # ---- toms: answer the kick, denser as the phrase climbs ----
        if stage >= 1:
            place(buf, tom(f0=190, f1=95), b + BEAT * 1.5, 0.45 + 0.1 * stage)
        if stage >= 2:
            place(buf, tom(f0=150, f1=78), b + BEAT * 3.5, 0.42 + 0.1 * stage)
        if stage == 3:
            place(buf, tom(dur=0.5, f0=230, f1=120), b + BEAT * 2.75, 0.5)

        # ---- congas: THREE against the bar's FOUR. The polyrhythm is the
        # groove; without it this is a metronome with skins on.
        if stage >= 2:
            g = 0.5 if stage == 2 else 0.72
            for k3 in range(3):
                t = b + k3 * (BAR / 3)
                place(buf, conga(f=310 if k3 else 250, seed=bar_i * 7 + k3), t, g)

        # ---- shaker: eighths, doubling to sixteenths from the build on ----
        div = 8 if stage < 2 else 16
        sh_gain = (0.34, 0.5, 0.72, 0.85, 0.45)[stage]
        for k in range(div):
            t = b + k * (BAR / div)
            if t >= seconds:
                break
            if k == 0:
                continue  # leave the downbeat to the kick
            place(buf, shaker(seed=int(t * 1000)), t, sh_gain * (1.0 if k % 2 else 0.6))

        # ---- release: a descending tom fill under the tiles lifting out ----
        if stage == 4:
            for k, (f0, f1, g) in enumerate(
                ((230, 120, 0.55), (200, 100, 0.62), (170, 85, 0.72), (140, 70, 0.8))
            ):
                place(buf, tom(dur=0.34, f0=f0, f1=f1), b + BEAT * 2 + k * (BEAT / 2), g)

    # Soft-clip rather than peak-normalise. Normalising to the drop would duck
    # every other bar to make room for one hit; a gentle tanh keeps the arc and
    # still leaves headroom for the re-encode every platform performs.
    peak = max(abs(v) for v in buf) or 1.0
    pre = 1.35 / peak
    return [math.tanh(v * pre) * 0.78 for v in buf]


def write_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(
            b"".join(
                struct.pack("<h", max(-32768, min(32767, int(v * 32767))))
                for v in samples
            )
        )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--out", default="C:/zzz/_hex-promo/hex-drums.wav")
    a = ap.parse_args()
    bars = a.seconds / BAR
    if abs(bars - round(bars)) > 1e-9:
        raise SystemExit(
            f"{a.seconds}s is not a whole number of bars at {BPM:g} BPM "
            f"(bar = {BAR:g}s). The loop would click."
        )
    if abs((bars / PHRASE_BARS) - round(bars / PHRASE_BARS)) > 1e-9:
        raise SystemExit(
            f"{a.seconds}s is {bars:g} bars, not a whole number of "
            f"{PHRASE_BARS}-bar phrases. The arc would be cut mid-build."
        )
    write_wav(a.out, build(a.seconds))
    print(
        f"{a.out}  {a.seconds:g}s  {bars:g} bars  "
        f"{bars / PHRASE_BARS:g} phrase(s) @ {BPM:g} BPM"
    )
