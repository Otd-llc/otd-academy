"""Beds for the video furniture: a 2-bar intro sting and a 4-bar outro.

WHY THIS IS NOT academy-bed.py WITH A DIFFERENT LENGTH. That file is one
composition -- a five-bar phrase carrying four named landings (DESIGN, BUILD,
LEARN, EARN) for the beta promo, with an arc built around those words. The
furniture needs something else entirely: two short pieces whose landings are
dictated by what the PICTURE does, not by a script. Re-pointing the promo's arc
at a 2-bar sting would put its whole shape somewhere the picture has no event.

Same argument academy-bed.py makes for not being hex-bed.py with different
samples, applied one level down. What is shared is the family: 120 BPM, the
bench palette, the sine sub, the convolved room, the tanh finish.

THE LANDINGS ARE NOT CHOSEN HERE. They are read off the retimed furniture, which
is on the same grid because meter.ts and hex-bed.py agree on 120 BPM / 0.5 s beat
/ 2.0 s bar. That agreement is the whole reason these can be cut separately and
still land together:

    intro, 2 bars (4.0 s)
      bar 0            the comb arrives, the run travels
      bar 1   t=2.0    THE LANDING -- the three names dissolve in together
                       and hold to the end

    outro, 4 bars (8.0 s)
      bar 0            the comb arrives, the rule draws
      bar 1   t=2.0    the names land
      bar 2   t=4.0    the hand-over -- the run travels one cell
      bar 3   t=6.0    THE PAYOFF -- the jaws close on it
      (rest)           the last bar rings out under a held frame

ESCALATION IS BY WEIGHT AND BY KIND, not by volume alone. The outro's three
landings go 0.55 / 0.78 / 1.00, and the last one is LAYERED -- body, strike and
something felt arriving together -- because a drop is several things at once
rather than one thing louder. That is the lesson academy-bed.py records and it
applies unchanged.

THE INTRO IS DELIBERATELY SMALL. It is two bars in front of a lesson, not a
trailer. One landing, no gong, no sub drop: if the opening sting is the biggest
sound in the video then everything after it is an anticlimax.

    python tools/furniture-bed.py                 both, default kit
    python tools/furniture-bed.py --piece outro   one
    python tools/furniture-bed.py --kit bench-arc

ASCII only.
"""

import argparse
import importlib.util
import math
import os

_SPEC = importlib.util.spec_from_file_location(
    "hex_bed", os.path.join(os.path.dirname(os.path.abspath(__file__)), "hex-bed.py")
)
_HB = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_HB)

SR, BEAT, BAR = _HB.SR, _HB.BEAT, _HB.BAR
SAMPLES = _HB.SAMPLES
read_wav, place = _HB.read_wav, _HB.place
sub_note, sidechain, reverb = _HB.sub_note, _HB.sidechain, _HB.reverb
write_wav = _HB.write_wav

# The bench palette, from academy-bed.py. Struck metal and switchgear: the
# subject is a workshop, and the furniture belongs to the same subject as the
# promo it will sit near.
KITS = {
    "bench": dict(
        desc="Anvil and hammer. The academy's own palette.",
        kick="kick/wav/673502.wav", hit="anvil/wav/386130.wav",
        alt="anvil/wav/386124.wav", low="hammer/wav/784152.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/256839.wav",
        gong="clank/wav/340615.wav", riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
    ),
    "bench-arc": dict(
        desc="An electrical arc rising into each landing.",
        kick="kick/wav/673502.wav", hit="anvil/wav/386130.wav",
        alt="anvil/wav/386124.wav", low="hammer/wav/784152.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/256839.wav",
        gong="clank/wav/340615.wav", riser="sub/wav/754771.wav",
        reverse="spark/wav/341609.wav", accent="spark/wav/189630.wav",
        space=0.18, sub=0.55,
    ),
}

ROLES = ("kick", "hit", "alt", "low", "drop", "click", "gong", "riser", "reverse", "accent")

# bars, and the weight of the landing on each bar's downbeat. Bar 0 opens and
# carries no landing in either piece -- it is the approach.
PIECES = {
    "intro": dict(bars=2, landings={1: 1.00}, desc="One landing, where the names arrive."),
    "outro": dict(bars=4, landings={1: 0.55, 2: 0.78, 3: 1.00},
                  desc="Three landings: names, hand-over, and the lock."),
}


def tail(snd, seconds):
    """The last `seconds` of a sample, so a long recording can be an approach
    rather than a drone that has been running since the previous bar."""
    n = int(seconds * SR)
    return snd[-n:] if len(snd) > n else snd


