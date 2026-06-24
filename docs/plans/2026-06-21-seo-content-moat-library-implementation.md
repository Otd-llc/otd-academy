# SEO Content Moat — Library / Mini-Lesson Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up the public `/library/<slug>` mini-lesson backend, then publish the `motor-imagery-bci` page carrying the "Embodied Motor Imagery" (EMI) vocabulary moat — proving the whole pipeline end-to-end before fanning out the EEG cluster.

**Architecture:** Brownfield. The teaching UI (`GuideBlocks` renderer, content-block Zod union, `BlockListEditor`), glossary `[[term]]` popovers, JSON-LD/`<JsonLd>`/sitemap helpers, `AccessTier`, and middleware path-gating ALL exist. The net-new work is: (1) one new `youtube` content block, (2) a lightweight `MiniLesson` model + `ProjectMiniLesson` join, (3) a public `/library/<slug>` route + index + admin authoring route that REUSE the existing renderer/editor, (4) three new pure JSON-LD builders (`TechArticle`, `LearningResource`, `DefinedTerm`), and (5) the EMI glossary term + content. NOT a new teaching system.

**Tech Stack:** Next.js App Router (RSC), Prisma + Neon Postgres (hand-authored migrations via `prisma migrate deploy`), Zod 4, Tailwind, Vitest (isolated Neon branch pool). pnpm via PowerShell.

---

## Locked decisions (do not re-litigate)

1. **Route namespace: `/library/<slug>`.** EMI canonical = `/library/motor-imagery-bci`. (Single public prefix → one clean `isPublicPath` rule; avoids a root catch-all that can't be prefix-gated. SEO depth delta is negligible.)
2. **`MiniLesson ↔ Project` relation: a `ProjectMiniLesson` join table** with a `MiniLessonLinkRole` discriminator (`SUPPORTING` = article→quest up-link; `DOWN_FUNNEL` = article→gated-build CTA). Bidirectional, ordered.
3. **Glossary hosting: Option A.** EMI is added to `src/lib/glossary.ts`; the `motor-imagery-bci` page is its long-form home and carries the `DefinedTerm` JSON-LD. No standalone `/glossary/<term>` page in this cut; a thin `/glossary` index is a Phase B optional task (so `DefinedTermSet.url` resolves).
4. **Down-funnel CTAs degrade to the waitlist** when the target build (L3.01 / L3.05) is unpublished — never dead-link.
5. **Library block allowlist:** `prose, callout, steps, table, image, quiz, sourceRef, deepDive, termRef, vendorCta, youtube`. EXCLUDED (project/enrollment-coupled): `partModel, bomTable, action, kit, video` (the mp4 capture block — Library uses YouTube).

## Guardrails (from the source docs + repo memory — keep in view every task)

- **`.env.local` `DATABASE_URL` is PROD.** Migrations: hand-author / `prisma migrate diff`-generate the SQL, apply with `pnpm exec prisma migrate deploy` (NEVER `migrate dev`). Restart `next dev` after `prisma generate`.
- **Tests** run against the isolated Neon branch pool (needs `.env.test.local`); each DB-test file gets its own branch, so throwaway rows are safe. `pnpm test` ≈ 80s. Run via PowerShell, not the Bash tool.
- **Render-verify by loading the PAGE logged-out**, not just the DB write — `contentBlocks` safeParse renders a blank card on ANY failure.
- **`"use server"` files export ONLY async fns** — put pure builders (JSON-LD, allowlist) in plain modules.
- **"Mini" ≠ thin.** Each page must carry first-hand value (tested steps, "gotchas", original diagrams). Volume trips Google's scaled-content-abuse policy. Schema is hygiene, not ranking lift — don't over-invest.
- **DISCLOSURE GUARDRAIL (locked 2026-06-22) — generic education only.** The academy Library teaches the *general field* (textbook EEG/BCI/AFE) and nothing proprietary. KEEP OFF every public page: OTD's coined moat (**Embodied Motor Imagery / EMI, "vectorial intent", "1:N supervisory", the target operator cohorts, "read the brain command the swarm"**); the *recipe* (signal features, classifier arch/params, calibration); the *research program* (whitepaper H1–H4, quantitative results) + the *data-flywheel / regulatory-arbitrage strategy* framing; and the *actual OTD-AFE-001A / paid-build design* (that's the gated L3.01 lesson). The moat lives ONLY on apex + whitepaper. Don't emit a moat `DefinedTerm`, don't add moat terms to `src/lib/glossary.ts`. Why: IP protection + free-vs-paid keyword separation + trust/E-E-A-T (a page that reads as a GTM funnel loses both). See memory `academy-library-disclosure-policy`.
- **Branch off `main`. No `gh pr merge` without Josh's explicit go-ahead** (he verifies every feature locally first).

---

## Phase A — Library / mini-lesson backend

### Task A1: The `youtube` content block (schema)

**Files:**
- Modify: `src/lib/schemas/guide.ts` (add a variant to `contentBlockSchema`, the discriminated union at lines 20–185)
- Test: `src/lib/schemas/guide.test.ts` (create if absent; else append)

**Step 1: Write the failing test**

