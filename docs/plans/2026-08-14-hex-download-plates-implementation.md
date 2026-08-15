# Hex cluster plated downloads: implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the hex configurator's download hand someone one 3MF arranged for their
printer's bed, in the right quantities, from a CTA they can actually find.

**Architecture:** The academy (`project-foundry`) owns the pack endpoint: it grows a
quantity grammar, a bed parameter, a shelf packer and a 3MF writer, plus a `User` bed
preference and a settings UI. The configurator (`bs-cap`) owns the request: it sends
quantities and a bed, resolves that bed from account-then-local-then-default, and rebuilds
the export bar so Download is the primary action. **Academy ships first** — the
configurator must never link a grammar the endpoint does not yet understand.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Cloudflare R2, JSZip, Vitest
(academy); Vite, TypeScript, Three.js, Vitest (configurator).

**Design:** `docs/plans/2026-08-14-hex-download-plates-design.md`. Read it first — it
records four validated decisions and, importantly, three measured slicer behaviours that
constrain the code.

---

## Things that will bite you if you skip them

1. **Do not rewrite mesh vertices.** An earlier experiment centred every mesh on its own
   origin. It is unnecessary: the shipped per-part 3MFs place correctly in Creality Print
   using the transform alone, which was measured. Rewriting vertices would also cost a
   ~20 MB string rewrite per request and would destroy instancing, so a quantity of six
   caps would embed six copies of the mesh instead of one object and six items.
2. **Every source 3MF is uniform** — core spec, exactly one `<object id="1">`, one `<item>`
   with an identity transform. The merge is: lift the object block, renumber, emit an item
   with a translation. Assert the uniformity; do not assume it silently.
3. **There is no local R2.** `R2_*` in `.env.local` is the real bucket. Reads are fine;
   nothing in this plan writes to R2.
4. **`pnpm` runs through PowerShell**, not the Bash tool.
5. **Migrations are hand-authored** and applied with `pnpm db:migrate` (LOCAL). Do not run
   `prisma migrate dev`. Prod is the owner's call, not this plan's.

---

## Phase A — academy (`project-foundry`). Ships first.

### Task A1: Quantity in the pack grammar

**Files:**
- Modify: `src/lib/hex-pack.ts`
- Test: `src/lib/__tests__/hex-pack.test.ts`

**Step 1: Write the failing tests.** Append to the existing file:

```ts
describe("quantities", () => {
  it("reads a bare slug as one", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE });
    expect(r.ok && r.request.parts).toEqual([{ slug: ONE, qty: 1 }]);
  });

  it("reads slug:n", () => {
    const r = resolvePack({ release: RELEASE, parts: `${ONE}:3` });
    expect(r.ok && r.request.parts).toEqual([{ slug: ONE, qty: 3 }]);
  });

  it("sums a repeated slug rather than dropping one", () => {
    // The old code Set-deduped, which silently lost the second mention.
    const r = resolvePack({ release: RELEASE, parts: `${ONE}:2,${ONE}:3` });
    expect(r.ok && r.request.parts).toEqual([{ slug: ONE, qty: 5 }]);
  });

  it("refuses a zero, a negative, or a non-integer quantity", () => {
    for (const q of ["0", "-1", "1.5", "x"]) {
      expect(resolvePack({ release: RELEASE, parts: `${ONE}:${q}` }).ok).toBe(false);
    }
  });

  it("refuses more than MAX_PACK_INSTANCES total items", () => {
    const r = resolvePack({
      release: RELEASE,
      parts: `${ONE}:${MAX_PACK_INSTANCES},${TWO}:1`,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problem).toBe("too-many");
  });
});
```

**Step 2: Run and watch it fail.**

```powershell
pnpm vitest run src/lib/__tests__/hex-pack.test.ts
```

Expected: fails to compile, `MAX_PACK_INSTANCES` is not exported.

**Step 3: Implement.** In `src/lib/hex-pack.ts`, replace the `parts` handling:

```ts
/** One line of the pack: a published part and how many of it. */
export type PackPart = { slug: string; qty: number };

/**
 * Total ITEMS a pack may contain, across all parts.
 *
 * MAX_PACK_PARTS bounds how many DISTINCT parts are named, which is what bounds
 * the R2 reads. It does not bound the work any more, because a quantity costs no
 * extra read but does cost an <item> line and a slot on a plate. Without this a
 * single `hex-tb-main:99999` turns one read into an unbounded document and an
 * unbounded number of plates.
 */
export const MAX_PACK_INSTANCES = 250;

const QTY = /^([a-z0-9][a-z0-9-]*)(?::(\d+))?$/;

function parseParts(raw: string): PackPart[] | null {
  const byslug = new Map<string, number>();
  for (const token of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = QTY.exec(token);
    if (!m) return null;
    const qty = m[2] === undefined ? 1 : Number(m[2]);
    // `\d+` already excludes a sign and a decimal point, so the only thing left
    // to reject is an explicit zero.
    if (!Number.isInteger(qty) || qty < 1) return null;
    // Summed, not replaced: naming a part twice is a UI slip, and dropping the
    // second mention is the bug this whole task exists to fix.
    byslug.set(m[1], (byslug.get(m[1]) ?? 0) + qty);
  }
  return [...byslug].map(([slug, qty]) => ({ slug, qty }));
}
```