def build(piece_name, kit_name):
    p = PIECES[piece_name]
    k = KITS[kit_name]
    S = {r: read_wav(os.path.join(SAMPLES, k[r])) for r in ROLES if k.get(r)}
    # An 8 s electricity recording used as an approach is a DRONE, not a riser.
    # Reversed, the dense end lands on the beat.
    if k.get("reverse") and "spark/" in k["reverse"]:
        S["reverse"] = S["reverse"][::-1]

    bars = p["bars"]
    seconds = BAR * bars
    n = int(round(seconds * SR))
    buf = [0.0] * n
    sub = [0.0] * n
    kicks = []
    root, fifth = 55.0, 36.7
    last = max(p["landings"])

    for bar_i in range(bars):
        b = bar_i * BAR
        w = p["landings"].get(bar_i, 0.0)

        if bar_i == 0:
            # THE OPENING IS HELD BACK, deliberately soft. The picture at t=0 is
            # an empty frame that things are about to arrive into; a full strike
            # here would be the biggest event in a piece whose point is what
            # comes later.
            place(buf, S["kick"], b, 0.34)
            kicks.append(b)

        elif bar_i == last:
            # THE PAYOFF, LAYERED. Body, strike and weight together -- a drop is
            # several things arriving at once, not one thing arriving loudly.
            place(buf, S["drop"], b, w)
            place(buf, S["hit"], b, w * 0.7)
            place(buf, S["kick"], b, w * 0.9)
            kicks.append(b)
            if "gong" in S and piece_name != "intro":
                # No gong on the intro: a long shimmering tail in front of a
                # lesson is a trailer gesture, and it would still be ringing
                # when the narration starts.
                place(buf, S["gong"], b, w * 0.5)

        else:
            # An intermediate landing. Struck, but plainly -- these escalate
            # toward the payoff and must not compete with it.
            place(buf, S["hit"], b, w)
            place(buf, S["kick"], b, w * 0.8)
            kicks.append(b)

        # ── the approach into the NEXT landing ──────────────────────────────
        if bar_i + 1 in p["landings"]:
            nxt = p["landings"][bar_i + 1]
            if "reverse" in S:
                place(buf, tail(S["reverse"], 1.0), b + BEAT * 3, nxt * 0.40)
            elif "riser" in S:
                place(buf, tail(S["riser"], 1.0), b + BEAT * 3, nxt * 0.34)
            if "accent" in S:
                place(buf, tail(S["accent"], 0.5), b + BEAT * 3.5, nxt * 0.30)

        # ── the pulse between landings ──────────────────────────────────────
        # Enough to say the bed is running; not so much that the bar has its own
        # rhythm competing with the picture's one event.
        if bar_i < last:
            place(buf, S["kick"], b + BEAT * 2, max(0.22, w * 0.45))
            kicks.append(b + BEAT * 2)
            place(buf, S["low"], b + BEAT * 2.75, max(0.16, w * 0.30))

        # ── the sub ─────────────────────────────────────────────────────────
        # Drops to the fifth under the payoff so the last bar has somewhere to
        # resolve from.
        f = fifth if bar_i == last else root
        g = 0.42 + 0.5 * (bar_i / max(1, bars - 1))
        for i, v in enumerate(sub_note(BAR * 0.85, f, gain=g)):
            j = int(b * SR) + i
            if j < n:
                sub[j] += v

    # One lap through the room. These pieces do not loop -- an intro plays once
    # and hands over -- so unlike the promo bed there is no second lap to keep.
    buf = reverb(buf, k["space"])[:n]
    sub = sidechain(sub, kicks)
    buf = [buf[i] + sub[i] * k["sub"] for i in range(n)]

    # THE CLIPPER IS LOAD-BEARING, not a safety net: `tanh` COMPRESSES, and the
    # weight curve above is only met because of it. Do not swap this for a
    # normalise.
    peak = max(abs(v) for v in buf) or 1.0
    return [math.tanh(v * (1.1 / peak)) * 0.82 for v in buf]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--piece", default="all", choices=sorted(PIECES) + ["all"])
    ap.add_argument("--kit", default="bench", choices=sorted(KITS))
    # Served by the dev server so the preview surface can load them. Gitignored.
    ap.add_argument("--out-dir", default=os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "_beds"))
    a = ap.parse_args()

    os.makedirs(a.out_dir, exist_ok=True)
    names = sorted(PIECES) if a.piece == "all" else [a.piece]
    for name in names:
        s = build(name, a.kit)
        path = os.path.join(a.out_dir, f"{name}-bed-{a.kit}.wav")
        write_wav(path, s)
        secs = len(s) / SR
        rms = math.sqrt(sum(v * v for v in s) / len(s))
        bars = PIECES[name]["bars"]
        print(f"{path}\n  {secs:.3f} s = {bars} bars  peak {max(abs(v) for v in s):.3f}  rms {rms:.4f}"
              f"\n  landings on {sorted(PIECES[name]['landings'])} -> "
              f"{[f'{i * BAR:.1f}s' for i in sorted(PIECES[name]['landings'])]}"
              f"\n  {PIECES[name]['desc']}")

    # A MANIFEST OF WHAT ACTUALLY EXISTS ON DISK, not of what this run produced.
    # The preview surface populates its picker from this, so a bed that failed to
    # write cannot appear as an option -- an audition list containing a 404 is
    # worse than a short one.
    import json
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
                    kit=kit, file=fn,
                    bars=PIECES[piece]["bars"],
                    seconds=BAR * PIECES[piece]["bars"],
                    landings=[i * BAR for i in sorted(PIECES[piece]["landings"])],
                    desc=KITS.get(kit, {}).get("desc", ""),
                ))
    with open(os.path.join(a.out_dir, "index.json"), "w", encoding="ascii") as fh:
        json.dump(dict(bpm=int(round(60 / BEAT)), beat=BEAT, bar=BAR, pieces=beds), fh, indent=2)
    print(f"\nmanifest: {os.path.join(a.out_dir, 'index.json')}  "
          f"({sum(len(v) for v in beds.values())} beds)")