```ts
// src/lib/schemas/guide.test.ts
import { describe, expect, it } from "vitest";
import { contentBlockSchema } from "@/lib/schemas/guide";

describe("youtube content block", () => {
  it("accepts a minimal valid youtube block", () => {
    const r = contentBlockSchema.safeParse({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "How the ADS1299 samples 8 channels",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an optional caption and start offset", () => {
    const r = contentBlockSchema.safeParse({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "Routing the EEG front-end",
      caption: "Full build at academy.onethousanddrones.com",
      start: 42,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty videoId", () => {
    const r = contentBlockSchema.safeParse({ type: "youtube", videoId: "", title: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects a videoId with URL/path characters (must be a bare id)", () => {
    const r = contentBlockSchema.safeParse({
      type: "youtube",
      videoId: "https://youtu.be/abc",
      title: "x",
    });
    expect(r.success).toBe(false);
  });
});
```

**Step 2: Run it, expect FAIL**

Run: `pnpm exec vitest run src/lib/schemas/guide.test.ts` → FAIL (`Invalid discriminator value` — `youtube` not in the union).

**Step 3: Add the block variant**

Insert this object into the `contentBlockSchema` discriminated union in `src/lib/schemas/guide.ts` (place it right after the `video` block, ~line 97, so the "moving image" blocks sit together):

```ts
  // youtube — a privacy-enhanced (youtube-nocookie), lazy-loaded embed for the
  // public Library / marketing surface (the in-build mp4 `video` block stays for
  // captured footage). Stores ONLY the bare video id (not a URL) — the renderer
  // builds the youtube-nocookie embed src — so there is no URL-parsing / SSRF
  // surface and the id can't smuggle query params. `title` is required (iframe
  // a11y title + default caption). `start` is an optional seconds offset.
  z.object({
    type: z.literal("youtube"),
    videoId: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(/^[A-Za-z0-9_-]+$/, "videoId must be a bare YouTube id"),
    title: z.string().trim().min(1).max(200),
    caption: z.string().max(200).optional(),
    start: z.int().nonnegative().optional(),
  }),
```

**Step 4: Run the test, expect PASS**

Run: `pnpm exec vitest run src/lib/schemas/guide.test.ts` → PASS.

**Step 5: Run `tsc` (the union type changed — `ContentBlock` consumers must still compile)**

Run: `pnpm exec tsc --noEmit` → no errors. (Per repo memory: a content-block union change can break enum-mirror maps / exhaustiveness switches that the task's own tests miss — `GuideBlocks.tsx`'s block dispatch is the likely site; A2's renderer task adds the `youtube` case, but `tsc` must be clean first.)

**Step 6: Commit**

```bash
git add src/lib/schemas/guide.ts src/lib/schemas/guide.test.ts
git commit -m "feat(guide): add youtube content block to the block schema"
```

---

### Task A2: The `youtube` block renderer (lazy facade)

**Files:**
- Create: `src/components/guide/YouTubeEmbed.tsx` (client facade island)
- Modify: `src/components/guide/GuideBlocks.tsx` (add the `youtube` case to the `GuideBlock` dispatch, ~line 1207 where `partModel`/`bomTable`/etc. are handled)
- Test: manual render-verify (client interaction) — see Step 4

**Step 1: Write the facade island**

A click-to-load facade keeps YouTube's heavy JS off the initial load (Core Web Vitals — the source docs require lazy-loading). It renders the thumbnail + a play button; the iframe is injected only on click.

```tsx
// src/components/guide/YouTubeEmbed.tsx
"use client";

import { useState } from "react";

// Privacy-enhanced, click-to-load YouTube facade. Until the learner clicks, we
// render only the static thumbnail (one image request) — no youtube.com JS — so
// a Library page with several embeds stays fast (CWV). On click we swap in the
// youtube-nocookie iframe with autoplay. `videoId` is a bare, schema-validated id.
export function YouTubeEmbed({
  videoId,
  title,
  start,
}: {
  videoId: string;
  title: string;
  start?: number;
}) {
  const [active, setActive] = useState(false);
  const startParam = start ? `&start=${start}` : "";
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-panel-border bg-black">
      {active ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0${startParam}`}
          title={title}
          loading="lazy"
          allow="accelerator; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 flex h-full w-full items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-command-gold/90 text-black shadow-lg transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
```

> Note: confirm `allow="accelerometer; ..."` spelling — the standard token is `accelerometer` (the snippet above has a typo placeholder `accelerator`; use `accelerometer`). Final: `allow="accelerometer; autoplay; encrypted-media; picture-in-picture"`.

**Step 2: Add the renderer case**

In `src/components/guide/GuideBlocks.tsx`, in the `GuideBlock` switch where each `block.type` is dispatched (the block immediately after the `video` case is a good home), add:

```tsx
  if (block.type === "youtube") {
    return (
      <figure className="my-6">
        <YouTubeEmbed videoId={block.videoId} title={block.title} start={block.start} />
        {(block.caption || block.title) && (
          <figcaption className="mt-2 text-center font-mono text-xs uppercase tracking-wider text-muted">
            {block.caption ?? block.title}
          </figcaption>
        )}
      </figure>
    );
  }
```

Add the import at the top of `GuideBlocks.tsx`: `import { YouTubeEmbed } from "@/components/guide/YouTubeEmbed";`

**Step 3: Run `tsc`**

Run: `pnpm exec tsc --noEmit` → clean. (The switch is now exhaustive over the union including `youtube`.)

**Step 4: Render-verify (deferred to A5)**

The block can't be seen until a page renders it; verification happens when the `/library/<slug>` route exists (Task A5) and again on the real EMI page (Phase B). No standalone harness — note this in the executing-plans batch report.

**Step 5: Commit**

```bash
git add src/components/guide/YouTubeEmbed.tsx src/components/guide/GuideBlocks.tsx
git commit -m "feat(guide): render the youtube block as a lazy click-to-load facade"
```

---

### Task A3: Library block allowlist (pure guard)

The `MiniLesson` reuses `guideContentBlocksSchema`, but a mini-lesson must NOT carry project-coupled blocks (`partModel`, `bomTable`, `action`, `kit`, mp4 `video`). This pure predicate is the authoring-time + render-time guard.

**Files:**
- Create: `src/lib/library/block-allowlist.ts`
- Test: `src/lib/library/block-allowlist.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/library/block-allowlist.test.ts
import { describe, expect, it } from "vitest";
import {
  LIBRARY_BLOCK_TYPES,
  isLibraryBlock,
  filterLibraryBlocks,
} from "@/lib/library/block-allowlist";
import type { ContentBlock } from "@/lib/schemas/guide";

