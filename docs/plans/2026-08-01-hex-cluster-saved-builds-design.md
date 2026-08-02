# Saved hex-cluster builds — design

**Goal:** a student names a hex-cluster configuration, saves it to their academy
account, recalls it, and prints a build sheet whose drawing number and revision
reference a real record rather than a hardcoded constant.

**Why this doc exists:** the feature spans three repos with independent deploys,
two origins with no shared session, and a printed artifact that must keep
resolving after both. Those constraints kill several obvious designs.

**Repos.** `bioscale-viz` = configurator (Vite + three.js, Cloudflare Pages,
`demo.onethousanddrones.com`). `project-foundry` = academy (Next.js on Vercel,
Neon, Auth.js). `otd-site-deploy` = apex. Every task names its repo.

**Baseline.** Tier 0 builds on the **`bioscale-viz` working tree**, not `HEAD`.
The build-sheet rebuild (`docs/build-sheet-spec.css`, `tools/check-sheet.mjs`,
the grid BOM) is uncommitted; `HEAD`'s `html.ts` is still a `<table>`. Commit and
merge it before Tier 0 starts.

---

## 1. Architecture decision (read first)

**The academy stores the payload as an opaque string it never parses.**

Not because it lacks a renderer — `project-foundry` has `three@^0.184.0` and
`ModelViewer.tsx` dynamically imports `GLTFLoader`. Because the schema, its
validator and its `migrate()` chokepoint live in `bioscale-viz/src/hex/state-url.ts`
on a different deploy cadence, and mirroring them means a third copy of enum
unions that file already documents as fragile. The precise constraint:

> `buildEnvelope()` and `buildBOM()` need a populated scene graph and loaded glTF
> templates — the state of the browser session that built the cluster. Not
> renderer-bound, but not reachable from a server action.

1. **The academy is a pipe.** Bytes in, bytes out, transport prefix included.
2. **There is never a "migrate the saved rows" job.** Migration is read-time,
   owned by the reader.
3. **Anything the sheet must reproduce is captured at save time.** Omitting a
   field is unrecoverable.

---

## 2. Identity

The sheet prints `OTD-HEX-001` / `Rev A` as constants (`export/html.ts:31-32`).

| | Unsaved export | Saved cluster |
| --- | --- | --- |
| Number | `OTD-HEX-h1-7f3a9c21` | `OTD-HEX-1042` |
| Revision | none | `Rev C` |
| Stamp | `UNCONTROLLED PRINT · generated <date>` | `<name at save> · saved <date>` |
| QR | full-payload deep link | `/c/<shareCode>` **always** |
| Verify by | recomputing the hash | scanning the QR and comparing `summary` |

Prefixes differ (`OTD-HEX-h1-` vs `OTD-HEX-`) so paper distinguishes the regimes.
Hex is **lowercase everywhere**, matching §2.2 step 8.

### 2.1 Identity is bound to the content hash

Earlier drafts held identity in memory and cleared it on mutation. That made the
saved regime reachable only between the post-save redirect and the first edit or
reload, gave a crafted query string the same power the design was refusing the
fragment, and left a forged `?s=` undetectable.

**There are TWO handles and they have opposite requirements.** Conflating them
was the pass-4 defect: the print identity must be content-bound so a sheet cannot
claim a record it does not match, and the lineage handle must survive edits or
`mode=rev` is unreachable and the whole revision model is dead code.

| | Print identity | Lineage handle |
| --- | --- | --- |
| Answers | "may this sheet print as saved?" | "which drawing does this scene descend from?" |
| Keyed by | `canonHash(current scene)` | nothing — it is a stored value |
| On edit | misses, sheet falls back to unsaved | **survives** |
| Cleared by | nothing (it is a lookup) | closing the tab, or any configurator load whose `?s=`/`h=` check does not pass |
| Storage | `localStorage['otd-hex-identity']` (content-keyed, shareable) | `sessionStorage['otd-hex-lineage']` (per tab) |

**Print identity — rule: valid iff `canonHash(current scene)` equals the hash
recorded when it was saved.**

- `localStorage['otd-hex-identity']` is a map from the **full 64-hex**
  `canonHash` to an **array** of `{ drawingLabel, revLabel, shareCode, name,
  savedAt, touchedAt }`. **Writes upsert by `drawingLabel`: the matching entry
  is replaced WHOLESALE**, not field-by-field. A write never appends a second
  entry for a `drawingLabel` already present; a *new* `drawingLabel` for the
  same content does insert, which is the array's whole reason to exist. Wholesale
  because a partial merge would leave `name` stale — rename it, then re-save the
  same bytes after the idempotency window, and the sheet stamps the old name while
  `/c/` renders the new one, which is the disagreement `n=` and `t=` (§3) exist to
  prevent. Appending would grow the
  array per *event* rather than per drawing: re-opening the same saved link twice,
  or the `A -> B -> A` case §4 protects as an invariant, would each add a second
  entry describing one drawing, and the multi-entry fallback would then print
  `UNCONTROLLED` on an unambiguous saved sheet. Whole-key eviction only preserves
  "one entry = one drawing" if the write path does. An array, not a value, because §5.3 deliberately manufactures
  duplicate content across clusters ("Save as new" at the revision cap mints a
  second drawing number for the same design) — identical content means an
  identical key, so a single value would let one cluster's sheet print another's
  drawing number with the hash check passing. **The print identity does not depend on the lineage handle.** A hit with
  exactly one entry prints saved, full stop — otherwise moving lineage to
  `sessionStorage` (§2.1) would mean no sheet can print as saved in any tab that
  did not itself perform the save, so saving, closing the tab and reopening your
  own bookmark tomorrow would print `UNCONTROLLED` on a content hit. The lineage
  is consulted **only to disambiguate a multi-entry hit**, matching on `drawingLabel`, which is the single
  case it was introduced for; with two entries and no lineage match the export
  prints unsaved rather than guessing.

  Pass 5 made this rule unconditional to close an eviction hazard — eviction
  reducing a two-entry array to one *wrong* entry that then printed as
  authoritative. That is closed instead by **evicting whole hash keys, never
  entries within one**: a single-entry array therefore means genuinely one
  drawing has ever been saved with that content, which is exactly when printing
  saved without a lineage is safe.
- Looked up by recomputing `canonHash` on export. Cost is negligible against the
  capture pipeline. A miss → the unsaved regime. **No `invalidateIdentity()`
  hook**, no call sites to keep in sync with `history.ts`, `undo()`, `redo()` or
  `applyState`.
- Bounded: keep the 50 most recent **hash keys**, evicting whole keys by their
  newest **`touchedAt`** — set on every write *and* on every successful export
  lookup. Not `savedAt`: pass 7 redefined that to the true save date, so evicting
  by it would make a build saved months ago the oldest key the instant it is
  recalled, evictable by the very write that inserted it, and the export that
  follows would silently print `UNCONTROLLED` on the feature's headline flow. Never evict an entry from within a key's array — that is what
  would strand a single wrong entry (see above). A
  content-keyed map grows once per distinct saved geometry and is a cache, not a
  record — the academy holds the truth.

**Lineage handle** — **`sessionStorage`**`['otd-hex-lineage']` = `{ shareCode,
drawingLabel }`. Written when a save succeeds and when a saved link is opened
(`?s=` present and the `h=` check passes). **Never cleared by editing.**

**`sessionStorage`, not `localStorage`, and that answers both its scope and its
lifetime.** It is per browsing context (§5.4 measured exactly this property while
rejecting it for a different job), so two tabs cannot clobber each other — which
matters more here than for the identity map, because the lineage has no content
key to fall back on: one global slot would let a build opened in tab B silently
downgrade tab A's genuinely-saved sheet to `UNCONTROLLED` and repoint its Save
button. And it dies with the tab, which is the correct lifetime: "this tab is
working on drawing X" is true for exactly as long as the tab is. A user returning
next week to a bare `hex.html` has no lineage and is offered "Save as a new
drawing" as the only button — right, because they are starting something new. It never
affects what the sheet prints — a stale lineage plus edited geometry still prints
`UNCONTROLLED`, because that is the print identity's job.

**The lineage handle does NOT decide `mode`. The user does.**

Three drafts tried to infer it from storage and each broke the opposite case:
identity-in-memory made the saved regime unreachable, content-bound identity made
`mode=rev` unreachable, and a never-cleared lineage made `mode=new` unreachable.
The question "does this scene still belong to that drawing?" is not answerable
from a hash or a storage slot — it is a judgement the person editing is the only
one qualified to make, and it is exactly what the Save control should ask.

So the Save control offers, with a lineage present:

- **`Save revision to OTD-HEX-1042`** → `mode=rev&share=<shareCode>` (primary)
- **`Save as a new drawing`** → `mode=new`

and with no lineage, only the second. The lineage handle chooses which button is
primary and supplies the label; it is a default, never a decision. That removes
the need for a "New build" control the configurator does not have (its toolbar is
`undo`, `redo`, `mode`, `theme`, `export`, and `clearAllCells()` is module-private
in `history.ts`), and it makes the non-owner case recoverable: `/c/` is public, so
anyone can open a stranger's build, and their first save must not dead-end.

