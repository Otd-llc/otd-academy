"""The Hex Cluster percussion bed, built from CC0 samples rather than synthesis.

WHY THIS REPLACES hex-drums.py FOR THE BED. That file synthesised everything and
went through several rounds of fixes, each of which measured a real improvement:
the scooped 200-1500 Hz middle filled in, the metallic ring dropped, the loop's
downbeat stopped reading as a restart. It still did not sound good. The material
was wrong, not the arrangement, and no amount of further tuning was going to
change that. hex-drums.py stays for the SUB, which is a sine and synthesises
perfectly well; everything struck is now a recording.

WHAT CARRIES OVER UNCHANGED, because none of it was the problem:
  * 120 BPM, beat 0.5 s, bar 2 s, five bars to a 10.000 s loop that matches the
    video frame for frame
  * the arc: sparse, stated, build, DROP on the explode, release
  * tails WRAP to the head of the buffer rather than truncating, which is what
    makes it a loop instead of a clip of the right length
  * the sub is sidechained under every kick, so a strike still reads as an
    attack instead of merging with the note beneath it
  * the seam is measured, not asserted

SOURCES ARE CC0 AND VERIFIED PER SOUND. See tools/hex-samples.py: the search
filter is not trusted as the authority, every result's licence field is checked
independently, and provenance is written beside the audio. CC0 requires no
attribution and permits both commercial use and redistribution, which matters
because these files get committed and that is redistribution rather than use.

    python tools/hex-bed.py                    # 10 s
    python tools/hex-bed.py --kit taiko-led    # a different sample selection
"""

import argparse
import json
import math
import os
import struct
import wave

SR = 48_000
BPM = 120.0
BEAT = 60.0 / BPM
BAR = BEAT * 4
PHRASE_BARS = 5
SAMPLES = "C:/zzz/_hex-promo/samples"

# Selections, by role. Several so the character can be auditioned rather than
# argued about, in the same spirit as the synth kits.
KITS = {
    "taiko-led": dict(
        desc="Taiko carries it. Deep toms on the backbeat, impact on the drop.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
    ),
    "taiko-reverse": dict(
        desc="Reverse swell running into the drop. No gap: the swell hands straight over.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
        reverse="reverse/wav/503812.wav",
    ),
    "taiko-hush": dict(
        desc="Reverse swell, then a BEAT OF SILENCE, then the drop. The gap is the trick.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
        reverse="reverse/wav/503812.wav", pre_gap=0.5,
    ),
    "taiko-roll": dict(
        desc="Accelerando snare fill through the build bar, velocity ramping into the hit.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
        fill="roll/wav/809821.wav",  # steady, not front-loaded
    ),
    "taiko-gong": dict(
        desc="A crash layered on the drop, so the impact has a top as well as a bottom.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
        gong="gong/wav/696209.wav",
    ),
    "taiko-subdrop": dict(
        desc="A sub drop under the impact. Felt rather than heard.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
        subdrop="subdrop/wav/338869.wav",
    ),
    "taiko-max": dict(
        desc="Everything: roll in, swell, silence, then impact with crash and sub together.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
        fill="roll/wav/809827.wav", reverse_fill=True,
        reverse="reverse/wav/503812.wav", pre_gap=0.5,
        gong="gong/wav/696209.wav", subdrop="subdrop/wav/338869.wav",
    ),
    "snap-clave": dict(
        desc="A clave on the beat. Near-instant attack, wooden, cuts through without foley.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        snap="rim/wav/368521.wav", snap_gain=0.55,
    ),
    "snap-clave-hot": dict(
        desc="The same clave, louder, so the beat reads as an event rather than a detail.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        snap="rim/wav/368521.wav", snap_gain=0.95,
    ),
    "snap-switch": dict(
        desc="A switch flip. Mechanical rather than musical: it sounds like something latching.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        snap="snap/wav/278205.wav", snap_gain=0.8,
    ),
    "snap-case": dict(
        desc="A case closing. The shortest of the set and the most percussive of the mechanisms.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        snap="snap/wav/835523.wav", snap_gain=0.85,
    ),
    "snap-lever": dict(
        desc="A lever throw. Longer, with some travel before it seats.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        snap="snap/wav/827344.wav", snap_gain=0.9,
    ),
    "snap-lock": dict(
        desc="A door lock. The heaviest, and the most obviously a recording of a real object.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        snap="snap/wav/140561.wav", snap_gain=0.6,
    ),
    "snap-none": dict(
        desc="The chosen bed with no snap accent, for comparison.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", riser="sub/wav/754771.wav",
        subdrop="subdrop/wav/338869.wav",
        space=0.16, sub=0.55,
        
    ),
    "kick-led": dict(
        desc="Kick forward, taiko answering. Tighter and more modern.",
        kick="kick/wav/584787.wav", hit="taiko/wav/801832.wav",
        alt="taiko/wav/802248.wav", low="tom/wav/808592.wav",
        drop="impact/wav/749957.wav", riser="sub/wav/649066.wav",
        space=0.12, sub=0.62,
    ),
    "cavernous": dict(
        desc="Longest samples and the most room. Every hit hangs.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801830.wav",
        alt="taiko/wav/801857.wav", low="tom/wav/459217.wav",
        drop="impact/wav/748752.wav", riser="sub/wav/649760.wav",
        space=0.26, sub=0.5,
    ),
    "dry": dict(
        desc="Almost no added room. The samples' own space only.",
        kick="kick/wav/673502.wav", hit="taiko/wav/802248.wav",
        alt="taiko/wav/801830.wav", low="tom/wav/685559.wav",
        drop="impact/wav/755054.wav", riser="sub/wav/754771.wav",
        space=0.04, sub=0.58,
    ),
}


