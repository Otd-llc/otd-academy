# Learner Guide System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-stage learner-guide capability across the 22 curriculum projects, a Radix-based reusable tooltip/glossary primitive, and a reusable bench-styled `PageHeader`.

**Architecture:** A revision-scoped `Guide` → `GuideCard[]` *teaching layer* (content stored as Zod-validated JSON blocks) authored by composing per-stage skeletons + per-track overlays + per-project gotcha blocks, materialized per revision (mirroring `materializeCanonicalChecklist`). Cards own **no** completion state: a typed `completionRef` adapter resolves each card to the *existing* checklist / measurement / artifact / commit / board-status substrate and reuses the existing stage-gate predicates for "done." A uniform "stage-gate" footer presents that state consistently; design-stage cards are revision-level, ASSEMBLY/BRINGUP cards are per-board.

**Tech Stack:** Next.js 16 (App Router, RSC) · React 19.2 · Prisma 7 / Neon Postgres · TypeScript · Tailwind v4 (`@theme`/`@layer`, no config file) · Zod 4 · Radix UI (`react-tooltip`, `react-popover`) · vitest (node env, real Neon DB, `pnpm exec vitest run <path>`).

**Reference design:** `docs/plans/2026-06-02-learner-guide-system-design.md` (validated 2026-06-02). Read it before starting.

**Conventions to mirror (verified file:line):**
- `materializeCanonicalChecklist` — `src/lib/actions/checklists.ts:601` (Serializable tx via `withTxRetry`, `assertNotFrozen`, dedupe, `items.create` with ordinal).
- `reorderChecklistItems` two-pass negative-scratch swap — `src/lib/actions/checklists.ts:470`.
- Stage gate predicates matched by `.subkind` — `src/lib/stages.ts:146,221,273,382`.
- `loadGateContext` (loads `revisionChecklists` + `activeBuild.checklists` with items) — `src/lib/load-gate-context.ts:68-82`.
- Existing client checklist editor — `src/components/ChecklistEditor.tsx`.
- Existing measurement form — `src/components/AddMeasurementForm.tsx`; action `src/lib/actions/measurements.ts:77`.
- `@theme` tokens + `@layer components` recipes — `src/app/globals.css:19-45,74-202`.

**Test command:** `pnpm exec vitest run <path>` (prepend PATH on Windows: `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path`). There is **no** component-DOM harness (no testing-library/jsdom) — unit-test pure logic; verify React/CSS by running the app (@run / @verify).

**Skills:** @superpowers:test-driven-development for every coded task · @superpowers:executing-plans to drive batches · @verify / @run to confirm UI.

---

## Milestone 0 — Prerequisites (sequencing; no code)

The composer reuses the §6 gotcha catalog and per-board predicates that currently live only on the unmerged `seed/curriculum-dag-population` branch (PR #1), and the 22 `foundry-*` revisions must exist in the target DB.

**Task 0.1 — Land the seed PR**
- Merge PR #1 (`seed/curriculum-dag-population`) into `main`.
- Rebase this branch: `git checkout feature/learner-guide-system && git rebase main`.
- Verify `scripts/populate-curriculum-dag.ts` now exists on this branch: `git ls-files scripts/populate-curriculum-dag.ts` → expect the path printed.

**Task 0.2 — Confirm DB state** (Neon project `flat-mountain-86476919`)
- Confirm 22 `foundry-*` projects + v1 revisions + REQUIREMENTS_REVIEW checklists exist (run the verification SQL from the seed work, or Neon MCP `run_sql`). Expect `projects_foundry=22`, `foundry_revisions=22`.

**Task 0.3 — Install Radix and verify clean resolution**
- `pnpm add @radix-ui/react-tooltip @radix-ui/react-popover`
- Run: `pnpm why @radix-ui/react-primitive` — Expected: a **single** version (dedupe against the transitive `2.1.3` from `@prisma/studio-core`; if two appear, add a `pnpm.overrides` pin).
- Commit: `git add package.json pnpm-lock.yaml && git commit -m "build: add radix tooltip + popover"`

---

## Milestone 1 — Data model + migration

### Task 1.1: Add `Guide` + `GuideCard` models

**Files:**
- Modify: `prisma/schema.prisma` (Revision back-relation, User back-relation, two new models)
- Create migration via Prisma

**Step 1: Add back-relations + models to `prisma/schema.prisma`**

In `model Revision` (after `checklists Checklist[]`):
```prisma
  guide Guide?
```
In `model User` (after `checklistsCreated Checklist[]`):
```prisma
  guidesCreated Guide[]
```
At the end of the file:
```prisma
model Guide {
  id            String           @id @default(cuid())
  revisionId    String           @unique
  revision      Revision         @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  title         String
  trackSnapshot CurriculumTrack?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  createdById   String
  createdBy     User             @relation(fields: [createdById], references: [id], onDelete: Restrict)
  cards         GuideCard[]
}

model GuideCard {
  id            String   @id @default(cuid())
  guideId       String
  guide         Guide    @relation(fields: [guideId], references: [id], onDelete: Cascade)
  stage         Stage
  ordinal       Int
  eyebrow       String
  title         String
  lead          String?
  contentBlocks Json
  isGate        Boolean  @default(false)
  completionRef Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([guideId, ordinal])
  @@unique([guideId, stage])
  @@index([guideId])
}
```

**Step 2: Create the migration**

Run: `pnpm exec prisma migrate dev --name add_guide_models`
Expected: a new folder under `prisma/migrations/*_add_guide_models/` with `CREATE TABLE "Guide"` + `"GuideCard"`, and `prisma generate` runs.

**Step 3: Verify the client typechecks the new models**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors). The `db.guide` / `db.guideCard` delegates now exist.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(guide): add Guide + GuideCard models"
```

### Task 1.2: Round-trip smoke test (real DB)

**Files:** Create `src/lib/__tests__/guide-model.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";

