# Guide Signpost System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace L1.01's six inconsistent teaching-signpost treatments with one designed system, chosen by the owner in a six-round browser sandbox, and normalize the lesson content to match.

**Architecture:** Three of the six locked designs are pure render-layer changes against the existing `callout` block plus a label-format normalization of the content. The other three need content the schema cannot express today, so they get two NEW block types (`doSteps`, `traceList`) and one new optional field (`callout.reason`). New types rather than widened unions: `steps` and `callout` keep their shapes, so nothing already authored can break, and every consumer change is additive. Renderer branches ship BEFORE the content that uses them, because an unrecognized label degrades to a harmless generic callout while the reverse blanks a card.

**Tech Stack:** Next.js 16 App Router (server components), Zod 4 (`src/lib/schemas/guide.ts`), Tailwind v4 tokens (`src/app/globals.css`), react-pdf (`src/lib/pdf/library-pdf.tsx`), Vitest, Prisma (contentBlocks is a JSON column, so there is NO database migration in this plan).

---

## Read this before Task 1

**The sandbox is the spec.** Every locked design is implemented and browsable at
`http://localhost:3000/sandbox/signposts` (dev only). Its source is the reference
implementation: copy the markup, do not re-derive it.

| Lock | Sandbox source | Replaces |
| --- | --- | --- |
| **A12b2** mode band | `src/app/sandbox/signposts/specimens4.tsx` → `A12b2` | `ModeBandBlock`, `GuideBlocks.tsx:929` |
| **C9a** alert ladder | `src/app/sandbox/signposts/specimens3.tsx` → `C9a` + `RungGlyph` | bare "Gotcha" `CalloutBlock` |
| **E6d1** aside | `src/app/sandbox/signposts/specimens4.tsx` → `E6d1` + `Glyph` | generic `CalloutBlock` for `Setup ·` / `Keys` / `Alternative ·` |
| **B9b** Do + proof | `specimens3.tsx` → `B9b`, driven by `interactive.tsx` → `TickReveal` | `ActionCalloutBlock` + a following `steps` block |
| **D8c3** triage | `specimens4.tsx` → `D8c3`, driven by `interactive2.tsx` → `Triage` (`layout="inline"`) | generic `CalloutBlock` for `Eyeball it ·` |
| **F7c4** sticky flag | `specimens4.tsx` → `F7c4` | `SectionHeaderBlock`, `GuideBlocks.tsx:854` |

### Do NOT copy the sandbox verbatim: it fails contrast

The sandbox was built to settle LAYOUT questions, and it uses `text-gray-3` 30 times
for real reading content: every `proof` line, every revealed `why` / `look for` line,
and the F7c reason text. **`gray-3` fails WCAG AA in both themes.** Measured against
the live token values in `globals.css`:

| Token | Dark (`#08090d`) | Light (`#faf7f0`) | Verdict |
| --- | --- | --- | --- |
| `gray-3` | `#555555` → **2.67:1** | `#9aa0ad` → **2.45:1** | FAILS AA in both |
| `muted` | `#aaaaaa` → 8.57:1 | `#6b7280` → 4.52:1 | passes in both |
| `text` | `#e8e8e8` → 16.24:1 | | passes |

AA wants 4.5:1 for body text. A proof line and a revealed explanation are body text,
not "faint meta" — they are the payload of the whole feature. `otd-frontend-design`
says as much: `gray-3` is for "faint meta, disabled", new body copy is `text-text`,
labels and captions are `text-muted`.

**The rule when porting any sandbox component:** every `text-gray-3` on a line the
learner is meant to READ becomes `text-muted`. Keep `gray-3` only for genuinely
de-emphasised chrome (a struck-through completed tick label, where the content has
been deliberately retired).

Two related constraints while you are in there:

- The guide is a PUBLIC page, and `GuideBlocks.tsx` already carries 8 uses of the
  legacy `gray-1` / `gray-2` tokens the design skill bans outside un-migrated
  internal screens. Do not add more. Leaving the existing 8 alone is fine; this plan
  is not a decontamination sweep, but it must not make it worse.
- Check the ported components in BOTH themes, at desktop AND at mobile width. The
  sandbox was only ever judged at 1100 to 1280 px.

## Validated against the real corpus (2026-07-20)

This plan was checked by running its proposed parsers over all 188 L1.01 signposts
(`scripts/_l101-validate-parsers.ts`, read-only, gitignored). What that proved:

- **`parseModeLabel` is correct on 24 of 24 real bands.** Zero venues leaked into a
  title, zero unknown mode words. The venue-by-content heuristic holds.
- **The alert parser claims exactly the 4 bare `Gotcha` labels**, and correctly
  leaves the 3 same-role warn callouts under other labels for Task 11 to convert.
- **Bands per stage:** SCHEMATIC 4, LAYOUT **7**, DRC_GERBER 4, BRINGUP 4,
  ASSEMBLY 3, ORDERING 2, **REQUIREMENTS 0, BOM_SOURCING 0**. See Task 10.
- **5 LAYOUT `do` bands carry no venue** while every other stage's do-band does.
  Task 10 fixes the grammar.
- **The `Keys` aside verb matches ZERO real labels.** See Task 15b.
- **A `Setup · …` callout is never rendered as a block** (`GuideBlocks.tsx:1558`
  absorbs it into the SetupBand summary), so the aside family is 3 blocks, not 4.
  See Task 4.
- **The 6 generated gotchas in `guide-templates/gotcha-blocks.ts` carry labels the
  alert parser does not claim.** See Task 15c.

Blast radius, traced with `git grep` over every `contentBlocks` consumer: apart from
`BlockEditor` and `library-pdf`, nothing branches exhaustively on block type. Every
other consumer filters for a SPECIFIC type (`quiz`, `math`, `image`, `video`,
`partModel`, `bomTable`, `youtube`, `table`, `action`), so a new type is invisible to
them by construction. The five cluster seed scripts, the capture routes, the quiz
gate, `lesson-readiness.ts` and the `/library` pages all fall in that group.

**`library-pdf.tsx` ends its switch in `default: return null` (line 646), so a
missing case is invisible to `tsc`.** It is the only consumer with no compiler
backstop. Task 5 Step 6 adds the test that covers for it.

Two tool facts, verified by running them:

- `pnpm exec vitest run <file>` works (3.5 s for a non-DB test file).
- **`pnpm exec rg` does NOT work** — ripgrep is not a dependency. Every search step
  in this plan uses `git grep -n` instead.

**Six facts that will bite you:**

1. **`.env.local` `DATABASE_URL` is LOCAL, not prod** (Postgres 17 service
   `postgresql-x64-17`, database `foundry_dev`), since 2026-07-15. `CLAUDE.md` is
   the source of truth here. The `otd-guide-content` skill still says PROD; it is
   stale on this one point. Every `scripts/_*.ts` in this plan writes to LOCAL and
   is safe by default.
2. **L1.01 content is under a prod-push HOLD** (owner, 2026-07-18). Every content
   script in Phase 5 is LOCAL-ONLY. Do not run `pnpm db:prod`. Do not push content
   to prod even if a script looks ready.
3. **The guide page renders `[]` on ANY contentBlocks parse failure.** A bad write
   looks fine in the DB and blanks the lesson. Always re-parse before writing and
   verify the rendered PAGE, not the DB row.
4. **`pnpm` runs via PowerShell, never the Bash tool** (Bash gives exit 127).
5. **Label patterns are a real API.** `src/lib/guide-islands.ts` scans for
   `Setup · …` (`SETUP_LABEL_RE`), `Mode …` (`MODE_LABEL_RE`) and `NN · …` to build
   the island jump-nav and the setup band. This plan keeps all three label prefixes
   intact and only changes what they RENDER as, plus what follows the prefix. If you
   change a prefix, `guide-islands.test.ts` will tell you.
6. **`BlockEditor.tsx` has an exhaustiveness guard** in its `default:` case. Adding a
   block type to the schema without adding an editor branch fails `tsc`, which is the
   intended alarm.