**Non-owner rev saves.** `mode=rev` with a `share` the caller does not own returns
`not-found` (ownership is enforced in the `where`). The save page treats that code
as **recoverable, not terminal**: it re-offers "Save as a new drawing" with the
scene intact. Scan a sheet, tweak it, save it as your own is the most natural use
of a public share page and must not require the user to rebuild anything.
- **The academy sends the hash back.** The return leg carries `h=<payloadHash>`
  (§3). The configurator recomputes `canonHash()` from its own scene and stores
  the identity only if `h === "h1:" + canonHash()` — split `h` on `:`, require
  the `h1` algorithm tag, compare the 64 hex chars. Without `h=` the comparison is vacuous — the
  value being compared *is* the value being written — and an earlier draft
  claimed a forgery defence it did not have. With it, a crafted
  `?s=<real shareCode>` paired with different geometry fails, because the
  attacker would need geometry that hashes to that record's stored hash.
- Verification by a human is comparing the sheet against `/c/<shareCode>`, which
  renders `summary` (§7.3). The printed number is a reference; the record is
  authority.
- **Measured** (7/7 scenarios: plain, half subslots N+S and W+E, caps, carrier
  fill, rotations, dense 7-cell): a fresh boot at `hex.html#<payload>` followed by
  `getShareURL()` canonicalises byte-identically to the pre-save scene. Restore →
  re-encode is stable, which is what makes content-keyed identity possible.

### 2.2 Canonicalisation (normative)

**What is hashed.** Always `validateEncodedState(JSON.parse(inflate(await
encodeState())))` — the re-encoded live scene, never an inbound payload.
`applyState` is lossy (it drops caps whose `slotId` has no spec for that cell,
`state-url.ts:334`, and `rebuildSpikes()` prunes triples absent from the cluster),
and `encodeState` drops an accessory on any non-`ball-joint` spike (`:267`). So
`canon(inbound) ≠ canon(re-encode(restore(inbound)))`, and only the latter is
stable under save → reload → export.

Given that `EncodedState`, produce `CanonV1`:

1. **Cells** sort by `q`, then `r`, then `ss` by index in the frozen order
   `['full','half-N','half-S','half-W','half-E']`. Not `(q,r)` alone —
   `cellKey()` is `q,r` for `full` and `q,r:half-N` otherwise
   (`types.ts:361-363`), so two cells legally share `(q,r)`.
2. **Cap tuples** within a cell sort by slot id with
   `(a,b) => a < b ? -1 : a > b ? 1 : 0`. **Not `localeCompare`** — that is ICU
   collation, locale- and ICU-version-dependent, and never code-unit order.
   (Verified: `'a'.localeCompare('B', undefined, {sensitivity:'variant'})` is
   `-1` while `'a' < 'B'` is `false`.) Today's ids are all lowercase
   (`edge-0..5`, `cut-line`), so the two agree and the bug would ship silent.
3. **`cf`** always emitted explicitly as `true` or `false`.
4. **Spikes**: normalise each triple by sorting its `(q,r)` pairs with
   `a.q - b.q || a.r - b.r` (the rule `sortedKey()` already uses,
   `spikes.ts:272`); pad every tuple to 8 with `'none'`; sort the `sp` array by
   the six normalised coordinates **as a numeric tuple**, left to right — not by
   a joined string, which would order `10,0` before `2,0`.
5. **Total-order guarantee.** Steps 1 and 4 are injective over *encoder* output
   (`cells` and `spikes` are Maps keyed by exactly those tuples) but
   `validateEncodedState` does not reject duplicates, and `Array.sort` is stable,
   so a hand-crafted payload with duplicates would hash by array order. Tier 0
   item 4 rejects duplicate `cellKey` and duplicate normalised spike triples, and
   the sorts append `JSON.stringify(element)` as a final tiebreaker.
6. **Drop `_doc`.**
7. **Serialise.** `validateEncodedCell` (`state-url.ts:152-164`) emits `cf` only
   when it is `false`, and appends it *last*, so its output matches neither the
   required key order nor step 3's always-explicit rule.
   The implementation **builds fresh object literals** in exactly
   `{q,r,ss,bt,br,ir,cr,cf,ex,cp}` and `{v,c,sp}`, then `JSON.stringify` with no
   whitespace, UTF-8. (A replacer array also works and additionally filters
   unknown keys; pick one and pin it in the fixture.) `sp: []` is emitted, never
   omitted.
8. **Digest.** `canonHash()` is the SHA-256 of the canonical string as **64
   lowercase hex chars** — the full digest, never truncated. Derived forms:
   `payloadHash` (§2.3) is `"h1:" + canonHash()`; the printed drawing number is
   `OTD-HEX-h1-` + `canonHash().slice(0, 8)`; the `localStorage` identity key is
   the full `canonHash()`. Truncation happens **only** at the print surface, so
   the return-leg predicate compares like with like.
9. **Version.** `h1` is printed in the number and stored as `h1:<64-hex>` in
   `payloadHash`. Bumping to `h2` renumbers; the version makes that visible. It
   cannot preserve old numbers and nothing can.

**Collision posture.** 32 bits, birthday bound at 10,000 distinct builds is
`1 − exp(−n(n−1)/(2·2³²))` ≈ **1.2e-2**, i.e. ~1.2%. (An earlier draft said 1.2e-5,
which is the figure at ~321 builds.) Acceptable for an uncontrolled artifact
because the register number is the identifier wherever a collision would matter.

**The encoder does not validate its own output.** Measured: a cell carrying an
invalid `BaseType` (a `SubSlot` value passed in the `baseType` position) encodes
into a payload and is silently dropped by `validateEncodedState` on decode, so
canon(A) ≠ canon(B) for that state. It is not reachable through the UI — every
mutator constrains the value — but Tier 0 item 5's bounding pass should assert
`bt` and `cr` against their unions on the *encode* side too, so an internal bug
cannot mint an unrestorable save.

**Conformance fixture** — pins the canonical **JSON byte string** *and* the
digest, so a divergence names itself instead of failing as an opaque hex
mismatch. Covers: two cells sharing `(q,r)` with different `ss`; a cell with ≥2
caps (cap-sort divergence); multi-digit and negative coordinates (spike-sort
divergence); one `cf:false`; spikes with and without an accessory; and a cluster
with no spikes.

### 2.3 `payloadHash`

`"h1:" + canonHash()`, i.e. `h1:` followed by the full 64 hex chars. The printed
number uses the first 8 chars **of the hex**, not of this string. Client-supplied and **unverifiable here by design** — the academy cannot
recompute it without parsing. Never treated as ground truth.

### 2.4 The revision label

`revLabel` holds the bare letter (`"C"`); the sheet prints `Rev C` and the return
leg sends `r=C`. Derived from `revNo`, never stored, by the drawing-office
convention: `A`-`Z` **skipping `I O Q S X Z`** (20 usable), then `AA`, `AB`, …,
20 + 400 = 420 labels, covering the 100-revision cap (§5.3) four times over. `revNo` 1 is `A`. The
formatter sits beside the drawing-number formatter in `src/lib/hex-cluster.ts`
and is unit-tested at 1, 20, 21 and 100. A derived label cannot drift from its
number.

### 2.5 `SHEET_FORMAT_REV`

`DRAWING_REV` means *sheet format* (module docblock, `export/html.ts:21-25`).
Rename to `SHEET_FORMAT_REV`, **bump to `B`** so no two sheets carry `Rev A`
under different meanings, and record the reassignment in
`docs/build-sheet-restructure.md`.

It appears in **two** printed places — `META[0]` (`html.ts:104`) and `pageMark()`
(`html.ts:249`). The META entry is what the backfill below replaces; the page mark is relabelled
`Fmt B` so a saved sheet's masthead `Rev C` and the page mark cannot be confused.
`META` has six entries rendered as `slice(0,3)` and `slice(3)` (`html.ts:146-147`);
dropping `Rev` leaves 3 + 2, so the **second** band collapses. Backfill that slot
with `Format` on unsaved sheets and `Rev` on saved ones.

---

## 3. The return channel

The sheet is rendered by `export/html.ts` in the configurator; the register
identity is allocated in the academy. Without a return leg the feature ships and
the sheet still prints a content hash.

**After a successful save the save page navigates client-side:**

```
demo.onethousanddrones.com/hex?d=OTD-HEX-1042&r=C&s=<shareCode>&h=<payloadHash>&n=<name>&t=<ISO8601>#<payload>
```

- **Client-side** (`window.location.assign` after the action resolves), not a
  server `redirect()`. A `u=` payload can reach ~90 KB and would not survive a
  `Location` response header.
- **`d` carries the formatted label**, not the integer. The `OTD-HEX-` /
  `DEV-HEX-` environment switch is evaluated in the academy (`VERCEL_ENV`), and
  the configurator on Cloudflare Pages has no such variable. This also keeps
  §6 control 7's "route on `shareCode`, never `drawingNo`" true: `d` is a
  display string, never a lookup key.
- Query string **before** the fragment. Everything after `#` is fragment.
- **`n=` is the STORED name**, i.e. the recalled revision's
  `summary.nameAtSave` — never `HexCluster.name`. Both recall surfaces have the
  current name in hand and an engineer will reach for it, but rename is a
  first-class action (§5.5), so the sheet would stamp the new name while `/c/`
  renders the old one: the same disagreement `t=` exists to prevent, on the line
  above it.
- **`t=` is the real save date.** `savedAt` must not be `Date.now()` at write
  time: on the primary recall path (§5.5's and §7.3's "Open in the configurator")
  a cluster saved weeks ago would stamp the sheet "saved today", and the reader
  then compares that against `/c/`, which shows the true `createdAt` — the two
  dates disagreeing on the one artifact the verification story rests on.
