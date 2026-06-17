# WS5 — Golden reference + team-build handoff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task.

**Goal:** Make the "golden set" a first-class, named bundle of a board's three proven
deliverables (KiCad starter · reference gerbers · bring-up measurements CSV) — surfaced to
operators as a "complete the kit" worklist and to learners as a consolidated "Proven board
kit" on the lesson-complete screen — with golden status **derived** (`published && vetted`),
no schema, reusing the existing reference-asset upload/resolve plumbing.

**Architecture:** A pure `assessGoldenReference` assessor (mirrors `board-readiness.ts`) +
a Prisma-free `goldenReferenceFromRows` mapper. The measurements leg becomes a uniform
file artifact (`BRINGUP_MEASUREMENTS_CSV`) on the published revision via a **generalized**
`reference-assets.ts` (gerbers + measurements) and a generalized resolver in
`learner-resources.ts`. Both surfaces render on `app/learn/[slug]/complete/page.tsx`: the
learner kit (three `GuideActionButton`s) always; the admin `GoldenReferencePanel` (status +
worklist + uploaders) admin-only.

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Prisma (prod Neon), Vitest, R2 (S3
SDK presign), Tailwind (OTD palette). Design doc:
`docs/plans/2026-06-16-ws5-golden-reference-design.md`.

---

## Constraints (read before touching anything)

- **Prod DB.** `.env.local` `DATABASE_URL` is **prod**. No migration in WS5. Run vitest **one
  suite at a time, never concurrently** (corrupts the `esp32-sensor-breakout` fixture;
  `pnpm db:seed` restores).
- **`pnpm` is not on the Bash-tool PATH** (exit 127) — run pnpm via the **PowerShell** tool.
- **`"use server"` files export only async functions** (`learner-resources.ts`,
  `reference-assets.ts`).
- **Branch:** already on `feat/ws5-golden-reference` (off `main`; design doc committed). Do
  **not** branch again.
- **Local build gotcha:** the gitignored `scripts/_phase1.ts` trips local `pnpm build` (not
  CI) — sideline it for a true local-green build; stop `next dev` + `Remove-Item -Recurse
  -Force .next` before the build gate.
- **No merge without Josh's go-ahead.** Open the PR off main, verify CI `build | pass`
  explicitly, hand back.
- **OTD palette:** deep-space `#08090d` / command-gold `#c8963e` / signal-blue accent. Reuse
  the existing Tailwind tokens (`text-command-gold`, `text-signal-blue`, `text-status-green`,
  `border-panel-border`, `text-gold-dim`, `text-muted`, `glass-card`, etc.).

---

## Task 1: Pure assessor `src/lib/golden-reference.ts`

**Files:**
- Create: `src/lib/golden-reference.ts`
- Test: `src/lib/__tests__/golden-reference.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import {
  assessGoldenReference,
  type GoldenReferenceInput,
} from "@/lib/golden-reference";

const base: GoldenReferenceInput = {
  published: true,
  vetted: true,
  hasKicadStarter: true,
  hasReferenceGerbers: true,
  hasMeasurementsCsv: true,
};

describe("assessGoldenReference", () => {
  test("published + vetted → isGolden; all three present → complete", () => {
    const r = assessGoldenReference(base);
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.bundle).toHaveLength(3);
    expect(r.bundle.map((d) => d.key)).toEqual([
      "kicadStarter",
      "referenceGerbers",
      "measurementsCsv",
    ]);
  });

  test("not published → not golden (regardless of vetted)", () => {
    const r = assessGoldenReference({ ...base, published: false });
    expect(r.isGolden).toBe(false);
  });

  test("published but not vetted → not golden", () => {
    const r = assessGoldenReference({ ...base, vetted: false });
    expect(r.isGolden).toBe(false);
  });

  test("golden but a deliverable missing → isGolden stays true, complete false", () => {
    const r = assessGoldenReference({ ...base, hasMeasurementsCsv: false });
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.bundle.find((d) => d.key === "measurementsCsv")!.present).toBe(false);
  });

  test("isGolden never gates on the files (golden with zero deliverables)", () => {
    const r = assessGoldenReference({
      published: true,
      vetted: true,
      hasKicadStarter: false,
      hasReferenceGerbers: false,
      hasMeasurementsCsv: false,
    });
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

PowerShell: `pnpm vitest run src/lib/__tests__/golden-reference.test.ts`
Expected: FAIL — `Cannot find module '@/lib/golden-reference'`.

**Step 3: Write minimal implementation**

```ts
// Golden "definition of done" — a board is GOLDEN when its lesson is published
// AND vetted (assessLessonReadiness.vetted: real media everywhere + ≥1 BROUGHT_UP
// board). The golden SET is the bundle of three proven-board deliverables (KiCad
// starter / reference gerbers / bring-up measurements CSV) on the published
// revision. isGolden is NEVER gated on the files — `complete` (all three attached)
// is the separate "kit fully assembled" notion that drives the operator worklist.
// Pure + testable, mirroring board-readiness.ts / lesson-readiness.ts.

