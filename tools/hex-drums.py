"""A loop-locked percussion bed for the Hex Cluster clips.

WHY THIS EXISTS AS CODE rather than a purchased loop: the clips are exact
video loops (300 frames, 10.000 s, seam-verified), and an audio bed that does
not divide that duration will click every lap even though the picture does not.
Synthesising it means the bar length is chosen to fit the clip instead of the
clip being trimmed to fit the bar.

120 BPM: beat = 0.5 s, bar = 2 s, so the default 10 s clip is exactly 5 bars.
The video choreography is laid on the same grid, so the placements land on bar
downbeats (2.0 s and 4.0 s) and the explode on bar 4 (6.0 s).

LOOP SAFETY IS THE WHOLE POINT. Any hit whose decay would run past the end is
WRAPPED to the head of the buffer rather than truncated. A truncated tail is
the click; a wrapped one is what makes the last lap flow into the first.

This is a scratch bed, not a produced track. Stdlib only, no numpy: it writes
16-bit PCM WAV at 48 kHz, which is the rate YouTube's spec asks for.

    python tools/hex-drums.py                 # 10 s, 5 bars
    python tools/hex-drums.py --seconds 30    # 15 bars, for a Shorts cut
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
    bars = seconds / BAR

    b = 0.0
    while b < seconds - 1e-9:
        bar_i = int(b / BAR)
        last_bar = bar_i == int(bars) - 1

        # Heartbeat: two kicks per bar, the second softer. Steady, not busy.
        place(buf, kick(), b, 0.95)
        place(buf, kick(dur=0.4), b + BEAT * 2, 0.55)

        # Toms answer on the offbeats, alternating pitch so it walks.
        place(buf, tom(f0=190, f1=95), b + BEAT * 1.5, 0.5)
        place(buf, tom(f0=150, f1=78), b + BEAT * 3.5, 0.42)

        # Shakers on eighths, dropped on the downbeat so the kick is clean.
        for k in range(8):
            t = b + k * (BEAT / 2)
            if t >= seconds:
                break
            if k == 0:
                continue
            place(buf, shaker(seed=int(t * 1000)), t, 0.9 if k % 2 else 0.55)

        # Closing fill on the last bar: eighths under the tiles lifting out.
        if last_bar:
            for k, g in ((5, 0.5), (6, 0.62), (7, 0.78)):
                place(buf, tom(dur=0.3, f0=210, f1=110), b + k * (BEAT / 2), g)
        b += BAR

    # Normalise with headroom. Peaking at 1.0 would clip on any platform that
    # re-encodes, and every one of them re-encodes.
    peak = max(abs(v) for v in buf) or 1.0
    scale = 0.72 / peak
    return [v * scale for v in buf]


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
    if abs((a.seconds / BAR) - round(a.seconds / BAR)) > 1e-9:
        raise SystemExit(
            f"{a.seconds}s is not a whole number of bars at {BPM:g} BPM "
            f"(bar = {BAR:g}s). The loop would click."
        )
    write_wav(a.out, build(a.seconds))
    print(f"{a.out}  {a.seconds:g}s  {a.seconds / BAR:g} bars @ {BPM:g} BPM")