- **`h=` is the identity predicate.** On arrival the configurator restores the
  payload, recomputes `canonHash` from the resulting scene, and writes the
  identity only if it equals `h`. See §2.1.
- **`s=<shareCode>` is also the cluster handle.** The next save sends
  `?mode=rev&share=<shareCode>`; the academy resolves the parent from it. No
  cluster id ever crosses the boundary, which keeps control 7 true and means the
  identity record needs no id field.

`/c/<shareCode>`'s "Open in the configurator" button uses the identical shape.

---

## 4. Data model

Parent/child: paper cites `OTD-HEX-1042 Rev C`, so the number survives across
saves and a revision is never `UPDATE`d.

House conventions: `//` comments (the repo has zero `///`, which would enter the
DMMF); `String` without `@db.Text` (Prisma maps it to `text`; the repo's three
`@db.Text` uses are inherited Auth.js token columns, not a pattern to copy);
`archivedAt` matching `Project.archivedAt`; nullable owner
with `SetNull` — the `Purchase` pattern, because `deleteStudent` hard-deletes
users (`src/lib/actions/admin-students.ts:205`).

```prisma
// A saved hex-cluster configuration = one DRAWING in the OTD register.
model HexCluster {
  id        String   @id @default(cuid())
  // Nullable + SetNull, the Purchase pattern: deleteStudent hard-deletes users
  // and a printed sheet's QR must not 404 because an account was cleaned up.
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  // autoincrement(), not a hand-rolled sequence: Postgres allocates at INSERT
  // (atomic, gaps expected), and Prisma types it Int so no nextval()::int cast
  // and no BigInt can reach a server action's return value.
  // Migration: ALTER SEQUENCE "HexCluster_drawingNo_seq" RESTART WITH 1001
  drawingNo Int      @unique @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // Soft delete, named for Project.archivedAt. /c/ resolves an archived cluster
  // to "removed by its owner". Does NOT count against the cluster quota.
  archivedAt DateTime?

  revisions HexClusterRevision[]

  // Raw migration CHECKs: hexcluster_name_len, hexcluster_drawingno_floor
  @@index([userId, updatedAt])
  @@index([userId, archivedAt])
}

// One immutable save. Never UPDATEd: paper cites (drawingNo, revNo).
model HexClusterRevision {
  id            String     @id @default(cuid())
  clusterId     String
  cluster       HexCluster @relation(fields: [clusterId], references: [id], onDelete: Cascade)
  revNo         Int
  // Public token for /c/<shareCode>. 22-char base62 from crypto.randomBytes, not
  // cuid(): cuid v1 is timestamp+counter+fingerprint and is not unguessable.
  shareCode     String     @unique
  // OPAQUE. Exactly the string after '#' in a deep link, transport prefix
  // included. Never parsed, re-encoded or migrated here.
  payload       String
  // h1:<64-hex> over the canonicalised state (design §2.2). Client-supplied and
  // unverifiable here by design. NOT unique per cluster: A -> B -> A must give
  // Rev C carrying Rev A's hash.
  payloadHash   String
  // EncodedState.v at save time. A number, not a shape. Also client-supplied.
  schemaVersion Int
  // What the SCENE said, captured at save time and not reconstructible later.
  // Required. Shape pinned in design §4.1, validated on write.
  summary       Json
  createdAt     DateTime   @default(now())

  // Raw migration CHECKs: hexrev_revno_positive, hexrev_payload_len,
  // hexrev_hash_len, hexrev_schema_ver, hexrev_summary_len
  @@unique([clusterId, revNo])
  @@index([clusterId, createdAt])
}
```

`User` gains `hexClusters HexCluster[]`. Both models pass `prisma validate`.

**Account deletion.** `SetNull` nulls `userId`; it does not scrub `name`.
`deleteStudent` gains, **before** the `db.user.delete` and in the same
transaction: collect that user's cluster ids, set `HexCluster.name = "(deleted)"`,
then delete, then fire `updateTag` per collected id. Order is load-bearing —
after the delete `userId` is already `NULL`, so an `updateMany({ where: { userId } })`
matches zero rows and the id list is unobtainable, and the scrub reports success
having done nothing — without the tag the
`account-deleted` outcome is up to an hour late, so `account-deleted` **is** a
cache concern. Its comment block gains `HexCluster`.

**`/c/` renders `summary.nameAtSave`, which the scrub cannot reach** — it is
frozen inside an immutable revision, and rewriting it would violate "never
`UPDATE`d". So `/c/` falls back to `HexCluster.name` **whenever `userId` is
null**, which is exactly the deleted case. Revisions stay immutable, the public
page stops showing a deleted user's title, and a live cluster still shows the
name that is on the paper.

### 4.1 `summary` (pinned)

The durable record of **what the scene said** — every printed field derived from
the scene. Not the drawing number or revision (allocated in the same transaction
that writes this) and not the constants (`Sheet`, projection).

```jsonc
{
  "nameAtSave": "Bench cluster",     // so a reprint after a rename matches paper
  "cells": 7, "caps": 12, "spikes": 3, "pieces": 22,
  "envelope": { "mm": [90.6, 48.8, 82.7], "in": [3.57, 1.92, 3.26] },
  "bom": [{ "item": 1, "qty": 3, "label": "Hex base · full",
            "dims": "87.8 × 33.0 × 78.0", "sourceFile": "Hex-TB-Main.FCStd" }],
  "details": [{ "letter": "A", "caption": "…" }]
}
```

All fields confirmed producible: `cells`/`caps` from `buildEnvelope()`, `pieces`
from the BOM reduce (`html.ts:136`), `dims`/`sourceFile` from `BOMEntry`
(`bom.ts:51-65`), imperial from `formatIn`, `details` from the `miniSlots` the
orchestrator precomputes (`index.ts:180-221`).

**Nulls.** `dims` is `PartDims | null` and prints `·`; the shape stores `null`,
not the glyph. `envelope` is `null` when `cellCount === 0`. `details` is
legitimately `[]` for a single-signature cluster (`index.ts:193`).

**The wire shape is this MINUS `nameAtSave`** — the academy stamps that in
(§5.1), so a Zod schema built literally from the shape above rejects every
save. Validate the inbound `s` against the wire shape, then stamp, then write.

**Write validation:** `bom` non-empty, `pieces ≥ 1`, `envelope` either null or
two arrays of 3, serialised length ≤ 8 KB in the action (the `hexrev_summary_len` CHECK is 12288, measuring `jsonb::text`).

**Readiness.** §4.1 previously deferred to "the same readiness the export button
uses". **That gate does not exist** — `main.ts:300-306` is a bare click and
`exportBuildSheet` checks nothing. Tier 0 builds it: a `templatesReady()`
predicate, the Save control disabled until it passes, and a
`summary-incomplete` result code for the race.

---

## 5. Flow and contracts

### 5.1 Save path

```
configurator export screen
  → academy.../account/hex-clusters/save?mode=new|rev&share=<shareCode>#<envelope>
    → client component reads location.hash
    → name field (prefilled with the drawing's current name when mode=rev,
      resolved server-side from share; empty on mode=new); user confirms
    → saveHexCluster(input)
    → window.location.assign(demo.../hex + RETURN_LINK)   // §3, incl. h=
```

Query **before** fragment on both legs.

`mode` is chosen by the user at the Save control (§2.1), never inferred: `new`
allocates a `drawingNo` at Rev A, `rev` appends to the cluster owning `share`.

**The save page opens in the SAME tab** (`window.location.assign`, not
`target="_blank"`). With lineage in `sessionStorage`, a new tab would receive the
return leg and write the lineage there, leaving the user's working tab pointing at
nothing. The scene is restored from the envelope's payload on return, so nothing
is lost but the camera and the undo stack — stated because opening a new tab to
preserve those is the natural instinct and it silently breaks the round trip.

**The fragment carries an ENVELOPE, not a bare payload.** `summary`,
`payloadHash` and `schemaVersion` are all required on write (§4), all derived from
the live scene, and none is reconstructible by the academy (§1). They cross in the
fragment with the payload, because §5.4 forbids a query string for scene data and
the fragment is the only channel that never reaches a log:

Encode with `TextEncoder` + base64url, not bare `btoa` — the summary already
carries U+00D7 and U+00B7 (§4.1) and survives only by their being under 256.

```
#<base64url of JSON.stringify({ p, h, v, s })>
   p = the payload string, transport prefix included ("s=…")
   h = payloadHash, "h1:" + the 64-hex canonHash
   v = schemaVersion (EncodedState.v at capture)
   s = summary, the §4.1 shape
```

The save page decodes it with base64url + `TextDecoder` (the inverse of the
encode rule above — a bare `atob` mojibakes the `×` and `·` the summary carries,
visibly, on the first `/c/` render), validates each field independently (control 4
still applies to `p` alone), and posts the four as separate form fields. The
envelope is a transport, never stored: the row keeps `p`, `h`, `v` and `s` in
their own columns — with one addition. **The academy stamps the confirmed name
into the summary before writing**: `summary = { ...s, nameAtSave: name }`. The
configurator never puts user text in the envelope, which keeps `btoa` off
non-Latin input (a CJK or emoji name throws) and means a first save — where the
name does not exist until the academy page collects it — still lands a populated
`nameAtSave` for `/c/` to render.

`SaveInput` is therefore `{ mode: "new" | "rev"; share?: string; name: string;
payload: string; payloadHash: string; schemaVersion: number; summary: unknown;
allowUnarchive?: boolean }`, with `share` required when `mode === "rev"`.