Then in `resolvePack`, after the format check:

```ts
  const parts = parseParts(input.parts ?? "");
  if (parts === null) return { ok: false, problem: "unknown-part" };
  if (parts.length === 0) return { ok: false, problem: "empty" };
  if (parts.length > MAX_PACK_PARTS) return { ok: false, problem: "too-many" };
  if (parts.reduce((n, p) => n + p.qty, 0) > MAX_PACK_INSTANCES) {
    return { ok: false, problem: "too-many" };
  }
  if (!parts.every((p) => isHexPartSlug(p.slug))) {
    return { ok: false, problem: "unknown-part" };
  }
```

Update `PackRequest.parts` to `PackPart[]`, and `packFilename` to count instances:

```ts
export function packFilename(parts: PackPart[]): string {
  const n = parts.reduce((a, p) => a + p.qty, 0);
  return parts.length === 1 && parts[0].qty === 1
    ? `hex-cluster-${parts[0].slug}.zip`
    : `hex-cluster-${n}-parts.zip`;
}
```

**Step 4: Run the tests.** Expected: PASS, including the pre-existing ones. Fix
`packReadme`'s signature where the compiler points at it.

**Step 5: Commit.**

```bash
git add src/lib/hex-pack.ts src/lib/__tests__/hex-pack.test.ts
git commit -m "feat(hex): carry quantity through the pack grammar"
```

---

### Task A2: Bed dimensions in the request

**Files:**
- Modify: `src/lib/hex-pack.ts`
- Test: `src/lib/__tests__/hex-pack.test.ts`

**Step 1: Write the failing tests.**

```ts
describe("the bed", () => {
  it("defaults to 220 square when absent", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE });
    expect(r.ok && r.request.bed).toEqual({ x: 220, y: 220 });
  });

  it("reads WxH", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE, plate: "350x350" });
    expect(r.ok && r.request.bed).toEqual({ x: 350, y: 350 });
  });

  it("refuses a bed outside the sane range, or a non-integer", () => {
    for (const p of ["0x100", "100x0", "40x40", "2000x2000", "350", "axb", "350x350x350"]) {
      expect(resolvePack({ release: RELEASE, parts: ONE, plate: p }).ok).toBe(false);
    }
  });
});
```

**Step 2: Run, watch it fail.**

**Step 3: Implement.**

```ts
/** The bed a pack is laid out for, in millimetres. */
export type Bed = { x: number; y: number };

/** Ships when the caller names no bed. Small enough to be right on almost any
 *  printer; a larger bed only means fewer plates, never a failure. */
export const DEFAULT_BED: Bed = { x: 220, y: 220 };

/** Sane range for a consumer FDM bed. This is a LOOP BOUND and a CACHE KEY, not
 *  merely a typo check: the packer iterates rows across it, and the response is
 *  cached per URL. The floor is above the largest part (87.8 x 78 mm), so any
 *  accepted bed can hold every part in the set. */
const BED_MIN = 100;
const BED_MAX = 1000;
const BED_RE = /^(\d{1,4})x(\d{1,4})$/;

function parseBed(raw: string | null | undefined): Bed | null {
  if (raw == null || raw === "") return DEFAULT_BED;
  const m = BED_RE.exec(raw);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x < BED_MIN || x > BED_MAX || y < BED_MIN || y > BED_MAX) return null;
  return { x, y };
}
```

Add `"bad-bed"` to `PackProblem`, `bed: Bed` to `PackRequest`, and wire `parseBed` into
`resolvePack` from `input.plate`.

**Step 4: Run. Expected PASS.**

**Step 5: Commit.**

```bash
git add src/lib/hex-pack.ts src/lib/__tests__/hex-pack.test.ts
git commit -m "feat(hex): accept a bed size on the pack request"
```

---

### Task A3: The part geometry table

> **Run A4 before this one.** A3's guard test needs `PLATE_GAP`, and the generated table
> is typed by `PartBox`; both live in `hex-plate.ts`, which A4 creates. A4 has no
> dependency in the other direction — its tests build synthetic boxes — so the packer goes
> first and the data conforms to it.

Bounding boxes are needed to pack, and parsing 130,000 vertices per part per request is not
an option. Generate a table once, commit it, and check it in CI the way the part-slug list
is checked.

**Files:**
- Create: `scripts/gen-hex-geometry.ts`
- Create: `src/lib/hex-geometry.ts` (generated)
- Test: `src/lib/__tests__/hex-geometry.test.ts`

**Step 1: Write the generator.**