export interface GoldenReferenceInput {
  /** project.publishedRevisionId != null */
  published: boolean;
  /** assessLessonReadiness(...).vetted */
  vetted: boolean;
  /** BOM_EXPORT artifact present on the published revision */
  hasKicadStarter: boolean;
  /** GERBER_ZIP artifact present on the published revision */
  hasReferenceGerbers: boolean;
  /** BRINGUP_MEASUREMENTS_CSV artifact present on the published revision */
  hasMeasurementsCsv: boolean;
}

export type GoldenDeliverableKey =
  | "kicadStarter"
  | "referenceGerbers"
  | "measurementsCsv";

export interface GoldenDeliverable {
  key: GoldenDeliverableKey;
  label: string;
  present: boolean;
}

export interface GoldenReference {
  /** published && vetted — the derived golden status. NEVER gated on the files. */
  isGolden: boolean;
  bundle: GoldenDeliverable[];
  /** All three deliverables attached — the downloadable kit is fully assembled. */
  complete: boolean;
}

export function assessGoldenReference(
  input: GoldenReferenceInput,
): GoldenReference {
  const bundle: GoldenDeliverable[] = [
    {
      key: "kicadStarter",
      label: "KiCad starter",
      present: input.hasKicadStarter,
    },
    {
      key: "referenceGerbers",
      label: "Verified reference gerbers",
      present: input.hasReferenceGerbers,
    },
    {
      key: "measurementsCsv",
      label: "Bring-up measurements (CSV)",
      present: input.hasMeasurementsCsv,
    },
  ];
  return {
    isGolden: input.published && input.vetted,
    bundle,
    complete: bundle.every((d) => d.present),
  };
}
```

**Step 4: Run test to verify it passes**

PowerShell: `pnpm vitest run src/lib/__tests__/golden-reference.test.ts`
Expected: PASS (5 tests).

**Step 5: Commit**

```
git add src/lib/golden-reference.ts src/lib/__tests__/golden-reference.test.ts
git commit -m "feat(ws5): pure assessGoldenReference (published+vetted derived golden + kit-complete)"
```

---

## Task 2: Prisma-free mapper `src/lib/golden-reference-load.ts`

Mirrors `src/lib/board-readiness-load.ts` — keeps the pure lib DB-free. Derives the three
`has*` booleans from a list of file-backed artifact subkinds on the published revision, and
takes `vetted` precomputed (the page computes it via `assessLessonReadiness`).

**Files:**
- Create: `src/lib/golden-reference-load.ts`
- Test: `src/lib/__tests__/golden-reference-load.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { goldenReferenceFromRows } from "@/lib/golden-reference-load";