def read_wav(path):
    with wave.open(path, "rb") as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = struct.unpack(f"<{n * ch}h", w.readframes(n))
    if ch == 2:
        raw = [(raw[i] + raw[i + 1]) * 0.5 for i in range(0, len(raw), 2)]
    if sr != SR:  # the fetch normalises to 48k, so this is a guard not a resampler
        raise SystemExit(f"{path} is {sr} Hz, expected {SR}")
    out = [v / 32768.0 for v in raw]
    # NORMALISE ON LOAD, so a placement gain means the same thing whatever the
    # source was recorded at. Uploads vary enormously: the kick and taiko arrive
    # at peak 1.00 while the snare fills peak at 0.40 and one is at 0.02. Before
    # this, `gain=0.75` on a quiet fill produced something five times below the
    # bed and inaudible, which reads as "the variant does nothing" rather than
    # "the sample was quiet".
    peak = max((abs(v) for v in out), default=0.0)
    if peak > 1e-6:
        out = [v / peak for v in out]
    return out


def place(buf, snd, at_s, gain=1.0):
    """Mix a hit in, WRAPPING any tail past the end back to the head."""
    start = int(at_s * SR)
    n = len(buf)
    for i, v in enumerate(snd):
        buf[(start + i) % n] += v * gain


def place_end(buf, snd, end_s, gain=1.0):
    """Place so the sound ENDS at `end_s`. Risers are positioned by their
    landing, never their start: the point of a riser is what it arrives on."""
    place(buf, snd, end_s - len(snd) / SR, gain)


def place_ramp(buf, snd, end_s, g0, g1, curve=2.2):
    """Place a sustained sample so it ENDS at `end_s`, rising from g0 to g1.

    A steady snare fill at a flat level is a texture; the same fill with its
    level climbing is a BUILD. This is the velocity ramp a player would
    perform, applied as a gain envelope because the sample is already recorded
    at one dynamic. The curve is exponential so most of the growth happens late,
    which is what makes the arrival feel inevitable rather than linear.
    """
    n = len(buf)
    start = int((end_s - len(snd) / SR) * SR)
    L = len(snd)
    for i, v in enumerate(snd):
        t = i / max(1, L - 1)
        buf[(start + i) % n] += v * (g0 + (g1 - g0) * (t**curve))


def place_peak(buf, snd, at_s, gain=1.0):
    """Place so the sample's LOUDEST MOMENT lands on the beat, not its first
    sample.

    Recordings of mechanisms carry leading silence: measured on this set, the
    toggle switches peak 267 and 387 ms in, and a case latch 121 ms in, while
    the claves peak in 6 to 8 ms. Aligning by the start would put the audible
    click a third of a beat late at 120 BPM, which reads as sloppy timing
    rather than as a late sample. Aligning by the peak makes any of them
    usable, whatever silence they were recorded with.
    """
    peak_i = max(range(len(snd)), key=lambda i: abs(snd[i])) if snd else 0
    place(buf, snd, at_s - peak_i / SR, gain)


