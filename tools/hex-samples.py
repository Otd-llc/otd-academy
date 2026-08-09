"""Fetch CC0 percussion one-shots from Freesound for the Hex Cluster bed.

WHY SAMPLES AT ALL. The bed was synthesised from scratch for several rounds and
each fix measured a real improvement: the scooped middle filled, the metallic
ring dropped, the loop's downbeat stopped reading as a restart. It still did not
sound good. Measurable progress on the wrong axis; the material was wrong, not
the arrangement. Real recordings fix what more synthesis tuning could not.

LICENCE IS THE CONSTRAINT, NOT QUALITY. This audio ends up in promotional video
for a company, and the samples themselves get committed, which is
redistribution rather than mere use. That rules out most "free" packs, which
permit use but not redistribution. CC0 clears both and requires no attribution.

  * The search filter is `license:"Creative Commons 0"`, which is the only
    syntax that works. `license:cc0`, `license:"Creative Commons Zero"` and the
    full licence URL all return zero results while the correct one returns
    27128, so a typo here fails OPEN: you get an empty set, not a wrong-licensed
    one. That is the safe direction, but it is luck rather than design.
  * EVERY RESULT IS RE-CHECKED against the `license` field it returns, which is
    a URL. Trusting a search filter to enforce a legal constraint is how a
    mislabelled sound ends up in a company's promo material.
  * Provenance is written next to the audio: id, name, uploader, licence URL and
    the page it came from, so the sourcing is auditable rather than folklore.

PREVIEWS, NOT ORIGINALS. Downloading the original upload requires OAuth2; a
token gets the previews, of which the best is ~192 kbps OGG. For percussion
that is genuinely usable, since lossy artefacts sit mostly above the range that
carries weight. If it turns out to be the limit, the escalation is OAuth, not
more processing.

PROVENANCE IS MERGED, NEVER OVERWRITTEN, and that is a bug fix rather than a
preference. This script used to rebuild `provenance.json` from a fresh LIVE
SEARCH on every `--fetch` and `json.dump` the result over the old file. Freesound
ranks by rating, so the result set moves: any sound downloaded on an earlier run
that had since slipped out of the top results kept its `.ogg` on disk and
silently lost its licence record. Found 2026-08-09 with **11 orphaned files** --
audio on disk, destined for published video, with no CC0 evidence behind it.

The audit trail is the entire point of this file, so it now only ever grows, and
`--reconcile` fails if a single audio file on disk has no record.

    python tools/hex-samples.py --list          # show candidates, download none
    python tools/hex-samples.py --fetch         # download the picks, MERGE provenance
    python tools/hex-samples.py --reconcile     # every file on disk has a record? exit 1 if not
    python tools/hex-samples.py --backfill      # re-fetch records for orphaned files, by id
"""

import argparse
import json
import os
import urllib.parse
import urllib.request

API = "https://freesound.org/apiv2"
KEY_FILE = "C:/zzz/_hex-promo/.freesound-key"
OUT_DIR = "C:/zzz/_hex-promo/samples"
CC0 = "creativecommons.org/publicdomain/zero"

