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

    python tools/hex-samples.py --list          # show candidates, download none
    python tools/hex-samples.py --fetch         # download the picks
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
                    "filter": 'license:"Creative Commons 0" duration:[0.1 TO 8]',
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
    a = ap.parse_args()
    token = key()
    os.makedirs(OUT_DIR, exist_ok=True)
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
        p = os.path.join(OUT_DIR, "provenance.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(all_prov, f, indent=2)
        n = sum(len(v) for v in all_prov.values())
        print(f"\n{n} samples, all CC0, provenance written to {p}")