```ts
// Regenerate src/lib/hex-geometry.ts from the mesh set in the hex-cluster repo:
//   pnpm tsx scripts/gen-hex-geometry.ts
//
// Run it whenever the meshes are re-cut, in the same commit that bumps
// HEX_RELEASE and HEX_PART_SLUGS. A stale table packs against the wrong sizes
// and the error shows up as parts overlapping on a plate, which nobody would
// trace back to here.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import JSZip from "jszip";

const SRC = resolve(
  process.env.PRINTABLES_DIR ?? "../hex-cluster/build/printables",
  "3mf",
);

const slug = (f: string) =>
  f.replace(/\.3mf$/i, "").toLowerCase().replace(/[^a-z0-9.-]+/g, "-");

async function box(file: string) {
  const zip = await JSZip.loadAsync(readFileSync(join(SRC, file)));
  const model = await zip.file("3D/3dmodel.model")!.async("string");
  const objects = (model.match(/<object /g) ?? []).length;
  if (objects !== 1) throw new Error(`${file}: ${objects} objects, expected 1`);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  const re = /<vertex x="([-\d.eE]+)" y="([-\d.eE]+)" z="([-\d.eE]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(model))) {
    const x = +m[1], y = +m[2], z = +m[3];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { x0: r(x0), y0: r(y0), z0: r(z0), dx: r(x1 - x0), dy: r(y1 - y0), dz: r(z1 - z0) };
}

const rows: string[] = [];
for (const f of readdirSync(SRC).filter((f) => f.endsWith(".3mf")).sort()) {
  const b = await box(f);
  rows.push(
    `  "${slug(f)}": { x0: ${b.x0}, y0: ${b.y0}, z0: ${b.z0}, dx: ${b.dx}, dy: ${b.dy}, dz: ${b.dz} },`,
  );
}

writeFileSync(
  "src/lib/hex-geometry.ts",
  `// GENERATED by scripts/gen-hex-geometry.ts. Do not edit by hand.
//
// Axis-aligned bounding box of every published part, in the PRINT orientation
// the mesh ships in: the minimum corner and the size, in millimetres. The packer
// needs both -- the size to place, the minimum corner to turn a target position
// into the translation that gets it there.
import type { PartBox } from "@/lib/hex-plate";

export const HEX_PART_BOX: Record<string, PartBox> = {
${rows.join("\\n")}
};
`,
);
console.log(`wrote ${rows.length} parts`);
```

**Step 2: Run it.**

```powershell
pnpm tsx scripts/gen-hex-geometry.ts
```

Expected: `wrote 53 parts`.

**Step 3: Write the guard test.**

```ts
import { describe, expect, it } from "vitest";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { HEX_PART_BOX } from "@/lib/hex-geometry";

describe("the geometry table", () => {
  it("covers every published slug", () => {
    // Two transcriptions of the same manifest. A re-cut that regenerates one and
    // not the other is caught here rather than by a pack that overlaps parts.
    for (const s of HEX_PART_SLUGS) expect(HEX_PART_BOX[s]).toBeDefined();
  });

  it("has no part too large for the smallest bed we accept, margin included", () => {
    // The design leans on this: a bed picker changes the plate COUNT and can
    // never make a part unprintable. If a future part breaks it, that promise
    // needs revisiting, not this assertion relaxing.
    //
    // The margin is part of the invariant, not decoration. The packer throws
    // when `size + 2 * PLATE_GAP` exceeds the bed, so a bare `< BED_MIN` check
    // would pass a 95 mm part and then 500 on a 100 mm bed. Derived from the
    // two constants rather than typed as a number, so it tracks them.
    for (const s of HEX_PART_SLUGS) {
      const b = HEX_PART_BOX[s];
      expect(Math.max(b.dx, b.dy)).toBeLessThanOrEqual(BED_MIN - 2 * PLATE_GAP);
    }
  });
});
```

**Step 4: Run. Expected PASS.**

**Step 5: Commit.**

```bash
git add scripts/gen-hex-geometry.ts src/lib/hex-geometry.ts src/lib/__tests__/hex-geometry.test.ts
git commit -m "feat(hex): generate a part bounding-box table for packing"
```

---

### Task A4: The packer

Pure arithmetic, no I/O, so it is the easiest thing in the feature to test properly.

**Files:**
- Create: `src/lib/hex-plate.ts`
- Test: `src/lib/__tests__/hex-plate.test.ts`

**Step 1: Write the failing tests.**

