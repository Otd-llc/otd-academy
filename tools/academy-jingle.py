"""A BEAT-DRIVEN jingle for the L1.01 cut: groove, bass line, drop.

WHY THIS REPLACES academy-bed.py. That file arranged four landings with air
between them. It measured exactly as designed and was still the wrong thing: a
sequence of events is not a jingle. A jingle has a GROOVE running underneath
that never stops, a BASS LINE with actual notes, and the words land on top of
something already moving.

It also could not have been fixed by rearranging, because the sample library had
no snare, no hi-hat and no clap. There was literally nothing to keep time with,
so "sparse" was the only thing the material could express. Those are fetched now
(tools/hex-samples.py), including a 909 snare.

THE WORKSHOP FOLEY IS DEMOTED, NOT DELETED. Anvil, relay, drill and arc as the
core kit made foley, not music. As a DROP accent or a riser into one, struck
steel is genuinely good, and it keeps the cut tied to its subject. So it lives
in the `drop` dimension where one hit does a lot of work, and nowhere else.

THREE DIMENSIONS, AUDITIONED SEPARATELY. Each sweep holds the other two fixed,
because comparing ten things that differ in three ways at once tells you
nothing.

  drums   10 grooves   the pattern AND the kit
  bass    10 lines     synthesised, so character is a parameter not a hunt
  drop    10 payoffs   what happens at EARN, and the approach into it

STILL ON THE SAME GRID: 120 BPM, 16th resolution, five bars, 10.000 s, and the
four words still land on the bar downbeats at 2 / 4 / 6 / 8. The groove is what
changed, not the timing the picture is cut to.

    python tools/academy-jingle.py --sweep drums
    python tools/academy-jingle.py --sweep all
    python tools/academy-jingle.py --drums four-floor --bass acid --drop anvil
"""

import argparse
import importlib.util
import math
import os
import random

_SPEC = importlib.util.spec_from_file_location(
    "hex_bed", os.path.join(os.path.dirname(os.path.abspath(__file__)), "hex-bed.py")
)
_HB = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_HB)

SR, BEAT, BAR = _HB.SR, _HB.BEAT, _HB.BAR
SAMPLES = _HB.SAMPLES
read_wav, place, place_end = _HB.read_wav, _HB.place, _HB.place_end
place_ramp, lowpass, reverb = _HB.place_ramp, _HB.lowpass, _HB.reverb
sidechain, write_wav = _HB.sidechain, _HB.write_wav

BARS = 5
SECONDS = BAR * BARS          # 10.000
STEP = BEAT / 4               # a sixteenth, 0.125 s
STEPS_PER_BAR = 16
N = int(round(SECONDS * SR))

# ── the kit ─────────────────────────────────────────────────────────────────
KIT = {
    "kick": "kick/wav/78815.wav",
    "kick2": "kick/wav/673502.wav",
    "snare": "snare/wav/414960.wav",     # Classic TR-909
    "snare2": "snare/wav/212240.wav",    # tape snare, softer
    "hat": "hat/wav/513364.wav",
    "hat2": "hat/wav/513362.wav",
    "open": "openhat/wav/842865.wav",
    "clap": "clap/wav/548506.wav",
    "crash": "crash/wav/696199.wav",
    # A SHORT tom. 685559 rings long enough that eighth-note toms smear energy
    # into the gaps between sixteenths: grid concentration measured 1.14x
    # against 1.79-2.21x for every other groove, which is the difference between
    # a beat and a wash. The pattern was fine; the sample could not play it.
    "tom": "tom/wav/459226.wav",
    "shake": "shaker/wav/448137.wav",
    "clank": "clank/wav/825095.wav",
    "rim": "rim/wav/368520.wav",
}

