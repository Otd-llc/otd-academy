// Shared authoring kit for guide stage cards.
//
// Lesson prose lives in the DB, which means it is invisible to git and unreviewable
// in a PR. Every card authored through this kit is instead a TRACKED, idempotent
// script under scripts/authoring/<slug>/<STAGE>.ts, so the prose shows up in a diff,
// two packets can never collide, and "merged" means the card is ready to replay
// against any database.
//
// A packet is one card. Write the blocks, call `publishCard`, and the harness
// schema-parses, runs the voice gate, and scores the card against the L1.01 bar
// before it will write anything.
//
//   pnpm exec tsx scripts/authoring/l1-02-espnow-link/LAYOUT.ts            # dry run
//   pnpm exec tsx scripts/authoring/l1-02-espnow-link/LAYOUT.ts --write    # local
//   pnpm db:prod scripts/authoring/l1-02-espnow-link/LAYOUT.ts --yes -- --write
import { config as loadEnv } from "dotenv";
import { revalidate } from "../lib/revalidate";
loadEnv({ path: ".env.local" });

export type Blk = Record<string, unknown>;

// ── block helpers ────────────────────────────────────────────────────────────
// The renderer dispatches callouts by LABEL PATTERN (see otd-guide-content). These
// helpers exist so a packet cannot invent a rival label convention by accident.

/** `Mode · orient|do|check · Title` — the full-width mode ribbon. */
export const band = (mode: "orient" | "do" | "check", title: string, body: string): Blk => ({
  type: "callout", severity: "info", label: `Mode · ${mode} · ${title}`, body,
});
/** `NN · Title` — a numbered section header, the card's scannable spine. */
export const sect = (n: string, title: string, body: string): Blk => ({
  type: "callout", severity: "info", label: `${n} · ${title}`, body,
});
export const prose = (md: string): Blk => ({ type: "prose", md });
/** `Check yourself` — one scenario question with the answer in line. */
export const check = (body: string): Blk => ({ type: "callout", severity: "info", label: "Check yourself", body });
/** `Gotcha · X` — only where a real trap earns it. */
export const gotcha = (label: string, body: string): Blk => ({
  type: "callout", severity: "warn", label: `Gotcha · ${label}`, body,
});
export const dive = (summary: string, body: string): Blk => ({ type: "deepDive", summary, body });
/** An empty capture slot. `captureHint` is a real shot spec, max 200 chars. */
export const shot = (caption: string, captureHint: string, reveal?: string): Blk => ({
  type: "image", src: "", aspect: "16:10", alt: caption, caption, captureHint,
  ...(reveal ? { reveal } : {}),
});
export const tube = (title: string): Blk => ({ type: "youtube", videoId: "", title });
export const does = (title: string, steps: { text: string; proof: string }[]): Blk => ({
  type: "doSteps", title, body: "", steps,
});
export const trace = (headline: string, items: { text: string; help: string }[]): Blk => ({
  type: "traceList", headline, body: "", items,
});
export const table = (columns: string[], rows: string[][]): Blk => ({
  type: "table", columns, rows: rows.map((r) => r.map((text) => ({ text }))),
});
export const ref = (label: string, href: string): Blk => ({ type: "sourceRef", label, href });
export const exit = (body: string): Blk => ({ type: "callout", severity: "info", label: "Exit this stage", body });

// ── the acceptance test every packet must pass ───────────────────────────────

/** L1.01's per-stage numbers. This is the bar, per the owner rule of 2026-07-22. */
export const BAR: Record<string, { blocks: number; sections: number; bands: number; proofs: number; quizQ: number; media: number }> = {
  REQUIREMENTS: { blocks: 33, sections: 5, bands: 2, proofs: 4, quizQ: 6, media: 5 },
  BOM_SOURCING: { blocks: 36, sections: 4, bands: 2, proofs: 4, quizQ: 5, media: 7 },
  SCHEMATIC: { blocks: 120, sections: 8, bands: 4, proofs: 43, quizQ: 8, media: 20 },
  LAYOUT: { blocks: 96, sections: 9, bands: 8, proofs: 49, quizQ: 9, media: 19 },
  DRC_GERBER: { blocks: 25, sections: 2, bands: 4, proofs: 10, quizQ: 5, media: 5 },
  ORDERING: { blocks: 24, sections: 2, bands: 2, proofs: 7, quizQ: 6, media: 5 },
  ASSEMBLY: { blocks: 40, sections: 4, bands: 3, proofs: 18, quizQ: 5, media: 12 },
  BRINGUP: { blocks: 32, sections: 3, bands: 4, proofs: 10, quizQ: 5, media: 7 },
};

const isSect = (b: Blk) => /^\d\d\s·\s/.test(String(b.label ?? ""));
const isBand = (b: Blk) => /^Mode\s·\s/.test(String(b.label ?? ""));
const isMedia = (b: Blk) => ["image", "video", "youtube"].includes(String(b.type));

