"""The Logbook cut's bed: four landings, plus the two events between them.

WHY THIS IS NOT academy-bed.py WITH A DIFFERENT KIT. That file already solves
four landings of rising weight on the 2/4/6/8 downbeats, and this film has the
same four. What it has no slot for is everything BETWEEN them, and this cut has
two such events that carry the story:

    bar 1   0.0 s   the question is up and being read
            1.5 s   THE ANSWER LANDS. One click, +5 XP. Beat four of bar one,
                    so it is a PICKUP into the first downbeat rather than an
                    event of its own - the cause, and LEARN is the label on it.
    bar 2   2.0 s   LEARN.     the word
    bar 3   4.0 s   GAIN.      the ring draws itself, the rank flips under it
    bar 4   6.0 s   RANK.      the wheel spins up and settles
    bar 5   8.0 s   PATCHES.   the patch drops in
            8.5 s   THE PLATING. The gold sweeps across the badge over 0.8 s.
                    A sweep, not a strike, and it is the last thing that
                    happens - so the piece has to still have somewhere to go
                    after its heaviest landing.
   10.0 / 0.0       the seam: the badge swings out, the question drops in

A bed with nothing at 1.5 leaves the film's FIRST event silent, and a bed that
ends on the 8.0 drop leaves the plating - the actual payoff, the moment the
badge becomes yours - happening over nothing.

THE WEIGHT CURVE IS INHERITED AND IT IS NOT A COINCIDENCE. 0.55 / 0.78 / 0.70 /
1.00, dip at the third. The academy cut justified that dip by its picture: "a
cursor clicking one radio button, not an impact". This film's third landing is a
rank wheel spinning up and settling - also small, also precise, also mechanical -
and the PICTURE was already built to that shape, with the wheel smaller and drier
than the ring before it. The curve fits because the cut was designed to it.

WHAT IS INHERITED WHOLESALE from tools/hex-bed.py, via academy-bed.py's example:
  * 120 BPM, beat 0.5 s, bar 2 s, five bars, 10.000 s, frame for frame
  * the helpers: placement, ramps, reversal, the sine sub, sidechaining, and the
    two-lap reverb whose tail WRAPS rather than truncating
  * CC0 samples, verified per sound by tools/hex-samples.py

Imported by path rather than copied, because hyphens are not importable and one
definition of "place a sample at a time" is the point.

    python tools/logbook-bed.py --kit relay
    python tools/logbook-bed.py --kit all
    python tools/hex-master.py --kit ../../_hex-promo/kits/logbook-bed-relay
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

read_wav, write_wav = _HB.read_wav, _HB.write_wav
place, place_end = _HB.place, _HB.place_end
sub_note, sub_rise = _HB.sub_note, _HB.sub_rise
sidechain, reverb = _HB.sidechain, _HB.reverb

# Bar indices of the four landings. Bar 0 carries the question and the pickup.
LEARN, GAIN, RANK, PATCH = 1, 2, 3, 4
WEIGHT = {LEARN: 0.55, GAIN: 0.78, RANK: 0.70, PATCH: 1.00}

# The two off-downbeat events, in seconds.
ANSWER = 1.5   # beat four of bar one
PLATE = 8.5    # half a bar after the last landing

# An approach may not start earlier than this before its landing. Inherited
# reasoning: uncapped, the swell into the payoff began on the previous landing
# and buried it, so a riser erased the event it was supposed to follow.
APPROACH_MAX = 1.0

# The wheel, as discrete ticks rather than a roll. Offsets from the RANK
# downbeat, with the gaps WIDENING - a rolodex decelerating into its stop. A
# roll sample played at falling gain reads as a fade; only the spacing reads as
# something slowing down. The last tick is the detent, and it lands on beat
# three of the bar rather than between beats, so the wheel stops ON the grid.
WHEEL = (0.02, 0.14, 0.28, 0.45, 0.66, 0.90, 1.00)

KITS = {
    "relay": dict(
        desc="Electrical. Relays and clank, an arc into every landing. The kit that "
             "matches the quiz's own language, where an answer is a circuit closing.",
        kick="kick/wav/78815.wav", hit="anvil/wav/386117.wav",
        alt="clank/wav/389765.wav", low="tom/wav/459217.wav",
        drop="hammer/wav/844093.wav", click="relay/wav/256839.wav",
        gong="clank/wav/340615.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", reverse="spark/wav/341609.wav",
        wheel="relay/wav/556632.wav", sweep="reverse/wav/503812.wav",
        space=0.16, sub=0.55, click_gain=0.55, wheel_gain=0.5, hit_gain=0.62,
    ),
    "forge": dict(
        desc="Struck and warm. Taiko and impact carry it, a rim for the answer, "
             "the wheel ticked out on a rim as well so bar four stays dry.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="tom/wav/459217.wav", low="tom/wav/459226.wav",
        drop="impact/wav/718004.wav", click="rim/wav/368520.wav",
        gong="gong/wav/749466.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", reverse="reverse/wav/503812.wav",
        wheel="rim/wav/368522.wav", sweep="whoosh/wav/742903.wav",
        space=0.18, sub=0.55, click_gain=1.0, wheel_gain=0.42,
    ),
    "machine": dict(
        desc="Servos and shakers. The wheel is the loudest idea in the kit, which "
             "suits a film whose third beat is a mechanism and risks making the "
             "dip the thing you remember.",
        kick="kick/wav/78815.wav", hit="anvil/wav/386117.wav",
        alt="clank/wav/825095.wav", low="tom/wav/459217.wav",
        drop="impact/wav/755054.wav", click="snap/wav/556631.wav",
        gong="gong/wav/813053.wav", subdrop="subdrop/wav/348242.wav",
        riser="sub/wav/757897.wav", reverse="reverse/wav/564442.wav",
        wheel="servo/wav/551504.wav", sweep="shaker/wav/399329.wav",
        space=0.12, sub=0.58, click_gain=0.8, wheel_gain=0.55,
    ),
    "quiet": dict(
        desc="Sparse. No between-landing kit at all, so the four events and the two "
             "in between are the whole arrangement. The one that lets the plating "
             "be heard.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="tom/wav/459217.wav", low="tom/wav/459226.wav",
        drop="impact/wav/748752.wav", click="rim/wav/368523.wav",
        gong="gong/wav/616295.wav", subdrop="subdrop/wav/221361.wav",
        riser="sub/wav/649760.wav", reverse="reverse/wav/418724.wav",
        wheel="rim/wav/368521.wav", sweep="reverse/wav/65488.wav",
        space=0.22, sub=0.5, click_gain=1.0, wheel_gain=0.4, sparse=True, plate_gain=1.9,
    ),
    "plate": dict(
        desc="Built around the LAST event rather than the biggest one: the 8.0 drop "
             "is pulled back and the 8.5 plating is given a real swell, so the film "
             "resolves on the badge becoming yours instead of on it arriving.",
        kick="kick/wav/78815.wav", hit="taiko/wav/801857.wav",
        alt="tom/wav/459217.wav", low="tom/wav/459226.wav",
        drop="impact/wav/718004.wav", click="rim/wav/368520.wav",
        gong="gong/wav/749466.wav", subdrop="subdrop/wav/154895.wav",
        riser="sub/wav/754771.wav", reverse="reverse/wav/503812.wav",
        wheel="rim/wav/368522.wav", sweep="reverse/wav/493974.wav",
        space=0.24, sub=0.55, click_gain=1.0, wheel_gain=0.42,
        drop_gain=0.78, plate_gain=1.0,
    ),
}

# PLATE, WITH THE CLIPPER GOT OUT OF THE WAY. Same arrangement, same samples,
# same everything - only the soft-clip drive comes down, from 1.1 to 0.6, which
# keeps the peaks inside tanh's near-linear region instead of up on its knee.
#
# It exists because plate is the picked kit and it is the ONE kit the clipper
# is hurting: its arrangement writes 0.556/0.791/0.645 against a curve of
# 0.55/0.78/0.70, which is very nearly exact, and the clipper then delivers
# 0.656/0.861/0.740. At drive 0.6 the delivered curve lands back on the
# authored one (rms error 0.069 -> ~0.029, measured by re-clipping the
# recovered pre-clip buffer).
#
# IT COSTS LOUDNESS, AND THE FIRST GUESS ABOUT WHICH WAY WAS BACKWARDS. The
# obvious reasoning - "a lower peak leaves the master more linear gain to
# apply" - is wrong, because the clipper was buying loudness by raising RMS
# against the peak. Backing it off raises crest, and crest is exactly what
# linear gain runs out of true-peak room against. Measured through the same
# chain:
#
#                     rms err     crest      master reaches
#     plate            0.073     13.70 dB    -14.25 LUFS (0.25 short)
#     plate-soft       0.030     15.66 dB    -16.16 LUFS (2.16 short)
#
# So the trade is real and it is a trade: the authored curve, 2 dB more crest,
# and 1.9 dB quieter in the feed. Platforms only turn material DOWN, never up
# (YouTube's normalisation is one-directional), so the shortfall is not
# corrected for us - it simply plays quieter than the clip before it.
#
# That is a listening call, not an arithmetic one, which is why this ships as
# a SECOND kit rather than as an edit to the first.
KITS["plate-soft"] = dict(
    KITS["plate"],
    drive=0.6,
    desc="Plate with the soft clipper backed off (drive 1.1 -> 0.6). The same "
         "arrangement, delivering the weight curve it actually wrote instead of "
         "a compressed version of it. A/B against plate.",
)

ROLES = ("kick", "hit", "alt", "low", "drop", "click", "gong", "subdrop", "riser")
EXTRA = ("reverse", "wheel", "sweep")


def tail(snd, seconds):
    """The last `seconds` of a sample, so a riser gets a shorter run-up."""
    keep = int(seconds * SR)
    return snd[-keep:] if len(snd) > keep else snd


def build(kit_name):
    k = KITS[kit_name]
    S = {r: read_wav(os.path.join(SAMPLES, k[r])) for r in ROLES if k.get(r)}
    for r in EXTRA:
        if k.get(r):
            S[r] = read_wav(os.path.join(SAMPLES, k[r]))
    # An electricity recording used as an approach is a DRONE. Reversing it puts
    # the dense end at the landing, and APPROACH_MAX keeps only the last second,
    # so what arrives is an arc striking rather than a buzz already running.
    if k.get("reverse") and "spark/" in k["reverse"]:
        S["reverse"] = S["reverse"][::-1]

    n = int(round(SECONDS * SR))
    buf = [0.0] * n
    sub = [0.0] * n
    kicks = []
    root, fourth, fifth = 55.0, 41.25, 36.7
    sparse = k.get("sparse", False)
    cg = k.get("click_gain", 1.0)

    for bar_i in range(PHRASE_BARS):
        b = bar_i * BAR
        w = WEIGHT.get(bar_i, 0.35)

        if bar_i == 0:
            # HELD BACK, because it lands on the previous lap's tail. At full
            # weight the top of the phrase reads as a restart, which is exactly
            # what a loop must not do.
            place(buf, S["kick"], b, 0.4)
            kicks.append(b)

            # THE ANSWER, on beat four. A pickup, so it is deliberately smaller
            # than the downbeat it leads into: it is the cause of LEARN, not a
            # fifth landing. A second tick a sixteenth later is the commit -
            # the pick and the lock are two sounds in the picture too.
            place(buf, S["click"], ANSWER, 0.42 * cg)
            place(buf, S["kick"], ANSWER, 0.22)
            kicks.append(ANSWER)
            if not sparse:
                place(buf, S["click"], ANSWER + BEAT * 0.25, 0.2 * cg)

        elif bar_i == RANK:
            # THE DIP, AND IT IS A DIFFERENT KIND OF SOUND. Dry and mechanical
            # against three struck landings, so it can sit below the one before
            # it and still register as an event. Escalating by volume here would
            # make it a smaller PATCHES and flatten the whole shape.
            place(buf, S["click"], b, w * cg)
            place(buf, S["kick"], b, w * 0.5)
            kicks.append(b)

            # THE WHEEL. Widening gaps, falling gain: a rolodex decelerating.
            # The detent is the last tick and it is the loudest of the tail, so
            # the wheel STOPS rather than fading out.
            if "wheel" in S:
                wg = k.get("wheel_gain", 0.45)
                for i, off in enumerate(WHEEL):
                    last = i == len(WHEEL) - 1
                    g = wg * (1.0 if last else 0.62 - 0.06 * i)
                    place(buf, S["wheel"], b + off, max(0.08, g))

        elif bar_i == PATCH:
            # THE LANDING, LAYERED. A drop is several things arriving together,
            # not one thing arriving loudly: body, skin, top, and something felt.
            dg = k.get("drop_gain", 1.0)
            place(buf, S["drop"], b, w * dg)
            place(buf, S["hit"], b, w * 0.7 * dg)
            place(buf, S["kick"], b, w * 0.9 * dg)
            kicks.append(b)
            if "gong" in S:
                place(buf, S["gong"], b, w * 0.55 * dg)
            if "subdrop" in S:
                place(buf, S["subdrop"], b, w * 0.8 * dg)

            # THE PLATING, half a bar later. A SWEEP, not a strike - the gold
            # crosses the badge over 0.8 s and nothing about that is an impact.
            # Placed by its start because it accompanies the picture rather than
            # arriving at the end of it, which is the opposite of every riser
            # here and the reason it is not one.
            if "sweep" in S:
                place(buf, tail(S["sweep"], 0.9), PLATE, 0.42 * k.get("plate_gain", 1.0))
            if "gong" in S:
                place(buf, S["gong"], PLATE, 0.2 * k.get("plate_gain", 1.0))

        else:
            # PER-KIT HIT GAIN, because recorded levels vary and the SHAPE must
            # not. At a flat 0.75 the relay kit's anvil put LEARN at 0.511 and
            # GAIN at 0.483 - the first landing out-peaking the second, which
            # inverts the climb on its very first step. The curve is the design;
            # a kit that swaps a sample has to be able to re-balance to it.
            place(buf, S["kick"], b, w)
            place(buf, S["hit"], b, w * 0.75 * k.get("hit_gain", 1.0))
            kicks.append(b)

        # ── the approach to the NEXT landing ────────────────────────────────
        # Placed by its END, because what a riser is for is the thing it lands
        # on. Capped so it cannot start on top of the landing it comes FROM.
        if bar_i < PATCH:
            landing = b + BAR
            if bar_i == PATCH - 1:
                if "reverse" in S:
                    place_end(buf, tail(S["reverse"], APPROACH_MAX), landing, 0.9)
                else:
                    place_end(buf, sub_rise(APPROACH_MAX), landing, 0.75)
            elif bar_i >= LEARN and "reverse" in S:
                place_end(buf, tail(S["reverse"], APPROACH_MAX * 0.7), landing, 0.3 + 0.16 * bar_i)

        # ── between the landings ────────────────────────────────────────────
        if not sparse and bar_i >= LEARN:
            place(buf, S["kick"], b + BEAT * 2, w * 0.45)
            kicks.append(b + BEAT * 2)
            place(buf, S["hit"], b + BEAT * 1.5, w * 0.42)
            if bar_i >= GAIN:
                place(buf, S["alt"], b + BEAT * 3.5, w * 0.40)
                place(buf, S["low"], b + BEAT * 2.75, w * 0.34)

        # ── the sub ─────────────────────────────────────────────────────────
        # Down to the fourth under the landing and resolving on the last bar, so
        # the loop has somewhere to come back FROM.
        f = fourth if bar_i == PATCH else (fifth if bar_i == RANK else root)
        g = (0.4, 0.58, 0.72, 0.60, 1.0)[bar_i]
        for i, v in enumerate(sub_note(BAR * 0.85, f, gain=g)):
            sub[(int(b * SR) + i) % n] += v

    # Two laps through the reverb, second kept, so the tail arriving at the loop
    # point is the one that just left it.
    wet = reverb(buf + buf, k["space"])
    buf = wet[len(buf):]

    sub = sidechain(sub, kicks)
    buf = [buf[i] + sub[i] * k["sub"] for i in range(n)]

    peak = max(abs(v) for v in buf) or 1.0
    # THE SOFT CLIPPER IS LOAD-BEARING, AND THAT WAS NOT THE PLAN.
    #
    # `tanh` compresses, so it lifts every quiet event relative to the loudest
    # one. Measured by inverting it off the rendered files (atanh(y/0.82)
    # recovers the pre-clip buffer exactly), the curve the ARRANGEMENT writes
    # and the curve that SHIPS are not the same curve, and the gap is large:
    #
    #                 authored          delivered @1.1     rms err vs curve
    #     plate     .556/.791/.645    .656/.861/.740      0.028 -> 0.069
    #     forge     .453/.637/.506    .560/.742/.616      0.130 -> 0.046
    #     machine   .384/.531/.365    .498/.657/.476      0.225 -> 0.130
    #     quiet     .431/.602/.450    .551/.724/.572      0.165 -> 0.070
    #
    # Read that carefully: for three kits the clipper is what BRINGS them to the
    # curve. Their placement gains were tuned against the rendered output, so
    # the compression is silently part of the arrangement - drop the drive and
    # they get WORSE, not better. Only `plate` writes the curve honestly in the
    # arrangement (0.028) and then has it inflated by the clipper (0.069).
    #
    # So the drive is per-kit rather than a constant, and nothing is retuned by
    # fiat: 1.1 is the default and every existing kit keeps its rendered sound.
    return [math.tanh(v * (k.get("drive", 1.1) / peak)) * 0.82 for v in buf]


def landing_peaks(s):
    """MEASURED, NOT ASSERTED. The weight curve is the whole design of this bed,
    so the shape it actually came out as is reported rather than trusted: peak
    in a 0.25 s window at each event. A kit whose third landing out-peaks its
    second has inverted the climb it exists inside, and that is a bug you can
    only hear if you are listening for it."""
    out = []
    for label, at in (
        ("answer", ANSWER), ("learn", LEARN * BAR), ("gain", GAIN * BAR),
        ("rank", RANK * BAR), ("patch", PATCH * BAR), ("plate", PLATE),
    ):
        i0, i1 = int(at * SR), int((at + 0.25) * SR)
        out.append((label, max(abs(v) for v in s[i0:min(i1, len(s))])))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", default="relay", choices=sorted(KITS) + ["all"])
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(SAMPLES), "kits"))
    a = ap.parse_args()

    names = sorted(KITS) if a.kit == "all" else [a.kit]
    os.makedirs(a.out_dir, exist_ok=True)
    for name in names:
        s = build(name)
        path = os.path.join(a.out_dir, f"logbook-bed-{name}.wav")
        write_wav(path, s)
        rms = math.sqrt(sum(v * v for v in s) / len(s))
        print(f"{path}\n  {SECONDS:.3f} s  peak {max(abs(v) for v in s):.3f}  rms {rms:.4f}")
        print("  " + "  ".join(f"{n}={v:.3f}" for n, v in landing_peaks(s)))
        print(f"  {KITS[name]['desc']}")