describe("Guide model", () => {
  const slug = "foundry-l1-01-wroom-breakout";
  let guideId: string | null = null;
  afterAll(async () => { if (guideId) await db.guide.delete({ where: { id: guideId } }); });

  it("creates a Guide with an ordered card on an existing revision", async () => {
    const rev = await db.revision.findFirstOrThrow({
      where: { project: { slug }, label: { equals: "v1", mode: "insensitive" } },
      select: { id: true, project: { select: { createdById: true } } },
    });
    const guide = await db.guide.create({
      data: {
        revisionId: rev.id,
        title: "Test guide",
        createdById: rev.project.createdById,
        cards: { create: [{ stage: "REQUIREMENTS", ordinal: 0, eyebrow: "PHASE 01", title: "REQUIREMENTS", contentBlocks: [] }] },
      },
      include: { cards: true },
    });
    guideId = guide.id;
    expect(guide.cards).toHaveLength(1);
    expect(guide.cards[0]!.stage).toBe("REQUIREMENTS");
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-model.test.ts`
Expected: FAIL (before migration applied to test DB) — apply migration first if needed.

**Step 3: (No implementation — model already exists)** Confirm migration is applied to the test DB.

**Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-model.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/__tests__/guide-model.test.ts
git commit -m "test(guide): Guide/GuideCard round-trip"
```

---

## Milestone 2 — Zod schemas (content blocks + completionRef)

### Task 2.1: Content-block + CompletionRef discriminated unions

**Files:**
- Create: `src/lib/schemas/guide.ts`
- Test: `src/lib/__tests__/guide-schema.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { contentBlockSchema, completionRefSchema, guideContentBlocksSchema } from "@/lib/schemas/guide";

describe("guide schemas", () => {
  it("accepts a valid callout block", () => {
    const r = contentBlockSchema.safeParse({ type: "callout", severity: "critical", label: "X", body: "Y" });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown block type", () => {
    expect(contentBlockSchema.safeParse({ type: "nope" }).success).toBe(false);
  });
  it("rejects a callout with a bad severity", () => {
    expect(contentBlockSchema.safeParse({ type: "callout", severity: "boom", label: "X", body: "Y" }).success).toBe(false);
  });
  it("validates a block array", () => {
    expect(guideContentBlocksSchema.safeParse([{ type: "prose", md: "hi" }]).success).toBe(true);
  });
  it("accepts a revisionChecklist completionRef", () => {
    expect(completionRefSchema.safeParse({ kind: "revisionChecklist", subkind: "LAYOUT_REVIEW" }).success).toBe(true);
  });
  it("rejects a completionRef with an invalid subkind", () => {
    expect(completionRefSchema.safeParse({ kind: "revisionChecklist", subkind: "NOPE" }).success).toBe(false);
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-schema.test.ts`
Expected: FAIL ("Cannot find module '@/lib/schemas/guide'").

**Step 3: Write the implementation**

```ts
// src/lib/schemas/guide.ts
import { z } from "zod";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";

const CHECKLIST_SUBKINDS = [
  "GENERIC", "EQUIPMENT_PREFLIGHT", "SCREENING_STEP_0", "ASSEMBLY_STEPS",
  "POST_ASSEMBLY_CONTINUITY", "POLARITY_VERIFICATION",
  "REQUIREMENTS_REVIEW", "LAYOUT_REVIEW", "STRIPBOARD_VALIDATION",
] as const;
const ARTIFACT_SUBKINDS = [
  "GENERIC", "REQUIREMENTS_DOC", "SCHEMATIC_FILE", "BOM_EXPORT", "LAYOUT_FILE",
  "DRC_REPORT", "GERBER_ZIP", "PCB_ORDER", "PARTS_ORDER", "ASSEMBLY_PROCEDURE",
  "BENCH_PROCEDURE", "BRINGUP_LOG", "BRINGUP_COMPLETE", "BOM_CSV_AS_ORDERED",
  "ASSEMBLY_PHOTO", "BRINGUP_MEASUREMENTS_CSV",
] as const;
const BOARD_STATUSES = ["BARE","SCREENED","ASSEMBLED","POWERED","BROUGHT_UP","FAILED","QUARANTINED"] as const;

const cellSchema = z.object({
  text: z.string(),
  decoration: z.enum(["ref", "mpn", "badge"]).optional(),
  tone: z.enum(["gold", "blue", "critical", "dim"]).optional(),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("prose"), md: z.string().max(4000) }),
  z.object({ type: z.literal("callout"), severity: z.enum(["critical", "warn", "info"]), label: z.string().max(120), body: z.string().max(2000) }),
  z.object({ type: z.literal("steps"), ordered: z.boolean().default(true), items: z.array(z.string().max(500)).min(1) }),
  z.object({ type: z.literal("table"), columns: z.array(z.string()).min(1), rows: z.array(z.array(cellSchema)) }),
  z.object({ type: z.literal("termRef"), term: z.string().max(80) }),
  z.object({ type: z.literal("sourceRef"), label: z.string().max(160), href: z.string().max(500) }),
]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const guideContentBlocksSchema = z.array(contentBlockSchema).max(60);

export const completionRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("revisionChecklist"), subkind: z.enum(CHECKLIST_SUBKINDS) }),
  z.object({ kind: z.literal("buildChecklist"), subkind: z.enum(CHECKLIST_SUBKINDS) }),
  z.object({ kind: z.literal("boardMeasurements"), steps: z.array(z.string().max(120)).min(1) }),
  z.object({ kind: z.literal("artifact"), subkinds: z.array(z.enum(ARTIFACT_SUBKINDS)).min(1) }),
  z.object({ kind: z.literal("commit"), field: z.enum(["schematicCommit", "layoutCommit"]) }),
  z.object({ kind: z.literal("boardStatus"), statuses: z.array(z.enum(BOARD_STATUSES)).min(1) }),
  z.object({ kind: z.literal("none") }),
]);
export type CompletionRef = z.infer<typeof completionRefSchema>;

export const guideCardInputSchema = z.object({
  stage: z.enum(STAGE_VALUES),
  ordinal: z.number().int().nonnegative(),
  eyebrow: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  lead: z.string().max(400).nullable().optional(),
  contentBlocks: guideContentBlocksSchema,
  isGate: z.boolean().default(false),
  completionRef: completionRefSchema.nullable().optional(),
});

export const materializeGuideSchema = z.object({ revisionId: z.cuid() });
export const editGuideCardSchema = z.object({
  id: z.cuid(),
  eyebrow: z.string().min(1).max(40).optional(),
  title: z.string().min(1).max(80).optional(),
  lead: z.string().max(400).nullable().optional(),
  contentBlocks: guideContentBlocksSchema.optional(),
  isGate: z.boolean().optional(),
  completionRef: completionRefSchema.nullable().optional(),
});
export const reorderGuideCardsSchema = z.object({
  guideId: z.cuid(),
  orderedIds: z.array(z.cuid()).min(1),
});
```

> Note: `STAGE_VALUES` is reused from `src/lib/schemas/project-dependency.ts:10`. If a `Stage`/`ChecklistSubkind`/`ArtifactSubkind`/`BoardStatus` literal list already exists elsewhere, import it instead of re-declaring (DRY).

**Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-schema.test.ts`
Expected: PASS (6 tests).

**Step 5: Commit**

```bash
git add src/lib/schemas/guide.ts src/lib/__tests__/guide-schema.test.ts
git commit -m "feat(guide): content-block + completionRef schemas"
```

---

## Milestone 3 — Composition templates (the 22-guide generator)

### Task 3.1: Extract the shared gotcha catalog

**Files:**
- Create: `src/lib/guide-templates/gotcha-blocks.ts`
- Test: `src/lib/__tests__/gotcha-blocks.test.ts`

The seed script (`scripts/populate-curriculum-dag.ts`, post-M0) holds the canonical gotcha strings + predicates (antenna keep-out on all WROOM boards; isolation post-reg on `foundry-l2-05`/`foundry-l3-01`; WS2812/servo/ADC1/auto-shutoff). Make this the single source and have the seed import from it in a later cleanup.

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { gotchaBlocksFor } from "@/lib/guide-templates/gotcha-blocks";

const wroom = { slug: "foundry-l1-01-wroom-breakout", track: "COMMS", requiresStripboard: false } as const;
const eeg = { slug: "foundry-l3-01-eeg-front-end", track: "SENSE", requiresStripboard: false } as const;

describe("gotchaBlocksFor", () => {
  it("attaches antenna keep-out to every board at LAYOUT", () => {
    const blocks = gotchaBlocksFor(wroom, "LAYOUT");
    expect(blocks.some((b) => b.type === "callout" && /antenna keep-out/i.test(b.label))).toBe(true);
  });
  it("attaches isolation post-reg only to isolated boards", () => {
    expect(gotchaBlocksFor(eeg, "LAYOUT").some((b) => /isolat/i.test((b as any).label))).toBe(true);
    expect(gotchaBlocksFor(wroom, "LAYOUT").some((b) => /isolat/i.test((b as any).label))).toBe(false);
  });
  it("does not attach antenna keep-out at REQUIREMENTS", () => {
    expect(gotchaBlocksFor(wroom, "REQUIREMENTS").some((b) => /antenna/i.test((b as any).label))).toBe(false);
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/gotcha-blocks.test.ts` → FAIL (module missing).

**Step 3: Implement**

```ts
// src/lib/guide-templates/gotcha-blocks.ts
import type { ContentBlock } from "@/lib/schemas/guide";

export interface GuideProjectFacts {
  slug: string;
  track: "SENSE" | "ACT" | "POWER" | "COMMS" | null;
  requiresStripboard: boolean;
}
type Stage = "REQUIREMENTS"|"SCHEMATIC"|"BOM_SOURCING"|"LAYOUT"|"DRC_GERBER"|"ORDERING"|"ASSEMBLY"|"BRINGUP";

interface Gotcha {
  id: string;
  block: ContentBlock;
  appliesAt: Stage[];
  appliesTo: (p: GuideProjectFacts) => boolean;
}

const ISOLATION_SLUGS = new Set(["foundry-l2-05-isolated-spi-bridge", "foundry-l3-01-eeg-front-end"]);

const GOTCHAS: Gotcha[] = [
  {
    id: "antenna-keepout",
    appliesAt: ["LAYOUT"],
    appliesTo: () => true, // every board contains a WROOM
    block: { type: "callout", severity: "warn", label: "WROOM antenna keep-out",
      body: "Confirm the keep-out against the module datasheet — no copper / no ground pour under the antenna. Violating it detunes the radio and kills range." },
  },
  {
    id: "isolation-postreg",
    appliesAt: ["LAYOUT", "SCHEMATIC"],
    appliesTo: (p) => ISOLATION_SLUGS.has(p.slug),
    block: { type: "callout", severity: "warn", label: "Isolated rail post-regulator",
      body: "Isolated DC-DC converters are noisy — post-regulate + filter the isolated secondary before it feeds the analog front-end." },
  },
  {
    id: "ws2812-levelshift",
    appliesAt: ["SCHEMATIC", "REQUIREMENTS"],
    appliesTo: (p) => /ws2812|lighting/.test(p.slug),
    block: { type: "callout", severity: "warn", label: "WS2812 level-shift",
      body: "3.3V logic is out of spec for 5V WS2812 — level-shift via 74AHCT125, run the strip ~4.5V, or substitute SK6812." },
  },
  {
    id: "servo-brownout",
    appliesAt: ["SCHEMATIC", "LAYOUT"],
    appliesTo: (p) => /servo|brushless/.test(p.slug),
    block: { type: "callout", severity: "warn", label: "Servo/motor brownout",
      body: "Separate supply rail, bulk cap sized for stall current, wide/short high-current traces (double-track on stripboard)." },
  },
  {
    id: "adc1-only",
    appliesAt: ["SCHEMATIC", "REQUIREMENTS"],
    appliesTo: (p) => /internal-adc/.test(p.slug),
    block: { type: "callout", severity: "warn", label: "ADC1-only",
      body: "ADC2 pins are unusable while WiFi/ESP-NOW is active — route all sampled inputs to ADC1." },
  },
  {
    id: "auto-shutoff",
    appliesAt: ["REQUIREMENTS"],
    appliesTo: (p) => /^foundry-bn-/.test(p.slug),
    block: { type: "callout", severity: "info", label: "Power-bank auto-shutoff",
      body: "USB power banks auto-shutoff under low/steady draw — source from a USB-C wall PD supply or add a periodic-pulse load." },
  },
];

export function gotchaBlocksFor(p: GuideProjectFacts, stage: Stage): ContentBlock[] {
  return GOTCHAS.filter((g) => g.appliesAt.includes(stage) && g.appliesTo(p)).map((g) => g.block);
}
```

**Step 4: Run to verify it passes** — `pnpm exec vitest run src/lib/__tests__/gotcha-blocks.test.ts` → PASS (3).

**Step 5: Commit** — `git add src/lib/guide-templates/gotcha-blocks.ts src/lib/__tests__/gotcha-blocks.test.ts && git commit -m "feat(guide): shared gotcha-blocks catalog"`

### Task 3.2: Stage skeletons + track overlays

**Files:**
- Create: `src/lib/guide-templates/stage-skeletons.ts`, `src/lib/guide-templates/track-overlays.ts`
- Test: `src/lib/__tests__/stage-skeletons.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { STAGE_CARD_SKELETONS, GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";

describe("stage skeletons", () => {
  it("covers exactly the 8 design->bringup stages (REVISION excluded)", () => {
    expect(GUIDE_STAGES).toEqual(["REQUIREMENTS","SCHEMATIC","BOM_SOURCING","LAYOUT","DRC_GERBER","ORDERING","ASSEMBLY","BRINGUP"]);
  });
  it("gives REQUIREMENTS a revisionChecklist completionRef", () => {
    expect(STAGE_CARD_SKELETONS.REQUIREMENTS.completionRef).toEqual({ kind: "revisionChecklist", subkind: "REQUIREMENTS_REVIEW" });
  });
  it("gives ASSEMBLY a buildChecklist completionRef", () => {
    expect(STAGE_CARD_SKELETONS.ASSEMBLY.completionRef?.kind).toBe("buildChecklist");
  });
  it("marks gate stages isGate", () => {
    expect(STAGE_CARD_SKELETONS.LAYOUT.isGate).toBe(true);
  });
});
```

**Step 2: Run** → FAIL (module missing).

**Step 3: Implement** `stage-skeletons.ts` — one entry per stage with `eyebrow`, `title`, base `contentBlocks` (generic process prose + `steps`), `isGate`, and `completionRef` per the design §3 table:

```ts
// src/lib/guide-templates/stage-skeletons.ts
import type { ContentBlock, CompletionRef } from "@/lib/schemas/guide";

export const GUIDE_STAGES = [
  "REQUIREMENTS","SCHEMATIC","BOM_SOURCING","LAYOUT","DRC_GERBER","ORDERING","ASSEMBLY","BRINGUP",
] as const;
export type GuideStage = (typeof GUIDE_STAGES)[number];

export interface StageSkeleton {
  eyebrow: string; title: string; lead: string;
  baseBlocks: ContentBlock[]; isGate: boolean; completionRef: CompletionRef;
}

export const STAGE_CARD_SKELETONS: Record<GuideStage, StageSkeleton> = {
  REQUIREMENTS: { eyebrow: "PHASE 01", title: "REQUIREMENTS", lead: "Pin down what the board must do and the constraints it must honor before any schematic work.",
    baseBlocks: [{ type: "prose", md: "Capture the functional requirements, the discipline this board teaches, and every safety/DFM constraint. Complete the REQUIREMENTS review checklist to exit." }],
    isGate: true, completionRef: { kind: "revisionChecklist", subkind: "REQUIREMENTS_REVIEW" } },
  SCHEMATIC: { eyebrow: "PHASE 02", title: "SCHEMATIC", lead: "Draw the schematic and pin the commit.",
    baseBlocks: [{ type: "prose", md: "Draft the schematic, then attach the schematic file artifact and record the schematic commit." }],
    isGate: false, completionRef: { kind: "artifact", subkinds: ["SCHEMATIC_FILE"] } },
  BOM_SOURCING: { eyebrow: "PHASE 03", title: "BOM SOURCING", lead: "Source every part; validate on stripboard where required.",
    baseBlocks: [{ type: "prose", md: "Build the BOM and source parts. Stripboard-de-risk boards must pass the stripboard validation checklist." }],
    isGate: false, completionRef: { kind: "revisionChecklist", subkind: "STRIPBOARD_VALIDATION" } },
  LAYOUT: { eyebrow: "PHASE 04", title: "LAYOUT", lead: "Place and route; honor the keep-outs.",
    baseBlocks: [{ type: "prose", md: "Lay out the board and complete the LAYOUT review checklist (antenna keep-out, isolation, etc.)." }],
    isGate: true, completionRef: { kind: "revisionChecklist", subkind: "LAYOUT_REVIEW" } },
  DRC_GERBER: { eyebrow: "PHASE 05", title: "DRC / GERBER", lead: "Pass DRC and export fabrication outputs.",
    baseBlocks: [{ type: "prose", md: "Run DRC clean and export Gerbers; attach the DRC report and Gerber zip." }],
    isGate: false, completionRef: { kind: "artifact", subkinds: ["DRC_REPORT", "GERBER_ZIP"] } },
  ORDERING: { eyebrow: "PHASE 06", title: "ORDERING", lead: "Order boards and parts.",
    baseBlocks: [{ type: "prose", md: "Place the PCB and parts orders; attach both order records to the build." }],
    isGate: false, completionRef: { kind: "artifact", subkinds: ["PCB_ORDER", "PARTS_ORDER"] } },
  ASSEMBLY: { eyebrow: "PHASE 07", title: "ASSEMBLY", lead: "Hand-build the boards; screen before paste.",
    baseBlocks: [
      { type: "callout", severity: "critical", label: "Sequence discipline", body: "Hot-air work first on the bare board, iron-solder passives/discretes after. Reverse order lifts placed parts." },
      { type: "steps", ordered: true, items: ["Flood the footprint with liquid flux.", "Load the iron tip with fresh solder.", "Drag along one pad row at ~3 mm/sec."] },
    ],
    isGate: true, completionRef: { kind: "buildChecklist", subkind: "POST_ASSEMBLY_CONTINUITY" } },
  BRINGUP: { eyebrow: "PHASE 08", title: "BRINGUP", lead: "Power on safely; record measurements.",
    baseBlocks: [{ type: "prose", md: "Bring each board up, capture the bring-up measurements, and mark boards BROUGHT_UP." }],
    isGate: true, completionRef: { kind: "boardStatus", statuses: ["BROUGHT_UP", "QUARANTINED"] } },
};
```

`track-overlays.ts`:
```ts
// src/lib/guide-templates/track-overlays.ts
import type { ContentBlock } from "@/lib/schemas/guide";
import type { GuideStage } from "./stage-skeletons";

type Track = "SENSE" | "ACT" | "POWER" | "COMMS";
const NEUTRAL: Partial<Record<GuideStage, ContentBlock[]>> = {};

export const TRACK_OVERLAYS: Record<Track, Partial<Record<GuideStage, ContentBlock[]>>> = {
  SENSE: { SCHEMATIC: [{ type: "prose", md: "Sense boards live or die on the analog front-end: low-noise reference, star ground, guard the high-impedance nodes." }] },
  ACT:   { SCHEMATIC: [{ type: "prose", md: "Actuator boards move current — size the driver, the gate drive, and the return path for the worst case, not the nominal." }] },
  POWER: { SCHEMATIC: [{ type: "prose", md: "Power boards: define every rail's source, sequencing, and protection before layout. DC-only — no student-laid-out mains copper." }] },
  COMMS: { SCHEMATIC: [{ type: "prose", md: "Comms boards: ESP-NOW channel/peer plan, and the WROOM antenna keep-out is a first-class layout constraint." }] },
};

// Null track → neutral (no overlay). Bench tools (level null) still have a track.
export function trackOverlayFor(track: Track | null, stage: GuideStage): ContentBlock[] {
  if (!track) return NEUTRAL[stage] ?? [];
  return TRACK_OVERLAYS[track][stage] ?? [];
}
```

**Step 4: Run** → PASS (4). **Step 5: Commit** — `git add src/lib/guide-templates/stage-skeletons.ts src/lib/guide-templates/track-overlays.ts src/lib/__tests__/stage-skeletons.test.ts && git commit -m "feat(guide): stage skeletons + track overlays"`

### Task 3.3: `composeGuide(project)`

**Files:** Create `src/lib/guide-templates/compose.ts`; Test `src/lib/__tests__/compose-guide.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { composeGuide } from "@/lib/guide-templates/compose";

const eeg = { slug: "foundry-l3-01-eeg-front-end", name: "L3.01 EEG front-end", track: "SENSE" as const, requiresStripboard: false, disciplineTaught: "8-ch ADS1299 AFE" };

describe("composeGuide", () => {
  it("produces 8 cards in stage order with ordinals 0..7", () => {
    const g = composeGuide(eeg);
    expect(g.cards).toHaveLength(8);
    expect(g.cards.map((c) => c.ordinal)).toEqual([0,1,2,3,4,5,6,7]);
    expect(g.cards[0]!.stage).toBe("REQUIREMENTS");
    expect(g.cards[7]!.stage).toBe("BRINGUP");
  });
  it("merges the isolation gotcha into the EEG LAYOUT card", () => {
    const layout = composeGuide(eeg).cards.find((c) => c.stage === "LAYOUT")!;
    expect(layout.contentBlocks.some((b) => /isolat/i.test((b as any).label ?? ""))).toBe(true);
  });
  it("falls back to neutral overlay when track is null", () => {
    const g = composeGuide({ ...eeg, track: null });
    expect(g.cards).toHaveLength(8); // no throw
  });
  it("validates every card against the schema", () => {
    // composeGuide should return cards that pass guideCardInputSchema
    const g = composeGuide(eeg);
    expect(g.cards.every((c) => typeof c.eyebrow === "string")).toBe(true);
  });
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement**

```ts
// src/lib/guide-templates/compose.ts
import { GUIDE_STAGES, STAGE_CARD_SKELETONS } from "./stage-skeletons";
import { trackOverlayFor } from "./track-overlays";
import { gotchaBlocksFor, type GuideProjectFacts } from "./gotcha-blocks";
import { guideCardInputSchema } from "@/lib/schemas/guide";

export interface ComposeInput extends GuideProjectFacts {
  name: string;
  disciplineTaught: string | null;
}
export interface ComposedCard {
  stage: string; ordinal: number; eyebrow: string; title: string;
  lead: string | null; contentBlocks: unknown[]; isGate: boolean; completionRef: unknown;
}
export interface ComposedGuide { title: string; trackSnapshot: ComposeInput["track"]; cards: ComposedCard[]; }

export function composeGuide(project: ComposeInput): ComposedGuide {
  const cards = GUIDE_STAGES.map((stage, i) => {
    const sk = STAGE_CARD_SKELETONS[stage];
    const blocks = [
      ...sk.baseBlocks,
      ...(project.disciplineTaught && stage === "REQUIREMENTS"
        ? [{ type: "prose" as const, md: `**Discipline taught:** ${project.disciplineTaught}` }] : []),
      ...trackOverlayFor(project.track, stage),
      ...gotchaBlocksFor(project, stage),
    ];
    const card = {
      stage, ordinal: i, eyebrow: sk.eyebrow, title: sk.title, lead: sk.lead,
      contentBlocks: blocks, isGate: sk.isGate, completionRef: sk.completionRef,
    };
    // Defense-in-depth: composed cards must satisfy the persisted schema.
    guideCardInputSchema.parse(card);
    return card as ComposedCard;
  });
  return { title: `${project.name} — build guide`, trackSnapshot: project.track, cards };
}
```

**Step 4: Run** → PASS (4). **Step 5: Commit** — `git commit -am "feat(guide): composeGuide template merge"` (add new files first).

---

## Milestone 4 — Server actions

### Task 4.1: `materializeGuide`

**Files:** Create `src/lib/actions/guides.ts`; Test `src/lib/__tests__/guides-actions.test.ts`
**Skill:** mirror `materializeCanonicalChecklist` (`src/lib/actions/checklists.ts:601`) and the auth/freeze pattern.

**Step 1: Write the failing test** (real DB; mock `requireUser` like existing action tests do — check `src/lib/__tests__/checklists-actions.test.ts` for the established mocking pattern and copy it):

```ts
import { describe, it, expect, afterAll, vi } from "vitest";
// Replicate the requireUser mock used by checklists-actions.test.ts
import { db } from "@/lib/db";

describe("materializeGuide", () => {
  const slug = "foundry-l1-02-espnow-link";
  let createdRevisionGuideId: string | null = null;
  afterAll(async () => { if (createdRevisionGuideId) await db.guide.delete({ where: { id: createdRevisionGuideId } }).catch(() => {}); });

  it("materializes 8 cards for a curriculum revision, idempotent on second call", async () => {
    const { materializeGuide } = await import("@/lib/actions/guides");
    const rev = await db.revision.findFirstOrThrow({ where: { project: { slug }, label: { equals: "v1", mode: "insensitive" } }, select: { id: true } });
    const g = await materializeGuide({ revisionId: rev.id });
    createdRevisionGuideId = g.id;
    const cards = await db.guideCard.count({ where: { guideId: g.id } });
    expect(cards).toBe(8);
    await expect(materializeGuide({ revisionId: rev.id })).rejects.toThrow(/already exists/i);
  });
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement** (key shape — copy the imports/auth/withTxRetry/assertNotFrozen wiring from `checklists.ts`):

```ts
// src/lib/actions/guides.ts
"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { materializeGuideSchema, editGuideCardSchema, reorderGuideCardsSchema } from "@/lib/schemas/guide";
import { composeGuide } from "@/lib/guide-templates/compose";

export async function materializeGuide(input: unknown) {
  const { revisionId } = materializeGuideSchema.parse(input);
  const user = await requireUser();

  const guide = await withTxRetry(() =>
    db.$transaction(async (tx) => {
      await assertNotFrozen(tx, revisionId);
      const rev = await tx.revision.findUniqueOrThrow({
        where: { id: revisionId },
        select: { project: { select: { slug: true, name: true, track: true, requiresStripboard: true, disciplineTaught: true } } },
      });
      const existing = await tx.guide.findUnique({ where: { revisionId }, select: { id: true } });
      if (existing) throw new Error("A guide already exists for this revision.");

      const composed = composeGuide({
        slug: rev.project.slug, name: rev.project.name, track: rev.project.track,
        requiresStripboard: rev.project.requiresStripboard, disciplineTaught: rev.project.disciplineTaught,
      });
      try {
        return await tx.guide.create({
          data: {
            revisionId, title: composed.title, trackSnapshot: composed.trackSnapshot, createdById: user.id,
            cards: { create: composed.cards.map((c) => ({
              stage: c.stage as Prisma.GuideCardCreateManyGuideInput["stage"],
              ordinal: c.ordinal, eyebrow: c.eyebrow, title: c.title, lead: c.lead ?? null,
              contentBlocks: c.contentBlocks as Prisma.InputJsonValue,
              isGate: c.isGate, completionRef: (c.completionRef ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            })) },
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new Error("A guide already exists for this revision.");
        }
        throw e;
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
  );

  const r = await db.revision.findUniqueOrThrow({ where: { id: revisionId }, select: { label: true, project: { select: { slug: true } } } });
  revalidatePath(`/projects/${r.project.slug}/${encodeURIComponent(r.label)}/guide`);
  return guide;
}
```

**Step 4: Run** → PASS. **Step 5: Commit** — `git add src/lib/actions/guides.ts src/lib/__tests__/guides-actions.test.ts && git commit -m "feat(guide): materializeGuide action"`

### Task 4.2: `editGuideCard` (Zod-validated content blocks, freeze-guarded)
TDD: edit a card's `contentBlocks`/`lead`; assert invalid block array rejected; assert frozen revision rejected. Implement mirroring `editChecklistItem` (resolve revision via `card.guide.revisionId`, `assertNotFrozen`, patch only provided fields, `revalidatePath`). Commit.

### Task 4.3: `reorderGuideCards` (two-pass negative-scratch swap)
TDD: reorder, assert ordinals 0..N-1; assert exhaustive-id-set validation. Implement by copying `reorderChecklistItems` (`checklists.ts:470`) substituting `guideCard`/`guideId`. Commit.

---

## Milestone 5 — POST_ASSEMBLY_CONTINUITY canonical template + build-scoped materialize

The ASSEMBLY card's `buildChecklist` completionRef needs a real checklist; today only the 3 revision-scoped templates exist and there is no build-scoped materialize path.

### Task 5.1: Add the canonical template
**Files:** Modify `src/lib/canonical-checklist-templates.ts` (widen the `Record` key union + add `POST_ASSEMBLY_CONTINUITY`); Test `src/lib/__tests__/canonical-checklist-templates.test.ts` (extend).
TDD: assert `CANONICAL_TEMPLATES.POST_ASSEMBLY_CONTINUITY.subkind === "POST_ASSEMBLY_CONTINUITY"` and items non-empty (continuity sweep, rail-resistance, no-bridge). Implement. Commit.

### Task 5.2: Build-scoped materialize
**Files:** Modify `src/lib/actions/checklists.ts` (generalize `materializeCanonicalChecklist` to accept a build owner, or add `materializeBuildChecklist`); Test extends `checklists-actions.test.ts`.
TDD: materialize POST_ASSEMBLY_CONTINUITY against a build; dedupe by `(buildId, subkind)`; freeze-guard (`assertBuildNotFrozen`). Implement reusing `createChecklist`'s build-owner branch. Commit.

---

## Milestone 6 — Completion adapters (resolve `completionRef` → live state)

### Task 6.1: `resolveCompletion` + build/board resolution
**Files:** Create `src/lib/guide-completion.ts`; Test `src/lib/__tests__/guide-completion.test.ts`
**Reuse:** `loadGateContext` (`src/lib/load-gate-context.ts`) and the stage gate predicates (`src/lib/stages.ts`) so "done" never diverges from the real gate.

**Step 1: Write the failing test** (real DB; use the seeded revision which has a REQUIREMENTS_REVIEW checklist):

```ts
import { describe, it, expect } from "vitest";
import { resolveCardCompletion } from "@/lib/guide-completion";

describe("resolveCardCompletion", () => {
  it("reports a revisionChecklist card as incomplete when items are unchecked", async () => {
    const { db } = await import("@/lib/db");
    const rev = await db.revision.findFirstOrThrow({ where: { project: { slug: "foundry-l1-01-wroom-breakout" }, label: { equals: "v1", mode: "insensitive" } }, select: { id: true } });
    const r = await resolveCardCompletion({ revisionId: rev.id, completionRef: { kind: "revisionChecklist", subkind: "REQUIREMENTS_REVIEW" } });
    expect(r.state).toBe("partial"); // checklist exists, has unchecked items
    expect(r.total).toBeGreaterThan(0);
  });
  it("reports 'blocked' for a buildChecklist card when there is no active build", async () => {
    const { db } = await import("@/lib/db");
    const rev = await db.revision.findFirstOrThrow({ where: { project: { slug: "foundry-l1-01-wroom-breakout" }, label: { equals: "v1", mode: "insensitive" } }, select: { id: true } });
    const r = await resolveCardCompletion({ revisionId: rev.id, completionRef: { kind: "buildChecklist", subkind: "POST_ASSEMBLY_CONTINUITY" } });
    expect(r.state).toBe("blocked");
  });
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement** `resolveCardCompletion({ revisionId, boardId?, completionRef })` returning `{ state: "complete"|"partial"|"untouched"|"blocked", done, total, href? }`. Switch on `completionRef.kind`:
- `revisionChecklist` → find the revision's checklist by subkind (lazily materialize if missing? — for resolve, treat missing as `untouched` with a "materialize" affordance), count items.
- `buildChecklist` → resolve active unfrozen build (`build_one_unfrozen_per_revision`); none → `blocked`; else count its checklist.
- `boardMeasurements` → require `boardId`; count steps with a Measurement row.
- `artifact` → presence of any artifact with one of the subkinds on the revision/active build.
- `commit` → `revision[field]` non-null.
- `boardStatus` → all boards of the active build in `statuses` (or quarantined).
- `none` → `complete`.

Add `resolveActiveBuild(revisionId)` + `listBoards(buildId)` helpers (reuse query shapes from `load-gate-context.ts`).

**Step 4: Run** → PASS. **Step 5: Commit.**

---

## Milestone 7 — Tooltip + glossary primitive (Radix)

### Task 7.1: Glossary data (pure, TDD)
**Files:** Create `src/lib/glossary.ts`; Test `src/lib/__tests__/glossary.test.ts`
TDD: `lookupTerm("ADC1")` returns a definition; unknown term returns `null`; seed from `src/lib/stages.ts` canonical terms + jargon (WL-CSP, drag-tin, SAC305, RLD, tombstoning, SAC305, ESP-NOW). Implement a `Record<string, {term,def}>` with a normalized lookup. Commit.

### Task 7.2: `Tooltip` (role=tooltip) and `GlossaryTerm` (popover) components
**Files:** Create `src/components/Tooltip.tsx`, `src/components/GlossaryTerm.tsx`
No DOM test harness → **verify by running** (Task 7.4). Build on `@radix-ui/react-tooltip` (hover+focus, Esc, `role=tooltip`) and `@radix-ui/react-popover` (`aria-expanded`, focus trap, click-outside). Style with `.glass-card` + `.note-italic` + `font-mono` term header; give content `className="... z-50"` (above the `z-20` header). Accept `container` prop on `GlossaryTerm` for in-dialog use. Commit.

### Task 7.3: Wire `termRef` block → `GlossaryTerm` in the block renderer (created in M8). (Cross-ref; implement in M8.)

### Task 7.4: Retrofit existing `title=` sites
**Files:** Modify `src/components/StageTracker.tsx:116`, `src/components/MarkBringupCompleteButton.tsx:30,62`, `src/components/SaveButton.tsx:23`, `src/app/projects/new/_form.tsx:227`, `src/app/projects/[slug]/_edit-fields.tsx:354`.
Replace raw `title=` with `<Tooltip content={...}>`. **Verify by running** (`@run` the app; hover each; confirm tooltip + keyboard focus shows it). Commit.

---

## Milestone 8 — `PageHeader` + globals.css recipes + block renderer

### Task 8.1: Port bench `@layer components` recipes
**Files:** Modify `src/app/globals.css` (add `meta-strip`, `bench-hero`/`.ord`/`.accent`, `subhead`, `nav-back`, `callout`+severities, `badge`, `table-tech` recipes consuming existing tokens — port from `C:/zzz/otd/.../_bench.css`, mapping `--command-gold`→`--color-command-gold`, etc.). **Verify by running.** Commit.

### Task 8.2: `PageHeader` component
**Files:** Create `src/components/PageHeader.tsx` — props `{ backHref, backLabel, meta: {label,value}[], eyebrow, title, accentWord, lead }`; renders `.nav-back`, `.meta-strip`, `bench-hero` (white title + gold `.accent` trailing word + `.ord` eyebrow), `.subhead`. Pure-presentational. Extract `splitTitle(title, accentWord)` as a tiny pure helper and **unit-test** it. **Verify** the rest by running. Commit.

### Task 8.3: Content-block renderer
**Files:** Create `src/components/guide/GuideBlocks.tsx` (client where `termRef`/Glossary needed; otherwise server) — switch over `ContentBlock.type` → markup using the new recipes (`callout` severities, `table-tech` with `ref`/`mpn`/`badge` cell decoration, `steps` `<ol>`, `prose` sanitized via existing `sanitize-html`, `termRef`→`GlossaryTerm`, `sourceRef`→`<a>`). **Verify by running.** Commit.

---

## Milestone 9 — Guide hub + card routes

### Task 9.1: Stage-gate footer component
**Files:** Create `src/components/guide/StageGate.tsx` — given a `resolveCardCompletion` result, render the uniform "✓ done / N remaining" footer; for `revisionChecklist`/`buildChecklist` embed the existing `ChecklistEditor`; for `boardMeasurements` embed `AddMeasurementForm` (with board selector); for `artifact`/`commit`/`boardStatus` show read-only state + deep link. **Verify by running.** Commit.

### Task 9.2: Card route
**Files:** Create `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` (RSC) — load the guide + card, render `PageHeader` + `GuideBlocks` + `StageGate`, prev/console/next nav. Board selector on ASSEMBLY/BRINGUP. **Verify by running** (`@run`; open a curriculum project's guide card). Commit.

### Task 9.3: Hub route (two-tier)
**Files:** Create `src/app/projects/[slug]/[revLabel]/guide/page.tsx` (RSC) — `PageHeader` + design-stage card grid (revision-level roll-up) + per-board matrix for ASSEMBLY/BRINGUP (or "blocked until a build/boards exist"). Add a "Generate guide" affordance calling `materializeGuide` when none exists. **Verify by running.** Commit.

### Task 9.4: Link to the guide from the revision detail page
**Files:** Modify `src/app/projects/[slug]/[revLabel]/page.tsx` — add a "Build guide →" link. **Verify by running.** Commit.

---

## Milestone 10 — Backfill + content authoring + verification

### Task 10.1: Backfill script
**Files:** Create `scripts/materialize-curriculum-guides.ts` (mirror `populate-curriculum-dag.ts` style: dotenv + dynamic `@/lib/db`; loop the 22 `foundry-*` v1 revisions; for each, replicate `composeGuide` write directly — or call a non-action helper — since server actions can't run headlessly per `[[foundry-headless-scripting]]`). Idempotent (skip if guide exists).
Run: `pnpm exec tsx scripts/materialize-curriculum-guides.ts` → expect "22 guides present".
Commit.

### Task 10.2: Verify DB state (Neon MCP `run_sql`, project `flat-mountain-86476919`)
- `SELECT count(*) FROM "Guide"` → 22.
- `SELECT count(*) FROM "GuideCard"` → 176 (22×8).
- Per-guide card count = 8; ordinals 0..7; isolation gotcha present on `foundry-l2-05`/`foundry-l3-01` LAYOUT cards only.

### Task 10.3: Author/curate per-project content
For each track/board, refine the composed `contentBlocks` (the skeleton+overlay+gotcha output is the floor, not the ceiling) — edit via `editGuideCard` or extend the templates and re-materialize. **YAGNI:** do not hand-write 176 cards; improve the templates so the composed output is good, then spot-edit outliers (EEG, BMS, lighting-array).

### Task 10.4: Full suite + typecheck
Run: `pnpm exec vitest run` and `pnpm exec tsc --noEmit` → both PASS. Commit any fixes.

---

## Done-criteria checklist
- [ ] Migration applied; `Guide`/`GuideCard` exist; `tsc --noEmit` clean.
- [ ] `composeGuide` → 8 valid cards; gotcha/track attachment tested.
- [ ] `materializeGuide`/`editGuideCard`/`reorderGuideCards` tested (dedupe, freeze, reorder, validation).
- [ ] `POST_ASSEMBLY_CONTINUITY` template + build-scoped materialize tested.
- [ ] `resolveCardCompletion` tested across all `completionRef` kinds incl. no-build/no-boards.
- [ ] `Tooltip`/`GlossaryTerm` render + a11y verified by running; `title=` sites retrofitted.
- [ ] `PageHeader` + recipes render correctly (verified); `splitTitle` unit-tested.
- [ ] Hub (two-tier) + card routes render for a curriculum project (verified).
- [ ] 22 guides / 176 cards materialized + verified via Neon MCP.
- [ ] `pnpm exec vitest run` green.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-02-learner-guide-system-implementation.md`. Two execution options:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. (REQUIRED SUB-SKILL: superpowers:subagent-driven-development.)
2. **Parallel Session (separate)** — Open a new session in the worktree and batch-execute with checkpoints. (REQUIRED SUB-SKILL: superpowers:executing-plans.)

**Note:** Milestone 0 (merge seed PR #1, install Radix) is a hard prerequisite before any coding milestone.