def sub_note(dur, f, gain=1.0, curve=1.6):
    """Sine sub. Kept synthetic on purpose: a sine is exactly what a synth is
    good at, and it is the one element the sampled rounds never faulted."""
    n = int(dur * SR)
    out = []
    p1 = p2 = 0.0
    for i in range(n):
        e = math.exp(-curve * (i / max(1, dur * SR * 0.75)))
        p1 += 2 * math.pi * f / SR
        p2 += 2 * math.pi * f * 1.004 / SR
        out.append((math.sin(p1) + 0.7 * math.sin(p2)) * e * gain * 0.5)
    return out


def sidechain(buf, hits, depth=0.7, dur=0.3):
    n = len(buf)
    gain = [1.0] * n
    w = int(dur * SR)
    for t in hits:
        s = int(t * SR)
        for i in range(w):
            k = (s + i) % n
            g = 1.0 - depth * math.exp(-4.0 * i / w)
            if g < gain[k]:
                gain[k] = g
    return [buf[i] * gain[i] for i in range(n)]


def reverb(buf, mix, decay=0.5, room=1.7, damp=0.5):
    """Damped combs into allpasses. Light here by design: the samples arrive
    with their own room, and stacking a second one on top is how a bed turns
    to soup."""
    if mix <= 0.001:
        return buf
    n = len(buf)
    combs = [int(d * room) for d in (1214, 1293, 1390, 1475, 1548, 1622, 1694, 1759)]
    fb = 0.80 + 0.16 * decay
    acc = [0.0] * n
    for delay in combs:
        d = [0.0] * n
        store = 0.0
        for i in range(n):
            out = d[i - delay]
            store = out * (1 - damp) + store * damp
            d[i] = buf[i] + store * fb
        for i in range(n):
            acc[i] += d[i] * 0.125
    for delay, g in ((605, 0.7), (480, 0.7), (371, 0.7), (245, 0.7)):
        dl = int(delay * room)
        out = [0.0] * n
        for i in range(n):
            out[i] = -g * acc[i] + acc[i - dl] + g * out[i - dl]
        acc = out
    return [buf[i] * (1 - mix) + acc[i] * mix for i in range(n)]