describe("library block allowlist", () => {
  it("allows the public-safe block types", () => {
    for (const t of ["prose", "callout", "steps", "table", "image", "quiz", "sourceRef", "deepDive", "termRef", "vendorCta", "youtube"]) {
      expect(LIBRARY_BLOCK_TYPES.has(t)).toBe(true);
    }
  });

  it("excludes project/enrollment-coupled block types", () => {
    for (const t of ["partModel", "bomTable", "action", "kit", "video"]) {
      expect(LIBRARY_BLOCK_TYPES.has(t)).toBe(false);
    }
  });

  it("filterLibraryBlocks drops disallowed blocks, preserves order", () => {
    const blocks = [
      { type: "prose", md: "hi" },
      { type: "bomTable" },
      { type: "youtube", videoId: "abc", title: "t" },
    ] as ContentBlock[];
    const kept = filterLibraryBlocks(blocks);
    expect(kept.map((b) => b.type)).toEqual(["prose", "youtube"]);
  });

  it("isLibraryBlock narrows a single block", () => {
    expect(isLibraryBlock({ type: "kit", items: [] } as unknown as ContentBlock)).toBe(false);
    expect(isLibraryBlock({ type: "prose", md: "x" } as ContentBlock)).toBe(true);
  });
});
```

**Step 2: Run it, expect FAIL** — `pnpm exec vitest run src/lib/library/block-allowlist.test.ts` (module not found).

**Step 3: Implement**

```ts
// src/lib/library/block-allowlist.ts
//
// The subset of content-block types valid on a public Library mini-lesson.
// `GuideBlocks` is shared with the project guide, where blocks like partModel /
// bomTable / action / kit / mp4 video resolve against project + enrollment
// context a standalone article does not have. This allowlist is the guard: the
// admin authoring route validates against it, and the public page filters
// through it (defense-in-depth — a bad row can't render a project-coupled block).
import type { ContentBlock } from "@/lib/schemas/guide";

export const LIBRARY_BLOCK_TYPES: ReadonlySet<string> = new Set([
  "prose",
  "callout",
  "steps",
  "table",
  "image",
  "quiz",
  "sourceRef",
  "deepDive",
  "termRef",
  "vendorCta",
  "youtube",
]);

export function isLibraryBlock(block: ContentBlock): boolean {
  return LIBRARY_BLOCK_TYPES.has(block.type);
}

export function filterLibraryBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter(isLibraryBlock);
}
```

**Step 4: Run the test, expect PASS.** **Step 5: `pnpm exec tsc --noEmit` clean.**

**Step 6: Commit**

```bash
git add src/lib/library/block-allowlist.ts src/lib/library/block-allowlist.test.ts
git commit -m "feat(library): add the public mini-lesson block allowlist"
```

---

### Task A4: New JSON-LD builders (TechArticle, LearningResource, DefinedTerm)

**Files:**
- Modify: `src/lib/seo/jsonld.ts` (append three pure builders, mirroring `courseJsonLd`/`productJsonLd`)
- Test: `src/lib/seo/jsonld.test.ts` (create if absent; else append)

**Step 1: Write the failing test**

```ts
// src/lib/seo/jsonld.test.ts (append)
import { describe, expect, it } from "vitest";
import { techArticleJsonLd, learningResourceJsonLd, definedTermJsonLd } from "@/lib/seo/jsonld";

describe("techArticleJsonLd", () => {
  it("emits an absolute url + headline and omits empty optionals", () => {
    const a = techArticleJsonLd({
      headline: "Motor Imagery & the Mu Rhythm",
      description: "How sensorimotor rhythms drive a BCI.",
      url: "https://academy.onethousanddrones.com/library/motor-imagery-bci",
      datePublished: "2026-06-21",
      dateModified: "2026-06-21",
      authorName: "One Thousand Drones",
    }) as Record<string, unknown>;
    expect(a["@type"]).toBe("TechArticle");
    expect(a.headline).toBe("Motor Imagery & the Mu Rhythm");
    expect(a.mainEntityOfPage).toBe("https://academy.onethousanddrones.com/library/motor-imagery-bci");
  });
  it("omits author when absent", () => {
    const a = techArticleJsonLd({ headline: "x", description: null, url: "https://e/x" }) as Record<string, unknown>;
    expect("author" in a).toBe(false);
    expect("description" in a).toBe(false);
  });
});

describe("learningResourceJsonLd", () => {
  it("emits a LearningResource with the name + url", () => {
    const r = learningResourceJsonLd({ name: "ADS1299 Explained", description: "d", url: "https://e/x", educationalLevel: "Beginner" }) as Record<string, unknown>;
    expect(r["@type"]).toBe("LearningResource");
    expect(r.educationalLevel).toBe("Beginner");
  });
});