```ts
import { describe, expect, it } from "vitest";
import { packPlates, PLATE_GAP } from "@/lib/hex-plate";

const box = (dx: number, dy: number) => ({ x0: 0, y0: 0, z0: 0, dx, dy, dz: 10 });

describe("packing", () => {
  it("puts everything on one plate when it fits", () => {
    const plates = packPlates([{ slug: "a", qty: 3, box: box(50, 50) }], { x: 220, y: 220 });
    expect(plates).toHaveLength(1);
    expect(plates[0]).toHaveLength(3);
  });

  it("expands quantity into that many placements", () => {
    const plates = packPlates([{ slug: "a", qty: 4, box: box(20, 20) }], { x: 220, y: 220 });
    expect(plates.flat().map((p) => p.slug)).toEqual(["a", "a", "a", "a"]);
  });

  it("opens a new plate when the bed is full", () => {
    // Nine 100x100 parts cannot share a 220 bed: four per plate at most.
    const plates = packPlates([{ slug: "a", qty: 9, box: box(100, 100) }], { x: 220, y: 220 });
    expect(plates.length).toBeGreaterThan(2);
  });

  it("never overlaps two placements on the same plate", () => {
    const plates = packPlates([{ slug: "a", qty: 12, box: box(60, 40) }], { x: 220, y: 220 });
    for (const plate of plates) {
      for (let i = 0; i < plate.length; i++) {
        for (let j = i + 1; j < plate.length; j++) {
          const a = plate[i], b = plate[j];
          const apart =
            a.x + a.box.dx <= b.x || b.x + b.box.dx <= a.x ||
            a.y + a.box.dy <= b.y || b.y + b.box.dy <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it("keeps every placement inside the bed, margin included", () => {
    const bed = { x: 220, y: 220 };
    for (const p of packPlates([{ slug: "a", qty: 20, box: box(37, 53) }], bed).flat()) {
      expect(p.x).toBeGreaterThanOrEqual(PLATE_GAP);
      expect(p.y).toBeGreaterThanOrEqual(PLATE_GAP);
      expect(p.x + p.box.dx).toBeLessThanOrEqual(bed.x - PLATE_GAP);
      expect(p.y + p.box.dy).toBeLessThanOrEqual(bed.y - PLATE_GAP);
    }
  });

  it("refuses to exceed the plate cap", () => {
    // THE REAL BOUND ON THIS ENDPOINT. MAX_PACK_INSTANCES caps items, not
    // plates, and the two are far apart: 250 of the largest part is 63 plates
    // on the default 220 bed and 250 plates on a 100 mm bed -- each one a
    // separate 3MF document carrying its own full copy of the mesh, from a
    // single unauthenticated GET. Throwing here lets the route answer 400
    // before it reads anything from R2.
    expect(() =>
      packPlates([{ slug: "a", qty: 250, box: box(88, 78) }], { x: 100, y: 100 }, 20),
    ).toThrow(/plate/i);
  });

  it("allows exactly the plate cap", () => {
    const at = packPlates([{ slug: "a", qty: 80, box: box(100, 100) }], { x: 220, y: 220 }, 20);
    expect(at.length).toBeLessThanOrEqual(20);
  });

  it("is deterministic", () => {
    // The response is cached per URL, so the same request must produce the same
    // bytes. A Map iteration order or a sort that is not total would break this
    // silently and only for some users.
    const input = [
      { slug: "a", qty: 2, box: box(40, 40) },
      { slug: "b", qty: 3, box: box(35, 60) },
    ];
    expect(JSON.stringify(packPlates(input, { x: 220, y: 220 })))
      .toBe(JSON.stringify(packPlates(input, { x: 220, y: 220 })));
  });
});
```

**Step 2: Run, watch it fail.**

**Step 3: Implement.**