def build(seconds, kit_name, open_beat="soft"):
    k = KITS[kit_name]
    S = {r: read_wav(os.path.join(SAMPLES, k[r])) for r in ("kick", "hit", "alt", "low", "drop", "riser")}
    # Optional drama parts. Absent means that kit simply does not use it, which
    # is how the variants stay comparable: the accent beats below never change.
    for r in ("reverse", "fill", "gong", "subdrop", "snap"):
        if k.get(r):
            S[r] = read_wav(os.path.join(SAMPLES, k[r]))
    # REVERSING TURNS A DECAY INTO A SWELL, which is the whole reverse-riser
    # trick and it costs one list slice. Needed because most "fill" and "roll"
    # uploads are front-loaded: they start loud and decay. Placed to land on the
    # drop and given a rising ramp, a front-loaded sample fights the ramp, and
    # the result measured as a 2% contribution that was placed perfectly and
    # could not be heard.
    if k.get("reverse_fill") and "fill" in S:
        S["fill"] = S["fill"][::-1]
    n = int(round(seconds * SR))
    buf = [0.0] * n
    sub = [0.0] * n
    kicks = []
    root, fourth = 55.0, 41.25

    for bar_i in range(int(round(seconds / BAR))):
        b = bar_i * BAR
        stage = bar_i % PHRASE_BARS

        # THE LOOP'S OPENING STRIKE is the one the ear judges the seam by. At
        # full strength it lands on the previous lap's tail and reads as a
        # restart rather than a continuation.
        first = bar_i == 0
        kg = (0.7, 0.9, 0.95, 1.0, 0.8)[stage]
        if not (first and open_beat == "none"):
            place(buf, S["kick"], b, kg * (0.45 if (first and open_beat == "soft") else 1.0))
            kicks.append(b)

        if stage >= 1:
            place(buf, S["kick"], b + BEAT * 2, kg * 0.5)
            kicks.append(b + BEAT * 2)

        # Taiko answers off the beat, alternating so it walks rather than repeats.
        if stage >= 1:
            place(buf, S["hit"], b + BEAT * 1.5, 0.5 + 0.1 * stage)
        if stage >= 2:
            place(buf, S["alt"], b + BEAT * 3.5, 0.45 + 0.1 * stage)
        if stage >= 2:
            place(buf, S["low"], b + BEAT * 2.75, 0.4)

        # THE SNAP BEAT. The word at 4.0 s is two halves meeting, so this beat
        # gets its own accent on top of the kick: a mechanism closing rather
        # than another drum. Peak-aligned, because these are recordings of real
        # objects and they do not all start when they sound.
        if stage == 2 and "snap" in S:
            place_peak(buf, S["snap"], b, k.get("snap_gain", 0.7))

        # ---- the build ------------------------------------------------------
        # GAP is the device, not the volume. A short silence before the drop
        # makes the hit land harder than any amount of extra level, because the
        # ear reads the pause as the held breath. Everything that builds is
        # positioned to END at the gap rather than run through it.
        gap = k.get("pre_gap", 0.0)
        landing = b + BAR - gap

        if stage == 2:
            if "reverse" in S:
                # A back-loaded swell placed by its END, so its peak coincides
                # with the moment the music stops.
                place_end(buf, S["reverse"], landing, 0.9)
            else:
                place_end(buf, S["riser"], landing, 0.85)

            if "fill" in S:
                # ACCELERANDO BY VELOCITY. Measured first at a flat 0.75 and it
                # contributed +0.0026 RMS against a bed of 0.148, about 2%:
                # placed correctly and completely inaudible. It needs both real
                # gain and a rising envelope, because a fill at constant level
                # is a texture rather than a build.
                place_ramp(buf, S["fill"], landing, 0.25, 2.4)

        if stage == 3:
            # LAYERED. A drop is several things arriving together rather than
            # one thing arriving loudly: body, skin, top, and something felt.
            place(buf, S["drop"], b, 1.0)
            place(buf, S["hit"], b, 0.7)
            if "gong" in S:
                place(buf, S["gong"], b, 0.55)
            if "subdrop" in S:
                place(buf, S["subdrop"], b, 0.8)
            place(buf, S["kick"], b + BEAT * 2.5, 0.55)
            kicks.append(b + BEAT * 2.5)

        if stage == 4:
            for j, g in enumerate((0.45, 0.55, 0.68, 0.8)):
                src = S["hit"] if j % 2 else S["alt"]
                place(buf, src, b + BEAT * 2 + j * (BEAT / 2), g)

        f = fourth if stage == 3 else root
        g = (0.45, 0.65, 0.75, 1.0, 0.6)[stage]
        sub_seg = sub_note(BAR * 0.85, f, gain=g)
        for i, v in enumerate(sub_seg):
            sub[(int(b * SR) + i) % n] += v

    # THE STOPDOWN. Cut everything for the last fraction of the build bar so the
    # drop arrives out of nothing. Applied to the DRY bed, before the reverb, so
    # the room cuts with it: a gap that still has reverb ringing through it is
    # not a gap, it is a duck.
    gap = k.get("pre_gap", 0.0)
    if gap > 0:
        for bar_i in range(int(round(seconds / BAR))):
            if bar_i % PHRASE_BARS != 2:
                continue
            end = (bar_i + 1) * BAR
            s0, s1 = int((end - gap) * SR), int(end * SR)
            for i in range(s0, min(s1, len(buf))):
                t = (i - s0) / max(1, s1 - s0)
                buf[i] *= max(0.0, 1.0 - t * 1.6)

    # Two laps through the reverb, second kept, so the tail arriving at the loop
    # point is the one that just left it.
    wet = reverb(buf + buf, k["space"])
    buf = wet[len(buf):]

    sub = sidechain(sub, kicks)
    buf = [buf[i] + sub[i] * k["sub"] for i in range(n)]

    peak = max(abs(v) for v in buf) or 1.0
    return [math.tanh(v * (1.1 / peak)) * 0.82 for v in buf]


def write_wav(path, s):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", max(-32768, min(32767, int(v * 32767)))) for v in s))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", default="taiko-led", choices=sorted(KITS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--open", default="soft", choices=["hit", "soft", "none"])
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--outdir", default="C:/zzz/_hex-promo/kits")
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    prov = os.path.join(SAMPLES, "provenance.json")
    if not os.path.exists(prov):
        raise SystemExit("No provenance.json. Run tools/hex-samples.py --fetch first.")
    for name in (sorted(KITS) if a.all else [a.kit]):
        out = f"{a.outdir}/hex-bed-{name}.wav"
        write_wav(out, build(a.seconds, name, a.open))
        print(f"{out}  {a.seconds:g}s  {KITS[name]['desc']}")