describe("definedTermJsonLd", () => {
  it("emits a DefinedTerm with the term set + canonical url", () => {
    const d = definedTermJsonLd({
      name: "Embodied Motor Imagery",
      alternateName: "EMI",
      description: "OTD's overtrained-procedural-motor-program approach to BCI control.",
      url: "https://academy.onethousanddrones.com/library/motor-imagery-bci",
      termSetName: "One Thousand Drones BCI Glossary",
      termSetUrl: "https://academy.onethousanddrones.com/glossary",
    }) as Record<string, unknown>;
    expect(d["@type"]).toBe("DefinedTerm");
    expect(d.name).toBe("Embodied Motor Imagery");
    expect((d.inDefinedTermSet as Record<string, unknown>).url).toContain("/glossary");
  });
});
```

**Step 2: Run it, expect FAIL** — `pnpm exec vitest run src/lib/seo/jsonld.test.ts` (exports missing).

**Step 3: Implement (append to `src/lib/seo/jsonld.ts`)**

```ts
// TechArticle — a public Library mini-lesson as a technical article. Schema is
// SEO hygiene (no rich-result / ranking lift per the 2026-06 validation) — keep
// it minimal + accurate. PURE: takes resolved scalars, not a Prisma row.
export function techArticleJsonLd(input: {
  headline: string;
  description: string | null;
  url: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "TechArticle",
    headline: input.headline,
    mainEntityOfPage: input.url,
    publisher: PROVIDER,
    ...(input.description ? { description: input.description } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.authorName
      ? { author: { "@type": "Organization", name: input.authorName } }
      : {}),
  };
}

// LearningResource — the same page as an educational resource (pairs with the
// TechArticle; both are hygiene-level). `educationalLevel` omitted when absent.
export function learningResourceJsonLd(input: {
  name: string;
  description: string | null;
  url: string;
  educationalLevel?: string | null;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "LearningResource",
    name: input.name,
    url: input.url,
    provider: PROVIDER,
    ...(input.description ? { description: input.description } : {}),
    ...(input.educationalLevel ? { educationalLevel: input.educationalLevel } : {}),
  };
}

// DefinedTerm — claims authorship of a coined term (e.g. "Embodied Motor
// Imagery"). Emitted on ONE canonical page only; every other mention links to
// that url, none re-declare the schema (EMI doc §5).
export function definedTermJsonLd(input: {
  name: string;
  alternateName?: string;
  description: string;
  url: string;
  termSetName: string;
  termSetUrl: string;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "DefinedTerm",
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: input.termSetName,
      url: input.termSetUrl,
    },
  };
}
```

**Step 4: Run the test, expect PASS.** **Step 5: `pnpm exec tsc --noEmit` clean.**

**Step 6: Commit**

```bash
git add src/lib/seo/jsonld.ts src/lib/seo/jsonld.test.ts
git commit -m "feat(seo): add TechArticle / LearningResource / DefinedTerm JSON-LD builders"
```

---

### Task A5: `MiniLesson` + `ProjectMiniLesson` models + migration

**Files:**
- Modify: `prisma/schema.prisma` (add two models + one enum; add back-relations to `Project` and `User`)
- Create: `prisma/migrations/20260621120000_mini_lesson/migration.sql`

**Step 1: Add the schema**

Add the enum near the other enums (after `EntitlementSource`, ~line 813):

```prisma
// How a Library mini-lesson links to a Quest/Catalog Project.
//   SUPPORTING  = the article supports / explains this project (renders an up-link).
//   DOWN_FUNNEL = the article's end-of-page CTA into this gated build.
enum MiniLessonLinkRole {
  SUPPORTING
  DOWN_FUNNEL
}
```

Add the models (place after the `GuideCard` model, ~line 871):

```prisma
// A public, gate-less Library mini-lesson (content-model §2.1/§3). Reuses the
// guide content-block schema (`contentBlocks` Json, validated by
// guideContentBlocksSchema + the Library allowlist) and the GuideBlocks renderer
// — it just has no stages / gates / builds / enrollment. accessTier defaults
// PUBLIC (a gated SEO page earns nothing); the URL is gated by middleware, not
// the Entitlement paywall.
model MiniLesson {
  id             String              @id @default(cuid())
  slug           String              @unique
  title          String
  summary        String?
  contentBlocks  Json
  published      Boolean             @default(false)
  accessTier     AccessTier          @default(PUBLIC)
  seoTitle       String?
  seoDescription String?
  byline         String? // "last verified vs vX.Y on <date>" + author — first-hand-value signal
  lastVerifiedAt DateTime?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  createdById    String
  createdBy      User                @relation(fields: [createdById], references: [id], onDelete: Restrict)
  relatedProjects ProjectMiniLesson[]

  @@index([published])
}