# What the bed needs, and what to search for it. Several queries per role
# because one phrasing rarely surfaces the good ones.
ROLES = {
    "kick": ["bass drum hit", "kick drum one shot", "deep kick"],
    "taiko": ["taiko", "taiko drum", "japanese drum hit"],
    "tom": ["floor tom hit", "low tom", "tom drum hit"],
    "impact": ["cinematic impact boom", "deep impact hit", "boom hit"],
    "sub": ["sub bass hit", "808 sub", "low sine boom"],
    # ---- the trailer vocabulary, added after a research pass -------------
    # Reversed material leading INTO a gap is the standard way to make a hit
    # land harder: the swell builds expectation and the silence sharpens it.
    "reverse": ["reverse cymbal", "reversed swell", "backwards riser"],
    # A roll fills space and, ramped in velocity, reads as accelerando.
    "roll": ["drum roll", "snare roll", "taiko roll"],
    # Metallic punctuation over the drop, which is what stops a big hit
    # sounding like nothing but low end.
    "gong": ["gong hit", "cymbal crash", "metal impact"],
    # Felt rather than heard, under the impact.
    "subdrop": ["sub drop", "bass drop boom", "low frequency rumble"],
    # ---- the SNAP beat --------------------------------------------------
    # The word at 4.0 s is two halves meeting, so the sound wants to be a
    # mechanism closing rather than a drum: a latch, a lock, a hard click.
    "snap": ["latch click", "lock mechanism click", "snap click sharp"],
    # The percussive alternative: a rim or a block reads as a hard edge
    # without sounding like a foley effect dropped on top of the music.
    "rim": ["rimshot", "woodblock hit", "clave hit"],
    # ---- more risers ----------------------------------------------------
    # The first pass surfaced one family of whooshes. These queries reach for
    # different shapes: tonal uplifters, tension beds, air, and short sweeps
    # that can lead into a beat rather than into the drop.
    "riser2": ["uplifter riser", "tension riser build", "sweep up transition"],
    "whoosh": ["whoosh short", "air swoosh pass by", "fast whoosh transition"],
    "tension": ["tension drone build", "suspense swell", "atmospheric rise"],
    # ---- impulse responses, for real convolution reverb ------------------
    # A recorded space beats any algorithm for realism, and ffmpeg's `afir`
    # convolves with one directly. OpenAIR has a bigger library but its licences
    # vary per item; pulling IRs through the same CC0-verified path as
    # everything else keeps one rule instead of two.
    "ir": ["impulse response hall", "impulse response reverb church",
           "impulse response room sweep"],
}


def key():
    with open(KEY_FILE, encoding="utf-8") as f:
        k = f.read().strip()
    if not k:
        raise SystemExit(f"{KEY_FILE} is empty. Put the Freesound API key in it.")
    return k


def get(path, params, token):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def search(role, token, limit=6):
    """Candidates for one role, CC0-verified, best-quality first."""
    seen, out = set(), []
    for q in ROLES[role]:
        try:
            d = get(
                "/search/text/",
                {
                    "query": q,
                    # The ONLY working licence filter. See the module docstring.
                    "filter": 'license:"Creative Commons 0" duration:[0.1 TO 12]',
                    "fields": "id,name,license,duration,samplerate,channels,username,previews,url",
                    "sort": "rating_desc",
                    "page_size": 12,
                },
                token,
            )
        except Exception as e:
            print(f"  ! {role}/{q}: {e}")
            continue
        for s in d.get("results", []):
            if s["id"] in seen:
                continue
            # RE-CHECK. The filter is not the authority; the field is.
            if CC0 not in (s.get("license") or ""):
                print(f"  ! dropped {s['id']}: licence is {s.get('license')}")
                continue
            if s.get("samplerate", 0) < 44100:
                continue
            seen.add(s["id"])
            out.append(s)
    out.sort(key=lambda s: (-s.get("samplerate", 0), s.get("duration", 99)))
    return out[:limit]


PROV_PATH = os.path.join(OUT_DIR, "provenance.json")
AUDIO_EXT = (".ogg", ".mp3", ".wav")