export function census(bs: Blk[]) {
  return {
    blocks: bs.length,
    sections: bs.filter(isSect).length,
    bands: bs.filter(isBand).length,
    proofs: bs.filter((b) => b.type === "doSteps")
      .reduce((a, b) => a + ((b.steps as Blk[]) ?? []).filter((s) => s?.proof).length, 0),
    quizQ: bs.filter((b) => b.type === "quiz")
      .reduce((a, b) => a + ((b.questions as unknown[]) ?? []).length, 0),
    media: bs.filter(isMedia).length,
    refs: bs.filter((b) => b.type === "sourceRef").length,
  };
}

/** Every string that reaches a renderer, walked. The em-dash ban is absolute. */
function scanStrings(v: unknown, path: string, hit: (p: string, s: string) => void) {
  if (typeof v === "string") return hit(path, v);
  if (Array.isArray(v)) return v.forEach((x, i) => scanStrings(x, `${path}[${i}]`, hit));
  if (v && typeof v === "object") return Object.entries(v).forEach(([k, x]) => scanStrings(x, `${path}.${k}`, hit));
}

export interface PublishOpts {
  slug: string;
  stage: keyof typeof BAR;
  blocks: Blk[];
  /** revision label; every L1 lesson is v1 today */
  revLabel?: string;
}

export async function publishCard({ slug, stage, blocks, revLabel = "v1" }: PublishOpts) {
  const write = process.argv.includes("--write");
  const { db } = await import("@/lib/db");
  const { guideContentBlocksSchema } = await import("@/lib/schemas/guide");

  // 1. voice gate: no em-dash in any rendered string
  const emdash: string[] = [];
  scanStrings(blocks, "blocks", (p, s) => { if (s.includes("—")) emdash.push(`${p}: ${s.slice(0, 70)}`); });
  if (emdash.length) {
    console.error(`VOICE GATE FAILED: ${emdash.length} em-dash(es)\n` + emdash.join("\n"));
    process.exit(1);
  }

  // 2. schema gate: the guide page renders [] on ANY parse failure, so a bad write
  //    blanks the card while looking fine in the DB. Never write unparsed blocks.
  guideContentBlocksSchema.parse(blocks);

  // 3. quiz gates: stable ids, an explain on every question, and a spread key
  const quizzes = blocks.filter((b) => b.type === "quiz");
  const problems: string[] = [];
  for (const q of quizzes) {
    const qs = ((q.questions as Blk[]) ?? []);
    qs.forEach((x, i) => {
      if (!x.id) problems.push(`quiz q${i}: missing stable id`);
      if (!x.explain) problems.push(`quiz q${i}: missing explain`);
    });
    const keys = qs.map((x) => Number(x.answer));
    const spread = new Map<number, number>();
    keys.forEach((k) => spread.set(k, (spread.get(k) ?? 0) + 1));
    const worst = Math.max(...spread.values(), 0);
    // options render in stored order with no shuffle, so a clustered key is guessable
    if (qs.length >= 6 && worst > Math.ceil(qs.length / 2)) {
      problems.push(`quiz answer key clustered: ${JSON.stringify([...spread])} over ${qs.length} questions`);
    }
  }
  if (problems.length) { console.error("QUIZ GATE FAILED:\n" + problems.join("\n")); process.exit(1); }

  // 4. density score against the L1.01 bar (reported, not enforced: the owner
  //    signs off on density, and a second pass after the board is built is normal)
  const bar = BAR[stage];
  const got = census(blocks);
  const card = await db.guideCard.findFirstOrThrow({
    where: { stage: stage as never, guide: { revision: { label: revLabel, project: { slug } } } },
    select: { id: true, contentBlocks: true },
  });
  const before = census((card.contentBlocks ?? []) as Blk[]);

  const row = (k: keyof typeof got) =>
    `${String(k).padEnd(9)} ${String(before[k]).padStart(4)} -> ${String(got[k]).padStart(4)}` +
    (k in bar ? `   bar ${String((bar as Record<string, number>)[k]).padStart(3)}` +
      (got[k] >= (bar as Record<string, number>)[k] ? "  ok" : "  UNDER") : "");
  console.log(`${slug} ${stage}`);
  (["blocks", "sections", "bands", "proofs", "quizQ", "media"] as const).forEach((k) => console.log("  " + row(k)));
  console.log(`  refs      ${String(before.refs).padStart(4)} -> ${String(got.refs).padStart(4)}`);

  if (!write) { console.log("\nDRY RUN. Re-run with --write to commit."); return; }
  await db.guideCard.update({ where: { id: card.id }, data: { contentBlocks: blocks as unknown as object } });
  const back = await db.guideCard.findUniqueOrThrow({ where: { id: card.id }, select: { contentBlocks: true } });
  console.log(`\nWROTE. read-back: ${((back.contentBlocks ?? []) as unknown[]).length} blocks`);

  // Drop the cache for THIS project's guide. Scoped rather than broad because
  // the slug is right here: re-authoring one stage of one board should not evict
  // every other board's guide. No-ops on a local write. Awaited, not
  // fire-and-forget — a caller that exits the process would kill an unawaited
  // request before it left.
  await revalidate({ guides: [slug] });
}