# ── grooves ─────────────────────────────────────────────────────────────────
# One 16-character string per voice per bar. '-' rests, '1'-'9' is velocity.
# Written out rather than generated because a groove is a decision, and reading
# the grid is how you check it.
DRUMS = {
    "four-floor": dict(
        desc="Four on the floor. Clap on 2 and 4, hats on the eighths.",
        kick="9---9---9---9---", clap="----9-------9---", hat="6-5-6-5-6-5-6-5-",
    ),
    "boom-bap": dict(
        desc="Boom bap. Kick on 1 and the and-of-3, snare answering on 2 and 4.",
        kick="9-----5-9-------", snare="----9-------9---", hat="6-4-6-4-6-4-6-4-",
    ),
    "trap": dict(
        desc="Trap. Snare on 3 only, hats in sixteenths with a roll into the bar.",
        kick="9-----4---9-----", snare="--------9-------", hat="5555555555557777",
    ),
    "break": dict(
        desc="Breakbeat. Syncopated kick, ghosted snare, driving eighths.",
        kick="9---3-9---3---5-", snare="----9---2---9---", hat="6-5-6-5-6-5-6-5-",
    ),
    "half-time": dict(
        desc="Half time. Snare on 3 alone, wide open, lets the bass carry.",
        kick="9-------5-------", snare="--------9-------", hat="5---5---5---5---",
    ),
    "tom-drive": dict(
        desc="Toms drive it. Eighth-note toms under a plain backbeat.",
        kick="9---5---9---5---", snare="----9-------9---", tom="--6---6---6---6-",
    ),
    "industrial": dict(
        desc="Industrial. Four on the floor with dropped metal on the offbeats.",
        kick="9---9---9---9---", snare="----9-------9---", clank="--5---5---5---5-", hat="4-4-4-4-4-4-4-4-",
    ),
    "march": dict(
        desc="March. Snare sixteenths and a hard two-step kick.",
        kick="9-------9-------", snare="--4-4-9---4-4-9-", hat="6---6---6---6---",
    ),
    "disco": dict(
        desc="Disco. Four on the floor with the open hat on every offbeat.",
        kick="9---9---9---9---", clap="----9-------9---", open="--7---7---7---7-", hat="5-5-5-5-5-5-5-5-",
    ),
    "rolling": dict(
        desc="Rolling. Two-step kick, snare on 2 and 4, sixteenth hats.",
        kick="9-----9-9-------", snare="----9-------9---", hat="5555555555555555", shake="--3---3---3---3-",
    ),
}

# Bar 1 opens lighter and bar 5 answers, so five identical bars do not read as a
# loop that forgot to develop. Applied to every groove.
OPEN_SCALE = 0.55
# The snare fill answering into the drop. The cymbal that used to live here moved
# out into its own dimension (LEARN, below) because it lands on a word.
FILL = {"snare": "------------4689"}