**Routing.** `/account/hex-clusters/save` is added to `isPublicPath` and gated
**inside the page** with
`redirect('/sign-in?callbackUrl=' + encodeURIComponent(pathname + search))`,
matching `guide/[stage]/page.tsx`. **The search string must be carried and
encoded**: since pass 5 the user's `mode` choice lives only in the query, and an
unencoded `&share=` would split off the `callbackUrl` parameter and turn a
revision save into a modeless one. `safeCallbackPath` preserves a query string
(verified: `/courses?ref=email` is in its passing fixture). Middleware gating would fire before any page JS, so the
client island that stashes the fragment (§5.4) could never mount. `/c/` is added
to `isPublicPath` too — without it every scanned QR 307s to `/sign-in`.

**Route groups:** `(chrome)` for account pages, `(bare)` for `/c/`.

### 5.2 Action contract

`src/lib/actions/hex-clusters.ts` — `"use server"`, async exports only. Types,
Zod schemas and the label formatter live in `src/lib/hex-cluster.ts`.

```ts
type SaveOk    = { ok: true; drawingLabel: string; revLabel: string;
                   shareCode: string; name: string; savedAt: string };
type SaveErr   = { ok: false; code: "payload-too-large" | "payload-malformed"
                   | "payload-uncompressed" | "summary-invalid"
                   | "summary-incomplete" | "name-invalid" | "quota-clusters"
                   | "quota-revisions" | "quota-total" | "not-found"
                   | "cluster-archived" | "rate-limited";
                   message: string };
type MutateOk  = { ok: true };
type MutateErr = { ok: false; code: "name-invalid" | "not-found"
                   | "quota-clusters"; message: string };  // quota-clusters: unarchive only

export async function saveHexCluster(i: SaveInput): Promise<SaveOk | SaveErr>;
export async function renameHexCluster(id: string, name: string): Promise<MutateOk | MutateErr>;
export async function archiveHexCluster(id: string): Promise<MutateOk | MutateErr>;
export async function unarchiveHexCluster(id: string): Promise<MutateOk | MutateErr>;
```

Rename and archive get their own result types — they mint no revision, so a
`SaveOk` shape was unsatisfiable, and a bare boolean could not say why.

`savedAt` is the created revision's `createdAt` as ISO8601: the save page builds
the §3 return link from this result, and without it `t=` falls back to the client
clock — which §3 forbids, and which stamps a date the freshly-created `/c/` page
contradicts under clock skew or a midnight-straddling round trip.

Discriminated results, never a throw for user error. `requireUser()` throws only
for genuine unauthorised. Ownership in the `where`, the `resume.ts` shape.

**What a `mode=rev` save writes to the parent.** It creates a revision and
touches `HexCluster.updatedAt` **explicitly** — Prisma's `@updatedAt` fires only
when that row is updated, and `hexClusterRevision.create()` does not touch it, so
§5.5's "ordered by `updatedAt`" would order by creation-or-last-rename and
`@@index([userId, updatedAt])` would index the wrong thing. It does **not** write
`name`: the save form's name field is a confirmation of what will be stamped into
`summary.nameAtSave`, and renaming the drawing is `renameHexCluster`'s job. The
list's "saved date" is the latest revision's `createdAt`, not the parent's.

**Payload transport:** hidden field in a `useActionState` form.
`experimental.serverActions.bodySizeLimit` is pinned to `"1mb"` (currently unset;
this documents intent, it is already the default and adds no bound).

**Concurrency — one lock fixes three races.** Measured against local PG 17.10:

- `count()` in-transaction under READ COMMITTED **does not** hold a cap: both
  transactions saw 2, both inserted, final 4 against a cap of 3.
- `INSERT … SELECT COALESCE(MAX(revNo),0)+1` **races**: with the unique index
  dropped, both computed `revNo` 2.
- With the index present the loser **blocks** on the uncommitted key, then errors
  `55P03` under a `lock_timeout` — it does not fail fast.
- The stated `P2002` retry **never fires**: a raw-SQL violation surfaces as
  `P2010` with the SQLSTATE at `meta.driverAdapterError.cause.originalCode`.
- A retry inside the transaction is impossible: the next statement gets `25P02`.

**Take `SELECT pg_advisory_xact_lock(hashtext($userId))` as the first statement
in the transaction.** Measured: quota holds (`saw=2 inserted=true` /
`saw=3 inserted=false`, final 3) and revisions serialise (`revNo` 2 then 3) with
no error and no retry loop. Keyed on `userId` it also serialises the idempotency
check, which is itself a read-then-write race. It is transaction-scoped, so it is
safe on Neon's PgBouncer pooler (only *session*-level advisory locks are
unsupported there). Keep `@@unique([clusterId, revNo])` as the backstop.

**Idempotency:** for `mode=rev`, a second save matching `(clusterId,
payloadHash)` **of the latest revision** within 60 s returns that revision. For
`mode=new` there is no `clusterId` yet, so the window is keyed
`(userId, payloadHash, revNo = 1)` — **scoped to first revisions**, or it would
swallow a legitimate "Save as a new drawing" made within 60 s of a `mode=rev`
save of the same bytes, which is precisely the fork §5.3 offers at the revision
cap. It returns the cluster created by the first call —
without it a double-click or a retry after a timeout mints two drawing numbers
for byte-identical content and burns two of the 200 slots. Scoped to the latest, not
any — otherwise A→B→A inside the window returns Rev A and the
`payloadHash`-is-not-unique invariant is broken.

### 5.3 Quotas

**Not `enforce()`** — it is a sliding-window *rate* limiter, cannot express "50
rows exist", returns ok when `KV_REST_API_*` is unset (all of local and CI),
degrades open, and does not self-gate (`defenseEnabled()` lives in
`abuse-defense-flag.ts` and callers apply it).

Caps are `count()` **inside the advisory-locked transaction** (§5.2): 50
non-archived clusters per user, 100 revisions per cluster. `enforce()` is kept
for burst rate only, gated on `defenseEnabled()`.

Archived rows do not count against the active cap, so
archive→save→archive is an unbounded write loop. **Cap total clusters (archived
or not) at 200**, returning `quota-total`. Unarchive is **not** an exit from it — unarchiving moves a row between states
and the total is unchanged — so v1 ships unarchive for the *active*-cap case and
**200 total is terminal in v1**: at the cap the only remedy is the manual
privacy-page channel, and the UI says so rather than implying otherwise. Hard
delete is deliberately deferred: it is the only real exit, and it 404s a printed
sheet's QR, which is the outcome the `SetNull` design exists to avoid. Revisit
with a tombstone that keeps `/c/` resolving.
`/account/hex-clusters` shows both figures, not one.

**`unarchiveHexCluster` runs inside the same advisory-locked transaction** and
re-checks the 50-active cap, returning `quota-clusters` — an unlocked `count()`
does not hold a cap (§5.2, measured). It fires `updateTag('hex-cluster-<id>')`,
or `/c/` keeps saying "removed by its owner" for up to an hour after the cluster
is live again. It is a row action on the list (§5.5) and has a test (§10).
`mode=rev&share=<code of an archived cluster>` is rejected with
**`cluster-archived`**, not `not-found` — saving a revision onto an archived
drawing would resurrect it silently, but the owner's remedy is one click
(unarchive), and routing them into "save as new" instead would mint a second
drawing number for the same design plus another slot against both caps. The save
page offers **Unarchive and save** for this code and "Save as a new drawing" for
`not-found`. "Unarchive and save" is **not** two actions: the page re-calls
`saveHexCluster` with `allowUnarchive: true`, so the unarchive, the 50-active cap
re-check and the revision insert are one advisory-locked transaction. Two
sequential calls would not be atomic — the unarchive could commit and the save
then fail on `quota-revisions` or `rate-limited`, leaving the drawing un-archived
with no revision — and the save page has no cluster id to call
`unarchiveHexCluster(id)` with, since §3 keeps ids off the boundary.

At the cluster cap **the "Save as a new drawing" button** is disabled with the
count shown — not the form. A `mode=rev` save creates no cluster, so neither cap
applies to it (except on the `allowUnarchive` branch above, which re-checks the
50-active cap and can therefore return `quota-clusters` from a `mode=rev` call), and a user at 50 clusters must still be able to revise the ones
they have. (A user at both caps at once has no continuation; the UI says so.) At the
revision cap the only continuation is "Save as new", which mints a new drawing
number — stated in the UI, because that is a new drawing for the same design.

### 5.4 Fragment survival

Verified in Chromium 148 and normative in RFC 9110 §10.2.2 (a UA **MUST** inherit
the original fragment when `Location` has none): the payload survives the 307 to
`/sign-in`. It dies at the magic-link round trip.

Three corrections to the previous draft:

1. **`sessionStorage` cannot work.** Measured: a new tab, same origin, reads
   `session: null`. A magic link opens a fresh browsing context. Use
   **`localStorage`** with a short TTL, cleared on restore.
2. **`/welcome` is not the landing.** It is the field-guide lead-magnet page. The
   general landing is `safeCallbackPath(params.callbackUrl, "/start")`
   (`sign-in/page.tsx:35`). Restore on the **save page itself**.
3. **Nothing navigates back.** `src/proxy.ts` redirects with no `?callbackUrl`.
   Gating inside the page (§5.1) fixes this — the page adds its own.