```ts
// Laying parts out on a bed.
//
// SHELF PACKING, tallest row first. Deliberately naive, and that is a design
// decision rather than a shortcut: Creality Print (and every Orca-lineage
// slicer) preserves our relative layout but the user's own auto-arrange is one
// click away, so the job is "opens ready to slice", not "beats the slicer".
// Optimal 2D packing is NP-hard and would buy nothing anyone sees.
//
// DETERMINISM IS A REQUIREMENT, not a nicety. The pack response is cached per
// URL, so identical requests must produce identical bytes.
import type { Bed } from "@/lib/hex-pack";

/** Axis-aligned bounding box of a part in its shipped print orientation: the
 *  minimum corner and the size, in millimetres.
 *
 *  Declared HERE rather than beside the generated table, so the dependency runs
 *  one way: the generated data conforms to what the packer needs, and the packer
 *  does not import generated output to describe its own input. */
export type PartBox = {
  x0: number; y0: number; z0: number;
  dx: number; dy: number; dz: number;
};

/** Margin at the bed edge and between parts, in mm. Enough for a skirt line and
 *  a nozzle path between neighbours. */
export const PLATE_GAP = 4;

export type PackInput = { slug: string; qty: number; box: PartBox };
/** A placed part: `x`/`y` are the MINIMUM corner on the bed, not the centre. */
export type Placement = { slug: string; box: PartBox; x: number; y: number };

/** Most plates one request may produce. See the cap test for the arithmetic:
 *  the instance cap does NOT imply a plate cap, and the gap between them is
 *  three orders of magnitude of response size. */
export const MAX_PLATES = 20;

export function packPlates(
  input: PackInput[],
  bed: Bed,
  maxPlates: number = MAX_PLATES,
): Placement[][] {
  // Expand quantities, then sort by depth descending so each shelf is as full as
  // it can be. Ties break on slug so the order is TOTAL and the output is stable.
  const items: PackInput[] = [];
  for (const p of input) for (let i = 0; i < p.qty; i++) items.push(p);
  items.sort((a, b) => b.box.dy - a.box.dy || a.slug.localeCompare(b.slug));

  const plates: Placement[][] = [];
  let plate: Placement[] = [];
  let cx = PLATE_GAP;
  let cy = PLATE_GAP;
  let rowH = 0;

  const newPlate = () => {
    if (plate.length) plates.push(plate);
    plate = [];
    cx = PLATE_GAP;
    cy = PLATE_GAP;
    rowH = 0;
  };

  for (const it of items) {
    const { dx, dy } = it.box;
    // Guarded by the geometry test and by BED_MIN, but a future part could break
    // the invariant and an infinite loop is a worse way to find out.
    if (dx + 2 * PLATE_GAP > bed.x || dy + 2 * PLATE_GAP > bed.y) {
      throw new Error(`${it.slug} is ${dx}x${dy} mm and cannot fit a ${bed.x}x${bed.y} bed`);
    }
    if (cx + dx + PLATE_GAP > bed.x) {
      cx = PLATE_GAP;
      cy += rowH + PLATE_GAP;
      rowH = 0;
    }
    if (cy + dy + PLATE_GAP > bed.y) newPlate();
    // Checked as plates are opened rather than after the fact, so an abusive
    // request costs the loop it has already run and nothing more.
    if (plates.length >= maxPlates) {
      throw new Error(`this build needs more than ${maxPlates} plates on a ${bed.x}x${bed.y} bed`);
    }
    plate.push({ slug: it.slug, box: it.box, x: cx, y: cy });
    cx += dx + PLATE_GAP;
    rowH = Math.max(rowH, dy);
  }
  if (plate.length) plates.push(plate);
  return plates;
}
```

**Step 4: Run. Expected PASS on all six.**

**Step 5: Commit.**

```bash
git add src/lib/hex-plate.ts src/lib/__tests__/hex-plate.test.ts
git commit -m "feat(hex): shelf-pack parts onto beds"
```

---

### Task A5: The 3MF writer

**Files:**
- Create: `src/lib/hex-3mf.ts`
- Test: `src/lib/__tests__/hex-3mf.test.ts`

**Step 1: Write the failing tests.**

```ts
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildPlate3mf, extractObjectBlock } from "@/lib/hex-3mf";

const SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="1" type="model"><mesh>
  <vertices><vertex x="0" y="0" z="0" /></vertices>
  <triangles><triangle v1="0" v2="0" v3="0" /></triangles>
 </mesh></object></resources>
 <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0" /></build>
</model>`;

describe("extractObjectBlock", () => {
  it("lifts the object and renumbers it", () => {
    expect(extractObjectBlock(SOURCE, 7, "Thing")).toContain('<object id="7"');
    expect(extractObjectBlock(SOURCE, 7, "Thing")).toContain('name="Thing"');
  });

  it("refuses a source with anything other than one object", () => {
    // Every published part is one object today. If a re-cut ever emits two, the
    // renumbering would silently collide and produce a corrupt merge.
    const two = SOURCE.replace("</resources>", '<object id="2" type="model"></object></resources>');
    expect(() => extractObjectBlock(two, 1, "x")).toThrow(/expected 1/);
  });
});

describe("buildPlate3mf", () => {
  const box = { x0: 0, y0: 0, z0: 0, dx: 10, dy: 10, dz: 10 };
  const sources = new Map([["a", SOURCE]]);

  it("emits one object per distinct part and one item per placement", async () => {
    const buf = await buildPlate3mf(
      [
        { slug: "a", box, x: 4, y: 4 },
        { slug: "a", box, x: 20, y: 4 },
      ],
      sources,
    );
    const model = await (await JSZip.loadAsync(buf)).file("3D/3dmodel.model")!.async("string");
    expect(model.match(/<object /g)).toHaveLength(1);   // instancing, not duplication
    expect(model.match(/<item /g)).toHaveLength(2);
  });

  it("translates a placement to its minimum corner and seats it on the bed", async () => {
    const buf = await buildPlate3mf([{ slug: "a", box: { ...box, x0: -5, y0: -5, z0: 2 }, x: 4, y: 9 }], sources);
    const model = await (await JSZip.loadAsync(buf)).file("3D/3dmodel.model")!.async("string");
    // tx = target - x0 = 4 - (-5) = 9 ; ty = 9 - (-5) = 14 ; tz = -z0 = -2
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 9 14 -2"');
  });

  it("is a readable 3MF package", async () => {
    const zip = await JSZip.loadAsync(await buildPlate3mf([{ slug: "a", box, x: 4, y: 4 }], sources));
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("_rels/.rels")).not.toBeNull();
    expect(zip.file("3D/3dmodel.model")).not.toBeNull();
  });
});
```

**Step 2: Run, watch it fail.**

**Step 3: Implement.**

```ts
// Writing one plate as a single 3MF.
//
// MEASURED BEHAVIOUR THIS RELIES ON (2026-08-15, Creality Print V7.2.1, see the
// design doc): the slicer preserves our relative layout exactly and centres the
// whole scene on the bed. So absolute position is not ours to choose and does
// not matter; the relative arrangement is what carries.
//
// DO NOT rewrite mesh vertices to recentre objects. It is unnecessary -- the
// transform alone places correctly -- it would cost a multi-megabyte string
// rewrite per request, and it would break instancing, so six identical caps
// would embed six copies of the mesh instead of one object and six items.
import JSZip from "jszip";
import type { Placement } from "@/lib/hex-plate";

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />` +
  `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />` +
  `</Types>`;

const RELS =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
  `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" /></Relationships>`;