describe("goldenReferenceFromRows", () => {
  test("derives has* from the published-rev artifact subkinds", () => {
    const r = goldenReferenceFromRows({
      publishedRevisionId: "rev_1",
      vetted: true,
      publishedArtifactSubkinds: ["BOM_EXPORT", "GERBER_ZIP"],
    });
    expect(r.isGolden).toBe(true);
    expect(r.bundle.find((d) => d.key === "kicadStarter")!.present).toBe(true);
    expect(r.bundle.find((d) => d.key === "referenceGerbers")!.present).toBe(true);
    expect(r.bundle.find((d) => d.key === "measurementsCsv")!.present).toBe(false);
    expect(r.complete).toBe(false);
  });

  test("no published revision → not golden", () => {
    const r = goldenReferenceFromRows({
      publishedRevisionId: null,
      vetted: true,
      publishedArtifactSubkinds: [],
    });
    expect(r.isGolden).toBe(false);
  });

  test("all three subkinds present + vetted → golden + complete", () => {
    const r = goldenReferenceFromRows({
      publishedRevisionId: "rev_1",
      vetted: true,
      publishedArtifactSubkinds: [
        "BOM_EXPORT",
        "GERBER_ZIP",
        "BRINGUP_MEASUREMENTS_CSV",
      ],
    });
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

PowerShell: `pnpm vitest run src/lib/__tests__/golden-reference-load.test.ts`
Expected: FAIL — cannot find module.

**Step 3: Write minimal implementation**

```ts
// Maps loaded Prisma values → assessGoldenReference input. Kept OUT of the pure
// golden-reference.ts (DB-free, mirroring board-readiness-load.ts). `vetted` is
// precomputed by the caller (the complete page runs assessLessonReadiness);
// has* are derived from the file-backed artifact subkinds on the published rev.
import {
  assessGoldenReference,
  type GoldenReference,
} from "@/lib/golden-reference";

export interface GoldenReferenceRows {
  publishedRevisionId: string | null;
  vetted: boolean;
  /** subkinds of file-backed artifacts on the published revision */
  publishedArtifactSubkinds: string[];
}

export function goldenReferenceFromRows(
  rows: GoldenReferenceRows,
): GoldenReference {
  const has = (s: string) => rows.publishedArtifactSubkinds.includes(s);
  return assessGoldenReference({
    published: rows.publishedRevisionId != null,
    vetted: rows.vetted,
    hasKicadStarter: has("BOM_EXPORT"),
    hasReferenceGerbers: has("GERBER_ZIP"),
    hasMeasurementsCsv: has("BRINGUP_MEASUREMENTS_CSV"),
  });
}
```

**Step 4: Run test to verify it passes**

PowerShell: `pnpm vitest run src/lib/__tests__/golden-reference-load.test.ts`
Expected: PASS (3 tests).

**Step 5: Commit**

```
git add src/lib/golden-reference-load.ts src/lib/__tests__/golden-reference-load.test.ts
git commit -m "feat(ws5): goldenReferenceFromRows mapper (artifact subkinds → golden input)"
```

---

## Task 3: Generalize the resolver — bring-up measurements download

Add the third leg to the learner-download resolver + the `GuideActionButton` action map. No
test (server action hits R2 + `requireUser`; tsc-verified + in-browser).

**Files:**
- Modify: `src/lib/actions/learner-resources.ts`
- Modify: `src/components/guide/GuideActionButton.tsx`

**Step 1: `learner-resources.ts`** — widen the private resolver's subkind union and add the
new export. The private helper signature is currently
`getPublishedRevisionArtifactUrl(input, subkind: "BOM_EXPORT" | "GERBER_ZIP")`:

- Change the union to `"BOM_EXPORT" | "GERBER_ZIP" | "BRINGUP_MEASUREMENTS_CSV"`.
- Add, next to `getReferenceFilesUrl`:

```ts
// getBringupMeasurementsUrl returns a presigned download for the board's verified
// BRING-UP MEASUREMENTS — the BRINGUP_MEASUREMENTS_CSV artifact an admin attached to
// the published (frozen reference) revision: the proven expected/actual readings at
// each bring-up step, so a learner can check their own board against the golden one.
// Returns null until that set is uploaded. Same public-resource rule as the starter.
export async function getBringupMeasurementsUrl(
  input: unknown,
): Promise<string | null> {
  return getPublishedRevisionArtifactUrl(input, "BRINGUP_MEASUREMENTS_CSV");
}
```

**Step 2: `GuideActionButton.tsx`** — import `getBringupMeasurementsUrl` and add an `ACTIONS`
entry:

```ts
  downloadBringupMeasurements: {
    resolve: getBringupMeasurementsUrl,
    notReady: "The bring-up measurements aren't available for this board yet.",
  },
```

**Step 3: Verify tsc**

PowerShell: `pnpm tsc --noEmit`
Expected: clean.

**Step 4: Commit**

```
git add src/lib/actions/learner-resources.ts src/components/guide/GuideActionButton.tsx
git commit -m "feat(ws5): bring-up measurements download (resolver + GuideActionButton action)"
```

---

## Task 4: Generalize the uploader actions — `reference-assets.ts`

Generalize the freeze-exempt admin upload from GERBER_ZIP-only to a `kind`-discriminated
asset (gerbers | measurements). Keep every guard identical; only the subkind + home stage vary.
**Rename** the two exported actions to generic names and update the single call site (Task 5).

**Files:**
- Modify: `src/lib/actions/reference-assets.ts`

**Step 1: Add the config + `kind` to the schemas.** Near the top, replace the
`REF_STAGE` constant with a per-kind config and add `kind` to both schemas:

```ts
const ASSET_CONFIG = {
  gerbers: {
    subkind: "GERBER_ZIP",
    stage: "DRC_GERBER", // GERBER_ZIP's home stage (revision-allowed)
  },
  measurements: {
    subkind: "BRINGUP_MEASUREMENTS_CSV",
    stage: "BRINGUP", // bring-up data's home stage (revision-allowed)
  },
} as const;
type ReferenceAssetKind = keyof typeof ASSET_CONFIG;
const referenceAssetKind = z.enum(["gerbers", "measurements"]);
```

Add `kind: referenceAssetKind` to both `presignSchema` and `recordSchema`.

**Step 2: Rename + generalize the two actions.** Rename `createReferenceGerberUploadUrl` →
`createReferenceAssetUploadUrl` and `recordReferenceGerber` → `recordReferenceAsset`. Inside
each, after `const data = …Schema.parse(input)`, resolve the config and use it for stage +
subkind:

```ts
  const cfg = ASSET_CONFIG[data.kind as ReferenceAssetKind];
  // …in createReferenceAssetUploadUrl: use cfg.stage for artifactKey(...)
  const key = artifactKey({ kind: "revision", id: revisionId }, cfg.stage, cuid, data.filename);
  // …in recordReferenceAsset: use cfg.subkind for the artifact create
  //   stage: cfg.stage, subkind: cfg.subkind,
```

Everything else stays byte-for-byte: `requireAdmin`, `ensureR2Enabled`,
`publishedRevisionIdOrThrow`, the HEAD-verify-and-delete-orphan check, the `revalidatePath`
calls.

**Step 3: Update the file header** — change "the board's VERIFIED REFERENCE GERBERS" framing
to cover both reference gerbers and bring-up measurements, and update the "scoped tightly:
… GERBER_ZIP subkind only" line to "GERBER_ZIP or BRINGUP_MEASUREMENTS_CSV subkind only".

**Step 4: Verify tsc** (call sites will break until Task 5 — that's expected; confirm the
only errors are in `ReferenceGerberAdmin.tsx`).

PowerShell: `pnpm tsc --noEmit`
Expected: errors ONLY in `src/components/learn/ReferenceGerberAdmin.tsx` (stale import
names). Fixed in Task 5.

**Step 5: Commit** (with Task 5, since tsc isn't clean alone — OR commit after Task 5). Defer
the commit to the end of Task 5 so the tree is tsc-clean.

---

## Task 5: Generalize the admin uploader component

Turn `ReferenceGerberAdmin` into a `kind`-driven reusable uploader (`ReferenceAssetAdmin`)
driving the renamed actions. One component serves both gerbers and measurements.

**Files:**
- Rename/replace: `src/components/learn/ReferenceGerberAdmin.tsx` →
  `src/components/learn/ReferenceAssetAdmin.tsx`
- Modify: `src/app/learn/[slug]/complete/page.tsx` (import + props — refined in Task 7; for now
  just keep the gerber call site compiling)

**Step 1: Create `ReferenceAssetAdmin.tsx`** — same upload dance, parameterized:

```tsx
"use client";

// Admin-only affordance: attach/replace a freeze-exempt REFERENCE ASSET (verified
// reference gerbers OR bring-up measurements CSV) on the board's published revision.
// Mirrors the proof-upload dance but hits the freeze-exempt reference-asset actions.
// Learners never see this; the matching download CTA picks up the newest upload.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createReferenceAssetUploadUrl,
  recordReferenceAsset,
} from "@/lib/actions/reference-assets";

type Kind = "gerbers" | "measurements";

const COPY: Record<
  Kind,
  { noun: string; accept: string; defaultMime: string; chooseHint: string }
> = {
  gerbers: {
    noun: "gerbers",
    accept: ".zip,application/zip",
    defaultMime: "application/zip",
    chooseHint: "Choose a .zip first.",
  },
  measurements: {
    noun: "measurements",
    accept: ".csv,text/csv",
    defaultMime: "text/csv",
    chooseHint: "Choose a .csv first.",
  },
};

export function ReferenceAssetAdmin({
  kind,
  projectId,
  hasAsset,
  published,
}: {
  kind: Kind;
  projectId: string;
  hasAsset: boolean;
  published: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const copy = COPY[kind];

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(copy.chooseHint);
      return;
    }
    start(async () => {
      setError(null);
      setDone(false);
      try {
        const mime = file.type || copy.defaultMime;
        const presign = await createReferenceAssetUploadUrl({
          kind,
          projectId,
          filename: file.name,
          mime,
          sizeBytes: file.size,
        });
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": presign.mime },
          body: file,
        });
        if (!put.ok) throw new Error("Upload to storage failed — try again.");
        await recordReferenceAsset({
          kind,
          projectId,
          key: presign.key,
          filename: presign.filename,
          mime: presign.mime,
          sizeBytes: presign.sizeBytes,
        });
        setDone(true);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not upload.");
      }
    });
  }

  return (
    <section className="glass-card w-full border-signal-blue/30 p-5 text-left">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal-blue">
        Admin · {copy.noun}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        {!published
          ? "No published revision — publish this board first."
          : hasAsset
            ? `Verified ${copy.noun} attached. Upload a new file to replace.`
            : `No verified ${copy.noun} yet — learners see a placeholder until you attach them.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept={copy.accept}
          disabled={!published || pending}
          className="font-mono text-xs text-gray-2 file:mr-3 file:rounded file:border file:border-panel-border file:bg-navy-dark file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-command-gold disabled:opacity-50"
        />
        <button
          type="button"
          onClick={upload}
          disabled={!published || pending}
          className="inline-flex items-center gap-1.5 rounded border border-signal-blue bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:bg-signal-blue hover:text-deep-space disabled:opacity-50"
        >
          {pending ? "Uploading…" : hasAsset ? `↑ Replace ${copy.noun}` : `↑ Attach ${copy.noun}`}
        </button>
      </div>
      {done && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-status-green">
          ✓ Saved — learners can download it now.
        </p>
      )}
      {error && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </section>
  );
}
```

**Step 2: Delete the old file** `src/components/learn/ReferenceGerberAdmin.tsx` and update its
import in `app/learn/[slug]/complete/page.tsx`. (Task 7 rewires the JSX; for this task just
make the import resolve — temporarily render `<ReferenceAssetAdmin kind="gerbers" projectId={…}
hasAsset={hasGerbers} published={…} />` in place of the old `<ReferenceGerberAdmin …>`.)

**Step 3: Verify tsc**

PowerShell: `pnpm tsc --noEmit`
Expected: clean.

**Step 4: Commit** (covers Tasks 4 + 5)

```
git add src/lib/actions/reference-assets.ts src/components/learn/ReferenceAssetAdmin.tsx src/app/learn/[slug]/complete/page.tsx
git rm src/components/learn/ReferenceGerberAdmin.tsx
git commit -m "feat(ws5): generalize reference-asset upload to gerbers|measurements (kind-driven action + ReferenceAssetAdmin)"
```

---

## Task 6: `GoldenReferencePanel` component

Admin operator panel: golden-status headline + the three-item kit worklist with an inline
uploader per admin-uploadable deliverable. Mirrors `BoardReadinessPanel`.

**Files:**
- Create: `src/components/GoldenReferencePanel.tsx`

**Step 1: Implement** (presentational; the page passes the assessed `GoldenReference` + the
project id + published flag so the uploaders work):

```tsx
// Golden-reference operator panel for the Lesson Complete screen (WS5). Shows the
// derived golden verdict (published && vetted) + the three-deliverable "kit"
// worklist, with an inline freeze-exempt uploader for each admin-attachable leg
// (gerbers + measurements; the KiCad starter is generator-produced, surfaced as a
// present/missing indicator only). Admin-only. Mirrors BoardReadinessPanel.
import type { GoldenReference } from "@/lib/golden-reference";
import { ReferenceAssetAdmin } from "@/components/learn/ReferenceAssetAdmin";

// Which deliverables have a freeze-exempt admin uploader (the starter does not).
const UPLOAD_KIND: Record<string, "gerbers" | "measurements" | null> = {
  kicadStarter: null,
  referenceGerbers: "gerbers",
  measurementsCsv: "measurements",
};

export function GoldenReferencePanel({
  golden,
  projectId,
  published,
}: {
  golden: GoldenReference;
  projectId: string;
  published: boolean;
}) {
  const verdict = golden.isGolden
    ? "✓ Golden reference"
    : published
      ? "Not golden yet — needs vetted (real media everywhere + a brought-up board)"
      : "Not golden yet — not published";
  const kitCount = golden.bundle.filter((d) => d.present).length;

  return (
    <section className="w-full max-w-2xl rounded-xl border border-panel-border p-5 text-left [background:linear-gradient(180deg,#13131f_0%,#0d0e14_100%)]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-gold-dim">
          Golden reference
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          admin · proven-kit handoff
        </span>
      </div>

      <div
        className={`mt-4 rounded-lg border px-4 py-3 ${
          golden.isGolden
            ? "border-status-green/50 bg-status-green/5"
            : "border-panel-border bg-panel-border/5"
        }`}
      >
        <span
          className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${
            golden.isGolden ? "text-status-green" : "text-gray-2"
          }`}
        >
          {verdict}
        </span>
        <p className="mt-1 font-serif text-xs italic text-muted">
          Golden = published &amp; vetted · kit {kitCount}/3 deliverables attached
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {golden.bundle.map((d) => {
          const uploadKind = UPLOAD_KIND[d.key];
          return (
            <li key={d.key} className="space-y-2">
              <div className="flex items-baseline gap-2 font-mono text-xs">
                <span
                  className={`w-3 shrink-0 font-bold ${
                    d.present ? "text-status-green" : "text-muted"
                  }`}
                >
                  {d.present ? "✓" : "○"}
                </span>
                <span className="text-gray-1">{d.label}</span>
                <span className="text-muted">
                  — {d.present ? "attached" : uploadKind ? "attach below" : "generate via the KiCad export flow"}
                </span>
              </div>
              {uploadKind ? (
                <ReferenceAssetAdmin
                  kind={uploadKind}
                  projectId={projectId}
                  hasAsset={d.present}
                  published={published}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

**Step 2: Verify tsc**

PowerShell: `pnpm tsc --noEmit`
Expected: clean.

**Step 3: Commit**

```
git add src/components/GoldenReferencePanel.tsx
git commit -m "feat(ws5): GoldenReferencePanel — golden verdict + kit worklist + inline uploaders"
```

---

## Task 7: Wire the complete screen — learner kit + admin panel

Replace the gerbers-only "Order the proven board" block with the consolidated **Proven board
kit** (learner) + the **GoldenReferencePanel** (admin). Compute the three `has*` from one
artifact query (always); compute `vetted` + the full `GoldenReference` admin-only.

**Files:**
- Modify: `src/app/learn/[slug]/complete/page.tsx`

**Step 1: Replace the single `GERBER_ZIP` lookup** (currently `page.tsx:79-89`) with a query
of **all** file-backed golden-deliverable subkinds on the published revision:

```ts
  // Golden-set deliverables on the published revision (file-backed). One query
  // drives both the learner "Proven board kit" downloads and the admin panel.
  const goldenSubkinds = ["BOM_EXPORT", "GERBER_ZIP", "BRINGUP_MEASUREMENTS_CSV"] as const;
  const goldenArtifacts = project.publishedRevisionId
    ? await db.artifact.findMany({
        where: {
          revisionId: project.publishedRevisionId,
          subkind: { in: [...goldenSubkinds] },
          fileKey: { not: null },
        },
        select: { subkind: true },
      })
    : [];
  const presentSubkinds = new Set(goldenArtifacts.map((a) => a.subkind));
  const hasKicadStarter = presentSubkinds.has("BOM_EXPORT");
  const hasGerbers = presentSubkinds.has("GERBER_ZIP");
  const hasMeasurements = presentSubkinds.has("BRINGUP_MEASUREMENTS_CSV");
```

**Step 2: Compute the full `GoldenReference` admin-only** (vetted needs the guide cards + exam
+ board count — mirror the guide hub's block; do it only when `isAdmin` so learners don't pay
for it). Add after Step 1:

```ts
  // Operator golden verdict (admin-only): vetted needs the published rev's guide
  // cards + exam + brought-up board count. Mirrors the guide-hub readiness load.
  let golden: GoldenReference | null = null;
  if (isAdmin) {
    let vetted = false;
    if (project.publishedRevisionId) {
      const [blockRows, broughtUpBoards] = await Promise.all([
        db.guideCard.findMany({
          where: { guide: { revisionId: project.publishedRevisionId } },
          orderBy: { ordinal: "asc" },
          select: { stage: true, contentBlocks: true },
        }),
        db.board.count({
          where: {
            status: "BROUGHT_UP",
            build: { revision: { projectId: project.id } },
          },
        }),
      ]);
      const parsedCards = blockRows.map((c) => ({
        stage: c.stage as string,
        blocks: guideContentBlocksSchema.safeParse(c.contentBlocks).data ?? [],
      }));
      const examQuestions = Array.isArray(exam?.questions)
        ? (exam.questions as unknown[]).length
        : 0;
      vetted = assessLessonReadiness({
        stages: GUIDE_STAGES,
        cards: parsedCards,
        exam: exam ? { questions: examQuestions } : null,
        broughtUpBoards,
        published: project.publishedRevisionId != null,
      }).vetted;
    }
    golden = goldenReferenceFromRows({
      publishedRevisionId: project.publishedRevisionId,
      vetted,
      publishedArtifactSubkinds: [...presentSubkinds],
    });
  }
```

New imports at the top of the file:

```ts
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { assessLessonReadiness, type LessonReadiness } from "@/lib/lesson-readiness";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";
import { goldenReferenceFromRows } from "@/lib/golden-reference-load";
import { type GoldenReference } from "@/lib/golden-reference";
import { GoldenReferencePanel } from "@/components/GoldenReferencePanel";
import { ReferenceAssetAdmin } from "@/components/learn/ReferenceAssetAdmin";
```

> Note: `getExam(project.id)` is already called as `exam` earlier in the file
> (`page.tsx:56`); reuse it — don't re-query. Drop the temporary `ReferenceAssetAdmin
> kind="gerbers"` shim from Task 5 here.

**Step 3: Replace the JSX block** (currently `page.tsx:220-248`, the "Verified reference
gerbers" `<div>`) with the Proven board kit + admin panel:

```tsx
      {/* ─── Proven board kit — the golden-set bundle ─── */}
      <div
        className="signin-rise flex w-full max-w-2xl flex-col items-center gap-3"
        style={{ animationDelay: "300ms" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
          // Proven board kit
        </span>
        <p className="font-serif text-sm italic text-muted">
          The exact files behind the board we built and brought up — download them
          to order or check your own.
        </p>

        {/* KiCad starter */}
        {hasKicadStarter ? (
          <GuideActionButton
            action="downloadKicadStarter"
            label="Download KiCad starter"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            KiCad starter — coming soon.
          </p>
        )}

        {/* Verified reference gerbers */}
        {hasGerbers ? (
          <GuideActionButton
            action="downloadReferenceFiles"
            label="Download verified reference gerbers"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Verified reference gerbers — coming soon.
          </p>
        )}

        {/* Bring-up measurements CSV */}
        {hasMeasurements ? (
          <GuideActionButton
            action="downloadBringupMeasurements"
            label="Download bring-up measurements"
            projectId={project.id}
            isSignedIn
          />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Bring-up measurements — coming soon.
          </p>
        )}
      </div>

      {/* Admin golden-reference panel — status + kit worklist + uploaders */}
      {isAdmin && golden && (
        <div className="signin-rise w-full max-w-2xl" style={{ animationDelay: "305ms" }}>
          <GoldenReferencePanel
            golden={golden}
            projectId={project.id}
            published={!!project.publishedRevisionId}
          />
        </div>
      )}
```

Also delete the now-unused `GuideActionButton` import note? No — `GuideActionButton` is still
imported (it already is at `page.tsx:13`). Remove the stale `ReferenceGerberAdmin` import if it
still lingers from Task 5.

**Step 4: Verify tsc**

PowerShell: `pnpm tsc --noEmit`
Expected: clean. (`LessonReadiness` import may be unused — drop it if tsc/eslint flags it; keep
only `assessLessonReadiness` + the types actually referenced.)

**Step 5: Commit**

```
git add src/app/learn/[slug]/complete/page.tsx
git commit -m "feat(ws5): Proven board kit + admin GoldenReferencePanel on the complete screen"
```

---

## Task 8: Full verification + PR

**Step 1: tsc**

PowerShell: `pnpm tsc --noEmit` → clean.

**Step 2: Full vitest (ONE run, never concurrent)**

PowerShell: `pnpm vitest run`
Expected: all green (existing suite + the two new pure test files). If the run is interrupted,
do NOT start a second concurrent run — wait, then re-run once. If the `esp32-sensor-breakout`
fixture looks corrupted, `pnpm db:seed` to restore, then re-run.

**Step 3: Build (sideline the scratch file; clean .next)**

PowerShell:
- Stop any running `next dev`.
- `Remove-Item -Recurse -Force .next`
- Temporarily move `scripts/_phase1.ts` aside (it's gitignored; not in CI).
- `pnpm build` → expect a successful production build.
- Restore `scripts/_phase1.ts`.

**Step 4: Push + open PR off main**

```
git push -u origin feat/ws5-golden-reference
gh pr create --base main --title "feat(ws5): golden reference + team-build handoff" --body "<summary>"
```

PR body: the golden-set bundle (derived golden = published+vetted, no schema), the three
uniform deliverables, the two complete-screen surfaces, what's explicitly out (errata, promote
action, dashboard pill). Note the remote-moved gotcha if a push/branch op needs the canonical
URL `https://github.com/Otd-llc/otd-academy.git`.

**Step 5: Verify CI `build | pass` EXPLICITLY**

`gh pr checks <pr#> --watch` — then confirm the `build` check shows **pass** (exit 0 ≠ build
pass on this repo; read the explicit `build | pass` line). Hand back to Josh for local
verification + merge (do NOT merge).

**Step 6: In-browser verification (as raven/admin + a finished learner)**

- Admin on `/learn/<slug>/complete`: `GoldenReferencePanel` shows the right verdict; the kit
  worklist lists 3 deliverables; upload a measurements `.csv` → it flips to ✓ present + the
  learner "Bring-up measurements" button appears.
- Finished learner: the "Proven board kit" shows the three downloads (real when attached,
  "coming soon" otherwise).

---

## Out of scope (do not build)

- No schema / migration. No errata changes. No explicit promote-to-golden action / `goldenAt`
  field. No new media-capture machinery. No move of the existing per-stage download buttons.
  No public dashboard / guide-hub golden pill. No KiCad-starter uploader (generator-produced).