# ── the LEARN accent ────────────────────────────────────────────────────────
# Bar 4's downbeat IS the word LEARN, at t = 6.0. Whatever sits there is the
# loudest thing in the jingle apart from the drop, and it was buried in the fill
# table as an afterthought: a 6-inch splash at 0.8, chosen by nobody.
#
# The picture at that moment is a cursor selecting the last exam answer. That is
# a small, precise, committing action, so the range worth auditioning runs from
# "barely there" through "bright and short" to "grand", and includes having
# nothing at all, because the snare fill may already be enough.
LEARN_BAR = 3
LEARN = {
    "splash": dict(desc="A 6-inch splash. Short and bright. What it has been so far, now on purpose.",
                   hit=["crash/wav/696199.wav"], gains=[0.8]),
    "crash": dict(desc="An 18-inch medium thin crash. Grander, and it rings across the bar.",
                  hit=["crash/wav/696212.wav"], gains=[0.7]),
    "choke": dict(desc="The crash, choked. All of the attack, none of the ring. Decisive.",
                  hit=["crash/wav/696212.wav"], gains=[0.85], choke=0.16),
    "reverse": dict(desc="A cymbal reversed so it swells INTO the word rather than off it.",
                    hit=[], gains=[], riser="crash/wav/696213.wav", riser_gain=0.7),
    # ── variations on the reverse ────────────────────────────────────────────
    # A reversed swell has more knobs than it looks: how LONG the run-up is
    # (which decides how much of the previous bar it occupies), what is being
    # reversed, how bright it is, and whether anything lands on the beat at the
    # end of it. Those are genuinely different edits, not gain changes.
    "rev-short": dict(desc="A half-second run-up. Arrives without eating the bar before it.",
                      hit=[], gains=[], riser="crash/wav/696213.wav", riser_gain=0.8, riser_len=0.5),
    "rev-long": dict(desc="Two full seconds. The swell IS the bar; LEARN is where it resolves.",
                     hit=[], gains=[], riser="crash/wav/696213.wav", riser_gain=0.62, riser_len=2.0),
    "rev-splash": dict(desc="The 6-inch splash reversed. Tighter and less hissy than the crash.",
                       hit=[], gains=[], riser="crash/wav/696199.wav", riser_gain=0.85, riser_len=0.9),
    "rev-china": dict(desc="The trashy china reversed. Dirtier swell, more edge on arrival.",
                      hit=[], gains=[], riser="crash/wav/452400.wav", riser_gain=0.8, riser_len=1.1),
    "rev-gong": dict(desc="A reversed gong. Tonal rather than noisy, so it swells WITH the bass.",
                     hit=[], gains=[], riser="gong/wav/749466.wav", riser_gain=0.7, riser_len=1.6),
    "rev-dark": dict(desc="The crash reversed and lowpassed. Swells without the hiss on top.",
                     hit=[], gains=[], riser="crash/wav/696213.wav", riser_gain=0.9,
                     riser_len=1.2, riser_lp=2600),
    "rev-land": dict(desc="The swell AND a choked hit on the beat, so it arrives rather than just stops.",
                     hit=["crash/wav/696212.wav"], gains=[0.6], choke=0.14,
                     riser="crash/wav/696213.wav", riser_gain=0.6, riser_len=1.2),
    "rev-noise": dict(desc="A synthesised noise swell. No cymbal at all, so nothing rings after.",
                      hit=[], gains=[], noise_riser=True, riser_gain=0.55, riser_len=1.2),
    "rev-gap": dict(desc="The swell stops an eighth EARLY. The word lands in the silence it left.",
                    hit=[], gains=[], riser="crash/wav/696213.wav", riser_gain=0.85,
                    riser_len=1.4, riser_gap=0.25),
    "openhat": dict(desc="An open hat instead of a cymbal. Keeps time rather than announcing.",
                    hit=["openhat/wav/842865.wav"], gains=[0.85]),
    "bell": dict(desc="A struck bell. Tonal rather than noisy, so it sits with the bass.",
                 hit=["gong/wav/749466.wav"], gains=[0.55], choke=0.9),
    "china": dict(desc="A trashy china splash. Ugly on purpose, and it cuts through anything.",
                  hit=["crash/wav/452400.wav"], gains=[0.75]),
    "click-stack": dict(desc="A splash layered under a switch click, so the cursor's action is audible.",
                        hit=["crash/wav/696199.wav", "relay/wav/256839.wav"], gains=[0.5, 0.9]),
    "spark": dict(desc="An electrical snap instead of a cymbal. Ties the accent to the subject.",
                  hit=["spark/wav/189630.wav", "crash/wav/696199.wav"], gains=[1.0, 0.3]),
    "none": dict(desc="Nothing. The snare fill and the groove carry the word on their own.",
                 hit=[], gains=[]),
}