def load_prov():
    if not os.path.exists(PROV_PATH):
        return {}
    with open(PROV_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_prov(prov):
    """MERGE, never clobber. Keyed by id within a role, so a re-fetch updates a
    record in place and a record this run did not see survives untouched."""
    old = load_prov()
    for role, records in prov.items():
        by_id = {r["id"]: r for r in old.get(role, [])}
        for r in records:
            by_id[r["id"]] = r
        old[role] = sorted(by_id.values(), key=lambda r: r["id"])
    with open(PROV_PATH, "w", encoding="utf-8") as f:
        json.dump(old, f, indent=2)
    return sum(len(v) for v in old.values())


def on_disk():
    """Every audio file under OUT_DIR as (role, id). The `wav/` subdirectories
    hold decoded derivatives of the same ids, so they resolve to the same record
    rather than needing one of their own."""
    found = set()
    for root, _dirs, files in os.walk(OUT_DIR):
        rel = os.path.relpath(root, OUT_DIR).replace("\\", "/")
        role = rel.split("/")[0]
        if role in (".", ""):
            continue
        for f in files:
            if f.lower().endswith(AUDIO_EXT):
                found.add((role, os.path.splitext(f)[0]))
    return found


def orphans():
    """Files on disk with no provenance record. This is the licence gap."""
    prov = load_prov()
    have = {(role, str(r["id"])) for role, rs in prov.items() for r in rs}
    return sorted(f for f in on_disk() if f not in have)


def sound_by_id(sound_id, token):
    """One sound's metadata, for backfilling a record whose file we already
    have. Re-checks the licence exactly as `search` does -- a backfill is not a
    reason to trust anything more than a search result."""
    s = get(
        f"/sounds/{sound_id}/",
        {"fields": "id,name,license,duration,samplerate,username,url"},
        token,
    )
    if CC0 not in (s.get("license") or ""):
        raise ValueError(f"licence is {s.get('license')}, not CC0")
    return s


def fetch(role, sounds):
    d = os.path.join(OUT_DIR, role)
    os.makedirs(d, exist_ok=True)
    prov = []
    for s in sounds:
        url = s["previews"].get("preview-hq-ogg") or s["previews"].get("preview-hq-mp3")
        if not url:
            continue
        ext = ".ogg" if "ogg" in url else ".mp3"
        path = os.path.join(d, f"{s['id']}{ext}")
        try:
            urllib.request.urlretrieve(url, path)
        except Exception as e:
            print(f"  ! {s['id']}: {e}")
            continue
        prov.append(
            {
                "id": s["id"],
                "name": s["name"],
                "uploader": s["username"],
                "license": s["license"],
                "page": s["url"],
                "file": os.path.basename(path),
                "duration": round(s["duration"], 3),
                "samplerate": s["samplerate"],
            }
        )
        print(f"  {role}/{os.path.basename(path)}  {s['duration']:.2f}s  {s['name'][:44]}")
    return prov


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--reconcile", action="store_true")
    ap.add_argument("--backfill", action="store_true")
    a = ap.parse_args()

    # --reconcile needs no network and no key, so it can run as a check.
    if a.reconcile:
        missing = orphans()
        for role, sid in missing:
            print(f"  ! {role}/{sid}: audio on disk, NO provenance record")
        n = sum(len(v) for v in load_prov().values())
        print(
            f"\n{len(on_disk())} audio ids on disk, {n} provenance records, "
            f"{len(missing)} orphaned"
        )
        raise SystemExit(1 if missing else 0)

    token = key()
    os.makedirs(OUT_DIR, exist_ok=True)

    if a.backfill:
        missing = orphans()
        if not missing:
            print("nothing orphaned")
            raise SystemExit(0)
        add, failed = {}, []
        for role, sid in missing:
            try:
                s = sound_by_id(sid, token)
            except Exception as e:
                print(f"  ! {role}/{sid}: {e}")
                failed.append((role, sid))
                continue
            add.setdefault(role, []).append(
                {
                    "id": s["id"],
                    "name": s["name"],
                    "uploader": s["username"],
                    "license": s["license"],
                    "page": s["url"],
                    "file": f"{sid}.ogg",
                    "duration": round(s["duration"], 3),
                    "samplerate": s["samplerate"],
                    "backfilled": True,
                }
            )
            print(f"  + {role}/{sid}  {s['name'][:44]}")
        total = save_prov(add) if add else sum(len(v) for v in load_prov().values())
        print(f"\n{sum(len(v) for v in add.values())} backfilled, {total} records total")
        if failed:
            # A file whose licence cannot be re-established is the thing this
            # tool exists to prevent shipping. Loud, and non-zero.
            print(f"STILL UNVERIFIED ({len(failed)}): {failed}")
            raise SystemExit(1)
        raise SystemExit(0)

    all_prov = {}
    for role in ROLES:
        print(f"== {role}")
        found = search(role, token)
        if not found:
            print("  (nothing)")
            continue
        if a.fetch:
            all_prov[role] = fetch(role, found)
        else:
            for s in found:
                print(
                    f"  {s['id']:<9}{s['duration']:>6.2f}s {s['samplerate']:>6}Hz "
                    f"ch{s['channels']}  {s['name'][:46]}"
                )
    if a.fetch:
        n = save_prov(all_prov)
        new = sum(len(v) for v in all_prov.values())
        print(f"\n{new} samples this run, all CC0. {n} records total in {PROV_PATH}")
        left = orphans()
        if left:
            print(f"! {len(left)} files still have no record — run --backfill")