// The MiniLesson ↔ Project (Quest node) link — the internal-linking spine.
model ProjectMiniLesson {
  id           String             @id @default(cuid())
  projectId    String
  project      Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  miniLessonId String
  miniLesson   MiniLesson         @relation(fields: [miniLessonId], references: [id], onDelete: Cascade)
  role         MiniLessonLinkRole @default(SUPPORTING)
  ordinal      Int                @default(0)
  createdAt    DateTime           @default(now())

  @@unique([projectId, miniLessonId, role])
  @@index([miniLessonId])
  @@index([projectId])
}
```

Add back-relations:
- In `model Project` (after `waitlist`, ~line 127): `miniLessons       ProjectMiniLesson[]`
- In `model User`: add `miniLessons MiniLesson[]` to its relation list (find the `User` model; mirror how `createdBy` back-relations are declared there).

**Step 2: Generate the migration SQL (non-interactive; does NOT touch prod)**

Run (PowerShell):

```
pnpm exec prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script | Out-File -Encoding utf8 prisma/migrations/20260621120000_mini_lesson/migration.sql
```

Create the directory first if needed. **Read the generated SQL** and sanity-check: it should `CREATE TYPE "MiniLessonLinkRole"`, `CREATE TABLE "MiniLesson"`, `CREATE TABLE "ProjectMiniLesson"`, the FKs (`createdById`→User, `projectId`→Project, `miniLessonId`→MiniLesson), the unique index on `slug` + `(projectId, miniLessonId, role)`, and the secondary indexes. It must NOT alter/drop any existing table. If the diff emits anything destructive, STOP and hand back to the maintainer.

**Step 3: Apply to the DB**

Run: `pnpm exec prisma migrate deploy` → "1 migration applied". Then `pnpm exec prisma generate`. **Restart `next dev`** (per repo memory: launch detached — `Start-Process pnpm.cmd 'dev' -WindowStyle Hidden` — a harness-backgrounded dev server dies on the next tool call).

**Step 4: Verify the client typed the model**

Run: `pnpm exec tsc --noEmit` → clean, and confirm `db.miniLesson` autocompletes (write a one-line throwaway `db.miniLesson.findMany` in a scratch and `tsc` it, then delete). 

**Step 5: Full suite (schema change — per repo memory run the WHOLE vitest, not just touched files)**

Run: `pnpm test` → green (≈80s on the branch pool). A schema/enum change can break enum-mirror fixtures elsewhere.

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260621120000_mini_lesson/
git commit -m "feat(library): add MiniLesson + ProjectMiniLesson models + migration"
```

---

### Task A6: Register `/library` as a public path (middleware gate)

**Files:**
- Modify: `src/lib/admin-routes.ts` (`isPublicPath`)
- Test: `src/lib/admin-routes.test.ts` (create if absent; else append)

**Step 1: Write the failing test**

```ts
// src/lib/admin-routes.test.ts (append)
import { describe, expect, it } from "vitest";
import { isPublicPath, isAdminOnlyPath } from "@/lib/admin-routes";

describe("library path gating", () => {
  it("the library index is public", () => {
    expect(isPublicPath("/library")).toBe(true);
  });
  it("a library article is public", () => {
    expect(isPublicPath("/library/motor-imagery-bci")).toBe(true);
  });
  it("the admin authoring route is NOT public and IS admin-only", () => {
    expect(isPublicPath("/admin/library")).toBe(false);
    expect(isAdminOnlyPath("/admin/library")).toBe(true); // already covered by the top==="admin" rule
  });
});
```

**Step 2: Run it, expect FAIL** (`/library` returns false today).

**Step 3: Implement** — in `isPublicPath`, before the final `return false;`:

```ts
  // The public Library (mini-lessons): index (/library) + every article
  // (/library/[slug]) are crawlable, anonymous-readable SEO pages. The admin
  // authoring surface lives under /admin/library (held back by isAdminOnlyPath's
  // top==="admin" rule), so the whole /library prefix is safe to expose.
  if (top === "library") return true;
```

(No `isAdminOnlyPath` change needed — authoring lives under `/admin/library`, already admin-only.)

**Step 4: Run the test, expect PASS.** **Step 5: `pnpm exec tsc --noEmit` clean.**

**Step 6: Commit**

```bash
git add src/lib/admin-routes.ts src/lib/admin-routes.test.ts
git commit -m "feat(library): gate /library as a public path"
```

---

### Task A7: The public `/library/[slug]` route

**Files:**
- Create: `src/app/library/[slug]/page.tsx`
- Create (helper): `src/lib/library/load.ts` (pure-ish DB loader, reused by index + sitemap)

**Step 1: Write the loader**

```ts
// src/lib/library/load.ts
import { db } from "@/lib/db";

// A published, public mini-lesson by slug — the public read path. Anonymous
// callers only ever see published + PUBLIC rows (the page enforces it; this
// keeps the query in one place). Returns null when missing/unpublished so the
// route 404s.
export async function loadPublicMiniLesson(slug: string) {
  return db.miniLesson.findFirst({
    where: { slug, published: true, accessTier: "PUBLIC" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      contentBlocks: true,
      seoTitle: true,
      seoDescription: true,
      byline: true,
      lastVerifiedAt: true,
      updatedAt: true,
      createdAt: true,
      relatedProjects: {
        orderBy: { ordinal: "asc" },
        select: {
          role: true,
          project: {
            select: {
              slug: true,
              name: true,
              publicTitle: true,
              tagline: true,
              accessTier: true,
              publishedRevisionId: true,
              publishedRevision: { select: { label: true } },
            },
          },
        },
      },
    },
  });
}

export async function listPublishedMiniLessons() {
  return db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, title: true, summary: true, updatedAt: true },
  });
}
```

**Step 2: Write the route**

Mirror the guide card page's structure (parse blocks → safeParse → `[]` on failure; emit `<JsonLd>`; render `<GuideBlocks>` with only the props the allowlisted blocks need). Down-funnel CTA degrades to waitlist (decision 4): a `DOWN_FUNNEL` project that is unpublished (`publishedRevisionId === null`) links to its `/courses/<slug>` waitlist/preview page instead of the guide.