# ── bass ────────────────────────────────────────────────────────────────────
# SYNTHESISED, not sampled. Bass character is filter, envelope and glide, which
# are parameters; hunting for ten sampled basses that differ in exactly those
# ways would be slower and less controllable.
#
# A natural minor, one root per bar: A A F G A. Real harmonic movement, and it
# resolves on the last bar so the loop has somewhere to come back from.
ROOTS = [55.00, 55.00, 43.65, 49.00, 55.00]
BASS = {
    "sub-hold": dict(desc="A sine holding the root. Felt, not heard.",
                     wave="sine", rhythm="9---------------", dur=3.6, cut=None),
    "octave-pulse": dict(desc="Sine eighths alternating root and octave.",
                         wave="sine", rhythm="7-7-7-7-7-7-7-7-", dur=0.42, oct_alt=True, cut=None),
    "saw-stab": dict(desc="Filtered saw stabs on the eighths. The most 'jingle'.",
                     wave="saw", rhythm="8-6-8-6-8-6-8-6-", dur=0.36, cut=520),
    "glide": dict(desc="808-style, gliding between notes instead of stepping.",
                  wave="sine", rhythm="9-------7-------", dur=1.4, glide=0.14, cut=None),
    "reese": dict(desc="Two detuned saws beating against each other. Wide and mean.",
                  wave="reese", rhythm="9-------9-------", dur=1.7, cut=380),
    "square-riff": dict(desc="A square sixteenth riff. Busy and bright.",
                        wave="square", rhythm="8-58-5-88-58-5--", dur=0.2, cut=900),
    "offbeat": dict(desc="Stabs on the offbeat only. Leaves the downbeat to the kick.",
                    wave="saw", rhythm="--8---8---8---8-", dur=0.3, cut=640),
    "walk": dict(desc="A walking line through the scale, one note per beat.",
                 wave="tri", rhythm="8---7---8---7---", dur=0.42, walk=True, cut=1100),
    "acid": dict(desc="Resonant filter sweeping across the bar. 303 territory.",
                 wave="saw", rhythm="9-79-79-79-79-7-", dur=0.22, cut=300, sweep=2400, res=0.75),
    "pluck": dict(desc="Short triangle plucks arpeggiating the chord.",
                  wave="tri", rhythm="8-6-7-6-8-6-7-6-", dur=0.16, arp=True, cut=1600),
}

# ── drops ───────────────────────────────────────────────────────────────────
# What happens at EARN (bar 5, t=8.0) and how bar 4 approaches it.
DROPS = {
    "anvil": dict(desc="A 125 kg anvil struck on 6 mm steel. The workshop, used where it earns its place.",
                  hit=["anvil/wav/386130.wav", "impact/wav/718004.wav"], gains=[1.0, 0.6]),
    # Layered, for the same reason tape-stop is: a lone impact left bar 5 at
    # 0.66 against the bar-4 fill crash at 0.69, so the loudest moment in the
    # jingle was the fill rather than the payoff.
    "spark-riser": dict(desc="A reversed electrical arc rising into the hit.",
                        hit=["impact/wav/718004.wav", "kick/wav/78815.wav"], gains=[1.0, 0.95],
                        riser="spark/wav/341609.wav", riser_rev=True),
    "crash": dict(desc="Plain and effective. A crash cymbal over the downbeat.",
                  hit=["crash/wav/696212.wav", "kick/wav/78815.wav"], gains=[0.9, 1.0]),
    "subdrop": dict(desc="Felt more than heard. A sub dropping under the hit.",
                    hit=["impact/wav/718004.wav", "subdrop/wav/154895.wav"], gains=[0.85, 1.0]),
    "reverse-cym": dict(desc="The classic. A reversed cymbal swelling into the bar.",
                        hit=["impact/wav/718004.wav", "kick/wav/78815.wav"], gains=[1.0, 0.95],
                        riser="reverse/wav/503812.wav"),
    "hush": dict(desc="A beat of silence before the hit. The gap does the work.",
                 hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.6], gap=0.5),
    "layered": dict(desc="Body, skin, top and something felt, all arriving together.",
                    hit=["impact/wav/718004.wav", "taiko/wav/801857.wav",
                         "crash/wav/696212.wav", "subdrop/wav/154895.wav"],
                    gains=[1.0, 0.7, 0.5, 0.8]),
    # LAYERED, unlike the first version. A single impact left bar 5 quieter than
    # bar 4, so the halt was the loudest moment and the release after it read as
    # an anticlimax. The stop only works if what follows is bigger.
    "tape-stop": dict(desc="The bar before pitches and slows to a halt, then the hit.",
                      hit=["impact/wav/718004.wav", "kick/wav/78815.wav", "crash/wav/696199.wav"],
                      gains=[1.0, 0.95, 0.5], tape_stop=True),
    "noise-sweep": dict(desc="A filtered white-noise riser. No sample, all envelope.",
                        hit=["impact/wav/718004.wav", "kick/wav/78815.wav"], gains=[0.95, 0.9],
                        noise_riser=True),
    # ── ten stutters ────────────────────────────────────────────────────────
    "stutter": dict(desc="Four sixteenths on the snare, rising into the hit. The plain one.",
                    hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                    stutter={"n": 4, "span": BEAT}),
    "stutter-32": dict(desc="Eight thirty-seconds. Twice the density, same beat of runway.",
                       hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                       stutter={"n": 8, "span": BEAT}),
    "stutter-accel": dict(desc="Repeats crowding toward the drop. Reads as being pulled in.",
                          hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                          stutter={"n": 9, "span": BEAT * 1.5, "accel": 1.1}),
    "stutter-decel": dict(desc="Repeats spreading out into the drop. Reads as bracing.",
                          hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                          stutter={"n": 8, "span": BEAT * 1.5, "accel": -1.1}),
    "stutter-pitch": dict(desc="Each repeat a little higher and shorter. The classic riser stutter.",
                          hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                          stutter={"n": 8, "span": BEAT, "pitch": 0.85}),
    "stutter-gate": dict(desc="Chops what is already playing instead of adding to it. The groove itself stutters.",
                         hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                         stutter={"n": 8, "span": BEAT * 2, "gate": True, "duty": 0.45}),
    "stutter-repeat": dict(desc="Beat repeat. One sixteenth of the bar copied over the rest of it.",
                           hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                           stutter={"n": 8, "span": BEAT * 2, "repeat": True}),
    "stutter-kick": dict(desc="The kick repeats instead of the snare. Lower, heavier, less busy.",
                         hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                         stutter={"n": 6, "span": BEAT, "voice": "kick", "g1": 0.85}),
    "stutter-hat": dict(desc="Hats repeat. The lightest version; it ticks rather than hammers.",
                        hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                        stutter={"n": 12, "span": BEAT, "voice": "hat", "g0": 0.35, "g1": 0.9}),
    "stutter-gap": dict(desc="Stutters, then stops dead for an eighth. The silence is the last repeat.",
                        hit=["impact/wav/718004.wav", "crash/wav/696199.wav"], gains=[1.0, 0.55],
                        gap=0.25, stutter={"n": 6, "span": BEAT}),
}

