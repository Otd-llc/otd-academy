# Hex Cluster distribution — plan v2

**Supersedes** `2026-08-02-hex-standard-distribution-plan.md` (on the unmerged
branch `docs/hex-distribution-plan`). That plan was invalidated by a four-agent
validation before any of it ran. This one is written from those findings.

**Status as of 2026-08-03.** The distribution *surface* is finished, which is why
sequencing is now the only open question.

- `academy.onethousanddrones.com/hex` is **live** and public: the spec, the
  licence, the attribution line, and working downloads.
- Release **2026-07-31 is published**: 161 objects (53 parts × 3 formats, the set
  archive, `LICENSE.txt`), 61.0 MB, CC BY 4.0.
- Every published file's `LICENSE.txt` cites `/hex`, and that URL now resolves.
- The build-sheet footer no longer claims blanket rights over CC BY geometry.

Nothing below is blocked on engineering. Everything below is blocked on a
decision or on content.

---

## 1. What v1 got wrong

Recorded so the same plan is not rewritten a third time.

1. **It sequenced the listing wave first.** Listings would have driven traffic
   into a catalog with **nothing buyable**: zero purchases to date, L1.01 free
   and alone, L1.02+ unpublished with price unset. The gate is a buyable
   catalog, not "the files exist".
2. **It said nothing about who else is in the space.** The v1 validation
   answered this with "Honeycomb Storage Wall already occupies hex + tapered
   dovetail + printed mounting", and **that answer was wrong**. See §1a: it
   compared a shape to a shape and missed that the two systems work by
   completely different mechanisms. The correction is recorded below because the
   wrong version was repeated into two revisions of this plan before the owner
   caught it.
3. **It treated attribution as the return.** On-platform, CC BY attribution
   renders as a **remix link back to the source model**, not a link to your
   domain. "Mandated attribution drives traffic to the academy" is largely
   false as stated. The `Source:` line inside `LICENSE.txt` is the only
   attribution that points at us, and it is only seen by someone who opens the
   file.
4. **It treated reach as an annuity.** Platform ranking decays with model age
   and rewards breadth of models over depth of one. A listing is a **~7-day
   spike**, not a standing channel.
5. **It planned to measure what cannot be measured.** `bioscale-viz` has **zero
   analytics**, so the middle hop of maker → configurator → academy is invisible.
   Every "we will see whether it converts" step in v1 was unimplementable.
6. **One workstream referenced a lesson step that does not exist** (an L1.01
   "breadboard holder insert download"). It was never in the authored content.

---

## 1a. Hex Cluster is not a Honeycomb Storage Wall competitor

Corrected 2026-08-03 by the owner, after this claim survived a four-agent
validation and two drafts of this plan. It is written out in full so the
comparison is not made a fourth time.

| | Honeycomb Storage Wall | Hex Cluster |
| --- | --- | --- |
| What you print | A honeycomb **sheet**, a mounting surface | **Tiles**, and nothing else |
| What the hex is | A socket array on a panel | The structural unit itself |
| The joint | An accessory's clip snapping into a cell | Tile dovetails to **tile**, on all six edges |
| Load path | Accessory → sheet → wall | Tile → tile, **in-plane**; the tiled layout is one rigid body |
| Cell size | 40.88 mm | 76.20 mm |
| Where it lives | On a wall | On a bench |

**The 40.88 mm "tapered dovetail" everyone cites is the accessory's clip**, the
thing that holds a paint bottle into a cell. It is not a tile-to-tile joint,
because HSW tiles do not join to each other: the sheet is printed as a sheet.

So the overlap with Hex Cluster is *hexagons*, *3D printed* and *modular*. That
is a resemblance in shape, not in mechanism, and it does not make the field
crowded. Two systems can both be hexagonal and share no engineering problem at
all: a socket array and a tessellating structural joint solve different things.

**The mistake to avoid repeating:** the validation compared silhouettes. Before
asserting that anything occupies this space again, state its **load path**. If
the load path is different, it is a different system, whatever it looks like in
a thumbnail.

**What this changes.** "The field is crowded" was carrying real weight in v1 and
in the first draft of this plan, and it should not have been. It does not mean
distribution is easy; it means the argument for distribution has to rest on
something real. The genuine constraints below stand on their own: nothing is
buyable (Gate B), and nothing is measurable (Gate A). Neither of those had
anything to do with HSW.

---

## 2. The corrected sequence

Gates, not dates. Each gate is cheap to check and none is a matter of taste.

### Gate A — make the funnel observable (small, do first)

Nothing after this is worth doing blind, and this is the cheapest item in the
plan.

- Add analytics to `bioscale-viz`. The academy already runs PostHog; the
  configurator runs nothing. Minimum viable: configurator opened, build
  configured, build sheet printed, save attempted, save completed, `/hex`
  referral.
- Instrument `/hex` for the two actions that matter: **download** and
  **configurator click-through**. The download now flows through
  `/api/printable/...`, which is our own route, so this is server-side and
  ad-blocker-proof. Do it there rather than with a client handler.
- **Success criterion:** you can answer "of everyone who downloaded a file, how
  many opened the configurator, and how many reached an account" with a number.
  Today that number does not exist at any hop.

### Gate B — have something to sell (the real gate)

This is the gate v1 skipped, and it is not a distribution task at all.

- L1.02–L1.05 and L2.01 are authored but were rejected as under-density and are
  being re-authored to the L1.01 bar. Until at least one premium lesson is
  published and priced, every visitor the files could send arrives at a catalog
  with one free lesson and nothing to buy.
- **Do not run a listing wave before this.** A spike that lands on an empty
  storefront is spent, not banked: the ranking decay means you do not get to
  re-spend it later.