**Branch and merge policy:** branch off `main`, batch commits onto ONE pull request,
and do NOT merge. `main` is PR-only with required checks `guard` and `Vercel`; a
direct push is declined. The maintainer merges after seeing it work locally.

---

## Phase 0: Branch and baseline

### Task 0: Create the branch and record a green baseline

**Files:** none (git only)

**Step 1: Branch off main**

```powershell
git checkout main
git pull
git checkout -b feat/guide-signpost-system
```

**Step 2: Record the baseline test count**

Run: `pnpm test`
Expected: PASS. Write down the total ("N passed"). Every later phase compares
against this number so a silently-skipped file is visible.

If `.env.test.local` is missing, the DB-backed tests fall back to whatever
`.env.local` sets (LOCAL `foundry_dev`) and lose per-file Neon branch isolation, so
they serialize and the suite takes minutes instead of ~80 s. That is slow, not wrong.
Most tasks in this plan touch pure modules, so prefer
`pnpm exec vitest run <file>` (about 3.5 s) during the loop and save `pnpm test` for
phase boundaries.

**Step 3: Record the baseline typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0, no output.

**Step 4: Commit nothing.** Phase 0 produces no diff. Proceed to Task 1.

---

## Phase 1: The three render-only locks

No schema change in this phase. Each task ships a renderer branch that a NEW label
format will use; Phase 5 supplies the content. Until then the old content keeps
rendering through the old path, which is the point of shipping code first.

### Task 1: Extract the mode vocabulary into one module

Today `MODE_STYLE` in `GuideBlocks.tsx:884` hardcodes `#4a8fff` / `#c8963e` /
`#8fe3a0`. Those are literal hex, so the band CANNOT flip under
`:root[data-theme="light"]` — the check band nearly vanishes on ivory. `#8fe3a0` is
not even a palette token (`status-green` is `#66bb6a`). This task fixes the theming
bug and gives the later tasks one place to import from.

**Files:**
- Create: `src/lib/guide-signposts.ts`
- Test: `src/lib/__tests__/guide-signposts.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/__tests__/guide-signposts.test.ts
import { describe, it, expect } from "vitest";
import { MODE_VAR, MODE_TEXT, parseModeLabel, MODES } from "@/lib/guide-signposts";

describe("guide signposts: mode vocabulary", () => {
  it("resolves every mode colour through a CSS custom property", () => {
    for (const m of MODES) {
      expect(MODE_VAR[m], `${m} must be a var(), not a literal`).toMatch(
        /^var\(--color-[a-z-]+\)$/,
      );
    }
  });

  it("has a token utility class for every mode", () => {
    for (const m of MODES) expect(MODE_TEXT[m]).toMatch(/^text-/);
  });

  it("parses a mode label with a venue", () => {
    expect(parseModeLabel("Mode · do · in KiCad · Build it, island by island")).toEqual({
      mode: "do",
      venue: "in KiCad",
      title: "Build it, island by island",
    });
  });

  it("parses a mode label with no venue", () => {
    expect(parseModeLabel("Mode · check · Prove it")).toEqual({
      mode: "check",
      venue: null,
      title: "Prove it",
    });
  });

  it("keeps a multi-part title intact when a venue is present", () => {
    expect(parseModeLabel("Mode · do · at the bench · Solder it, heavy parts first")).toEqual({
      mode: "do",
      venue: "at the bench",
      title: "Solder it, heavy parts first",
    });
  });

  it("falls back to do for an unknown mode word", () => {
    expect(parseModeLabel("Mode · wibble · Something")?.mode).toBe("do");
  });

  it("returns null for a label that is not a mode band", () => {
    expect(parseModeLabel("01 · The regulator")).toBeNull();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: FAIL, "Failed to resolve import ... guide-signposts".

**Step 3: Write the implementation**

```ts
// src/lib/guide-signposts.ts
// The signpost vocabulary shared by the guide renderer, the PDF renderer and the
// island scan. Colours resolve through CSS custom properties, never literal hex,
// so every signpost flips under the `[data-theme="light"]` token override.
//
// The old inline MODE_STYLE map used literal hex (#4a8fff / #c8963e / #8fe3a0),
// which is why the pre-2026-07-20 mode band could not re-theme and the check band
// washed out on ivory. #8fe3a0 was not a palette value at all.

