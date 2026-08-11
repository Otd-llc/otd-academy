"""The L1.01 beta promo bed: FOUR landings, not one drop.

WHY THIS IS NOT hex-bed.py WITH DIFFERENT SAMPLES. The Hex cut has a single
dramatic event and the whole arrangement exists to serve it: sparse, stated,
build, DROP on the explode, release. The academy cut has FOUR events that each
have to land, one per word, on consecutive bar downbeats:

    bar 1   0.0 s   open, the sheets are still closed
    bar 2   2.0 s   DESIGN.   the sheets explode
    bar 3   4.0 s   BUILD.    the collapse hands over to the board
    bar 4   6.0 s   LEARN.    the cursor clicks the last exam answer
    bar 5   8.0 s   EARN.     the certificate, and the URL

Pointing hex-bed.py's single-drop arc at this would put its whole weight on bar
4 and leave the payoff bar limp, so the arc is rebuilt: four strikes of RISING
weight, each with its own approach, and the last one the biggest thing in the
piece. That is a different composition, not a different kit.

LEARN IS DELIBERATELY NOT LOUDER. It is the third of four and the picture there
is a cursor clicking one radio button, not an impact. Escalating by volume
alone would make it a smaller version of EARN and flatten the shape. It
escalates by CHANGING COLOUR instead: a dry mechanical click against three
struck hits. Weight goes 0.55, 0.78, 0.70, 1.00, and the dip at LEARN is the
point.

WHAT IS INHERITED WHOLESALE from tools/hex-bed.py, because none of it was ever
the problem and re-deriving it would only introduce drift:
  * 120 BPM, beat 0.5 s, bar 2 s, five bars, 10.000 s, frame-for-frame with the
    video
  * the helpers: placement, ramps, reversal, the sine sub, sidechaining, and the
    two-lap reverb whose tail wraps rather than truncates
  * CC0 samples verified per sound by tools/hex-samples.py

It is IMPORTED rather than copied. The filename has a hyphen so it cannot be
imported by name; importlib loads it by path. One definition of "place a sample
at a time" is the point.

Finish with the existing chain, which is unchanged and needs no academy variant:

    python tools/academy-bed.py --kit forge
    python tools/hex-master.py --kit ../../_hex-promo/kits/academy-bed-forge   # see --help
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
PHRASE_BARS = 5
SECONDS = BAR * PHRASE_BARS  # 10.000

read_wav, place, place_end = _HB.read_wav, _HB.place, _HB.place_end
place_ramp, place_peak, lowpass = _HB.place_ramp, _HB.place_peak, _HB.lowpass
sub_note, sub_rise, sidechain, reverb = _HB.sub_note, _HB.sub_rise, _HB.sidechain, _HB.reverb
write_wav = _HB.write_wav

# The four landings, by bar index. Bar 0 opens and carries nothing.
DESIGN, BUILD, LEARN, EARN = 1, 2, 3, 4
WEIGHT = {DESIGN: 0.55, BUILD: 0.78, LEARN: 0.70, EARN: 1.00}

KITS = {
    # ── THE BENCH. The academy palette. ──────────────────────────────────────
    # Distinctly different from Hex, same family. Family is what they SHARE: the
    # 120 BPM grid, the arc, the sine sub underneath, the convolved room, the
    # finishing chain. Difference has to come from MATERIAL, because that is the
    # only axis left, and the first academy beds reused Hex's taiko and gong,
    # which is exactly why they sounded like Hex with the parts moved around.
    #
    # The material is the subject: the lesson builds a circuit board, so the kit
    # is a workshop. Struck metal instead of struck skin, switchgear instead of
    # woodblock, an electrical arc instead of a reversed cymbal. An anvil and a
    # taiko are both a big low strike with a long tail, which is what keeps this
    # in the family instead of making it a different genre.
    "bench": dict(
        desc="Anvil carries it. A 125 kg Lokomo on 6 mm steel, a light switch on LEARN.",
        kick="kick/wav/673502.wav", hit="anvil/wav/386130.wav",
        alt="anvil/wav/386124.wav", low="hammer/wav/784152.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/256839.wav",
        gong="clank/wav/340615.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav",
        space=0.16, sub=0.55, click_gain=0.55,
    ),
    "bench-arc": dict(
        desc="An electrical arc rising into every landing instead of a reversed cymbal.",
        kick="kick/wav/673502.wav", hit="anvil/wav/386130.wav",
        alt="anvil/wav/386124.wav", low="hammer/wav/784152.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/256839.wav",
        gong="clank/wav/340615.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", reverse="spark/wav/341609.wav",
        accent="spark/wav/189630.wav",
        space=0.18, sub=0.55, swell_every=True,
    ),
    "bench-shop": dict(
        desc="A working shop. Drill and dropped metal tick between the landings.",
        kick="kick/wav/673502.wav", hit="anvil/wav/386130.wav",
        alt="anvil/wav/386124.wav", low="hammer/wav/784152.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/556631.wav",
        gong="clank/wav/340615.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", tick="clank/wav/825095.wav",
        accent="servo/wav/551504.wav",
        space=0.12, sub=0.58, machine=True,
    ),
    "bench-forge": dict(
        desc="Heaviest. Anvil and plate layered, the hot-steel strike on EARN.",
        kick="kick/wav/78815.wav", hit="anvil/wav/386117.wav",
        alt="anvil/wav/386124.wav", low="hammer/wav/784154.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/556632.wav",
        gong="clank/wav/835169.wav", subdrop="subdrop/wav/348242.wav",
        riser="sub/wav/754771.wav", reverse="spark/wav/393066.wav",
        space=0.20, sub=0.62,
    ),

    # ── THE HEX FAMILY. Kept as the thing to compare against. ────────────────
    "forge": dict(
        desc="Taiko carries it. Four struck landings, EARN the biggest, dry click on LEARN.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", click="rim/wav/368520.wav",
        gong="gong/wav/749466.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav",
        space=0.16, sub=0.55,
    ),
    "forge-hush": dict(
        desc="A beat of silence before EARN. The gap is what makes the payoff land.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", click="rim/wav/368520.wav",
        gong="gong/wav/749466.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav",
        space=0.16, sub=0.55, earn_gap=0.5,
    ),
    "forge-swell": dict(
        desc="A reverse swell running into every landing, so each word is approached.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", click="rim/wav/368520.wav",
        gong="gong/wav/749466.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", reverse="reverse/wav/503812.wav",
        space=0.18, sub=0.55, swell_every=True,
    ),
    "forge-roll": dict(
        desc="An accelerating fill through bar 4, so LEARN runs into EARN instead of resetting.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/685559.wav",
        drop="impact/wav/718004.wav", click="rim/wav/368520.wav",
        gong="gong/wav/749466.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", fill="roll/wav/809821.wav",
        space=0.16, sub=0.55,
    ),
    "sparse": dict(
        desc="Minimal. Almost no kit between the landings, so the type carries the cut.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801830.wav",
        alt="taiko/wav/801832.wav", low="tom/wav/459217.wav",
        drop="impact/wav/748752.wav", click="rim/wav/368522.wav",
        gong="gong/wav/616295.wav", subdrop="subdrop/wav/221361.wav",
        riser="sub/wav/649760.wav",
        space=0.22, sub=0.5, sparse=True,
    ),
    "machine": dict(
        desc="Harder and more mechanical. Rim work between landings, tighter room.",
        kick="kick/wav/581454.wav", hit="taiko/wav/802248.wav",
        alt="taiko/wav/347126.wav", low="tom/wav/808592.wav",
        drop="impact/wav/755054.wav", click="rim/wav/368523.wav",
        gong="gong/wav/813053.wav", subdrop="subdrop/wav/348242.wav",
        riser="sub/wav/757897.wav",
        space=0.10, sub=0.6, machine=True,
    ),
}

ROLES = ("kick", "hit", "alt", "low", "drop", "click", "gong", "subdrop", "riser")

# The approach to EARN may not start before this, measured back from the hit.
# At a full bar it began exactly on LEARN and buried it: the click measured
# 0.69x the level of its own bar, so the third landing did not land. A riser is
# supposed to approach the next event, not erase the previous one.
APPROACH_MAX = 1.0


def tail(snd, seconds):
    """The last `seconds` of a sample, so a riser can be given a shorter run-up."""
    keep = int(seconds * SR)
    return snd[-keep:] if len(snd) > keep else snd


def build(kit_name):
    k = KITS[kit_name]
    S = {r: read_wav(os.path.join(SAMPLES, k[r])) for r in ROLES if k.get(r)}
    for r in ("reverse", "fill", "accent", "tick"):
        if k.get(r):
            S[r] = read_wav(os.path.join(SAMPLES, k[r]))
    # An 8 s electricity recording used as an approach is a DRONE, not a riser.
    # Reversing it puts the dense end at the landing, and APPROACH_MAX keeps
    # only the last second, so what arrives is an arc striking rather than a
    # buzz that has been running since the previous bar.
    if k.get("reverse") and "spark/" in k["reverse"]:
        S["reverse"] = S["reverse"][::-1]

    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    sub = [0.0] * n
    kicks = []
    root, fourth, fifth = 55.0, 41.25, 36.7
    sparse = k.get("sparse", False)
    machine = k.get("machine", False)
    gap = k.get("earn_gap", 0.0)

    for bar_i in range(PHRASE_BARS):
        b = bar_i * BAR
        w = WEIGHT.get(bar_i, 0.35)

        # ── the landing on this bar's downbeat ───────────────────────────────
        if bar_i == 0:
            # THE OPENING STRIKE IS HELD BACK. It lands on the previous lap's
            # tail, and at full weight it reads as a restart rather than as the
            # top of the phrase. Same reason hex-bed softens its first beat.
            place(buf, S["kick"], b, 0.4)
            kicks.append(b)

        elif bar_i == LEARN:
            # A CLICK, NOT A HIT. The picture is a cursor selecting an answer.
            # A struck landing here would be a smaller EARN and would flatten
            # the shape; a dry mechanical sound is a different KIND of event, so
            # it can be quieter than the hit before it and still register.
            # A rim is 20 ms of energy against a bar of sustained kit, so it
            # needs real gain to read as an event even though it is the quiet
            # landing of the four. Quiet in ENERGY, not in presence.
            # Enough gain to cut through as an event, not so much that it
            # out-peaks BUILD: at 1.9 it did, which put the third landing above
            # the second and flattened the climb it exists inside. A rim is
            # bright and dry against a dark bed, so it reads well below the
            # struck hits.
            # Set against the MASTERED file, not this one. EARN ends up pinned
            # at the true-peak ceiling by definition, so the only way the payoff
            # can read is if LEARN sits clearly below it: at 1.25 the two came
            # out 1.16x apart after mastering, which is not a payoff. It still
            # measures 5x above its own bar, so presence was never the problem.
            # PER-KIT, because recorded levels vary and the shape must not.
            # relay/256839 is hot enough that at a flat gain it peaked ABOVE
            # BUILD and inverted the climb, while relay/556632 in the same slot
            # sat well under. A kit that swaps a sample has to be able to
            # re-balance it.
            cg = k.get("click_gain", 1.0)
            place(buf, S["click"], b, w * cg)
            place(buf, S["kick"], b, w * 0.5)
            kicks.append(b)
            if not sparse:
                # A second click a sixteenth later: the button, then the commit.
                place(buf, S["click"], b + BEAT * 0.25, w * 0.45 * cg)

        elif bar_i == EARN:
            # THE PAYOFF, LAYERED. A drop is several things arriving together,
            # not one thing arriving loudly: body, skin, top, and something felt.
            place(buf, S["drop"], b, w)
            place(buf, S["hit"], b, w * 0.7)
            place(buf, S["kick"], b, w * 0.9)
            kicks.append(b)
            if "gong" in S:
                place(buf, S["gong"], b, w * 0.55)
            if "subdrop" in S:
                place(buf, S["subdrop"], b, w * 0.8)

        else:
            place(buf, S["kick"], b, w)
            place(buf, S["hit"], b, w * 0.75)
            kicks.append(b)

        # ── the approach to the NEXT landing ────────────────────────────────
        # Everything that builds is placed by its END, because what a riser is
        # for is the thing it arrives on.
        nxt = b + BAR
        if bar_i < EARN:
            landing = nxt - (gap if bar_i == EARN - 1 else 0.0)
            # CAPPED, so the approach cannot start on top of the landing it is
            # approaching FROM. Uncapped, the reverse swell ran the whole bar and
            # the LEARN click sat underneath it at 0.69x its own bar.
            if k.get("swell_every") and "reverse" in S:
                place_end(buf, tail(S["reverse"], APPROACH_MAX), landing, 0.35 + 0.2 * bar_i)
            elif bar_i == EARN - 1:
                # Always approach the payoff, whatever the kit.
                if "reverse" in S:
                    place_end(buf, tail(S["reverse"], APPROACH_MAX), landing, 0.9)
                else:
                    place_end(buf, sub_rise(APPROACH_MAX), landing, 0.75)
            if "fill" in S and bar_i == EARN - 1:
                # ACCELERANDO BY VELOCITY. A fill at constant level is a texture,
                # not a build; it needs a rising envelope as well as real gain.
                place_ramp(buf, tail(S["fill"], APPROACH_MAX), landing, 0.25, 2.4)

        # ── between the landings ────────────────────────────────────────────
        if not sparse and bar_i >= DESIGN:
            place(buf, S["kick"], b + BEAT * 2, w * 0.45)
            kicks.append(b + BEAT * 2)
            place(buf, S["hit"], b + BEAT * 1.5, w * 0.42)
            if bar_i >= BUILD:
                place(buf, S["alt"], b + BEAT * 3.5, w * 0.40)
                place(buf, S["low"], b + BEAT * 2.75, w * 0.34)
            if machine and "tick" in S:
                for j in (1.25, 2.25, 3.25):
                    place(buf, S["tick"], b + BEAT * j, w * 0.30)
            elif machine and "click" in S:
                for j in (1.25, 2.25, 3.25):
                    place(buf, S["click"], b + BEAT * j, w * 0.22)
            # A short accent on the offbeat before each landing: the spark or
            # the drill, so the bed sounds powered rather than only struck.
            if "accent" in S and bar_i >= DESIGN:
                place(buf, tail(S["accent"], 0.5), b + BEAT * 3.5, w * 0.34)

        # ── the sub ─────────────────────────────────────────────────────────
        # Moves to the fourth under EARN and resolves on the last bar, so the
        # loop has somewhere to come back FROM.
        f = fourth if bar_i == EARN else (fifth if bar_i == LEARN else root)
        g = (0.4, 0.6, 0.72, 0.62, 1.0)[bar_i]
        for i, v in enumerate(sub_note(BAR * 0.85, f, gain=g)):
            sub[(int(b * SR) + i) % n] += v

    # THE STOPDOWN. Cut the dry bed for the last fraction of bar 4 so EARN
    # arrives out of nothing. Applied BEFORE the reverb, so the room cuts with
    # it: a gap that still has reverb ringing through it is a duck, not a gap.
    if gap > 0:
        end = EARN * BAR
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


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", default="forge", choices=sorted(KITS) + ["all"])
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(_HB.SAMPLES), "kits"))
    a = ap.parse_args()

    names = sorted(KITS) if a.kit == "all" else [a.kit]
    os.makedirs(a.out_dir, exist_ok=True)
    for name in names:
        s = build(name)
        path = os.path.join(a.out_dir, f"academy-bed-{name}.wav")
        write_wav(path, s)
        rms = math.sqrt(sum(v * v for v in s) / len(s))
        print(f"{path}\n  {SECONDS:.3f} s  peak {max(abs(v) for v in s):.3f}  rms {rms:.4f}"
              f"\n  {KITS[name]['desc']}")