/** Lift the single `<object>` out of a published part, renumbered and named.
 *
 *  The name is what a slicer shows in its object list, and carrying it is the
 *  whole reason 3MF is the primary format and STL the fallback. Measured: all
 *  15 names survived a Creality Print round trip. */
export function extractObjectBlock(model: string, id: number, name: string): string {
  const count = (model.match(/<object /g) ?? []).length;
  if (count !== 1) throw new Error(`source has ${count} objects, expected 1`);
  const a = model.indexOf("<object ");
  const b = model.indexOf("</object>") + "</object>".length;
  return model
    .slice(a, b)
    .replace(/^<object id="\d+"/, `<object id="${id}" name="${escapeAttr(name)}"`);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

const n = (v: number) => String(Math.round(v * 1e4) / 1e4);

export async function buildPlate3mf(
  placements: Placement[],
  sources: Map<string, string>,
  meta?: { title?: string; credit?: string },
): Promise<Buffer> {
  const ids = new Map<string, number>();
  const objects: string[] = [];
  const items: string[] = [];

  for (const p of placements) {
    if (!ids.has(p.slug)) {
      const id = ids.size + 1;
      ids.set(p.slug, id);
      const src = sources.get(p.slug);
      if (!src) throw new Error(`no source mesh for ${p.slug}`);
      objects.push(extractObjectBlock(src, id, p.slug));
    }
    // The translation that carries the mesh's own minimum corner to the target,
    // and drops the part onto z = 0 whatever its authored height.
    items.push(
      `  <item objectid="${ids.get(p.slug)}" transform="1 0 0 0 1 0 0 0 1 ` +
      `${n(p.x - p.box.x0)} ${n(p.y - p.box.y0)} ${n(-p.box.z0)}" printable="1" />`,
    );
  }

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    ` <metadata name="Application">One Thousand Drones -- Hex Cluster</metadata>\n` +
    ` <metadata name="Title">${escapeAttr(meta?.title ?? "Hex Cluster plate")}</metadata>\n` +
    ` <metadata name="LicenseTerms">${escapeAttr(meta?.credit ?? "CC BY 4.0")}</metadata>\n` +
    ` <resources>\n${objects.join("\n")}\n </resources>\n` +
    ` <build>\n${items.join("\n")}\n </build>\n</model>\n`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("3D/3dmodel.model", model);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
```

**Step 4: Run. Expected PASS.**

**Step 5: Commit.**

```bash
git add src/lib/hex-3mf.ts src/lib/__tests__/hex-3mf.test.ts
git commit -m "feat(hex): write a packed plate as one 3MF"
```

---

### Task A6: Response assembly and the README

**Files:**
- Create: `src/lib/hex-pack-readme.ts`
- Modify: `src/lib/hex-pack.ts` (drop the old `packReadme`, re-export from the new module)
- Test: `src/lib/__tests__/hex-pack-readme.test.ts`

**Step 1: Write the failing tests.**

```ts
describe("the pack README", () => {
  it("states the bed it was packed for and the plate count", () => {
    const txt = plateReadme({ release: "2026-08-03", bed: { x: 350, y: 350 }, plates: [[...]], ... });
    expect(txt).toContain("350 x 350");
    expect(txt).toContain("2 plates");
  });

  it("lists each plate's contents with quantities", () => { /* ... */ });

  it("says the arrangement is a starting point, not a guarantee", () => {
    // Measured: slicers recentre the scene, and a user's auto-arrange overrides
    // us entirely. Promising an exact layout would be a claim we cannot keep.
    expect(txt.toLowerCase()).toContain("starting point");
  });

  it("names the spike parts as needing support when present", () => { /* ... */ });

  it("mentions the preset dialog so it does not read as an error", () => {
    expect(txt).toContain("printer preset");
  });

  it("carries the CC BY credit", () => { /* ... */ });

  it("is pure ASCII", () => {
    // Read in Notepad and in terminals as often as in a GUI.
    expect(/^[\x20-\x7e\n]*$/.test(txt)).toBe(true);
  });
});
```

**Step 2: Run, watch it fail. Step 3:** implement `plateReadme`, reusing the `ascii()`
folder and the spec constants already imported by the route. Keep the existing
support/orientation notes; add the bed line, the per-plate manifest, the "starting point"
sentence and the preset-dialog note.

**Step 4: Run. Step 5: Commit.**

```bash
git add src/lib/hex-pack-readme.ts src/lib/__tests__/hex-pack-readme.test.ts src/lib/hex-pack.ts
git commit -m "feat(hex): a README that states the bed, the plates and the caveats"
```

---

### Task A7: Wire the route

**Files:**
- Modify: `src/app/api/printable-pack/route.ts`
- Test: `src/lib/__tests__/printable-download.test.ts` (extend)

**Behaviour:**

- Read `plate` from the query; pass it to `resolvePack`.
- **Pack BEFORE reading anything from R2.** `packPlates` needs only the geometry table, so
  the plate cap can be enforced without a single network call. A request over the cap
  answers 400 having done pure arithmetic. Reading first and counting after would let one
  GET pull 53 objects out of R2 before we decide to refuse it.
- Then fetch each DISTINCT slug from R2 once, sequentially (keep the existing comment's
  reasoning), unzip, and keep the `3D/3dmodel.model` string in a `Map`.
- `packPlates` → if one plate, respond with the bare `.3mf`; if more, build a zip of
  `plates/plate-N-of-M.3mf` plus `README.txt` and `LICENSE.txt`.
- `Content-Type`: `model/3mf` for the bare file, `application/zip` otherwise.
- `format=stl` keeps today's behaviour exactly: loose files in a zip, no packing. Add one
  test asserting that, so a future refactor cannot quietly start plating STL.
- Extend the `capture` call with `bed_x`, `bed_y`, `plates`, `instances`, and
  `bed_source` (read from a `bedFrom` query param the configurator sets: `account` /
  `local` / `default`).

**Commit.**

```bash
git commit -m "feat(hex): serve packed plates from the pack endpoint"
```

---

### Task A8: The `User` bed preference

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_user_print_bed/migration.sql`

**Step 1:** add to `model User`, following the commented style of its neighbours:

```prisma
  // Print bed size in millimetres, used to lay out hex-cluster downloads. Null =
  // no stored choice; the configurator falls back to this browser's localStorage
  // and then to a conservative default. Two columns rather than a prefs JSON: it
  // is queried as a pair, never partially, and a typed column cannot drift.
  printBedXMm           Int?
  printBedYMm           Int?
```

**Step 2:** hand-author the migration.

```sql
ALTER TABLE "User" ADD COLUMN "printBedXMm" INTEGER;
ALTER TABLE "User" ADD COLUMN "printBedYMm" INTEGER;
```

**Step 3:** apply to LOCAL and regenerate.

```powershell
pnpm db:migrate
pnpm prisma generate
```

**Step 4:** full typecheck and full test run — a schema change is exactly the case where a
partial run misleads.

```powershell
pnpm tsc --noEmit
pnpm test
```

**Step 5: Commit.**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(account): store a print bed size on the user"
```

---

### Task A9: The settings UI and its action

**Files:**
- Create: `src/lib/actions/print-bed.ts` (`"use server"`, async exports only)
- Modify: `src/app/(chrome)/account/page.tsx`
- Test: `src/lib/__tests__/print-bed-action.test.ts`

A "Printing" group with a bed control, following the account page's existing hairline-row
pattern. The action validates against the same `BED_MIN`/`BED_MAX` as the endpoint —
import them, do not restate them — and refuses when unauthenticated.

Remember the repo rule: a `"use server"` module exports **only** async functions. Put the
types in a plain module.

**Commit.**

```bash
git commit -m "feat(account): a printing section for the bed size"
```

---

### Task A10: Carry the bed over the embed protocol

**Files:**
- Modify: `src/lib/hex-embed-protocol.ts`
- Modify: `src/components/hex/HexConfiguratorFrame.tsx`
- Test: `src/lib/__tests__/hex-embed-protocol.test.ts`

Follow the existing `theme` precedent exactly:

- Add an **optional** `bed?: { x: number; y: number }` to `Ready`. Optional for
  back-compat: the two sides deploy separately, and an older child must keep working.
- Add a `set-bed` parent → child message, mirroring `SetTheme`.
- Add a `bed-changed` child → parent message so a change made in the configurator writes
  through to the account.
- `parseMessage` must validate the numbers, not just their presence. A malformed message
  from an allowed origin is ignored, never thrown.

Test the refusals, which is where the existing protocol tests spend their effort.

**Commit.**

```bash
git commit -m "feat(hex): carry the bed size across the embed boundary"
```

**End of Phase A. Open the academy PR and let it merge before starting Phase B.**

---

## Phase B — configurator (`bs-cap`). Ships after Phase A is live.

### Task B1: Send quantities and the bed

**Files:**
- Modify: `src/hex/export/parts-pack.ts`
- Test: `src/hex/export/parts-pack.test.ts`

Replace the `Set` dedupe with a count. `partsPackURL` takes the BOM entries (which already
carry `qty`) rather than a flat list of source files, and gains a `bed` argument.

```ts
export function partsPackURL(
  entries: { sourceFile: string; qty: number }[],
  opts: { format?: '3mf' | 'stl'; bed?: { x: number; y: number }; bedFrom?: string } = {},
): string | null {
  const byslug = new Map<string, number>();
  for (const e of entries) {
    const s = partSlug(e.sourceFile);
    byslug.set(s, (byslug.get(s) ?? 0) + e.qty);
  }
  if (byslug.size === 0) return null;
  // Sorted so the URL is stable for a given build, which is what makes the
  // response cacheable and what makes two identical builds share a cache entry.
  const parts = [...byslug].sort(([a], [b]) => a.localeCompare(b))
    .map(([s, q]) => (q === 1 ? s : `${s}:${q}`)).join(',');
  ...
}
```

Test that a quantity of six emits `:6` and that a single stays bare.

**Commit.**

```bash
git commit -m "fix(hex): stop dropping quantities from the download link"
```

---

### Task B2: Resolve the bed

**Files:**
- Create: `src/hex/print-bed.ts`
- Test: `src/hex/print-bed.test.ts`

One resolver, and nothing reads a store directly.

```ts
/** account (if signed in and set) -> this browser -> the shipped default. */
export function resolveBedSize(): { bed: Bed; source: 'account' | 'local' | 'default' }
```

Writes go both ways: `localStorage` always, and a `bed-changed` message when embedded.
Promote a local value once if the account has none.

Test each precedence branch, the promotion, and a corrupt localStorage value falling back
to the default rather than throwing.

**Commit.**

```bash
git commit -m "feat(hex): resolve the print bed from account, browser, then default"
```

---

### Task B3: Rebuild the export bar as B2

**Files:**
- Modify: `hex.html` (the `export-modal` markup)
- Modify: `src/styles/export.css`
- Modify: `src/hex/export/index.ts`

Sandbox round 02 picked **B2**: heading on its own row; below it a single action row with
the CTA reading `↓ Download 15 parts · 1 plate`, then `for [bed ▾]`, then a spacer, then
Print sheet and Share. The foot bar goes away. Reference:
`sandbox-export-cta-b.html`, variant B2.

Plate count in the label is computed client-side with the same shelf-pack arithmetic as
the server. **Extract that into a shared module rather than writing it twice** — a
disagreement between the label and the file is the worst failure this feature has, because
it is invisible until someone counts.

**Do not test that agreement by calling the packer twice and comparing.** That test is
inert: V8's sort is stable, so the same input array yields the same answer whether or not
the comparator is a total order. A4 shipped with exactly that mistake in the plan and it
passed against a deliberately broken sort. Test it the way the failure actually happens —
the SAME build with its parts in a DIFFERENT order, using parts of equal depth and
different widths, since that is the only input that reaches the tiebreak.

Keep: the in-sheet link under the BOM, now calling the same resolver.

**Commit.**

```bash
git commit -m "feat(hex): put the download where people can find it"
```

---

### Task B4: The conditional copy

**Files:**
- Modify: `src/hex/export/index.ts`, `src/styles/export.css`

Both strings are conditional, never permanent:

- *"Also available individually, in every format, on the spec page"* — first visit only,
  suppressed once a download has happened.
- *"from your account"* — only when a signed-in account value actually overrode a
  different local one.

**Commit.**

```bash
git commit -m "feat(hex): explain the bed and the alternatives, only when it helps"
```

---

### Task B5: Clean up

Delete `sandbox-export-cta.html` and `sandbox-export-cta-b.html`. Sandboxes are picked
from, then removed before the PR.

```bash
git rm sandbox-export-cta.html sandbox-export-cta-b.html
git commit -m "chore(hex): remove the export CTA sandboxes"
```

---

## Verification before either PR is called done

1. `pnpm test` green in the repo you touched, and `pnpm tsc --noEmit` clean.
2. `pnpm lint` clean in `bs-cap` (it runs with `--max-warnings 0`).
3. **Download a real pack and open it in a slicer.** A green unit test is not a rendered
   plate. Check: the expected number of plates, every part named in the object list,
   nothing off the bed. `c:\zzz\hex-cluster-plate-K2.3mf` is a known-good reference.
4. Check the multi-plate path specifically by requesting a small bed (`plate=180x180`) for
   a large build, and confirm the zip's plate count matches the CTA label that produced it.
5. Both themes on the export bar, and the narrow width, which is what the embedded copy
   runs at.