- **Success criterion:** a signed-out visitor can reach a purchase.

### Gate C — an adapter into an existing ecosystem: DROPPED for now

This was the headline recommendation in the first draft of this plan. It is
withdrawn, for two independent reasons, either of which is sufficient.

**1. Its premise was the crowded-field claim, and that claim was wrong (§1a).**
The adapter was pitched as a way to "inherit a remix graph instead of starting
one at zero", on the assumption that HSW and Multiboard already occupied this
space. HSW does not: it is a mounting sheet, not a tessellating joint. An
adapter into a system that solves a different problem is not defensive
positioning, it is just a part.

**2. Both candidate systems are NonCommercial, so we could not ship it anyway.**
Checked 2026-08-03:

| System | Licence |
| --- | --- |
| Multiconnect (David D) | **CC BY-NC-SA** |
| Honeycomb Storage Wall (RostaP, 2021) | **CC BY-NC 4.0** |

A derivative of either would have to ship NC, and Share-Alike for Multiconnect.
That conflicts with the CC BY 4.0 the Hex Cluster release is already published
under, and it drags a non-commercial restriction onto an asset whose entire
purpose is feeding a paid catalog. It would also mean one part of the release
carrying different terms from the rest, which is precisely the unscoped-licence
defect already fixed on the build sheet.

**The one route that might survive**, if an adapter is ever wanted: design to
**published dimensions** rather than remixing their geometry. HSW publishes
dimension PDFs so third parties can build compatible parts, and dimensions
themselves are not copyrightable; their STEP files are. Clean-room from the
dimension sheet is a materially different risk profile from remixing the mesh.
That is a judgement call for the owner and, if it ever matters commercially,
for someone qualified to give it. **Do not start CAD on the assumption it is
fine.**

**What replaces this gate: nothing.** Reach has to be earned by the object
being good and by the listing being found, not by attaching to somebody else's
graph. Which makes Gate B the whole ballgame.

### Gate D — the listing wave (only after A and B)

- Time listings to land **together**, since the spike is short and simultaneous
  listings compound within it.
- Lead with what the system actually is: **a bench mounting standard where the
  tiles carry load through each other.** Not "hex storage". The nearest-looking
  systems solve a different problem (§1a), so a description that leans on the
  resemblance invites the wrong comparison and loses on it.
- Put the configurator link above the fold in every description. That link, not
  the CC BY attribution, is the actual channel back.
- Expect a ~7-day window. Decide in advance what "worked" means, in the numbers
  Gate A now produces.

---

## 3. What not to do

- **Do not re-pitch the standard to match anyone.** The 76.20 mm pitch is load
  bearing: it is the hex across-flats plus the 0.25 mm design gap, it is
  toleranced against PETG shrinkage, and it is already published in immutable
  files. There is also nothing to match: the systems it would be matched to are
  mounting sheets, not tessellating joints (§1a).
- **Do not describe it as storage, or position it against storage walls.** It is
  a mounting standard whose tiles carry load through each other. Describing it
  by what it resembles invites a comparison it does not need to win.
- **Do not gate any part of the release.** Already settled, and the reasoning
  holds: a teaser set cannot rank, and enforcement against a printed functional
  object is thin. Lead capture belongs on the configurator's "save your build",
  which is built and live.
- **Do not count attribution as traffic.** Count clicks from the configurator
  link, which Gate A will let you do.
- **Do not publish a new release to chase a small fix.** Release segments are
  immutable and a re-cut mints a new one, splitting the download history. Batch
  corrections; there is one queued already (the orientation note, corrected in
  `upload-printables.ts` and shipping with the next release).

---

## 4. Open decisions for the owner

1. **Is Gate B in scope for this plan, or a separate track?** It is the binding
   constraint on everything here but it is a content programme, not a
   distribution one.
2. **Analytics vendor for `bioscale-viz`.** PostHog matches the academy and
   makes the funnel joinable across the two properties; anything else leaves the
   hop unjoined and Gate A only half-satisfied.
3. **Is an adapter wanted at all, now that its premise is gone (§1a) and both
   candidate systems are NonCommercial (Gate C)?** If yes, the only viable route
   is clean-room from published dimensions, and that is a risk call rather than
   an engineering one.

---

## 5. Sources

Third-party facts above were verified rather than recalled. The one that was
NOT verified, and was wrong, is recorded in §1a: "HSW occupies hex + tapered
dovetail" came from a validation pass that compared shapes, survived into two
drafts, and was corrected by the owner. Licences below were checked on
2026-08-03; **the model pages themselves return 403 to automated fetches**, so
these are search-surfaced and worth a human glance before anything is built on
them.

- Multiconnect (David D): **CC BY-NC-SA**
- Honeycomb Storage Wall (RostaP, 2021): **CC BY-NC 4.0**


- [Multiconnect — generic connector for Multiboard (MakerWorld)](https://makerworld.com/en/models/642696-multiconnect-generic-connector-for-multiboard)
- [Multiconnect for Multiboard v2 — modeling files (MakerWorld)](https://makerworld.com/en/models/645768-multiconnect-for-multiboard-v2-modeling-files)
- [Multiconnect — Honeycomb Storage Wall (HSW) (MakerWorld)](https://makerworld.com/en/models/642702-multiconnect-honeycomb-storage-wall-hsw)
- [Multiconnect — HSW connector (Printables)](https://www.printables.com/model/987886-multiconnect-honeycomb-storage-wall-hsw-connector)
- [Honeycomb Storage Wall (Printables)](https://www.printables.com/model/152592-honeycomb-storage-wall)

Internal facts (catalog state, purchase count, analytics coverage) are from the
repo and the production database as of 2026-08-03.