4. **The stash runs on `/sign-in`, not on the save page.** A Server Component
   `redirect()` never sends the page body, so no client island on the save page
   ever mounts for an anonymous first visit — the same property §5.1 cites as the
   reason to gate in-page rather than in middleware. `/sign-in` is already a
   client-bearing route and the fragment is alive there (RFC 9110 §10.2.2), so it
   stashes; the save page restores after the round trip.

Residual failure is a genuinely different browser or profile; the save page
renders "your build could not be carried through sign-in — go back and press
Save again."

**Query strings are forbidden for the payload**: Vercel access logs and the
`Referer` on every outbound asset. (The earlier claim that it is persisted in a
`VerificationToken` row is false — that table holds `identifier`, `token`,
`expires` only.)

### 5.5 Pages

**`/account/hex-clusters/save`** — states: loading (a client component cannot
read `location` during prerender, so this is mandatory), no-payload,
malformed-payload, carried-through-sign-in-failed, form, submitting, one message
per `SaveErr.code`, success. Copy for each is specified in the implementation
doc, not here.

**`/account/hex-clusters`** — rows show name, drawing label, latest rev, saved
date, cells/pieces from `summary`, and **"Open in the configurator"** (the
recall action; without it the saved regime is unreachable). Ordered by
`updatedAt`. Latest revision per row, with a per-cluster history view listing
every revision and its `/c/` link. Quota remaining. Empty state linking to the
configurator. `robots: { index: false }`.

**`/c/<shareCode>`** — §7.2.

Archived clusters are hidden by default behind an **"Archived" filter** on the
same page; without it `unarchiveHexCluster` has no surface and archiving is a
one-way trip. Rename, archive and unarchive are row actions. `UserMenu.tsx` gains "Saved builds" — note
this is a *link*, so §8's "academy first, unlinked" means unlinked **from the
configurator**, not from the account area.

---

## 6. Security controls

| # | Control |
| - | ------- |
| 1 | **Refuse to save from a non-compressing browser.** Not a larger cap: on the `u=` path the QR is V28 at five cells and over QR capacity entirely at nineteen, so any byte cap still permits an unscannable sheet. Return `payload-uncompressed`. ~7% of global traffic lacks `deflate-raw`, so the message must be actionable. |
| 2 | The academy never inflates. There is no server-side decompression path. |
| 3 | `bodySizeLimit: "1mb"` pinned. |
| 4 | Payload validated as an opaque token: **split on the first `=`**, prefix in `{s,u}`, remainder `/^[A-Za-z0-9_-]+$/`, length ≤ 16 KB. (The previous draft applied the character class to the whole string, which rejects every real payload since the prefix contains `=`.) |
| 5 | Never store a URL. Reconstruct return links from a compile-time constant. |
| 6 | Name: trim, 1–60 code points after NFC, reject C0/C1 and newlines, reject bidi overrides (U+202A–202E, U+2066–2069) — a printed drawing must render the string that was stored. |
| 7 | Route on `id`/`shareCode`. `drawingNo` never appears as a lookup key; `?d=` carries a display label only (§3). |
| 8 | Quotas by `count()` inside the advisory-locked transaction (§5.2/§5.3). |
| 9 | Never add `cookies.sessionToken.options.domain`. There is **no `cookies` key in `src/auth.ts` at all** — the control is "never add one". Enforce with a source-text guard in the `content-archive-guards.test.ts` style, matching `cookies:` **inside the `NextAuth({…})` call** — a naive grep is red on day one because `auth.ts:313` does `const { cookies } = await import("next/headers")`. Do not hoist the config for a test. |
| 10 | A hash- or query-supplied name is a suggestion the user confirms. |
| 11 | `disallow: /c/` in `robots.ts` — **with the trailing slash**. `Disallow` is a prefix match, so `/c` would de-index `/courses`, `/courses/*` and `/checkout/success`. Plus `noindex` on the page, an IP rate limit on `/c/` 404s, and the **cluster** name shown, never the owner's. |

### Ruled out permanently: same-origin rewrite

Serving the configurator at `academy.../hex` would enable inline saving. It must
not be built:

- `HttpOnly` is irrelevant — a script on that origin has the browser, and Next's
  server-action CSRF defense is an Origin/Host comparison that same-origin passes
  by construction. An XSS reaches every module in `src/lib/actions/`.
- With an admin session: `editGuideCard`, `deleteStudent`, `grantPassEntitlement`,
  `createUploadUrl` (presigned R2 write). `contentBlocks` is not in git and Neon
  free keeps ~6h of history.
- The academy has **no CSP** beyond `frame-ancestors *` on `/embed/:path*`.
- It gives the configurator's build pipeline script authority over a
  payment-bearing origin: `three`, `camera-controls`, `qrcode` are floating
  carets, `vite-plugin-glsl` is a build-time plugin with code-gen authority.
- Independently broken: `base` does not fix **124** hardcoded runtime path
  literals, all silent at compile time; upstream sends `max-age=0`, so Vercel
  proxies all 114 requests per load.

---

## 7. Print and QR

### 7.1 A saved sheet's QR is always `/c/<shareCode>`

Measured at the approved 78 px box (`docs/build-sheet-spec.css:104`,
`export.css:322-326`), with `margin: 1` (`qr.ts:20`), at 96 CSS px/inch:

| version | modules + quiet zone | mm/module at 78 px | px for 0.40 mm |
| --- | --- | --- | --- |
| V14 (typical) | 75 | **0.275** | 113 |
| V17 | 87 | 0.237 | 132 |
| V25 | 119 | 0.173 | 180 |

**Every size already fails a 0.4 mm/module rule, including typical.** Holding it
needs 113 px at V14 and 180 px at V25 against a 78 px approved box — at V25 the
`.sheet-id` band narrows ~17%, which is a masthead redesign of a locked pick.

Therefore: **do not derive the size.** A saved sheet's QR encodes
`/c/<shareCode>` — ~61 bytes, V4-M, 33 modules, **0.63 mm/module at 78 px** — and
the approved box is left alone. An unsaved sheet keeps the payload QR and prints
`UNCONTROLLED`, which is the regime where a large cluster's code being marginal
is honest rather than misleading.

**Sizing caveats to carry forward.** The 0.4 mm/module figure is a common
industry rule of thumb; it is **not** in the repo and not in ISO 18004's text as
a per-module minimum (18004 specifies symbol sizes; the 10 mm / 20 mm symbol
guidance is what the standard supports). Cite it as a rule of thumb or drop it.
`/c/<shareCode>` at 61 bytes leaves **one byte** of V4-M headroom (62), and
base62 forces byte mode, so any host or path change pushes it to V5.