DEFAULTS = {"drums": "four-floor", "bass": "saw-stab", "drop": "anvil", "learn": "splash"}


# ── synthesis ───────────────────────────────────────────────────────────────
def osc(dur, f0, f1, wave, res=0.0, cut=None, sweep=None):
    """One bass note. Glide from f0 to f1; optional resonant sweeping lowpass."""
    n = int(dur * SR)
    out = [0.0] * n
    phase = 0.0
    phase2 = 0.0
    # A two-pole state-variable filter, so resonance is available. One pole
    # cannot make an acid line: the whole character is the peak at cutoff.
    low = band = 0.0
    for i in range(n):
        u = i / max(1, n - 1)
        f = f0 + (f1 - f0) * min(u / 0.25, 1.0) if f1 != f0 else f0
        phase += f / SR
        phase -= int(phase)
        if wave == "sine":
            v = math.sin(2 * math.pi * phase)
        elif wave == "tri":
            v = 4 * abs(phase - 0.5) - 1
        elif wave == "square":
            v = 1.0 if phase < 0.5 else -1.0
        elif wave == "reese":
            phase2 += (f * 1.008) / SR
            phase2 -= int(phase2)
            v = (2 * phase - 1) * 0.5 + (2 * phase2 - 1) * 0.5
        else:  # saw
            v = 2 * phase - 1
        if cut:
            fc = cut if not sweep else cut + (sweep - cut) * u
            g = min(2 * math.sin(math.pi * min(fc, SR * 0.45) / SR), 1.4)
            q = max(0.05, 1.0 - res)
            low += g * band
            band += g * (v - low - q * band)
            v = low
        # Percussive envelope: instant attack, exponential decay, short release
        # so notes do not click when they abut.
        env = math.exp(-3.2 * u) * min(1.0, (n - i) / (0.004 * SR))
        out[i] = v * env
    return out


def noise_riser(dur, cut0=400, cut1=9000):
    n = int(dur * SR)
    rng = random.Random(7)  # fixed, so a render is reproducible
    low = 0.0
    out = [0.0] * n
    for i in range(n):
        u = i / max(1, n - 1)
        fc = cut0 + (cut1 - cut0) * (u ** 2)
        g = min(2 * math.sin(math.pi * min(fc, SR * 0.45) / SR), 1.0)
        low += g * (rng.uniform(-1, 1) - low)
        out[i] = low * (u ** 1.5)
    return out