export const MODES = ["orient", "do", "check"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_VAR: Record<Mode, string> = {
  orient: "var(--color-signal-blue)",
  do: "var(--color-command-gold)",
  check: "var(--color-status-green)",
};

export const MODE_TEXT: Record<Mode, string> = {
  orient: "text-signal-blue",
  do: "text-command-gold",
  check: "text-status-green",
};

export interface ParsedModeLabel {
  mode: Mode;
  /** Where the learner's hands are ("in KiCad", "at the bench"). Null for read/verify bands. */
  venue: string | null;
  title: string;
}

function isMode(s: string): s is Mode {
  return (MODES as readonly string[]).includes(s);
}

/**
 * Parse `Mode · <mode> · [venue ·] <title>`.
 *
 * The venue is recognised by CONTENT, not position: a third segment counts as a
 * venue only when it opens with a preposition ("in …", "at …", "on …"), because
 * the authored corpus writes venues that way and titles never do. Positional
 * parsing is what shipped "in KiCad · Build it, island by island" into the Bebas
 * display title on every SCHEMATIC band.
 */
const VENUE_RE = /^(in|at|on|with)\s+\S/i;

export function parseModeLabel(label: string): ParsedModeLabel | null {
  const parts = label.split("·").map((s) => s.trim());
  if (parts.length < 3 || !/^mode$/i.test(parts[0])) return null;
  const word = parts[1].toLowerCase();
  const mode: Mode = isMode(word) ? word : "do";
  const hasVenue = parts.length >= 4 && VENUE_RE.test(parts[2]);
  return {
    mode,
    venue: hasVenue ? parts[2] : null,
    title: (hasVenue ? parts.slice(3) : parts.slice(2)).join(" · "),
  };
}
```

**Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: PASS, 7 tests.

**Step 5: Commit**

```powershell
git add src/lib/guide-signposts.ts src/lib/__tests__/guide-signposts.test.ts
git commit -m "feat(guide): token-only mode vocabulary + venue-aware label parser"
```

---

### Task 2: Rebuild the mode band as A12b2

**Files:**
- Modify: `src/components/guide/GuideBlocks.tsx:884-955` (delete `MODE_STYLE`, `ModeIcon`, `ModeBandBlock`; add the new `ModeBandBlock`)
- Modify: `src/components/guide/GuideBlocks.tsx:1106-1107` (the dispatch call site, to pass the ordinal)
- Modify: `src/app/globals.css:1311-1342` (delete the `.mode-band` recipe)
- Test: `src/lib/__tests__/guide-signposts.test.ts` (extend)

**Step 1: Write the failing test for the band ordinal scan**

The band renders `[ do 02 / 06 ]`, so the renderer must know each band's position
among the mode bands IN THAT CARD. This mirrors how figure numbers are already
assigned in `GuideBlocks.tsx:1503`.

```ts
// append to src/lib/__tests__/guide-signposts.test.ts
import { scanModeBands } from "@/lib/guide-signposts";
import type { ContentBlock } from "@/lib/schemas/guide";

const band = (label: string): ContentBlock => ({
  type: "callout", severity: "info", label, body: "",
});

describe("guide signposts: band ordinals", () => {
  it("numbers mode bands within a card and reports the total", () => {
    const blocks: ContentBlock[] = [
      { type: "prose", md: "intro" },
      band("Mode · orient · Meet the board"),
      band("Mode · do · in KiCad · Build it"),
      { type: "prose", md: "filler" },
      band("Mode · check · Prove it"),
    ];
    const m = scanModeBands(blocks);
    expect(m.get(1)).toEqual({ ord: 1, of: 3 });
    expect(m.get(2)).toEqual({ ord: 2, of: 3 });
    expect(m.get(4)).toEqual({ ord: 3, of: 3 });
    expect(m.has(0)).toBe(false);
  });

  it("returns an empty map for a card with no bands", () => {
    expect(scanModeBands([{ type: "prose", md: "x" }]).size).toBe(0);
  });
});
```

**Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: FAIL, "scanModeBands is not a function".

**Step 3: Implement `scanModeBands`**

```ts
// append to src/lib/guide-signposts.ts
import type { ContentBlock } from "@/lib/schemas/guide";

/**
 * Map of block index → this band's position among the card's mode bands.
 * The band renders `[ do 02 / 06 ]`, and "of" is per CARD (a stage), which is the
 * unit a learner experiences as "how much of this is left".
 */
export function scanModeBands(
  blocks: ContentBlock[],
): Map<number, { ord: number; of: number }> {
  const idx: number[] = [];
  blocks.forEach((b, i) => {
    if (b.type === "callout" && parseModeLabel(b.label)) idx.push(i);
  });
  const out = new Map<number, { ord: number; of: number }>();
  idx.forEach((blockIndex, n) => out.set(blockIndex, { ord: n + 1, of: idx.length }));
  return out;
}
```

**Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: PASS, 9 tests.

**Step 5: Replace the band component**

In `src/components/guide/GuideBlocks.tsx`, DELETE `MODE_STYLE` (line 884), the
local `ModeIcon` (line 893) and `ModeBandBlock` (line 929), and add:

```tsx
// A12b2 — the mode band. `[ do 02 / 06 ]` in the gate's own bracket vocabulary,
// the venue as a mono chip (NOT inside the Bebas title, which is what the old
// positional parse did), and a hairline closing the row.
//
// The fraction is per CARD: a learner three hours into SCHEMATIC is not asking
// "which band is this", they are asking how much is left.
//
// Add this import at the TOP of the file, with the others (it is written here only
// so the snippet is self-describing):
//   import { MODE_VAR, MODE_TEXT, parseModeLabel } from "@/lib/guide-signposts";

function ModeBandBlock({
  label,
  body,
  ord,
  of,
}: {
  label: string;
  body: string;
  ord: number;
  of: number;
}) {
  const parsed = parseModeLabel(label);
  if (!parsed) return null;
  const { mode, venue, title } = parsed;
  return (
    <section className="mt-3">
      <div className="flex items-center gap-3">
        <span
          className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}
        >
          [ {mode}{" "}
          <span className="font-numeral text-sm tabular-nums">
            {String(ord).padStart(2, "0")}
          </span>
          <span className="text-muted"> / </span>
          <span className="font-numeral text-sm tabular-nums text-muted">
            {String(of).padStart(2, "0")}
          </span>{" "}
          ]
        </span>
        {venue ? (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            {venue}
          </span>
        ) : null}
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 40%, transparent)` }}
        />
      </div>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">
        {title}
      </h2>
      {body ? (
        <p className="mt-2 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
    </section>
  );
}
```

**Step 6: Thread the ordinal through the dispatch**

Copy the `fig` pattern exactly. Compute the map beside the existing `figByIndex`
scan (`GuideBlocks.tsx:1497-1505`):

```tsx
const bandByIndex = scanModeBands(blocks);
```

then add ONE line to the `<GuideBlock …/>` inside the shared `renderBlock` closure
(`GuideBlocks.tsx:1540`, next to `fig={figByIndex.get(i)}`):

```tsx
band={bandByIndex.get(i)}
```

`renderBlock` is called from BOTH loops (the SetupBand children at line 1558 and the
main loop at 1566), so threading it there covers a band that falls inside a
`Setup · …` range without any second wiring.

Then add the prop to `GuideBlock`'s signature next to `fig?: number`, and pass it at
the `^mode` branch:

```tsx
if (/^mode\b/i.test(label))
  return (
    <ModeBandBlock
      label={label}
      body={block.body}
      ord={band?.ord ?? 1}
      of={band?.of ?? 1}
    />
  );
```

**Step 7: Delete the dead CSS**

Remove `.mode-band` and `.mode-band::before` from `src/app/globals.css` (lines
1311-1342). Nothing else references them; confirm with:

Run: `git grep -n "mode-band" -- src`
Expected: no matches outside `src/app/sandbox/`. (Do NOT reach for `rg` — it is not
installed in this repo.)

**Step 8: Typecheck and test**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

Run: `pnpm test`
Expected: PASS, baseline count + 9.

**Step 9: Eyeball both themes**

Start dev detached (a harness-backgrounded `next dev` dies on the next tool call):

```powershell
Start-Process pnpm.cmd -ArgumentList "dev" -WindowStyle Hidden
```

Open `http://localhost:3000/projects/l1-01-wroom-breakout/v1/guide/SCHEMATIC`
(use `localhost`, NOT `127.0.0.1`, which blocks `/_next` chunks). Confirm:
- The band reads `[ DO 02 / 06 ]`, and "in KiCad" is a small mono chip, NOT part of
  the big title. (Content still says `Mode · do · in KiCad · Build it…` — the new
  parser is what moves it. That is the fix working with zero content change.)
- Toggle the theme. The gold, blue and green all flip; nothing washes out.

**Step 10: Commit**

```powershell
git add src/components/guide/GuideBlocks.tsx src/app/globals.css src/lib/guide-signposts.ts src/lib/__tests__/guide-signposts.test.ts
git commit -m "feat(guide): A12b2 mode band, venue out of the display title"
```

---

### Task 3: Add the C9a alert ladder

The lesson has four bare `Gotcha` warn callouts with no headline (nothing scans) and
about six more warn callouts doing the same job under a specific headline. C9a makes
one component with three rungs, and gives each rung a distinct SHAPE so severity is
not carried by colour alone.

**Files:**
- Create: `src/components/guide/RungGlyph.tsx`
- Modify: `src/components/guide/GuideBlocks.tsx` (add `AlertBlock`, add a dispatch branch)
- Test: `src/lib/__tests__/guide-signposts.test.ts` (extend)

**Step 1: Write the failing test**

```ts
// append to src/lib/__tests__/guide-signposts.test.ts
import { parseAlertLabel } from "@/lib/guide-signposts";

describe("guide signposts: alert ladder", () => {
  it("parses a headlined gotcha", () => {
    expect(parseAlertLabel("Gotcha · an LDO without its output cap can oscillate", "warn")).toEqual({
      rung: "caution",
      word: "Gotcha",
      headline: "an LDO without its output cap can oscillate",
    });
  });

  it("parses a bare gotcha with no headline", () => {
    expect(parseAlertLabel("Gotcha", "warn")).toEqual({
      rung: "caution",
      word: "Gotcha",
      headline: null,
    });
  });

  it("promotes a critical severity to the warning rung", () => {
    const r = parseAlertLabel("Gotcha · a soldering iron never looks hot", "critical");
    expect(r?.rung).toBe("warning");
    expect(r?.word).toBe("Warning");
  });

  it("returns null for a label that is not an alert", () => {
    expect(parseAlertLabel("Check yourself", "info")).toBeNull();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: FAIL, "parseAlertLabel is not a function".

**Step 3: Implement the parser**

```ts
// append to src/lib/guide-signposts.ts

// MIL-STD-38784 §4.8.10 runs a three-rung alert ladder (NOTE / CAUTION / WARNING),
// each rung visually distinct. Our `severity` field already carries three values
// and rendered one, which is why a bare "Gotcha" read as weightless: it was the
// middle rung with nothing above or below it.
export const RUNGS = ["note", "caution", "warning"] as const;
export type Rung = (typeof RUNGS)[number];

const RUNG_WORD: Record<Rung, string> = {
  note: "Note",
  caution: "Gotcha",
  warning: "Warning",
};

// All THREE rung words are accepted as the label prefix, not just "Gotcha".
// A `Gotcha`-only prefix cannot express the other two rungs, and it produces an
// author-hostile contradiction: ASSEMBLY's critical safety callout would have to be
// labelled "Gotcha · a soldering iron never looks hot" while RENDERING the word
// "Warning". The author writes the word they mean; `severity` still decides the
// rung, so the two can never disagree on colour and shape.
// A headline is REQUIRED for every word except the legacy bare "Gotcha".
//
// Why: `defaultBlock("callout")` (src/lib/guide-block-defaults.ts:87) emits
// `label: "Note"`. A pattern that claims a bare rung word would turn EVERY newly
// inserted callout in the editor into a headline-less Note-rung alert the moment an
// author adds one. The bare-Gotcha allowance exists only because four of them are
// in the corpus right now; Task 11 removes them, after which the `?` can go.
//
// The separator is `·` ONLY, never `:`. Real labels are full of colons ("First
// power-on: a charger, not your laptop"), and `·` is the house separator, so
// restricting to it removes a whole class of false claim.
const ALERT_LABEL_RE = /^(?:(gotcha)|(?:(gotcha|warning|note|caution)\s*·\s*(.+)))$/i;

export function parseAlertLabel(
  label: string,
  severity: "critical" | "warn" | "info",
): { rung: Rung; word: string; headline: string | null } | null {
  const m = label.trim().match(ALERT_LABEL_RE);
  if (!m) return null;
  const rung: Rung =
    severity === "critical" ? "warning" : severity === "info" ? "note" : "caution";
  return { rung, word: RUNG_WORD[rung], headline: m[3]?.trim() || null };
}
```

Add these cases to the Step 1 test before implementing:

```ts
  it("accepts a Warning-prefixed label on a critical callout", () => {
    expect(parseAlertLabel("Warning · a soldering iron never looks hot", "critical")).toEqual({
      rung: "warning",
      word: "Warning",
      headline: "a soldering iron never looks hot",
    });
  });

  it("accepts a Note-prefixed label on an info callout", () => {
    expect(parseAlertLabel("Note · the WROOM carries its own decoupling", "info")?.rung).toBe("note");
  });

  it("does not claim a label that merely contains the word gotcha", () => {
    expect(parseAlertLabel("The gotcha with LDOs", "warn")).toBeNull();
  });

  // THE REGRESSION THAT MATTERS: defaultBlock("callout") emits label "Note".
  // If a bare rung word were claimed, every callout an author inserts would render
  // as a headline-less Note-rung alert.
  it("does not claim the editor's default callout label", () => {
    expect(parseAlertLabel("Note", "info")).toBeNull();
    expect(parseAlertLabel("Warning", "critical")).toBeNull();
  });

  it("does not claim a colon-separated label", () => {
    expect(parseAlertLabel("Caution: read first", "warn")).toBeNull();
    expect(parseAlertLabel("First power-on: a charger, not your laptop", "warn")).toBeNull();
  });
```

Those two cases are load-bearing. `·` is the only separator, and only the legacy
bare `Gotcha` may go without a headline. Verified against the corpus: no real L1.01
label is falsely claimed, and all four bare Gotchas still are.

**Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: PASS, 13 tests.

**Step 5: Create the shared rung glyph**

Copy `RungGlyph` verbatim out of `src/app/sandbox/signposts/specimens3.tsx` into
`src/components/guide/RungGlyph.tsx` and export it. It is a pure presentational SVG
(a dot for note, a triangle for caution, an octagon for warning) with
`stroke="currentColor"`, so it themes for free and reads in greyscale.

**Step 6: Add `AlertBlock` and its dispatch branch**

Copy the `C9a` markup from `specimens3.tsx` into `GuideBlocks.tsx` as `AlertBlock`,
substituting the real `Inline` renderer for the sandbox's `T`. Split the body into
trap and consequence at the FIRST sentence boundary, exactly as the sandbox does:

```tsx
const cut = body.indexOf(". ");
const trap = cut > 0 ? body.slice(0, cut + 1) : body;
const cost = cut > 0 ? body.slice(cut + 2) : "";
```

Add the dispatch branch ABOVE the generic `CalloutBlock` fallback:

```tsx
const alert = parseAlertLabel(label, block.severity);
if (alert) return <AlertBlock {...alert} body={block.body} />;
```

**Step 7: Typecheck, test, eyeball**

Run: `pnpm exec tsc --noEmit` — exit 0.
Run: `pnpm test` — baseline + 13.
Open the SCHEMATIC card. The four Gotchas now render as gold spines with a triangle
glyph, not grey boxes. They still have no headline; Phase 5 supplies those.

**Step 8: Commit**

```powershell
git add src/components/guide/RungGlyph.tsx src/components/guide/GuideBlocks.tsx src/lib/guide-signposts.ts src/lib/__tests__/guide-signposts.test.ts
git commit -m "feat(guide): C9a alert ladder with a distinct shape per rung"
```

---

### Task 4: Add the E6d1 aside

Four labels (`Setup ·`, `KiCad 10 ·`, `Alternative ·`, `Route it ·`) do three jobs
and all render as the same grey info box at the same weight as the teaching spine.
E6d1 gives the family one component: a glyph and verb sitting in a break in a
hairline.

**Read this before writing the verb set. `Setup` must NOT be in it.**

A `Setup · …` callout is never rendered as a block at all. `GuideBlocks.tsx:1558`
absorbs it: the loop over a setup range starts at `range.start + 1`, and the Setup
callout becomes the `SetupBand` summary instead of body. Putting `Setup` in
`ASIDE_VERBS` produces dead code that looks like it works.

That leaves the aside family smaller than the sandbox round implied:

| Verb | Real labels today | After Phase 5 |
| --- | --- | --- |
| `Setup` | 1, but absorbed by SetupBand | not in the set |
| `Keys` | **0** (they are labelled `KiCad 10 · …` and `The KiCad 10 keys you'll use`) | 2, after Task 15b |
| `Alternative` | 1 (ASSEMBLY) | 1 |
| `Route it` | 1, but it is a Do in disguise | reassigned by Task 15 |

So E6d1 ships for **three blocks in the whole lesson**. That is still worth doing (an
aside should not carry the same weight as the teaching spine, and the component is
about twenty lines) but the owner should hear the real number before it is built,
not after. Raise it, then proceed.

**Files:**
- Modify: `src/lib/guide-signposts.ts` (add `parseAsideLabel` + the verb set)
- Modify: `src/components/guide/GuideBlocks.tsx` (add `AsideBlock` + dispatch)
- Test: `src/lib/__tests__/guide-signposts.test.ts` (extend)
- Check: `src/lib/__tests__/guide-islands.test.ts` must still pass untouched

**Step 1: Write the failing test**

```ts
// append to src/lib/__tests__/guide-signposts.test.ts
import { parseAsideLabel } from "@/lib/guide-signposts";

describe("guide signposts: asides", () => {
  it("parses a Keys aside", () => {
    expect(parseAsideLabel("Keys · The KiCad 10 keys you'll use")).toEqual({
      verb: "Keys",
      headline: "The KiCad 10 keys you'll use",
    });
  });

  // SetupBand owns this label (GuideBlocks.tsx:1558 never renders the block), so the
  // aside family must not claim it.
  it("does not claim a Setup label", () => {
    expect(parseAsideLabel("Setup · Get KiCad + the starter open")).toBeNull();
  });

  it("parses an Alternative aside", () => {
    expect(parseAsideLabel("Alternative · have hot air? Reflow them instead")).toEqual({
      verb: "Alternative",
      headline: "have hot air? Reflow them instead",
    });
  });

  it("does not claim a numbered section header", () => {
    expect(parseAsideLabel("01 · The regulator")).toBeNull();
  });

  it("does not claim a mode band", () => {
    expect(parseAsideLabel("Mode · do · in KiCad · Build it")).toBeNull();
  });

  it("does not claim an unknown verb", () => {
    expect(parseAsideLabel("Wibble · something")).toBeNull();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: FAIL, "parseAsideLabel is not a function".

**Step 3: Implement**

```ts
// append to src/lib/guide-signposts.ts

// A CLOSED verb set on purpose. The corpus grew an implicit `Verb ·` convention and
// applied it about half the time ("KiCad 10 · PCB-editor keys" vs "The KiCad 10 keys
// you'll use" are the same thing written two ways). A closed set means an unlisted
// verb degrades to the generic callout instead of silently joining the family.
// `Setup` is deliberately ABSENT: GuideBlocks.tsx:1558 absorbs a `Setup · …`
// callout into the SetupBand summary and never renders it as a block, so listing it
// here would be dead code that reads as working.
export const ASIDE_VERBS = ["Keys", "Alternative"] as const;
export type AsideVerb = (typeof ASIDE_VERBS)[number];

export function parseAsideLabel(
  label: string,
): { verb: AsideVerb; headline: string } | null {
  const [head, ...rest] = label.split("·").map((s) => s.trim());
  if (!rest.length) return null;
  const verb = ASIDE_VERBS.find((v) => v.toLowerCase() === head.toLowerCase());
  if (!verb) return null;
  return { verb, headline: rest.join(" · ") };
}
```

Note `Route it ·` is deliberately absent: it is a Do wearing an aside's clothes and
Phase 5 relabels it, rather than the aside family absorbing it.

**Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-signposts.test.ts`
Expected: PASS, 18 tests.

**Step 5: Add `AsideBlock` and dispatch**

Copy `E6d1` and its `Glyph` helper from `specimens4.tsx` into `GuideBlocks.tsx`,
substituting `Inline` for `T`. Add the dispatch branch above the generic fallback,
BELOW the `^setup` branch is not needed (the aside parser handles Setup itself), but
place it AFTER the mode and alert branches so those keep priority.

**Step 6: Prove the island scan is unaffected, and pin the invariant Phase 5 can break**

`deriveSetupRanges` keys on the `Setup · …` LABEL, not on how it renders, so nothing
changes today. Verify rather than assume:

Run: `pnpm exec vitest run src/lib/__tests__/guide-islands.test.ts`
Expected: PASS, unchanged.

Then add this regression test, because Phase 5 is what puts it at risk.
`isStructuralBreak` (`src/lib/guide-islands.ts:44`) returns false for ANY non-callout
block. Once `Draw it ·` callouts become `doSteps` blocks, they stop terminating a
`Setup · …` range. Today that changes nothing (the one open range in SCHEMATIC
already swallows its Do block), but nothing currently pins it:

```ts
// src/lib/__tests__/guide-islands.test.ts
it("a doSteps block does not terminate a Setup range (documented, not desired)", () => {
  const ranges = deriveSetupRanges([
    { type: "callout", severity: "info", label: "Setup · Get KiCad open", body: "" },
    { type: "doSteps", title: "wire it", body: "", steps: [{ text: "a" }] },
    { type: "callout", severity: "info", label: "01 · The regulator", body: "" },
  ]);
  expect(ranges[0]).toEqual({ start: 0, end: 2, title: "Get KiCad open" });
});
```

If a reviewer decides a Do block SHOULD close a setup region, that is a deliberate
change to `isStructuralBreak` with this test inverted, not a silent drift.

**Step 7: Typecheck, full test, eyeball, commit**

Run: `pnpm exec tsc --noEmit` — exit 0.
Run: `pnpm test` — baseline + 18.

```powershell
git add src/components/guide/GuideBlocks.tsx src/lib/guide-signposts.ts src/lib/__tests__/guide-signposts.test.ts
git commit -m "feat(guide): E6d1 aside family on a closed verb set"
```

---

## Phase 2: Two new block types and one new field

### Task 5: Add `doSteps`, `traceList` and `callout.reason` to the schema

**Files:**
- Modify: `src/lib/schemas/guide.ts:31-32` (callout gets `reason`; two new union members)
- Test: `src/lib/__tests__/guide-schema.test.ts`

**Step 1: Write the failing test**

```ts
// append to src/lib/__tests__/guide-schema.test.ts
import { contentBlockSchema } from "@/lib/schemas/guide";

describe("signpost block types", () => {
  it("accepts a doSteps block", () => {
    const r = contentBlockSchema.safeParse({
      type: "doSteps",
      title: "wire the decoupling, then tie the module",
      body: "Caps first, right at U1's power pins.",
      steps: [{ text: "Drop a +3V3 port on C1.", proof: "C1 carries a +3V3 port." }],
    });
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  it("accepts a doSteps step with no proof", () => {
    const r = contentBlockSchema.safeParse({
      type: "doSteps",
      title: "x",
      body: "",
      steps: [{ text: "Do the thing." }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a doSteps block with no steps", () => {
    const r = contentBlockSchema.safeParse({ type: "doSteps", title: "x", body: "", steps: [] });
    expect(r.success).toBe(false);
  });

  it("accepts a traceList block", () => {
    const r = contentBlockSchema.safeParse({
      type: "traceList",
      headline: "what ERC can't catch",
      body: "ERC checks connectivity, not intent.",
      items: [{ text: "U2 VIN sits on +5V.", help: "The VIN wire lands on the +5V label." }],
    });
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  it("accepts an optional reason on a callout", () => {
    const r = contentBlockSchema.safeParse({
      type: "callout",
      severity: "warn",
      label: "02 · Set up PCBWay's rules",
      body: "Load the limits now.",
      reason: "Do this before you route, or you will redo it",
    });
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  it("still accepts a callout with no reason", () => {
    const r = contentBlockSchema.safeParse({
      type: "callout", severity: "info", label: "Note", body: "",
    });
    expect(r.success).toBe(true);
  });
});
```

**Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/guide-schema.test.ts`
Expected: FAIL on the doSteps / traceList / reason cases.

**Step 3: Implement the schema change**

In `src/lib/schemas/guide.ts`, change the callout member to add `reason`, and add
two new members to the discriminated union:

```ts
  // `reason` names WHY a section is flagged, in words, and renders in the margin
  // beside the change-bar mark (F7c4). Severity alone only tells the learner how
  // bad it is; the reason tells them what to do about it. Optional, so every
  // existing callout stays valid.
  z.object({
    type: z.literal("callout"),
    severity: z.enum(["critical", "warn", "info"]),
    label: z.string().trim().min(1).max(120),
    body: z.string().max(2000),
    reason: z.string().trim().max(120).optional(),
  }),

  // doSteps — a "Do ·" action block whose steps each carry the EVIDENCE that the
  // step worked. Ticking a step reveals its proof (B9b), so the learner confirms
  // rather than guesses. Distinct from `steps` (a plain ordered list) on purpose:
  // `steps` stays exactly as authored everywhere it is already used.
  z.object({
    type: z.literal("doSteps"),
    title: z.string().trim().min(1).max(120),
    body: z.string().max(2000),
    steps: z
      .array(
        z.object({
          text: z.string().max(1000),
          /** What the learner should SEE when this step worked. */
          proof: z.string().max(300).optional(),
        }),
      )
      .min(1)
      .max(20),
  }),

  // traceList — an "Eyeball it ·" verify block: things to check by eye, each with
  // the answer-key line that only opens when the learner says they are not sure
  // (D8c3). The items used to live buried in a body paragraph, where they could
  // not be counted, ticked, or matched against the stage gate that asks for the
  // same three.
  z.object({
    type: z.literal("traceList"),
    headline: z.string().trim().min(1).max(120),
    body: z.string().max(2000),
    items: z
      .array(
        z.object({
          text: z.string().max(1000),
          /** Shown only on "not sure": what right looks like. */
          help: z.string().max(300).optional(),
        }),
      )
      .min(1)
      .max(12),
  }),
```

**Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/guide-schema.test.ts`
Expected: PASS.

**Step 5: Run the FULL typecheck and expect it to FAIL in exactly ONE place**

Run: `pnpm exec tsc --noEmit`
Expected: **FAIL in `src/components/guide/BlockEditor.tsx` only**, at the
exhaustiveness guard. That failure is the guard doing its job and Task 8 fixes it.

**It will NOT fail in `src/lib/pdf/library-pdf.tsx`.** That switch ends in
`default: return null` (line 646), so a block type it does not handle renders as
NOTHING, silently, with a green typecheck. This is the single most skippable task in
the plan and the only one with no compiler backstop, which is exactly why Task 9
gets its own test in Step 1 below rather than relying on `tsc`.

**Step 6: Write the PDF coverage test NOW, while the gap is visible**

Put it in place before Task 6 so it is red for the whole build and cannot be
forgotten:

```ts
// src/lib/__tests__/library-pdf-coverage.test.ts
import { describe, it, expect } from "vitest";
import { BLOCK_TYPES, defaultBlock } from "@/lib/guide-block-defaults";
import { renderBlockToPdf } from "@/lib/pdf/library-pdf";

// library-pdf's switch ends in `default: return null`, so a missing case is
// invisible to tsc AND to the eye until someone prints a PDF and finds a hole.
// Every block type an author can insert must render something.
describe("library PDF block coverage", () => {
  it("renders every insertable block type to a non-null node", () => {
    for (const t of BLOCK_TYPES) {
      expect(
        renderBlockToPdf(defaultBlock(t), new Map()),
        `${t} renders nothing in the PDF`,
      ).not.toBeNull();
    }
  });
});
```

The per-block render function in `library-pdf.tsx` is currently module-private.
Export it (named `renderBlockToPdf`) as part of this step. If some existing types
legitimately render null there (line 584 hints at least one is unused by the Library
set), the honest move is an explicit allow-list constant in the test, NOT deleting
the assertion.

Run: `pnpm exec vitest run src/lib/__tests__/library-pdf-coverage.test.ts`
Expected: FAIL, naming `doSteps` and `traceList` (plus any pre-existing holes, which
are a finding worth reporting, not silently listing).

**Commit discipline for the red span:** Tasks 5 through 9 leave the tree
un-typechecking. That is four tasks with no commit, which is longer than this plan is
comfortable with. Either finish 5-9 in one sitting and commit once, or commit each
task with `--no-verify` ONLY if a hook blocks on tsc and you are confident, and
squash before pushing. Do not push a red intermediate to the PR.

---

## Phase 3: Render the three new locks

### Task 6: Render `doSteps` as B9b

**Files:**
- Create: `src/components/guide/DoStepsBlock.tsx` (client island)
- Modify: `src/components/guide/GuideBlocks.tsx` (dispatch `case "doSteps"`)

**Step 1: Build the client island**

Copy `TickReveal` from `src/app/sandbox/signposts/interactive.tsx` and `B9b` from
`specimens3.tsx` into one `"use client"` component. It must be a client island
because ticking is local state.

Session-only state is DELIBERATE and matches `SelfCheckBlock`: a self-check resets
on every page load so it can be re-attempted. Do NOT persist tick state without a
separate decision — the stage gate already stores attestations, and a Do list that
double-stores them creates two sources of truth about the same claim.

**Step 2: Dispatch it**

```tsx
    case "doSteps":
      return <DoStepsBlock title={block.title} body={block.body} steps={block.steps} />;
```

**Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: still failing on `BlockEditor.tsx` only, until Task 8. It does NOT fail on
`library-pdf.tsx` (that switch has a `default: return null`); the coverage test from
Task 5 Step 6 is what stays red for the PDF.

---

### Task 7: Render `traceList` as D8c3 and section flags as F7c4

**Files:**
- Create: `src/components/guide/TraceListBlock.tsx` (client island)
- Modify: `src/components/guide/GuideBlocks.tsx` (dispatch `case "traceList"`; rebuild `SectionHeaderBlock`)

**Step 1: Build the trace island**

Copy `Triage` from `interactive2.tsx` with `layout="inline"` and the `D8c3` wrapper
from `specimens4.tsx`. Verdicts are `traced, looks right` and `not sure`; only the
second reveals `help`.

Fix three things the sandbox version gets wrong before shipping it:

1. **`text-gray-3` → `text-muted`** on the revealed help line (see the contrast table
   above). The help text is the payload; it cannot be the faintest thing on screen.
2. **The verdict buttons carry `aria-pressed` but not `aria-expanded`**
   (`interactive2.tsx:97`), even though choosing "not sure" opens a region. A screen
   reader is told the button is pressed and never told something appeared. Add
   `aria-expanded` to the verdict that reveals, and `aria-controls` pointing at the
   revealed paragraph's id.
3. **The two verdicts are not grouped.** Wrap each row's pair in a
   `role="group"` with an `aria-label` naming the item, so the buttons are announced
   as two answers to one question rather than two loose controls in a list.

`TickReveal` (`interactive.tsx:139-140`) already does the `aria-expanded` part
correctly; use it as the reference.

**Step 1b: Keep the heading outline exactly where it is**

The guide pages are public and indexed, so the document outline is an SEO artefact,
not just markup taste. The levels DO NOT change in this plan:

- mode band → `<h2>` (the old `ModeBandBlock` was `<h2>`; A12b2 is `<h2>`)
- section header → `<h3>` (the old `SectionHeaderBlock` was `<h3>`; F7c4 is `<h3>`)

Resist "improving" this while you are in the file. A card with 4 to 7 bands already
emits that many `h2`s under the page `h1`; that is a pre-existing shape worth
revisiting deliberately, with the SEO consequences priced in, not as a side effect of
a signpost redesign.

**Step 2: Rebuild `SectionHeaderBlock` as F7c4**

Copy `F7c4` from `specimens4.tsx`. Two behaviours it adds over today's component:
- `severity` finally renders. `SectionHeaderBlock` currently IGNORES it, so LAYOUT
  sections 02 and 04 (`warn`) and ASSEMBLY 01 (`critical`) are authored as flagged
  and render identical to an ordinary section. The author's flag is written and
  thrown away.
- The flag is `position: sticky` in the margin, so it stays level with the eye for
  the whole section. A banner you have scrolled past has stopped warning you, and
  ASSEMBLY's safety section is one a learner is inside for ten minutes.

Below `lg` the margin collapses to a left-spine indent. Verify BOTH widths.

**Step 2b: Prove the sticky actually sticks**

`position: sticky` silently stops working if ANY ancestor sets `overflow` to
anything but `visible`. `SetupBand` itself is clean (`src/components/guide/SetupBand.tsx:29`
has no overflow), but the guide page, the island rail and the route-group layout are
not audited here and cannot be proven statically.

In the browser at ≥1024px, scroll a flagged section past the top of the viewport and
confirm the margin flag holds. If it scrolls away, walk the ancestors in devtools for
an `overflow` that is not `visible` and fix THAT, rather than abandoning F7c4 — the
whole argument for the margin is that the warning outlives the scroll.

Also check a flagged section that falls inside a collapsed `Setup · …` band: the
`<details>` hides its content entirely, so the flag must not leave a floating orphan.

**Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: failing on `BlockEditor.tsx` only, until Task 8. The PDF gap is held red by
the Task 5 Step 6 coverage test, not by the compiler.

---

## Phase 4: Editor, defaults and PDF

### Task 8: Teach the editor the two new block types

**Files:**
- Modify: `src/lib/guide-block-defaults.ts:23` (BLOCK_TYPES), `:27` (labels), `:52` (icons), `:80` (defaultBlock)
- Modify: `src/components/guide/BlockEditor.tsx` (two new editor branches + components)
- Test: `src/lib/__tests__/guide-block-defaults.test.ts:7-10` (the hardcoded type list WILL fail; update it)

**Step 1: Run the defaults test and watch it fail**

Run: `pnpm exec vitest run src/lib/__tests__/guide-block-defaults.test.ts`
Expected: FAIL on "lists all block types" once you add to `BLOCK_TYPES`. That
assertion is a deliberate tripwire; update the expected array to include
`"doSteps"` and `"traceList"` in sorted position.

**Step 2: Add the four table entries**

```ts
// BLOCK_TYPES: add "doSteps", "traceList"
// BLOCK_TYPE_LABELS
  doSteps: "Do steps (with proof)",
  traceList: "Trace list (eyeball it)",
// BLOCK_TYPE_ICON
  doSteps: ListIcon,
  traceList: EyeIcon,
// defaultBlock
    case "doSteps":
      return {
        type: "doSteps",
        title: "do the thing",
        body: "",
        steps: [{ text: "Step 1" }],
      };
    case "traceList":
      return {
        type: "traceList",
        headline: "what the checker can't catch",
        body: "",
        items: [{ text: "Thing to trace by eye" }],
      };
```

**Step 3: Run the defaults test**

Run: `pnpm exec vitest run src/lib/__tests__/guide-block-defaults.test.ts`
Expected: PASS. The "defaultBlock passes contentBlockSchema" case proves the two new
defaults are schema-valid.

**Step 4: Add the editor branches**

`BlockListEditor.tsx` needs NO change: it maps over `BLOCK_TYPES`, so both new types
appear in the Add-block menu automatically. `BlockEditor.tsx` needs a `case` and a
component for each. Model both on the existing `KitEditor` (it edits an array of
`{label, note}` objects, which is the same shape problem).

The section-header `reason` is a new optional text input on the EXISTING callout
editor, not a new component.

**Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: **exit 0.** The compiler is now satisfied. The PDF gap is still open and
still red in `library-pdf-coverage.test.ts`; Task 9 closes it. Do not read a green
tsc here as done.

**Step 6: Commit the whole schema-through-editor slice**

```powershell
git add src/lib/schemas/guide.ts src/lib/guide-block-defaults.ts src/components/guide/BlockEditor.tsx src/components/guide/DoStepsBlock.tsx src/components/guide/TraceListBlock.tsx src/components/guide/GuideBlocks.tsx src/lib/__tests__/guide-schema.test.ts src/lib/__tests__/guide-block-defaults.test.ts
git commit -m "feat(guide): doSteps + traceList block types, B9b/D8c3/F7c4 renderers"
```

---

### Task 9: Render both new types in the PDF

**Scope correction, verified:** `library-pdf.tsx` renders `/library` MINI-LESSONS,
not build-guide cards. Its only consumers are `/library/[slug]/pdf`,
`/library/field-guide/pdf` and `/library/field-guide/[cluster]/pdf`. There is no
guide-card PDF route, so **no L1.01 content reaches this renderer.**

The task is still required, for two reasons that are not "the field guide will break":

1. `tsc` is red until it is done. The PDF's `switch` is over the same
   `ContentBlock` union.
2. `/library` mini-lessons share the schema and the editor, so an author CAN reach
   for `doSteps` or `traceList` there the moment Task 8 lands. A block type missing
   from this switch disappears from the printed PDF silently.

**Files:**
- Modify: `src/lib/pdf/library-pdf.tsx`

**Step 0: Confirm the coverage test from Task 5 Step 6 is still red**

Run: `pnpm exec vitest run src/lib/__tests__/library-pdf-coverage.test.ts`
Expected: FAIL on `doSteps` and `traceList`. This test, not the compiler, is what
proves this task happened.

**Step 1: Add both cases**

Print is a static medium: there is no ticking and no reveal. So:
- `doSteps` prints as a numbered list with each proof beneath its step in the small
  mono "you should see" style. Everything the screen hides behind a tick must be
  VISIBLE in print.
- `traceList` prints as a numbered list with each `help` line shown.

**Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0 (it already was after Task 8 — the compiler never had an opinion
about this file). The signal that matters is the coverage test in Step 3.

**Step 3: The coverage test must go green**

Run: `pnpm exec vitest run src/lib/__tests__/library-pdf-coverage.test.ts`
Expected: PASS. This is the only proof this task happened.

Then the full suite:

Run: `pnpm test`
Expected: PASS, baseline + all new cases.

**Step 4: Render a real PDF and look at it**

Open a field-guide PDF for a lesson and confirm neither new block type is missing or
clipped.

**Step 5: Commit**

```powershell
git add src/lib/pdf/library-pdf.tsx
git commit -m "feat(pdf): print doSteps proofs and traceList help lines"
```

---

## Phase 5: Normalize L1.01 content (LOCAL ONLY)

**Everything in this phase writes to the LOCAL `foundry_dev` database.** L1.01 is
under an owner hold on prod pushes (2026-07-18). Do not run `pnpm db:prod`.

Every script follows the mandatory dry-run shape in the `otd-guide-content` skill:
`--write` flag, dry-run prints the exact diff, THROW on no-match (a silent no-op is
how half-applied edits ship), re-parse with `guideContentBlocksSchema` before
writing, idempotent so a re-run is safe. Name them `scripts/_l101-signpost-*.ts`
(`scripts/_*.ts` is gitignored, so they stay out of the PR).

Use `scripts/_l101-signpost-census.ts` (already written, read-only) to re-scan after
each script and confirm the counts moved the way you expect, and
`scripts/_l101-validate-parsers.ts` to confirm the parsers still claim what they
should.

### Task 9b: Capture the before-state (do this FIRST, before Task 10)

Phase 5 has no undo. `contentBlocks` is a JSON column with no history, so a bad
`--write` is only recoverable from what you captured beforehand.

**Step 1: Dump every card verbatim**

```powershell
pnpm tsx scripts/_l101-signpost-backup.ts   # writes scratch JSON, one file per stage
```

Model it on `scripts/_wroom-guide-backup.json`, which is the precedent for exactly
this. Keep it OUT of git (it lands under `scripts/_*`, already gitignored).

**Step 2: Capture the readiness baseline**

```powershell
pnpm exec tsx scripts/lesson-readiness.ts l1-01-wroom-breakout
```

Save the output. Task 16 compares against it, and there is no way to reconstruct it
after Task 10 has run.

**Step 3: Capture the census baseline**

```powershell
pnpm tsx scripts/_l101-signpost-census.ts > <scratch>/census-before.txt
```

**Rollback, if you need it:** re-write the affected card's `contentBlocks` from the
Step 1 dump. Do it per stage, not wholesale, and re-verify the rendered page after.

### Task 10: Normalize the mode-band labels, and fill the two stages that have none

Two grammars ship today. LAYOUT writes `Mode · do · place every part`; everywhere
else writes `Mode · do · in KiCad · Build it, island by island`. The new parser
handles both (proved on all 24 real bands), but the corpus should say one thing.

The five venueless bands, from the validation run, are all in LAYOUT:
`set up the board`, `place every part`, `route the copper`, `pour & stitch the
ground`, `run DRC to zero & export`. Give each a venue (`in KiCad`) and title-case
the titles to match every other stage.

**REQUIREMENTS and BOM_SOURCING have ZERO mode bands.** A12b2's whole proposition is
`[ do 02 / 07 ]` answering "how much of this stage is left", and on 2 of 8 stages it
answers nothing because there is no band to render. Both stages still use the small
`Draw it ·` Do, so the learner gets a Do with no mode context at all. Either:

- author an orient band and a do band for each (the honest fix, and it makes the
  system uniform), or
- get the owner's explicit decision that those two stages are band-free.

Do not leave it undecided: an inconsistent denominator is worse than none.

Also fix the duplicate in BRINGUP: the band `Mode · check · What success looks like`
is immediately followed by a callout with the SAME title.

Dry-run, print, get the owner's go on the print, then `--write`.

### Task 11: Give every Gotcha a headline

Four bare `Gotcha` labels become `Gotcha · <headline>`. Write the headline as the
scannable claim, not a restatement of the body. Convert the ~6 unnamed `warn`
callouts doing the same job (`J1's tabs are the anchor, not decoration`, `First
power-on: a charger, not your laptop`, `Label both ends: the one slip ERC won't
catch`) to the same `Gotcha · …` form so one role has one label.

Voice rules for the new headlines are NOT this plan's to invent: follow
`otd-content-writing`. In particular there is a hard ban on em-dashes in EVERY
rendered glyph.

**That applies to every string authored in Tasks 12, 13 and 14 too**, not just these
headlines. Between them those tasks write roughly 80 `proof` lines, a dozen `help`
lines and 3 `reason` lines: over 90 new user-visible strings, which is the largest
block of new prose this lesson has taken in one pass. Grep the dry-run print for `—`
before every `--write`.

### Task 12: Convert Do blocks to `doSteps`

27 `Draw it ·` callouts, each followed by a `steps` block, become one `doSteps`
block. **This is the largest task in the plan by a wide margin.** 27 blocks at
roughly 3 steps each is about 80 authored `proof` lines, each of which has to be
factually correct about what KiCad actually shows. Treat it as its own working
session, not a step inside a sprint, and do it in stage-sized batches (SCHEMATIC
first, it has 12) with an owner review between batches.

If the proof lines cannot be written honestly for some step, leave `proof` absent.
It is optional in the schema precisely so a half-known step degrades to a plain tick
instead of shipping a confident wrong answer key.

The label bug this fixes: `ActionCalloutBlock` renders `label.split("·").pop()`, so
`Draw it · do one with me · the USB differential pair` (LAYOUT block 65) ships as
just "the USB differential pair". The middle segment is silently dropped. Check
every three-part label for lost content before converting.

Writing the `proof` for each step is authoring, not mechanical transformation. Draft
them, then have the owner review a dry-run print before any `--write`.

### Task 13: Convert Eyeball it blocks to `traceList`

Four `Eyeball it ·` callouts carry their trace targets as numbered clauses inside a
body paragraph: `(1) U2 VIN sits on +5V … (2) Each LED's bar/flat side …`. Split
them into `items`, and write the `help` line for each.

Cross-check the SCHEMATIC and LAYOUT lists against what the stage gate actually asks
the learner to attest to. If they differ, that is a content bug worth reporting to
the owner, not something to paper over.

### Task 14: Add `reason` to the flagged sections

Three sections are authored with a non-info severity and currently render identical
to every other section: LAYOUT 02 and 04 (`warn`), ASSEMBLY 01 (`critical`). Give
each a `reason` under 120 chars.

### Task 15: Relabel `Route it ·`

LAYOUT block 59 (`Route it · the craft, and the traps`) is a Do wearing an aside's
label. Decide with the owner whether it becomes a `doSteps` block or a numbered
section, then relabel. Do not add it to `ASIDE_VERBS`.

### Task 15b: Relabel the keys asides so the `Keys` verb matches something

The validation run found that **`Keys` matches ZERO real labels.** The two callouts
doing that job are `KiCad 10 · PCB-editor keys` (LAYOUT) and `The KiCad 10 keys
you'll use` (SCHEMATIC, no separator at all). Without this task, `ASIDE_VERBS`
carries a verb that never fires and the two keys callouts stay generic boxes.

Relabel both to `Keys · <headline>`. Keep the KiCad-version detail in the headline,
not the verb: the verb names the ROLE, the headline names the specifics.

Do NOT relabel the `Setup · …` callouts. `SetupBand` owns that label and depends on
it (`SETUP_LABEL_RE`, `src/lib/guide-islands.ts:35`); changing it collapses the
set-up-once band on every card that has one.

### Task 15c: Bring the generated gotchas onto the ladder

`src/lib/guide-templates/gotcha-blocks.ts` generates six §6 gotcha callouts with
labels like `WROOM antenna keep-out`, `ADC1-only`, `Servo/motor brownout`. None
matches `parseAlertLabel`, so every GENERATED gotcha renders as a generic grey box
while every hand-authored one renders as the ladder. Same role, two treatments, which
is the exact problem this whole plan exists to end.

**Files:**
- Modify: `src/lib/guide-templates/gotcha-blocks.ts` (6 `label:` values, lines 68-123)
- Modify: `src/lib/__tests__/gotcha-blocks.test.ts`

Relabel each to `Gotcha · <existing label text>`. The test matches labels with loose
regexes (`/antenna keep-out/i`, `/isolat/i`) so most assertions survive the prefix
unchanged, but run it and read the failures rather than assuming:

Run: `pnpm exec vitest run src/lib/__tests__/gotcha-blocks.test.ts`

**This is the one task in Phase 5 that is CODE, not a content script.** It edits a
committed source file and belongs in the PR; everything else in this phase writes to
the local database and produces no diff. It sits here because it only makes sense
once the ladder exists and the hand-authored gotchas have been converted. Commit it
on its own so the PR's history stays readable.

### Task 16: Verify the rendered pages, not the DB

For every stage card touched:

```powershell
$html = (curl.exe -s "http://localhost:3000/projects/l1-01-wroom-breakout/v1/guide/SCHEMATIC") -join ''
$html -match [regex]::Escape('<a string you added>')      # expect True
$html -match [regex]::Escape('<a string you removed>')    # expect False
```

A card that fails schema parse renders as `[]` — a blank page with a 200 status. An
empty-looking card is a FAILED write, not an empty card.

Then run the readiness gate and diff against the baseline Task 9b captured:

Run: `pnpm exec tsx scripts/lesson-readiness.ts l1-01-wroom-breakout`
Expected: no regression. Note that readiness `safeParse`s and falls back to `[]` on
failure (`scripts/lesson-readiness.ts:47`), so a card that fails to parse shows up
here as a sudden score drop rather than an error. A drop is a corrupt write until
proven otherwise.

Finally, re-run the parser validator and confirm the corpus now matches the design:

Run: `pnpm tsx scripts/_l101-validate-parsers.ts`
Expected: zero bare Gotchas, zero venueless `do` bands, zero unclaimed `Verb ·`
labels, and a non-zero band count on all eight stages.

---

## Phase 6: Remove the scaffolding

### Task 17: Delete the sandbox and revert the route exemption

**Files:**
- Delete: `src/app/sandbox/` (the whole directory)
- Modify: `src/lib/admin-routes.ts:39-42` (remove the temporary `/sandbox` public exemption)

The sandbox route carries a dev-only `notFound()` guard AND a
`NODE_ENV !== "production"` gate on its route exemption, so neither can reach the
deployed site. They still come out before the PR: the sandbox-round convention is
that sandboxes are deleted once the owner has picked, and the six picks are now
implemented in the real components.

**Step 1: Delete and revert**

```powershell
Remove-Item -Recurse -Force src/app/sandbox
```

Then remove the `top === "sandbox"` branch from `isPublicPath`.

**Step 2: Confirm nothing else referenced them**

Run: `git grep -n "sandbox" -- src`
Expected: no matches.

**Step 3: Full verification**

Run: `pnpm exec tsc --noEmit` — exit 0.
Run: `pnpm test` — PASS.
Run: `pnpm lint` — exit 0.
Run: `pnpm check:classification` — exit 0.

That last one is not optional politeness: `classification-guard` is a REQUIRED check
on `main` (`.github/workflows/classification-guard.yml`). A PR that fails it cannot
merge, and finding that out from GitHub after pushing wastes a round trip.

**Step 4: Commit and open the PR**

```powershell
git add -A
git commit -m "chore(guide): remove the signpost sandbox after the design round"
git push -u origin feat/guide-signpost-system
gh pr create --base main --title "feat(guide): one signpost system for the build guide" --body "..."
```

Do NOT merge. `main` requires the `guard` and `Vercel` checks, and the maintainer
merges after seeing it work locally.

---

## What this plan deliberately does NOT do

- **No tick-state persistence.** Every tickable is session-only, matching
  `SelfCheckBlock`. Persisting a Do list would create a second source of truth
  alongside the stage gate's attestations. That is a separate decision.
- **No prod content push.** Phase 5 is local-only under the standing L1.01 hold.
- **No changes to other lessons or the Library.** The new block types are available
  to `/library` mini-lessons (same schema, same editor) but nothing there is
  converted here.
- **No `Route it` in the aside verb set.** See Task 15.
- **No database migration.** `contentBlocks` is a JSON column, so a schema change is
  a Zod change, not a Prisma one.