**Two live hangs to fix in the same pass.** `src/hex/export/index.ts` has **zero**
`try`/`catch`. `generateQRSVG` throws on an over-capacity payload (a 200-cell
`s=` URL exceeds V40-M's 2331 bytes) and `encodeState` throws on Chrome 80–102,
where `typeof CompressionStream` passes but the `deflate-raw` *format* is
unsupported. Either way the modal sits on "Generating build sheet…" forever.

### 7.2 `sheet:check` coverage is narrower than assumed

The harness derives assertions from declarations **present in the spec**, so
anything without a spec rule is unguarded by construction. Verified: the stamp
has no rule; `content` is in the harness's `IGNORE` list so a `Rev` relabel passes
silently; band track lists are injected inline (`repeat(${rows.length},1fr)`) so a
3→2 column collapse passes; `.qr-url` has no rule. **Only `.qr` width/height is
genuinely asserted** — and since §7.1 no longer changes it, no spec change is
needed for the QR at all.

The harness also drives only `#export-btn` on `hex.html`, i.e. the unsaved
regime. **Tier 0 extends it** to render a saved-regime masthead from a fixture,
or the saved sheet ships with no gate coverage.

### 7.3 `/c/<shareCode>` is a 200 interstitial

Not a cached 307. Plain `use cache` is an in-memory LRU that does not persist
across serverless instances; `redirect()` throws and cannot be cached; and a 307
has no body for "removed by its owner" or an OG card.

**Renders:** drawing label, revision, **`summary.nameAtSave`** (not the current
name — the page exists so a reader can compare it against paper, and paper says
what the name was at save; §5.5's list shows the current name, which is the
surface where a rename should be visible), saved date, **and `summary`**
— cells, caps, pieces, envelope, and the BOM table. Without `summary` a reader
holding paper has nothing to compare, and comparison is the whole verification
story (§2). Plus "Open in the configurator" carrying the **full** §3 return link — `h=`
included. Omitting it makes the identity check vacuous, so a recall from `/c/`
or from the account list would silently land in the unsaved regime.

**Caching:** the lookup is `'use cache: remote'` (Next 16.0+, requires
`cacheComponents`, which is on), with `ONE_HOUR` and the new tag
constants both in `cache-profile.ts` (where `TAG_PARTS` and `guideContentTag`
already live; `cache-invalidate.ts` holds the invalidator functions), never a
bespoke inline tag.

**One tag, cluster-level.** The lookup carries `hex-cluster-<clusterId>` and
nothing else. A per-revision `hex-share-<code>` tag was specified in an earlier
draft and fired by nothing: revisions are immutable, and every event that changes
a `/c/` render is cluster-level — archive, unarchive and account deletion — so a
per-revision tag would also have left 99 stale pages after archiving a
100-revision cluster while the cluster tag invalidates all of them at once.
`updateTag()` fires it on those three. **Rename is not one of them** — `/c/`
renders `summary.nameAtSave`, which a rename cannot reach, and the
`HexCluster.name` fallback applies only when `userId` is null, a state in which
nobody can rename.

Caveats: Vercel's Runtime Cache docs name `revalidateTag`/`expireTag` for remote
entries and do not mention `updateTag`; the cache is **regional**; and the key is
near-unique per request, so utilisation is low and the Neon saving is smaller
than a shared cache normally implies. Verify invalidation on a preview deployment
before treating it as immediate. `redirect()` and `notFound()` are called
**outside** the cached function, which is the documented shape.

`account-deleted` **is** a cache concern — §4 fires `hex-cluster-<id>` on
deletion, or a deleted user's title survives on `/c/` for up to an hour.

---

## 8. Sequencing

**Deploy order** (governs; the tier numbering is build order):

1. **Merge the `bioscale-viz` working tree.**
2. **Academy**, unlinked *from the configurator*. `UserMenu` and the account
   pages ship together. In this window every `/c/` hit is `unknown-code`, so
   **the enumeration alert (§10) is armed only after step 3.**
3. **Configurator.** The export screen starts linking. Shipping this first points
   users at a 404.

### Tier 0 — configurator

1. `canonHash()` per §2.2 + the conformance fixture.
2. Identity + lineage: read the §3 return link, verify `h === "h1:" + canonHash()`,
   persist both handles (§2.1), fall back to unsaved on mismatch.
3. **The Save control** — where it lives in the export modal, how it builds
   `?mode=new|rev&share=<shareCode>` **from the lineage handle** (not from the
   print identity, which misses after any edit), disabled until
   `templatesReady()`.
4. `SHEET_FORMAT_REV` rename + bump to `B` + page-mark relabel + band backfill
   (§2.5).
5. Bound `applyState`: `c.length ≤ 512`, `sp.length ≤ 512`, `cp.length ≤ 12`,
   `slotId.length ≤ 32`, cell **and spike** `q`/`r` `Number.isInteger` within
   ±256, **`br ∈ 0..2`, `ir ∈ 0..1`** (`types.ts:580-581` — `br` is ×120° and
   `ir` ×180°, so `br: 3` renders identically to `br: 0` while producing a
   different digest), and **reject duplicate `cellKey` / duplicate normalised
   spike triples** (§2.2 step 5).
6. Escape the raw sinks in `export/html.ts`: `band()`'s `v` (`:76`) and `second`
   (`:77`), `DRAWING_ID` (`:145`, `:249`). `${qrSVG}` (`:150`) stays raw and
   must be branded, not escaped. Introduce `rawHTML(s): RawHtml`; `band()`
   escapes anything unbranded. The new stamp is user-controlled text and renders
   through the escaping path.
7. Fix the `deflate-raw` feature detect (`try { new CompressionStream('deflate-raw') }`)
   and add error handling to `export/index.ts` for both hangs (§7.1).
8. Extend `tools/check-sheet.mjs` to cover the saved-regime masthead (§7.2).

**Tier 0 item 5 must run against the Tier 1 corpus before shipping**, so build
the corpus first — it is a test fixture, not a dependency on Tier 1's runtime
changes.

### Tier 1 — the contract, configurator

- `migrate(raw)` dispatches on `raw.v`: `1 → validateV1`, unknown → a typed
  `{ kind: 'unsupported-version', v }`, so a newer payload is distinguishable
  from garbage.
- **Corpus:** ≥12 payloads covering both prefixes, every `SubSlot`, `cf:false`,
  7- and 8-element spike tuples, absent `sp`, and two cells sharing `(q,r)`.
  Generating a `u=` payload requires an injection point — `HAS_COMPRESSION` is a
  module-scope const (`state-url.ts:391`), so `encodeState` gains an internal
  `opts?: { forceUncompressed?: boolean }` used only by the generator.
- Asserted by **deep-equal against an expected decoded object**, not "not null",
  which passes on a migration that drops every cap.
- Surface decode failure: `decodeRawHash` catches to `null` and
  `main.ts:597-604` then places a default cell and starts the demo, so a failed
  restore is **indistinguishable from a fresh visit**.
- **Forward tolerance is deferred**, not designed. A partial restore changes the
  canonical state and therefore the number.

### Tier 2 — academy

Migration → actions → pages → `/c/`. `pnpm db:migrate` (local) →
`pnpm test:pool:refresh` → verify → `pnpm db:migrate:prod` **before the code
merges**. The pool refresh is not optional: `vitest.global-setup.ts` throws before
any worker spawns once a migration directory exists that the pool lacks (local
only — CI leaves `TEST_DATABASE_POOL` unset).

`prisma migrate deploy` applies files without diffing, so run `prisma migrate
diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel
prisma/schema.prisma --exit-code` after local.

**Rollback is forward-only.** Reverting the code is safe *while nothing links to
the tables*; after step 3 it is not.

Migration SQL follows `20260707120000_billing_purchase/migration.sql`: WHY header,
`CREATE TABLE IF NOT EXISTS`, inline named `CONSTRAINT … CHECK` with a `--`
rationale each, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, FKs in
`DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.

**CHECK predicates:**

```sql
hexcluster_name_len        CHECK (char_length("name") BETWEEN 1 AND 120)
hexcluster_drawingno_floor CHECK ("drawingNo" >= 1001)
hexrev_revno_positive      CHECK ("revNo" >= 1)
hexrev_payload_len         CHECK (char_length("payload") BETWEEN 4 AND 16384)
hexrev_hash_len            CHECK (char_length("payloadHash") BETWEEN 11 AND 80)
hexrev_schema_ver          CHECK ("schemaVersion" >= 1)
-- 12288, not 8192: Prisma Json maps to JSONB, and jsonb::text re-serialises
-- with a space after every ':' and ',', so a summary the action validates at
-- <= 8192 compact can exceed a 8192 CHECK and throw a raw constraint error
-- instead of returning summary-invalid. Measured: a 25-byte compact object is
-- 31 bytes as jsonb::text.
hexrev_summary_len         CHECK (length("summary"::text) <= 12288)
```

`hexrev_payload_len`'s single bound is now writable because control 1 refuses
uncompressed payloads outright rather than admitting a larger `u=` ceiling.

---

## 9. Struck

**"Derive `SHARE_BASE_URL` from `location.origin + location.pathname`."** You
cannot derive a cross-origin target from your own origin; the constant is
hardcoded deliberately so preview-deploy QRs resolve to production
(`state-url.ts:364-368`); `SCHEMA_DOC_URL` is written into `_doc` in every
payload, so deriving it changes payload bytes and forks the corpus. **And the
premise was false** — `BioScaleEmbed.tsx:6` is one env-overridable constant
(`process.env.NEXT_PUBLIC_DEMO_URL ?? …`) used at three sites.

If preview QRs are a real problem: refuse to render a QR on a non-production
origin and print "PREVIEW BUILD — NOT FOR DISTRIBUTION".

---

## 10. Testing

DB tests lease a per-file Neon branch via `.env.test.local`; throwaway rows.

- **CHECK tests**, one per predicate above, in the `check-*.test.ts` family
  (`check-bomline-refdes-count.test.ts` for the shape).
- **`hex-clusters-actions.test.ts`**: ownership scoping, every `SaveErr.code`
  except `rate-limited` (unreachable in CI — `enforce()` no-ops keyless), quota
  boundaries, the idempotency window.
- **Concurrency**: two parallel saves produce sequential `revNo` and hold the
  quota. **Set a `lock_timeout`** — without the advisory lock the loser *blocks*
  rather than erroring, and the test hangs the suite instead of failing it.
- **Drawing number**: monotonic, unique, format. Never assert an absolute value.
- **`admin-routes.test.ts`**: `/c/<code>` and `/account/hex-clusters/save` public.
- **Canonicalisation**: the §2.2 fixture, its pinned JSON string and digest, plus
  order-independence (same cluster built two ways, one digest).
- **Guards**: no route reads the payload from `searchParams` (scoped to the hex
  routes, matching a named key); no `cookies` key in `src/auth.ts`.

---

## 11. Observability

- `capture("hex_save_failed", { code })` over `SaveErr.code`.
- `capture("hex_share_resolve", { outcome })` — `hit | archived | account-deleted |
  unknown-code`. **Not `schema-stranded`**: deciding it would require the academy
  to know the configurator's current schema version, which §1 forbids. Tier 1
  already puts that decision in the right place (`{ kind: 'unsupported-version',
  v }`), so the notice is rendered by the configurator after a failed restore, not
  by `/c/`. Fire it in the **page**, not inside the cached
  lookup: re-execution of a cached function is the cache's business, and
  telemetry as a cache side effect under-counts.
- **The Neon-wake metric cannot ride a returned flag.** A `cacheMiss` boolean
  computed inside the cached function is cached *with* the value, so a hit
  replays `cacheMiss: true` — the same reason the telemetry moved out. Measure it
  where waking actually happens: a counter incremented in the DB access layer, or
  Neon's own compute-time metric correlated against the `hex_share_resolve`
  count. Do not infer it from the page.
- Rising `unknown-code` → `alertAbuse()`. **Armed only after deploy step 3.**
- Record `payload.length` and `summary` length per save.

---

## 12. Measurements

**All figures below need regenerating by a checked-in script before any of them
is used as a budget.** The previous table was produced ad hoc and one figure
(a 61-cell `u=` payload at ~27 KB) was contradicted by a later measurement
(~13 KB). Direction is established; magnitudes are not.

What *is* measured and reproducible: base64 overhead converges to 4/3 from above;
on the `u=` path the QR reaches V28 at five cells and exceeds QR capacity at
nineteen; a `/c/<shareCode>` URL is ~61 bytes, V4-M, 33 modules, one byte inside
the version's 62-byte limit.

**The quota set implies a per-user storage bound.** 200 clusters × 100 revisions
× (16 KB payload + 8 KB summary) ≈ **0.47 GB for a single account at the caps**,
against a free-tier storage ceiling of roughly that size. The caps are a defence
against accident, not against a determined user, and they should be re-derived
against a verified tier figure before launch — or the total cap lowered.

Neon tiers: the 5 GB egress and 100 CU-h figures are in `CLAUDE.md`; the 0.5 GB
storage cap is **not** — web-verify before relying on it.

---

## 13. Validation log

Recursive review to a dry pass, per `2026-07-07-billing-audit-schema.md`.

### Pass 1 — 2026-08-01 · fact-check, implementability, failure modes, consistency

**Not dry.** ~80 findings. Material: no return channel; canonicalisation
unimplementable; `payloadHash` conflated with the drawing number; `enforce()`
misused; `revNo` race; `Cascade` vs never-hard-delete; `use cache` 307;
`sheet:check` collision; `sessionStorage`; `u=` cap; `summary` nullable;
`shareCode` entropy; `SHARE_BASE_URL` derivation; missing pages; no ship order;
no observability; convention deviations.

**Corrections to this document's own claims:** the academy *does* have three.js
and a glTF loader; `BioScaleEmbed.tsx` has one env-overridable constant;
`VerificationToken` does not persist `callbackUrl`; a failed restore boots the
default demo scene; the 0.5 GB cap is not in `CLAUDE.md`; four raw sinks, not
three; `/account` is gated by the same fall-through as `/hex`.

### Pass 2 — 2026-08-01 · implementability, adversarial correctness, consistency

**Not dry.** Canonicalisation **validated** — two independent implementations
from the prose agreed byte-for-byte across 200 permutations. Everything else was
mechanical.

Measured and fixed: `count()` quota breaches under READ COMMITTED; the `revNo`
`INSERT…SELECT` races and its loser *blocks* rather than erroring; `P2002` never
fires (it is `P2010`); a retry cannot live inside the transaction (`25P02`);
`pg_advisory_xact_lock(hashtext(userId))` fixes all three; uncast `nextval`
returns a **BigInt** through Prisma and `JSON.stringify` throws, and
`@default(autoincrement())` removes the problem; `sessionStorage` is empty in a
new tab; `/welcome` is not the sign-in landing and `proxy.ts` sends no
`callbackUrl`; the `u=` QR is unusable from five cells; `HAS_COMPRESSION` is the
wrong detect and Chrome 80–102 hangs the modal; `generateQRSVG` throws
uncaught on over-capacity; at 78 px every QR size fails 0.4 mm/module.

Design changes: identity is now **bound to the content hash** (§2.1), which
fixes the unreachable saved regime, the forged-`?s=` hole and the 44-call-site
`invalidateIdentity()` problem together; a saved sheet's QR is **always**
`/c/<shareCode>`, which removes the QR resize and the `sheet:check` conflict
entirely; `/c/` renders `summary` so paper is verifiable.

Corrections: collision figure was 1000× optimistic (~1.2%, not 0.0012%); the
query string was placed after the fragment; control 4's regex rejected every
payload; `drawingNo` was declared "never a URL token" then passed as `?d=`;
the `DEV-HEX-` switch could not reach the printer; `localeCompare` is not
code-unit order; `SHEET_FORMAT_REV` would print two meanings of `Rev` on one
sheet; the second band collapses, not the first; `sheet:check` guards one of the
three changes it was invoked for.

### Pass 3 — 2026-08-01 · implementability + consistency, plus a direct empirical test

**Not dry**, but converging: ~80 findings in pass 1, ~60 in pass 2, six blockers
here — all single-decision fixes, none requiring re-architecture. 7 of pass 2's
10 blockers fully closed, 1 closed-but-flawed, 2 relocated.

**The crux was tested directly rather than reasoned about.** §2.1 only works if
restore-then-re-encode is byte-stable; otherwise a saved identity never validates
after a reload and the model fails silently. Measured with the real modules
against a dev server, each leg a fresh page boot so nothing accumulates, leg B
going through the production `tryRestoreFromHash` path:

```
  ok  plain 3 cells        A=06c57acb B=06c57acb   cells 3->3
  ok  half subslots N+S    A=22952ab9 B=22952ab9   cells 3->3
  ok  half subslots W+E    A=67109a8c B=67109a8c   cells 3->3
  ok  caps on 3 slots      A=b72934a0 B=b72934a0   cells 2->2
  ok  carrier fill off     A=bac5a4e4 B=bac5a4e4   cells 2->2
  ok  rotated base+insert  A=8be55050 B=8be55050   cells 2->2
  ok  dense 7 cells        A=29046485 B=29046485   cells 7->7

  crux: 7/7 stable across save -> reload -> re-encode
```

A first run reported 7/7 stable and was a **false green** — `applyState` had
returned `false` in four scenarios, so no restore happened and the harness
re-encoded an untouched scene, while a broken reset let clusters accumulate. The
recorded result is from the corrected harness. It also surfaced a real asymmetry:
an invalid `BaseType` encodes into a payload and is dropped on decode, so the
encoder does not validate its own output (now Tier 0 item 5).

Blockers fixed: the cluster id never crossed the return channel, so `mode=rev`
was unbuildable (now keyed on `shareCode`); the identity write had no predicate,
making the forgery claim false as specified (now `h=<payloadHash>` on the return
leg); the fragment stash could not run where it was placed, because a Server
Component `redirect()` never mounts a client island (now stashes from
`/sign-in`); `cacheMiss` could not escape a cached function (metric moved to the
DB layer); `/c/` invalidation was one tag against N revisions (now a cluster tag
too); the name on `/c/` was specified twice incompatibly (now `nameAtSave`).

Also: identity is keyed per-hash rather than a single `localStorage` slot,
because §5.3 manufactures duplicate content across clusters and one slot let two
tabs print each other's drawing numbers; the 200-cap gained a code and an exit
(unarchive); and four of this document's own claims were corrected — `@db.Text`
*is* used in the repo, the no-`cookies` guard is red on day one against
`auth.ts:313`, `SHEET_FORMAT_REV` prints in two places not one, and the birthday
formula was mis-parenthesised.

### Pass 4 — 2026-08-01 · dry-pass check

**Not dry.** 8 material findings, 7 of them in the sections pass 3 edited — the
signature of a revision pass rather than a settled document. Only one needed a
design decision.

**The decision: there are TWO handles, not one.** Pass 3 bound identity to the
content hash, which is right for *printing* and fatal for *lineage*: after any
edit `canonHash` misses, so the Save control always built `mode=new` and
`mode=rev` was reachable only by re-saving an unchanged scene. The entire
revision model — `revNo`, its unique constraint, the advisory lock that
serialises it, the 100-revision cap, "Save as new", and §4's `A→B→A` invariant —
described behaviour the flow could not produce. §2.1 now separates a
content-keyed **print identity** from a stored **lineage handle** that survives
edits and is cleared only by "New build".

Also fixed: `canonHash` was compared against `payloadHash` across a truncation
boundary (8 chars vs `h1:`+64) — always false, so the identity would never have
been written; the hash forms are now defined once, with truncation only at the
print surface. Per-hash `localStorage` keying did not fix the duplicate-content
case it was introduced for (identical content, identical key), so identities are
now an array disambiguated by the lineage handle. The return link was stated four
ways, three of them pre-pass-3 and omitting `h=`, which would have made both
recall paths land silently in the unsaved regime. Unarchive shipped with no
contract. Unarchive is **not** an exit from the 200-total cap — the pass-3 log
claimed one the body did not provide, and 200 is now stated as terminal in v1.
Account deletion scrubbed the one name copy the public page does not render.

### Pass 5 — 2026-08-01 · dry-pass check

**Not dry.** 9 material findings — and two of them were pass 4's own fix,
reflected: making `mode=rev` reachable had made `mode=new` unreachable, because
"New build" is not a control the configurator has (its toolbar is undo, redo,
mode, theme, export, and `clearAllCells()` is module-private) and no tier added
one. §5.1 also still derived `mode` from the print identity, contradicting the
table three sections above it.

**The oscillation was the finding.** Three consecutive passes broke a different
direction of the same question — pass 3 made the saved regime unreachable, pass 4
`mode=rev`, pass 5 `mode=new` — because each answered "does this scene still
belong to that drawing?" with storage mechanics. It is not a storage question. It
is a judgement only the person editing can make, so **the Save control now asks**:
with a lineage present it offers "Save revision to OTD-HEX-1042" and "Save as a
new drawing"; with none, only the second. The lineage handle picks which button is
primary and supplies the label — a default, never a decision. That also removes
the need for a "New build" control and makes the non-owner case recoverable:
`/c/` is public, so a stranger's first save must offer "save as new" with the
scene intact rather than dead-ending on `not-found`.

Also fixed: the identity disambiguator was scoped to multi-entry hits, so eviction
could reduce a two-entry array to a single wrong entry that then printed as
authoritative (now unconditional); §4 and §7.3 flatly contradicted each other on
whether account deletion is a cache concern; the deletion scrub was a silent no-op
in the natural implementation order, because after `db.user.delete` the `userId`
is already null and the id list is unobtainable; a `mode=rev` save never touched
`HexCluster.updatedAt`, so the list's ordering and its index were both wrong;
archived rows had no surface, making unarchive unreachable; and `schema-stranded`
required the academy to know the configurator's schema version, which §1 forbids —
the notice moves to the configurator, where Tier 1 already decides it.

### Pass 6 — 2026-08-01 · dry-pass check

**Not dry**, 9 material — but the reachability oscillation of passes 3-5 is
**settled**. All eight paths were traced (first save; save→edit→save;
save→edit→save-as-new; open-saved-link→edit→save; stranger's `/c/`→edit→save;
deep link with no `?s=`; two tabs; failed-and-retried save) and both modes are
reachable on every one, with the user reaching their intended outcome everywhere
except two tabs.

The new findings clustered on what pass 5 had just made load-bearing: the lineage
object's lifecycle, and the query string that now carries the user's decision.

- **`summary`, `payloadHash` and `schemaVersion` had no transport.** All three are
  required on write, none is derivable by the academy, and §5.4 forbids a query
  string for scene data — so the single most data-heavy hop was unspecified. The
  fragment now carries a base64url **envelope** `{ p, h, v, s }`, and `SaveInput`
  is pinned.
- **The lineage handle had no lifetime and no scope.** Now `sessionStorage`: per
  browsing context, so two tabs cannot clobber each other (with one global slot, a
  build opened in tab B silently downgraded tab A's genuinely-saved sheet to
  `UNCONTROLLED` and repointed its Save button), and it dies with the tab, which
  is the honest lifetime for "this tab is working on drawing X".
- **The `callbackUrl` had to carry the query, encoded** — since pass 5 the user's
  `mode` lives only there, and an unencoded `&share=` would split the parameter
  and turn a revision save into a modeless one.
- `not-found` covered three causes; archived clusters now return
  `cluster-archived`, so an owner is offered **Unarchive and save** rather than
  being routed into minting a duplicate drawing.
- The revision label was never defined and 100 revisions do not fit a letter: now
  `A`-`Z` skipping `I O Q S X Z`, then `AA`, with the boundaries tested.
- The cluster-cap disable would have blocked revision saves, which create no
  cluster. First-save idempotency was structurally impossible on
  `(clusterId, payloadHash)` and is now keyed `(userId, payloadHash)` for
  `mode=new`. And `hex-share-<code>` was declared a tag and fired by nothing —
  dropped, with rename correctly removed from the `/c/` invalidation set.

**Trend note.** Counts by pass: ~80, ~60, 6, 8, 9, 9. The count has plateaued
while the *severity* has not: passes 1-2 were "the mechanism is broken", passes
4-6 are "this field is unspecified". Six of pass 6's nine needed a decision and
all six were made here; pass 7 tests whether those decisions hold.

### Pass 7 — 2026-08-01 · dry-pass check

**Not dry**, 6 material — the first fall in the count (80, 60, 6, 8, 9, 9, 6),
with five of the six single edits.

**One real defect, and again a consequence of the previous pass's fix.** Moving
lineage to `sessionStorage` (pass 6) silently made the *print identity* die with
the tab, because pass 5 had made the print rule depend on lineage
**unconditionally**. Save, close the tab, reopen your own bookmark tomorrow:
content hit, one unambiguous entry, sheet still prints `UNCONTROLLED`. The
unconditional rule was itself an over-correction — lineage was only ever needed to
disambiguate a *multi-entry* hit. Restored to that, with the eviction hazard it
was guarding against closed properly instead: **evict whole hash keys, never
entries within one**, so a single-entry array genuinely means one drawing.

Also fixed: the save page's navigation target was unstated, and `target="_blank"`
— the natural choice, to preserve camera and undo — would have written the lineage
into the new tab and left the working tab pointing at nothing; `?n=` was cited as
a prefill source on a leg that does not carry it, and `nameAtSave` had no
producer, so a first save would have rendered a blank title on `/c/` (the academy
now stamps it, which also keeps `btoa` off CJK and emoji names); "Unarchive and
save" was unbuildable, since the save page holds a share code and no id, and as
two calls was not atomic (now `allowUnarchive` inside the one transaction); the
`mode=new` idempotency window was unscoped and would have swallowed a legitimate
"Save as new" made within 60 s of a rev save of the same bytes; `hexrev_summary_len`
measured `jsonb::text`, which re-serialises with a space after every `:` and `,`,
so a summary the action passes at 8192 compact could still throw a raw constraint
error; and nothing carried the real save date, so the primary recall path would
stamp "saved today" on a sheet whose `/c/` page shows the true date — the two
disagreeing on the one artifact the verification story rests on.

### Pass 8 — 2026-08-01 · dry-pass check

**Not dry**, 4 material — **all single-line edits, none needing a design
decision**, and the pass-7 identity rule held under a full trace (single-entry
with no lineage, with a stale lineage, two entries with and without, whole-key
eviction under a live lineage, the same content saved by two users, a
crash-restored tab, and the same-tab save navigation).

The rule was sound; what was missing was the **write** rule that makes its central
invariant true. "One entry = one drawing" only holds if writes upsert by
`drawingLabel` — the naive `push` grows the array per *event*, so re-opening a
saved link twice, or the `A → B → A` case §4 protects, would each add a second
entry describing one drawing and re-enter the exact defect pass 7 fixed, through
the write path instead of the eviction path.

The other three were follow-through on pass 7's own two edits: `savedAt` had been
redefined to the true save date and was still doubling as the eviction key, so a
build saved months ago became the oldest key the instant it was recalled and was
evictable by the very write that inserted it (now a separate `touchedAt`, set on
write and on every successful export lookup); `n=` was never pinned to the stored
name the way `t=` had just been pinned to the stored date, so a recall would stamp
a renamed drawing's *new* name against a `/c/` page rendering the old one; and
`SaveOk` carried no date, leaving `t=` on the post-save leg with only the client
clock — which §3 forbids.

Count trend: 80, 60, 6, 8, 9, 9, 6, 4.

### Pass 9 — 2026-08-01 · dry-pass check

**Not dry — one material finding, at the severity floor.** All four of pass 8's
fixes closed. The finding is a single-word omission that continues the documented
pattern of a round's own fix seeding the next: pass 8's upsert rule enumerated
three fields as "winning" while the entry carries six, and `name` is the one a
rename changes. Save as "Bench cluster" → rename to "Rig cluster" → re-save the
same bytes after the idempotency window, and a field-by-field merge leaves `name`
stale, so the sheet stamps the old name against a `/c/` page rendering the new
one. Restated as a wholesale replace, which the reviewer noted is also the more
natural implementation.

Verified clean this round, having been checked specifically: `touchedAt` on a read
path does not compromise "the print identity is a pure lookup" (it bumps recency
only — cannot clear, cannot change the print decision, adds no call site);
upsert × multi-entry × whole-key eviction is coherent, because §5.3's "Save as
new" mints a *different* `drawingLabel` and therefore inserts rather than
upserts, preserving the array's reason to exist; §7.3's rewritten one-tag
paragraph is true and complete; and the pass-8 lineage-clearing generalisation
was verified against the repo — `bioscale-viz` has zero `history.pushState`/
`replaceState` and calls `getShareURL()` only from the export modal and the share
button, so the address bar is never re-synced on mutation and a reload after edits
restores the saved payload with the `h=` check passing.

Count trend: 80, 60, 6, 8, 9, 9, 6, 4, 1.

### Pass 10 — 2026-08-01 · DRY

**Zero material findings.** Pass 9's finding closed. The reviewer traced the five
oscillation-prone areas end to end and could not construct a path producing a
wrong build or two divergent builds, and re-verified the load-bearing repo claims
rather than assuming them — including the one that could still have shipped a
defect: `state-url.ts:436` strips base64 padding, so control 4's
`/^[A-Za-z0-9_-]+$/` on the post-`=` remainder does not reject real payloads.

Also re-confirmed against the repo: `SubSlot`'s frozen order matches §2.2 step 1;
`cellKey` proves two cells legally share `(q,r)`; `EncodedSpike` is genuinely 7-or-8
so "pad to 8 with `'none'`" is right; `validateEncodedCell` emits `cf` only when
false and appends it last, and `sp` is omitted when empty — both being exactly why
step 7 mandates fresh literals and an explicit `sp: []`; and `applyState:334` /
`encodeState:267` are the two asymmetries that force "hash the re-encode, never
the inbound". Arithmetic re-checked: birthday bound, label count, storage bound,
QR module counts.

**Count trend across the full review: 80, 60, 6, 8, 9, 9, 6, 4, 1, 0.**

Five cosmetics applied on the way out (the "never append" clause read alone as
forbidding the insert branch; the disambiguating field was implied not named;
`MutateErr` omitted the `quota-clusters` unarchive returns; the wire `summary`
shape excludes `nameAtSave`, so a schema built from §4.1 verbatim would reject
every save; and the two summary error codes had no stated boundary). The rest of
the cosmetic list is recorded in the pass-10 agent output and is not load-bearing.

**Build-readiness.** Assessed for the first time this round and answered yes:
every cross-boundary hop has a pinned wire shape, every load-bearing decision
carries the measurement or counter-case that forced it, the canonicalisation is
normative to the byte with a conformance fixture, the concurrency section names
the exact SQL and the three races it kills, and where the document is genuinely
under-specified it says so and scopes it. Residual work surfaces as a type error
or a failing first test, not as a shipped defect.