def resample(snd, ratio):
    """Linear resample. ratio > 1 slows and lowers, which is the tape stop."""
    n = int(len(snd) / ratio)
    out = [0.0] * n
    for i in range(n):
        x = i * ratio
        a = int(x)
        if a + 1 >= len(snd):
            break
        out[i] = snd[a] + (snd[a + 1] - snd[a]) * (x - a)
    return out


def trim_head(snd, floor=0.02):
    """Slice off leading silence so the sample starts ON its transient.

    THIS IS A TIMING FIX, NOT TIDINESS. place() puts a sample's FIRST SAMPLE on
    the beat, but uploads are padded: a hit with 30 ms of silence in front of it
    plays 30 ms late, and a kit whose members are padded differently is a groove
    that drags unevenly. Measured before this, only 47% of onsets landed within
    30 ms of a sixteenth. On a jingle that is the whole difference between tight
    and loose, and it is invisible in a waveform view.

    A couple of milliseconds are kept in front of the transient so the attack
    still has a rising edge and does not click.
    """
    peak = max((abs(v) for v in snd), default=0.0)
    if peak <= 0:
        return snd
    thresh = peak * floor
    for i, v in enumerate(snd):
        if abs(v) >= thresh:
            return snd[max(0, i - int(0.002 * SR)):]
    return snd


def grid_hits(pattern, bar_i):
    """(time, velocity) for one 16-step bar string."""
    out = []
    for s, ch in enumerate(pattern[:STEPS_PER_BAR]):
        if ch == "-":
            continue
        out.append((bar_i * BAR + s * STEP, int(ch) / 9.0))
    return out