```tsx
// src/app/library/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GuideBlocks } from "@/components/guide/GuideBlocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import {
  techArticleJsonLd,
  learningResourceJsonLd,
  breadcrumbJsonLd,
  siteUrl,
} from "@/lib/seo/jsonld";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { filterLibraryBlocks } from "@/lib/library/block-allowlist";
import { loadPublicMiniLesson } from "@/lib/library/load";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await loadPublicMiniLesson(slug);
  if (!lesson) return {};
  const url = `${siteUrl()}/library/${lesson.slug}`;
  const title = lesson.seoTitle ?? lesson.title;
  const description = lesson.seoDescription ?? lesson.summary ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LibraryArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const lesson = await loadPublicMiniLesson(slug);
  if (!lesson) notFound();

  // Parse + allowlist-filter (defense-in-depth: a project-coupled block can't
  // reach the renderer without project context).
  const parsed = guideContentBlocksSchema.safeParse(lesson.contentBlocks);
  const blocks = filterLibraryBlocks(parsed.success ? parsed.data : []);

  const base = siteUrl();
  const url = `${base}/library/${lesson.slug}`;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const articleLd = techArticleJsonLd({
    headline: lesson.title,
    description: lesson.summary,
    url,
    datePublished: iso(lesson.createdAt),
    dateModified: iso(lesson.updatedAt),
    authorName: lesson.byline ? undefined : "One Thousand Drones",
  });
  const learningLd = learningResourceJsonLd({ name: lesson.title, description: lesson.summary, url });
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${base}/` },
    { name: "Library", url: `${base}/library` },
    { name: lesson.title, url },
  ]);

  const upLinks = lesson.relatedProjects.filter((r) => r.role === "SUPPORTING");
  const downFunnel = lesson.relatedProjects.filter((r) => r.role === "DOWN_FUNNEL");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={articleLd} />
      <JsonLd data={learningLd} />
      <JsonLd data={crumbLd} />
      <PageHeader
        backHref="/library"
        backLabel="Library"
        eyebrow="LIBRARY"
        title={lesson.title}
        lead={lesson.summary ?? undefined}
      />

      <GuideBlocks blocks={blocks} isSignedIn={false} />

      {lesson.byline && (
        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">{lesson.byline}</p>
      )}

      {upLinks.length > 0 && (
        <nav className="mt-8 border-t border-panel-border pt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gray-3">Part of the path</p>
          <ul className="space-y-1">
            {upLinks.map((r) => (
              <li key={r.project.slug}>
                <Link className="text-command-gold hover:underline" href={`/courses/${r.project.slug}`}>
                  {r.project.publicTitle ?? r.project.name} →
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {downFunnel.length > 0 && (
        <section className="mt-8 rounded-md border border-command-gold/40 bg-command-gold/5 p-5">
          {downFunnel.map((r) => {
            const published = r.project.publishedRevisionId !== null && r.project.publishedRevision;
            // Degrade to the waitlist/preview when the build isn't live (decision 4).
            const href = published
              ? `/projects/${r.project.slug}/${encodeURIComponent(r.project.publishedRevision!.label)}/guide`
              : `/courses/${r.project.slug}`;
            return (
              <div key={r.project.slug} className="flex flex-col gap-2">
                <p className="font-mono text-xs uppercase tracking-wider text-muted">
                  {published ? "Build it" : "Coming soon"}
                </p>
                <Link href={href} className="text-lg font-semibold text-command-gold hover:underline">
                  {r.project.publicTitle ?? r.project.name} →
                </Link>
                {r.project.tagline && <p className="text-sm text-muted">{r.project.tagline}</p>}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
```

**Step 3: `pnpm exec tsc --noEmit` clean.**

**Step 4: Render-verify (manual, logged-out) — deferred until a real row exists.** This is the first place the `youtube` block + the page render. Seed a throwaway published MiniLesson (a short prose + one youtube block) via a direct-Prisma scratch script (server actions can't be scripted — repo memory), then load `http://localhost:3000/library/<slug>` in a **logged-out** browser. Confirm: prose renders, the YouTube facade shows + plays on click, no blank-card, View-Source shows the three `application/ld+json` scripts. Delete the throwaway row. (The canonical render-verify is the real EMI page in Phase B.)

**Step 5: Commit**

```bash
git add src/app/library/[slug]/page.tsx src/lib/library/load.ts
git commit -m "feat(library): public /library/[slug] article route with JSON-LD + CTA degradation"
```

---

### Task A8: The Library index `/library`

**Files:**
- Create: `src/app/library/page.tsx`

A simple server-rendered, searchable list of published mini-lessons (reuse `listPublishedMiniLessons`). Emit `ItemList` JSON-LD (reuse `courseListJsonLd`-style — or add a generic `itemListJsonLd`; `courseListJsonLd` already produces a plain `ItemList`, so reuse it). Client-side filter box is optional (YAGNI for v1 — start with a static list ordered by `updatedAt`; add search only when the list grows). Add `<JsonLd>` + `PageHeader`. `export const dynamic = "force-dynamic"`.

Verify: load `/library` logged-out → the seeded/real articles list; links resolve. Commit `feat(library): browsable /library index`.

---

### Task A9: Admin authoring route (reuse `BlockListEditor`)

**Files:**
- Create: `src/app/admin/library/page.tsx` (list + "new")
- Create: `src/app/admin/library/[id]/page.tsx` (edit one)
- Create: `src/lib/actions/mini-lesson.ts` (`"use server"` — async-only: `createMiniLesson`, `saveMiniLesson`, `publishMiniLesson`), each `requireAdmin()` first
- Create: `src/lib/schemas/mini-lesson.ts` (Zod input — `slug`, `title`, `summary`, `seoTitle`, `seoDescription`, `byline`, `relatedProjects[]`, and `contentBlocks` validated by `guideContentBlocksSchema` **then** rejected if any block fails `isLibraryBlock`)

Pattern-match the existing guide-card authoring (`saveGuideCard` in `src/lib/actions/guides-form.ts` + `BlockListEditor` usage). The editor component is `src/components/guide/BlockListEditor.tsx` — reuse as-is; the only delta is the allowlist guard in the schema:

```ts
// in src/lib/schemas/mini-lesson.ts
import { z } from "zod";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";

const libraryBlocksSchema = guideContentBlocksSchema.refine(
  (blocks) => blocks.every((b) => LIBRARY_BLOCK_TYPES.has(b.type)),
  "Library mini-lessons may not use project-coupled blocks (partModel/bomTable/action/kit/video).",
);

export const miniLessonInputSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().max(400).nullable().optional(),
  seoTitle: z.string().max(70).nullable().optional(),
  seoDescription: z.string().max(200).nullable().optional(),
  byline: z.string().max(200).nullable().optional(),
  contentBlocks: libraryBlocksSchema,
  relatedProjects: z
    .array(z.object({ projectSlug: z.string(), role: z.enum(["SUPPORTING", "DOWN_FUNNEL"]), ordinal: z.int().nonnegative().default(0) }))
    .max(20)
    .optional(),
});
```

Write a unit test for `miniLessonInputSchema` (rejects a `bomTable` block; accepts a `youtube`+`prose` set; rejects a non-kebab slug). TDD: test first → fail → implement → pass. Wire `lastVerifiedAt = now()` on publish in the action. `tsc` + targeted vitest green. Commit `feat(library): admin authoring route + create/save/publish actions`.

---

### Task A10: Internal-linking polish + sitemap inclusion

**Files:**
- Modify: `src/app/sitemap.ts` (add published public mini-lessons)

**Step 1:** In `sitemap.ts`, add a third parallel query and emit entries:

```ts
// add to the Promise.all destructure:
const [projects, parts, miniLessons] = await Promise.all([
  /* ...existing projects query... */,
  /* ...existing parts query... */,
  db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    select: { slug: true, updatedAt: true },
  }),
]);

// after the parts loop, before/after the projects loop:
entries.push({ url: `${base}/library`, lastModified });
for (const ml of miniLessons) {
  entries.push({ url: `${base}/library/${ml.slug}`, lastModified: ml.updatedAt });
}
```

**Step 2:** `pnpm exec tsc --noEmit` clean. Load `/sitemap.xml` (dev) → `/library` + each article URL present. (Update the sitemap's top-of-file doc comment to mention the Library URLs.)

**Step 3:** Commit `feat(library): include public mini-lessons in the sitemap`.

> Phase A exit: the pipeline is real and crawlable. No page is published yet beyond throwaway verification rows — that's Phase B/C content.

---

## Phase B — EMI vocabulary moat (do alongside the first real page)

### Task B1: Add "Embodied Motor Imagery" to the glossary

**Files:**
- Modify: `src/lib/glossary.ts` (add the canonical entry + aliases)
- Test: `src/lib/glossary.test.ts` (append — mirror existing lookup tests)

Add to `GLOSSARY` (use the **verbatim short definition** from the EMI doc §2 — never paraphrase the spelling):

```ts
  "embodied motor imagery": {
    term: "Embodied Motor Imagery",
    def: "The mental rehearsal of deeply-grooved, overtrained procedural movements — the kind forged through thousands of hours of bilateral physical skill — used as a high-signal, low-variance input for brain-computer control.",
  },
```

Add aliases (in the alias table, mapping variants → the canonical key) for `"emi"` → `"embodied motor imagery"`. Per the EMI doc style guide, do NOT alias loose variants ("embodied imagery", "grooved imagery") — one spelling only; an un-aliased variant SHOULD miss (degrade to plain text), which enforces correct usage.

Test: `lookupTerm("Embodied Motor Imagery")` and `lookupTerm("EMI")` both resolve to the canonical entry; `lookupTerm("embodied imagery")` returns null. TDD. Commit `feat(glossary): add the Embodied Motor Imagery canonical term`.

### Task B2: (Optional) thin `/glossary` index

So `DefinedTermSet.url` resolves to a real page. A minimal server-rendered alphabetical list of `GLOSSARY` entries at `src/app/glossary/page.tsx` + register `if (top === "glossary") return true;` in `isPublicPath` (add a test like A6) + a sitemap entry. Low priority; the `DefinedTerm` schema is still valid if `/glossary` 404s, but a resolving URL is better. If skipped, point `termSetUrl` at `${siteUrl()}/glossary` anyway (the canonical we'll build later) and note the follow-up.

### Task B3: Author + publish the `motor-imagery-bci` page (THE first real page)

This is the proof-of-pipeline page (the "suggested first PR slice" target). Author it as a `MiniLesson` via the A9 admin route (or a direct-Prisma seed script — repo memory: server actions can't be scripted, use a seed-style script for bulk writes):

- **slug:** `motor-imagery-bci`; **accessTier:** PUBLIC; **published:** true.
- **Content** (EEG brief §4 Tier-3 row + EMI doc): teach generic "motor imagery & the mu rhythm" (ranks for the generic query), then convert to the **Embodied Motor Imagery** framing. First use per page = full term + "(EMI)"; pair EMI with **vectorial intent**; contrast with **"un-anchored / abstract mental imagery"** (never drop the contrast). Use `[[Embodied Motor Imagery]]` and `[[EMI]]` popovers. Include first-hand value (a real annotated diagram/screenshot, tested framing, a byline + "last verified" line) — not a thin page.
- **relatedProjects:** a `DOWN_FUNNEL` link to **L3.05** (the swarm hub). It's almost certainly "coming soon" → the CTA degrades to `/courses/l3-05-...` waitlist (decision 4 — verify the real slug; the curriculum DAG uses `l3-05-*`). Optionally a `SUPPORTING` up-link to the `eeg-bci-guide` pillar once it exists.
- **DefinedTerm JSON-LD:** the article page (A7) currently emits TechArticle + LearningResource + Breadcrumb. For the EMI page ONLY, also emit the `DefinedTerm`. Implement by adding an optional `definedTerm` flag/field path: simplest is a small per-slug allowlist or a `MiniLesson.definedTermName` nullable column — **but YAGNI**: instead, render the `DefinedTerm` when the lesson's slug === `"motor-imagery-bci"` via a tiny pure helper `emiDefinedTermLd()` in `src/lib/seo/jsonld.ts` (or a `src/lib/library/defined-terms.ts` map `slug → DefinedTerm args`), so exactly one canonical page declares it. Add a `<JsonLd data={definedTermJsonLd(...)} />` in A7's page when the map has an entry for the slug. Copy the EMI doc §5 block verbatim; set `url` to `${siteUrl()}/library/motor-imagery-bci` (the locked canonical).

**Render-verify (logged-out):** load `/library/motor-imagery-bci` signed-out → full content renders (no blank card), `[[EMI]]` popover works, the down-funnel CTA points at the L3.05 waitlist, View-Source shows TechArticle + LearningResource + Breadcrumb + DefinedTerm. This is the gate for "the pipeline works."

Commit `feat(library): publish motor-imagery-bci with the EMI DefinedTerm moat`.

> **Cross-property (NOT in this repo):** the apex bridge link lives in `otd-site-deploy`. File a sibling task to point apex's "science behind BioScale" blurb at `https://academy.onethousanddrones.com/library/motor-imagery-bci` (the now-locked canonical). Don't build it here.

---

## Phase C — EEG/BCI cluster content (ride the Phase A pipeline)

Phase C is **content authoring**, not new infra — each page is a `MiniLesson` row through the A7 route. Do NOT write 12 near-identical code tasks; instead follow this repeatable process per page, in the EEG brief **§8 moat-first order**:

**Authoring process (per page):**
1. Pull the row from EEG brief §3/§4 (slug, primary/secondary queries, one-idea scope, down-funnel CTA target).
2. Author substantive content-blocks (prose + ≥1 diagram/image where it teaches; `[[term]]` popovers on first jargon use; first-hand value per the guardrail). Title tag <60 chars keyword-first; meta description ~150–160 chars (`seoTitle`/`seoDescription`).
3. Set `relatedProjects`: up-link to the pillar (`SUPPORTING`) + 2–3 sideways sibling links (as `sourceRef` blocks to other `/library/<slug>`) + the `DOWN_FUNNEL` CTA (L3.01 or L3.05 per the row; degrades to waitlist).
4. Apply the EEG brief §7 per-page checklist. Render-verify logged-out.
5. Cannibalization guard: Library = reference intent; never target a paid lesson's build keyword.
6. **Disclosure audit (mandatory, see the Disclosure guardrail above):** the page teaches the general field only — no coined moat (EMI/vectorial intent/1:N/cohorts), no recipe (features/classifier/calibration), no research-program/flywheel/strategy framing, no actual OTD-AFE-001A/paid-build design. The deeper hardware pages (`ads1299-explained`, `biopotential-afe`, `eeg-noise-and-right-leg-drive`) are the high-risk ones — teach *how the class of circuit works*, never publish OTD's specific board. If a sentence reads as product positioning or a GTM funnel, cut or generalize it.

**Sequence (EEG brief §8):**
- **Phase 1 (highest ROI):** pillar `eeg-bci-guide` → `ads1299-explained` → `motor-imagery-bci` (done in Phase B) → `control-a-drone-with-your-brain`.
- **Phase 2 (trust/reference):** `eeg-safety-and-isolation` (prominent, no-hedging isolation warning — E-E-A-T + liability), `eeg-noise-and-right-leg-drive`, `biopotential-afe`, `eeg-electrodes-10-20-system`.
- **Phase 3 (fill-in):** `eeg-frequency-bands`, `eeg-classification-csp-eegnet`, `what-is-eeg`, `what-is-a-bci`.

**Pillar note:** `eeg-bci-guide` is the hub (links down to every cluster page, up/out to the apex BioScale explainer). It may warrant `Course`/`HowTo` JSON-LD in addition to TechArticle — reuse `courseJsonLd`/`guideCardToHowTo`. The cluster pages link UP to it. Internal-linking-spine completeness (EEG brief §6) is what makes the cluster rank vs. a pile of pages — wire it as you go.

**Out of scope (flagged):** the telemetry / neural-data-privacy consent mechanism the funnel eventually feeds (EEG brief §10). Do NOT build a data-collection opt-in here.

---

## Suggested first PR slice (matches the handoff)

**PR 1 = Phase A tasks A1–A7 + A10 + Phase B B1 + B3**, end-to-end for the single `motor-imagery-bci` page: youtube block + allowlist + JSON-LD builders + `MiniLesson`/`ProjectMiniLesson` migration + `/library/[slug]` route + middleware + sitemap + EMI glossary term + DefinedTerm, render-verified logged-out. Defer A8 (index), A9 (admin authoring — can seed the first page directly), and B2 (`/glossary` index) to PR 2 if PR 1 is getting large. This proves the whole pipeline on the highest-value page before fanning out the cluster.

Branch off `main`. **No merge without Josh's local verify.**
