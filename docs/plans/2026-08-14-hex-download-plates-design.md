# Hex cluster downloads: plated 3MF, bed sizes, and a findable CTA

**Status:** design validated 2026-08-14. Not implemented. One blocking test open.
**Spans two repos:** the configurator UI lives in `bs-cap`; the pack endpoint and the
account setting live here (`project-foundry`).

Prompted by alpha-tester feedback on the hex cluster export: *"could you put all of
those components onto a 3MF file so I could slice it all and print them all on one
print?"* — plus a second note that the download link was hard to find.

## The problem, with evidence

**The download CTA is buried twice over.** It renders *inside the sheet*, under the BOM
table (`bs-cap/src/hex/export/html.ts` `renderPackLink`), so it sits inside the preview's
own scroll region below a table that grows with the build. The modal's action bar (Save /
Print / Share) is a **foot** bar, and `bs-cap/src/styles/export.css` already carries a note
that it "sits below the visible area" in some states. A first-time user sees a document
and a close button.

**The "download them individually" reminder already exists** — same buried block:
*"Just this build. The full set and every format are on the spec page."* The copy is fine.
Its address is the bug.

**Quantity is silently dropped.** Both `bs-cap/.../parts-pack.ts` and
`src/lib/hex-pack.ts` collapse the part list through a `Set`. The BOM knows quantities
(`bom.ts` groups anchors per glTF path and counts instances); the URL throws that away. A
cluster needing six identical caps hands the user one file and no indication that it did.
This is a worse defect than the plating gap, and it is invisible on any build whose parts
are all qty 1 — which is why nobody caught it.

## Physical constraints that shape the design

Measured from `hex-cluster/build/printables/manifest.json` (release `2026-08-03`):

- **Largest part: `Hex-TB-Main`, 87.8 × 78 × 33 mm.** Tallest: the Half-Top family at
  35 mm. Every part fits a 100 mm bed. **Bed size can never make a part unprintable** —
  it only changes the plate count. A bed picker is therefore a refinement, never a gate,
  and must never stand between someone and their files.
- **All 53 parts sum to 122,787 mm² of footprint**; a 220 bed is 48,400 mm². So even the
  entire published library is roughly four to six plates on the smallest common printer.
  Multi-plate is an edge to handle gracefully, not a workflow to build the UI around.
- **The merge itself is mechanical.** Every published 3MF is core-spec only, with exactly
  one `<object id="1">` and one `<item>` carrying an identity transform. Merging N parts
  is: lift the object block, renumber, and place it with a translation transform in
  `<build>`. No mesh math. Verified by building one (see below).

## Proof of concept