def build(drums_name, bass_name, drop_name, learn_name="splash"):
    d = DRUMS[drums_name]
    b = BASS[bass_name]
    dr = DROPS[drop_name]
    S = {k: trim_head(read_wav(os.path.join(SAMPLES, v))) for k, v in KIT.items()}

    buf = [0.0] * N
    bass = [0.0] * N
    kicks = []

    # ── groove ──────────────────────────────────────────────────────────────
    for bar_i in range(BARS):
        # The drop bar is carried by the drop itself; keeping a full groove
        # under it makes the payoff smaller, not bigger.
        scale = OPEN_SCALE if bar_i == 0 else 1.0
        for voice, pattern in d.items():
            if voice == "desc" or voice not in S:
                continue
            for t, v in grid_hits(pattern, bar_i):
                place(buf, S[voice], t, v * scale * (0.85 if bar_i == 4 else 1.0))
                if voice.startswith("kick"):
                    kicks.append(t)
        # A fill answers into the drop, so bar 5 is arrived at rather than cut to.
        if bar_i == LEARN_BAR:
            for voice, pattern in FILL.items():
                if voice in S:
                    for t, v in grid_hits(pattern, bar_i):
                        place(buf, S[voice], t, v * 0.8)

    # ── bass ────────────────────────────────────────────────────────────────
    scale_steps = [0, 3, 5, 7, 10]  # natural minor degrees, in semitones
    for bar_i in range(BARS):
        root = ROOTS[bar_i]
        hits = grid_hits(b["rhythm"], bar_i)
        for j, (t, v) in enumerate(hits):
            f = root
            if b.get("oct_alt") and j % 2:
                f = root * 2
            if b.get("walk"):
                f = root * (2 ** (scale_steps[j % len(scale_steps)] / 12))
            if b.get("arp"):
                f = root * (2 ** (scale_steps[(j * 2) % len(scale_steps)] / 12)) * (2 if j % 4 > 1 else 1)
            f1 = f
            if b.get("glide") and j + 1 < len(hits):
                f1 = ROOTS[min(bar_i + 1, BARS - 1)] if j == len(hits) - 1 else f
            note = osc(b["dur"], f, f1, b["wave"], res=b.get("res", 0.0),
                       cut=b.get("cut"), sweep=b.get("sweep"))
            at = int(t * SR)
            for i, s in enumerate(note):
                bass[(at + i) % N] += s * v
        # The drop bar drops the bass out under the hit and brings it back, so
        # the low end returning IS part of the payoff.
        if bar_i == 4:
            for i in range(int(4 * BAR * SR), int((4 * BAR + 0.18) * SR)):
                bass[i % N] *= 0.15

    # ── the LEARN accent, on bar 4's downbeat ───────────────────────────────
    lr = LEARN[learn_name]
    learn_at = LEARN_BAR * BAR
    if lr.get("riser") or lr.get("noise_riser"):
        # Placed by its END, because a swell exists for the moment it arrives on.
        keep = int(lr.get("riser_len", 1.2) * SR)
        if lr.get("noise_riser"):
            snd = noise_riser(lr.get("riser_len", 1.2))
        else:
            snd = trim_head(read_wav(os.path.join(SAMPLES, lr["riser"])))[::-1]
            snd = snd[-keep:] if len(snd) > keep else snd
            if lr.get("riser_lp"):
                snd = lowpass(snd, lr["riser_lp"])
        # riser_gap ends the swell EARLY, so the word arrives into silence
        # rather than out of the top of the swell.
        place_end(buf, snd, learn_at - lr.get("riser_gap", 0.0), lr.get("riser_gain", 0.7))
    for path, g in zip(lr["hit"], lr["gains"]):
        snd = trim_head(read_wav(os.path.join(SAMPLES, path)))
        if lr.get("choke"):
            # A choke is a cymbal grabbed by hand: the attack survives, the ring
            # does not. Truncate and fade rather than gate, or it clicks.
            n_keep = int(lr["choke"] * SR)
            snd = snd[:n_keep]
            fade = int(0.02 * SR)
            for i in range(max(0, len(snd) - fade), len(snd)):
                snd[i] *= (len(snd) - i) / fade
        place(buf, snd, learn_at, g)

    # ── the drop, at bar 5 ──────────────────────────────────────────────────
    at = 4 * BAR
    gap = dr.get("gap", 0.0)

    # THE APPROACH MUST PEAK BELOW THE ARRIVAL, and at a fixed 0.85 gain it did
    # not: spark-riser, reverse-cym and tape-stop all put bar 5 at 0.66 against
    # a bar-4 peak of 0.69, so the riser was louder than the drop it was
    # building to. Derive the ceiling from the drop's own level instead of
    # picking a number per kit, because the drop layers differ per option.
    hits = [trim_head(read_wav(os.path.join(SAMPLES, p))) for p in dr["hit"]]
    drop_peak = max(
        (max((abs(v) for v in h), default=0.0) * g for h, g in zip(hits, dr["gains"])),
        default=1.0,
    )
    riser_ceiling = drop_peak * 0.62

    def place_riser(snd, at_end):
        p = max((abs(v) for v in snd), default=1.0) or 1.0
        place_end(buf, snd, at_end, min(0.85, riser_ceiling / p))

    if dr.get("riser"):
        snd = read_wav(os.path.join(SAMPLES, dr["riser"]))
        if dr.get("riser_rev"):
            snd = snd[::-1]
        keep = int(1.4 * SR)
        place_riser(snd[-keep:] if len(snd) > keep else snd, at - gap)
    if dr.get("noise_riser"):
        place_riser(noise_riser(1.4), at - gap)
    if dr.get("stutter"):
        # A STUTTER HAS MORE THAN ONE KNOB. Re-triggering a snare in sixteenths
        # is only the simplest version; what actually differs between them is
        # how many repeats, whether the spacing accelerates or slows, which
        # voice repeats, whether the PITCH climbs, and whether it gates the mix
        # rather than adding to it. Those are different edits, not levels.
        st = dr["stutter"] if isinstance(dr["stutter"], dict) else {}
        n = st.get("n", 4)
        span = st.get("span", BEAT)
        voice = st.get("voice", "snare")
        accel = st.get("accel", 0.0)
        src = S.get(voice, S["snare"])
        start = at - span - st.get("gap", 0.0)

        if st.get("gate"):
            # Gating chops what is ALREADY there, so the groove itself
            # stutters instead of a new sound being laid over it.
            a0, a1 = int(start * SR), int((start + span) * SR)
            for k in range(n):
                s0 = a0 + int((a1 - a0) * (k / n))
                s1 = a0 + int((a1 - a0) * ((k + 1) / n))
                keep = int((s1 - s0) * st.get("duty", 0.5))
                for i in range(s0 + keep, min(s1, len(buf))):
                    buf[i] = 0.0
        elif st.get("repeat"):
            # Beat-repeat: copy one slice of the bar over the rest of the span.
            slice_len = int((span / n) * SR)
            a0 = int(start * SR)
            seg = buf[a0 : a0 + slice_len]
            for k in range(1, n):
                for i, v in enumerate(seg):
                    j = a0 + k * slice_len + i
                    if j < len(buf):
                        buf[j] = v
        else:
            for k in range(n):
                # Geometric spacing: accel > 0 crowds the hits toward the drop,
                # accel < 0 spreads them out into it.
                u = k / n
                pos = u ** (1.0 + accel) if accel >= 0 else 1 - (1 - u) ** (1.0 - accel)
                snd = src
                if st.get("pitch"):
                    # Resampling shortens as it raises, which is what a real
                    # re-pitched retrigger does.
                    snd = resample(src, 1.0 / (1.0 + st["pitch"] * u))
                place(buf, snd, start + pos * span, st.get("g0", 0.3) + (st.get("g1", 0.75) - st.get("g0", 0.3)) * u)
    if dr.get("tape_stop"):
        # Slow and pitch down the final beat of bar 4 by resampling what is
        # already in the buffer, which is the only honest way to do it.
        a, z = int((at - BEAT) * SR), int(at * SR)
        seg = resample(buf[a:z], 1.0)
        out = []
        pos = 0.0
        rate = 1.0
        while pos < len(seg) - 1 and len(out) < (z - a):
            i0 = int(pos)
            out.append(seg[i0] + (seg[i0 + 1] - seg[i0]) * (pos - i0))
            rate *= 0.99965
            pos += rate
        out += [0.0] * ((z - a) - len(out))
        buf[a:z] = out
    if gap > 0:
        a, z = int((at - gap) * SR), int(at * SR)
        for i in range(a, z):
            buf[i] *= max(0.0, 1.0 - (i - a) / (z - a) * 1.6)

    for h, g in zip(hits, dr["gains"]):
        place(buf, h, at, g)
    kicks.append(at)

    # ── finish ──────────────────────────────────────────────────────────────
    wet = reverb(buf + buf, 0.13)
    buf = wet[len(buf):]
    bass = sidechain(bass, kicks, depth=0.75, dur=0.22)
    buf = [buf[i] + bass[i] * 0.62 for i in range(N)]
    peak = max(abs(v) for v in buf) or 1.0
    return [math.tanh(v * (1.15 / peak)) * 0.84 for v in buf]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sweep", choices=["drums", "bass", "drop", "learn", "all"])
    ap.add_argument("--drums", default=DEFAULTS["drums"])
    ap.add_argument("--bass", default=DEFAULTS["bass"])
    ap.add_argument("--drop", default=DEFAULTS["drop"])
    ap.add_argument("--learn", default=DEFAULTS["learn"])
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(SAMPLES), "kits"))
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)

    jobs = []
    dims = ["drums", "bass", "drop", "learn"] if a.sweep == "all" else ([a.sweep] if a.sweep else [])
    for dim in dims:
        table = {"drums": DRUMS, "bass": BASS, "drop": DROPS, "learn": LEARN}[dim]
        for name in table:
            sel = dict(DEFAULTS)
            sel[dim] = name
            jobs.append((f"{dim}-{name}", sel, table[name]["desc"]))
    if not jobs:
        sel = {"drums": a.drums, "bass": a.bass, "drop": a.drop, "learn": a.learn}
        tag = f"{a.drums}_{a.bass}_{a.drop}" + ("" if a.learn == DEFAULTS["learn"] else f"_{a.learn}")
        jobs = [(tag, sel, "")]

    for tag, sel, desc in jobs:
        s = build(sel["drums"], sel["bass"], sel["drop"], sel["learn"])
        path = os.path.join(a.out_dir, f"jingle-{tag}.wav")
        write_wav(path, s)
        rms = math.sqrt(sum(v * v for v in s) / len(s))
        print(f"jingle-{tag}  rms {rms:.4f}  {desc}")
