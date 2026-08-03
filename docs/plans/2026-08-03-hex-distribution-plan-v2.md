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
2. **It assumed an empty field.** Honeycomb Storage Wall already occupies hex +
   tapered dovetail + printed mounting, at a **40.88 mm** pitch, with a large
   accessory ecosystem on both Printables and MakerWorld. Multiboard occupies
   structural modular building. Neither is a niche to enter; both are graphs to
   join or to be ignored beside.
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

### Gate C — inherit a remix graph instead of starting one (cheapest reach)

The single highest-leverage distribution action available, and it is a
half-day of CAD, not a campaign.

The Hex Cluster pitch is **76.20 mm**; HSW is **40.88 mm**. They are not
pitch-compatible, so this is not a re-pitch and the standard does not change.
What is available is a **connector**:

- **Multiconnect is a generic connector explicitly for "Multiboard or
  Honeycomb"** and ships modeling files organised as modular bricks for exactly
  this purpose. One Multiconnect-compatible back plate on a hex tile reaches
  **both** ecosystems with one part.
- **HSW publishes dimension PDFs and STEP files** so third parties can build
  compatible models. The interface is documented; no reverse-engineering is
  required.
- A remix of an existing, heavily-downloaded model enters that model's remix
  graph on day one, which is the mechanism v1 was trying to buy with volume.

**Deliverable:** one part, `Hex-TB-Adapter-Multiconnect`, and a listing that is
a remix rather than a new model. Ship it through the existing printables
pipeline so it inherits the release, the licence and the `/hex` attribution.

**Caveat to check before building:** confirm the licence on the Multiconnect
modeling files permits a derivative and what it requires in return. CC BY-NC or
SA would change the answer. This is a five-minute check and it must happen
first.

### Gate D — the listing wave (only after A, B and C)

- Time listings to land **together**, since the spike is short and simultaneous
  listings compound within it.
- List the **adapter** and the **complete set** as separate models. The adapter
  is the one with a remix graph to enter; the set is the one with depth.
- Put the configurator link above the fold in every description. That link, not
  the CC BY attribution, is the actual channel back.
- Expect a ~7-day window. Decide in advance what "worked" means, in the numbers
  Gate A now produces.

---

## 3. What not to do

- **Do not re-pitch the standard to 40.88 mm.** The 76.20 mm pitch is load
  bearing: it is the hex across-flats plus the 0.25 mm design gap, it is
  toleranced against PETG shrinkage, and it is already published in immutable
  files. Compatibility comes from a connector, not from moving the grid.
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
3. **Does the adapter ship under the Hex Cluster release, or as its own model?**
   Under the release keeps one licence and one attribution target; separate lets
   it be listed and versioned on its own cadence.

---

## 5. Sources

Third-party facts above were verified rather than recalled:

- [Multiconnect — generic connector for Multiboard (MakerWorld)](https://makerworld.com/en/models/642696-multiconnect-generic-connector-for-multiboard)
- [Multiconnect for Multiboard v2 — modeling files (MakerWorld)](https://makerworld.com/en/models/645768-multiconnect-for-multiboard-v2-modeling-files)
- [Multiconnect — Honeycomb Storage Wall (HSW) (MakerWorld)](https://makerworld.com/en/models/642702-multiconnect-honeycomb-storage-wall-hsw)
- [Multiconnect — HSW connector (Printables)](https://www.printables.com/model/987886-multiconnect-honeycomb-storage-wall-hsw-connector)
- [Honeycomb Storage Wall (Printables)](https://www.printables.com/model/152592-honeycomb-storage-wall)

Internal facts (catalog state, purchase count, analytics coverage) are from the
repo and the production database as of 2026-08-03.