A 15-part plate was generated from the tester's actual share link
(`#s=…` → raw-deflate → the cluster JSON → the configurator's model tables) and written
to a single 3MF: 15 items, 1.27 MB, all seated at Z = 0, occupying 320 × 155 mm of a 350
bed.

The meshes it was built from are **byte-identical to what ships**: `Hex-TB-Main.3mf` is
327,423 bytes both locally and from the live `2026-08-03` release URL. Geometry was
checked with a purpose-written verifier (all items on the bed, inside the plate); that
verifier is our own code, so opening the file in a real slicer is still the acceptance
test.

## Decisions

| Fork | Chosen | Why |
| --- | --- | --- |
| What the export modal is for | **Files primary, sheet secondary** | People come here for plastic. The sheet is what they look at while deciding. |
| Default download with no settings touched | **Arranged for a default bed (220 × 220)** | Opens ready to slice on almost anything. Big-bed owners get extra plates until they change one dropdown. |
| Where bed size persists | **localStorage default, account value wins** | Signed-out users are remembered; signed-in users get cross-device. |
| Multi-plate builds | **Zip of per-plate files only** | Originally "zip plus a multi-plate 3MF inside". Reversed 2026-08-15 on measurement: the single file cannot work in the target slicer (see below). The zip is universal and needs nothing. |

## Design

### 1. Where the actions live

The top bar becomes the action bar and the foot bar goes away — two bars is how the
tester ended up looking at a document with only a close button.

Ladder: **Download** as the single solid-gold CTA, **Print sheet** gold outline, **Share**
outline, **×** icon. This inverts today's ladder, where Print holds the gold.

The bed picker sits directly under the CTA as an inline hairline control, not a step and
not a modal. **The plate count lives in the button label**, so changing the bed visibly
changes the CTA. That is the entire session-splitting UI: no wizard, no stepper. You watch
"1 plate" become "3 plates" and understand what a smaller bed costs you.

The in-sheet link under the BOM stays — it is contextually right there ("download what is
in this table") and is already screen-only. It calls the same resolver, so both paths
always produce an identical file.

Vocabulary: **plate**, not session. It is the word the slicer puts on screen.

Placement went to sandbox rounds rather than being decided in prose:

- **Round 01** (`bs-cap/sandbox-export-cta.html`, six placements, both themes) → **B**, the
  two-row bar: heading keeps its own line, action row beneath, files left and sheet
  actions right.
- **Round 02** (`bs-cap/sandbox-export-cta-b.html`, five B variations, plus a narrow-width
  toggle for the embedded case) → **B2**, plate count inside the button. The CTA reads
  `↓ Download 15 parts · 1 plate`, with `for [bed ▾]` immediately after it, then a spacer,
  then Print sheet and Share. Changing the bed visibly rewrites the button, which is the
  cause-and-effect the whole session-splitting story depends on.

Both sandbox files are deleted before the PR.

### 2. Bed size: one resolver, two stores

```
resolveBedSize()
  1. academy account value      (signed in, and set)
  2. localStorage               (this browser)
  3. 220 × 220                  (default, in code)
```

Writes always hit both: picking in the export bar writes localStorage and, if signed in,
the account. On sign-in, a local value is promoted once if the account has none. If both
exist and disagree the account wins, and the picker says *"from your account"* in small
text so the "220 here, 350 there" support question answers itself on screen.

Because the value lives in two stores, **every read goes through that one function**.
Nothing reads a store directly.

**X × Y only, no Z.** The tallest part is 35 mm; every printer clears it. A build-height
field could never change an answer.

Two edit points, same value:

- **Inline in the export bar** — primary, at the point of use. Never navigate away.
- **Account settings, new "Printing" group** — discoverable, and what makes it
  cross-device.

**Not** on the hex-configurations page: a bed belongs to the person's hardware, not to a
saved cluster. Two clusters do not have different printers.

The picker offers sizes (180 / 220 / 235 / 250 / 300 / 350 / Custom), not printer model
names. Model names mean maintaining a printer database and being wrong about it.

Schema: two nullable `Int`s on `User`, not a prefs JSON. Hand-authored migration, applied
to local first per the repo's migration split.

### 3. Packing and the artifacts

Shelf-pack, tallest row first, 4 mm gaps, every part seated at Z = 0. Deliberately naive:
the slicer's own auto-arrange is one click away, so the target is "opens ready to slice",
not "beats the slicer".

### What Creality Print actually does with our file (measured 2026-08-15)

Method: open our file in Creality Print V7.2.1, change nothing, File → Save Project As,
then diff the transform we declared against the one it writes back, per named object.

**It centres the imported scene on the bed as a rigid group. Nothing is re-arranged.**
Both imports produced a *perfectly uniform* delta across every object — (13.10, 95.56) for
the single-plate file, (−97.73, +110.64) for the two-plate one, Z unchanged in both. In
each case the scene's bounding-box centre lands on (175.0, 175.0): the middle of a 350 bed.

An earlier reading of this same data said Creality had auto-arranged and discarded our
layout. That was wrong — it compared raw translation values without accounting for the
mesh-centre convention, and a uniform translation looked like a re-pack. **Our layout is
preserved exactly.**

Consequences:

- **Our arrangement survives, so packing is worth doing** — though the absolute position
  is not ours to choose, since the scene gets recentred regardless. Coordinates are
  effectively relative; only the relative layout carries.
- **Object names survive intact** (all 15 read back as `Hex-TB-Main`,
  `Dovetail-Cap-Single-F-Solid`, and so on). That is the whole argument for 3MF over STL,
  now measured rather than assumed.
- **Z convention confirmed:** a translation of half the part height seats the base on the
  bed, and Creality writes back exactly the values we declared.
- Opening a plain core 3MF raises *"This project file is not from Creality Print. Please
  select the printer preset."* Expected: our file deliberately carries no printer or
  process settings, because those belong to the user. One preset click. Say so in the
  README so nobody reads it as an error.

### Why `all-plates.3mf` is dead

Three candidate files were built and tested, and the result is mechanical rather than a
matter of taste:

| Candidate | Contents | Result |
| --- | --- | --- |
| M1 | core 3MF + `model_settings.config` with two `<plate>` blocks | Two plates created; objects scattered, several off-bed |
| M2 | M1 + BambuStudio and production namespaces, `requiredextensions="p"`, per-object UUIDs | Identical to M1 — none of it matters |
| M3 | M1 + every mesh recentred on its own origin, so both readings of the transform agree | Identical to M1 |

A `<plate>` block in `model_settings.config` **is** enough to make Creality create N plates,
and no vendor `project_settings.config` is needed. But plate *membership* does not survive:
Creality centres the whole scene first and then re-derives which plate each object is on
from its geometry. A two-plate scene is by definition wider than one bed, so centring it
puts roughly half the parts off the plate. The M3 read-back landed 10 objects on plate 1,
1 on plate 2, and 4 on no plate at all.

No coordinate convention fixes this, because the centring is applied to the scene as a
whole before membership is recomputed. **The multi-plate single file is therefore dropped**
and multi-plate builds ship as the `plates/` zip alone, which needs none of this and works
in every slicer. The PrusaSlicer test that was gating `all-plates.3mf` is moot with it gone.

It must be **deterministic** — same parts + same bed produce the same bytes. The pack
endpoint caches for a day keyed on the URL, so bed dimensions must be *in the query* or
two people with different printers share a cache entry.

```
fits on one plate  →  hex-cluster-15-parts.3mf        (bare file, no zip)

needs three        →  hex-cluster-41-parts.zip
                      ├─ plates/
                      │  ├─ plate-1-of-3.3mf
                      │  ├─ plate-2-of-3.3mf
                      │  └─ plate-3-of-3.3mf
                      ├─ README.txt
                      └─ LICENSE.txt
```

**Plating is 3MF-only.** STL is a flat triangle soup with no transforms, no units and no
part names. Baking translations into vertices would hand someone one anonymous blob where
15 named parts used to be. `format=stl` keeps shipping loose files and the bed picker
greys out with a one-line reason.

### 4. Request grammar and limits

Grammar becomes `parts=hex-tb-main:3,dovetail-cap-single-m-solid:6`, with a bare slug
meaning qty 1 so existing links keep working.

**Quantity changes the threat model.** Today `MAX_PACK_PARTS` caps *distinct* parts at 53,
which was sufficient when one name meant one file. With quantities, `hex-tb-main:99999`
costs the same single R2 read but fans out into unbounded `<item>` lines and unbounded
plates. So:

- cap per-part quantity,
- cap **total instances** (~250),
- cap plates (~20),
- validate `plate=350x350` as two integers in a sane range and nothing else — it is both a
  loop bound and a cache key.

Over any cap is a 400 with a plain message, not a 40-plate zip.

### 5. README and the reminder

Every download's README states: the bed it was packed for, the plate count, what is on
each plate with quantities, the spike support note, the orientation note, CC BY, and the
line about individual files and the full set.

In the UI, both strings are **conditional, not permanent furniture** (sandbox round 02
picked B2, which renders neither by default):

- *"Also available individually, in every format, on the spec page"* (linking `/hex`)
  appears on a first visit, and stops appearing once the user has downloaded. It is an
  orientation aid, not a standing label.
- The *"from your account"* provenance stamp appears **only when a signed-in account value
  actually overrode a different local one** — the exact situation that would otherwise
  produce a "why is my bed 220 here and 350 there" support question. When both stores
  agree, or the user is signed out, there is nothing to explain and nothing is shown.

Neither ever competes with the CTA in the common case, which is what B2 was chosen for.

### 6. Analytics

Extend `printable_pack_downloaded` with bed dimensions, plate count, total instances, and
the **provenance** of the bed value (account / local / default). That is how we learn
whether 220 was the right default or whether everyone changes it immediately.

## Gate: closed, and the method that closed it

The multi-plate question is resolved (see "Why `all-plates.3mf` is dead"). Nothing about
this feature is blocked on further slicer testing.

**The method is worth keeping**, because it is the one that worked after three wrong
guesses from screenshots: *open our file in the slicer, change nothing, save the project
back, and diff what we declared against what it wrote.* A read-back diff answers origin
convention, transform interpretation and plate stride simultaneously and mechanically. Two
of the three conclusions I reached by looking at renders were wrong; every conclusion
reached by reading a saved file was right.

Reference artifacts, kept for whoever revisits this:

- `c:\zzz\hex-cluster-plate-K2.3mf` — our 15-part single plate.
- `c:\zzz\creality-1plate.3mf`, `c:\zzz\creality-2plate.3mf` — Creality's own saves, which
  are the authoritative schema reference for the project format.
- `c:\zzz\creality-m3-readback.3mf` — the read-back that produced the uniform-delta proof.
- Generators: `plate-3mf.mjs`, `plate-3mf-multi.mjs`, `plate-3mf-v2.mjs` in the session
  scratchpad. `plate-3mf.mjs` is the one worth porting; the other two exist to document
  what does not work.

Known false negative for anyone testing here later: Creality Print's *"The currently
selected printer does not support multi-plate printing"* is a device-registration error,
not a capability limit. Fix is Device → Scan Add → restart.

Unresolved and no longer load-bearing: the tester said *Creality Cloud*, the web/app
cloud-slicing path, which is a different code path from the Creality Print desktop build
all of this was measured against. Worth asking him, but nothing depends on the answer now.

## The one security property this feature changed

`src/lib/hex-embed-protocol.ts` stated, as rule 3 of its own model, that **no message
performs a write**. `bed-changed` writes: a bed chosen inside the configurator persists to
the signed-in user's account.

That was a deliberate widening, and it is bounded on purpose:

- the value is validated against `BED_MIN`/`BED_MAX`, the same bounds the endpoint and the
  settings action use, imported rather than restated;
- the write is idempotent, and the frame suppresses a repeat of an identical value so one
  slider drag cannot become a stream of writes;
- the result is visible and undoable at `/account`;
- the sender is already pinned by origin **and** `event.source`.

Worst case is a peer that has already cleared both gates setting a victim's bed to another
legal bed. Reversible, non-destructive, and self-evident the next time they download.

**Where the exception stops.** Nothing that creates a row, spends a quota, sends mail, or
touches another person's data may ride this channel. If a future message wants any of
those, it does not get to cite this precedent — the reasoning above turns on the write
being a single bounded integer pair on the sender's own account.

## Not in scope

- Optimal (non-shelf) packing. The slicer does it better and it is one click.
- Per-plate print profiles or filament assignment. We ship geometry, not process settings.
- Any change to the published release keys, which stay immutable.
