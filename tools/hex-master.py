"""Master a Hex Cluster bed: convolution reverb, glue compression, and a
platform-correct loudness target.

WHY THIS IS FFMPEG AND NOT MORE PYTHON. The bed is arranged by hand because
arrangement is the creative part, but the finishing chain is solved engineering
and ffmpeg already ships professional implementations of all of it: `afir` for
convolution, `acompressor` for glue, `alimiter` for true peak, and `loudnorm`
for EBU R128. Hand-rolling any of those in stdlib Python would be slower, worse,
and pointless.

WHAT EACH STAGE IS FOR

  CONVOLUTION beats an algorithm for realism, because it plays the material
  through a recording of an actual room rather than an approximation of one.
  The IRs are claps recorded in churches, pulled through the same CC0-verified
  path as every other sample. They are STEREO, so a mono bed comes out with real
  width instead of a fake widener.

  GLUE COMPRESSION makes the layers sound like one performance rather than
  several files played at once. Deliberately gentle, and it had to be dialled
  back once: at 2:1 from -18 dB with makeup it took loudness range from 5.8 to
  3.7 LU and crest from 13.1 to 9.6 dB, which is the sparse-to-drop arc being
  levelled away. The arc is the thing the arrangement exists to produce, so the
  chain must not spend it buying loudness.

  TRUE PEAK LIMITING is not the same as sample peak. Encoding to AAC can push
  intersample peaks above 0 dBFS even when no sample does, which is audible as
  distortion after the platform re-encodes.

  LOUDNESS. Every platform normalises to roughly -14 LUFS. Delivering louder
  than that gains nothing, because it gets turned down, and costs dynamic range.
  Delivering quieter than that gets turned UP, which raises the noise floor. Two
  passes: measure, then correct with the measured values.

LOOP SAFETY SURVIVES ALL OF IT. Convolution adds a tail as long as the impulse
response, which would run past the end and truncate. The bed is therefore run
through the chain TWO LAPS long and the second lap kept, so the tail arriving at
the loop point is the one that just left it. Same trick the synthesis reverb
used, for the same reason.

    python tools/hex-master.py --kit rd-revtaiko
    python tools/hex-master.py --kit rd-revtaiko --ir 579154 --wet 0.22
"""

import argparse
import json
import os
import subprocess
import wave

SR = 48_000
KITS_DIR = "C:/zzz/_hex-promo/kits"
IR_DIR = "C:/zzz/_hex-promo/samples/ir/wav"
# -14 LUFS integrated with -1 dBTP is the safe universal target: it is what
# YouTube normalises to, and TikTok and Instagram sit close enough that one
# master serves all of them.
TARGET_I = -14.0
TARGET_TP = -1.0
TARGET_LRA = 9.0


def run(args):
    return subprocess.run(args, capture_output=True, text=True)


def wav_seconds(path):
    with wave.open(path, "rb") as w:
        return w.getnframes() / w.getframerate()


def double(src, dst):
    """Two laps of the bed, so convolution has a previous lap to ring out of."""
    lst = dst + ".txt"
    with open(lst, "w", encoding="utf-8") as f:
        f.write(f"file '{os.path.basename(src)}'\n" * 2)
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
         "-i", lst, "-c", "copy", dst])
    os.remove(lst)


def chain(ir_path, wet, comp):
    """The filtergraph, minus loudnorm, which is added per pass."""
    if ir_path and wet > 0:
        # Explicit parallel blend rather than afir's own dry/wet, so the balance
        # is a number in this file instead of a scale inside the filter.
        pre = (
            "[0:a]asplit=2[dry][pre];"
            f"[pre][1:a]afir=dry=1:wet=1:maxir=4[wet];"
            f"[dry]aformat=channel_layouts=stereo,volume={1.0 - wet * 0.35}[d];"
            f"[wet]volume={wet}[w];"
            "[d][w]amix=inputs=2:normalize=0[m];[m]"
        )
    else:
        pre = "[0:a]aformat=channel_layouts=stereo,"
    if comp:
        # GENTLE ON PURPOSE. At 2:1 from -18 dB with 2 dB of makeup this took
        # loudness range from 6.6 to 3.7 LU, which is the sparse-to-drop arc
        # being flattened: the exact thing the arrangement exists to produce.
        # 1.6:1 from -12 dB with no makeup glues without levelling the story.
        pre += "acompressor=threshold=-12dB:ratio=1.6:attack=25:release=300,"
    pre += "alimiter=limit=0.94:attack=5:release=50,"
    return pre


def measure(src, ir_path, wet, comp):
    g = chain(ir_path, wet, comp) + (
        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json[out]"
    )
    args = ["ffmpeg", "-hide_banner", "-i", src]
    if ir_path:
        args += ["-i", ir_path]
    args += ["-filter_complex", g, "-map", "[out]", "-f", "null", "-"]
    r = run(args)
    txt = r.stderr
    start = txt.rfind("{")
    end = txt.rfind("}")
    if start < 0 or end < 0:
        raise SystemExit("loudnorm measurement failed:\n" + txt[-1200:])
    return json.loads(txt[start : end + 1])


def apply(src, dst, ir_path, wet, comp, m):
    g = chain(ir_path, wet, comp) + (
        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}"
        f":measured_I={m['input_i']}:measured_TP={m['input_tp']}"
        f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
        f":offset={m['target_offset']}:linear=true[out]"
    )
    args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src]
    if ir_path:
        args += ["-i", ir_path]
    args += ["-filter_complex", g, "-map", "[out]",
             "-ar", str(SR), "-c:a", "pcm_s16le", dst]
    r = run(args)
    if r.returncode != 0:
        raise SystemExit("master failed:\n" + r.stderr[-1200:])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", default="rd-revtaiko")
    ap.add_argument("--ir", default="579154", help="impulse response id, or 'none'")
    ap.add_argument("--wet", type=float, default=0.22)
    ap.add_argument("--no-comp", action="store_true")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    src = f"{KITS_DIR}/hex-bed-{a.kit}.wav"
    if not os.path.exists(src):
        raise SystemExit(f"no such bed: {src}")
    ir_path = None if a.ir == "none" else f"{IR_DIR}/{a.ir}.wav"
    if ir_path and not os.path.exists(ir_path):
        raise SystemExit(f"no such impulse response: {ir_path}")

    lap = wav_seconds(src)
    tmp2 = f"{KITS_DIR}/_two-{a.kit}.wav"
    tmpm = f"{KITS_DIR}/_m-{a.kit}.wav"
    double(src, tmp2)

    m = measure(tmp2, ir_path, a.wet, not a.no_comp)
    apply(tmp2, tmpm, ir_path, a.wet, not a.no_comp, m)

    # KEEP THE SECOND LAP. The first one rings out of silence; the second rings
    # out of the first, which is what the loop point will actually hear.
    out = a.out or f"{KITS_DIR}/hex-bed-{a.kit}-master.wav"
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(lap), "-t", str(lap),
         "-i", tmpm, "-c:a", "pcm_s16le", out])
    for f in (tmp2, tmpm):
        if os.path.exists(f):
            os.remove(f)
    print(
        f"{out}\n  measured in  {m['input_i']} LUFS, TP {m['input_tp']} dBTP\n"
        f"  target       {TARGET_I} LUFS, TP {TARGET_TP} dBTP\n"
        f"  reverb       {'none' if not ir_path else os.path.basename(ir_path)} wet {a.wet}\n"
        f"  compression  {'off' if a.no_comp else '1.6:1 @ -12 dB, no makeup'}"
    )
