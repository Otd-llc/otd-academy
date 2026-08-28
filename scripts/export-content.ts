// Export every authored lesson record to a deterministic JSON archive.
//
//   pnpm content:export                       # write (LOCAL by default)
//   pnpm content:check                        # write nothing, exit 1 if stale
//   pnpm db:prod scripts/export-content.ts    # export PRODUCTION
//
// WHY THIS EXISTS. Authored content lives only in the production database:
// GuideCard / MiniLesson `contentBlocks`, Exam `questions`, and the prose
// scalars around them. None of it is in git, and Neon's free plan keeps only a
// short history window, so anything authored more than a few hours ago has no
// provider-side recovery path.
//
// WHERE IT WRITES. Outside this repository, always. `otd-academy` is PUBLIC and
// the archive contains the priced curriculum and every exam ANSWER KEY, which
// gate the certificates served at /verify. Default target is the sibling
// directory ../otd-content-archive/content; override with CONTENT_ARCHIVE_DIR.
// A `/content/` .gitignore entry exists as belt-and-braces, but the real
// protection is not writing here in the first place.
//
// READ-ONLY. This script performs no Prisma mutation of any kind, which is what
// makes it safe to point at production.
//
// WHICH DATABASE. Each archive tree carries a `.archive-source.json` pin naming
// the host it mirrors, and the export refuses to run if DATABASE_URL points
// somewhere else. Nothing else can tell the two apart: a non-production clone
// clears every floor below, and the README records a wrong-database mirror
// happening twice on 2026-08-14. Rejecting `localhost` would not be enough --
// damage requires a *reachable* database, and the vitest branch pool is a real
// Neon host that is not prod -- so the pin is an equality test, not a heuristic.
//
// *** IF YOU CHANGE THIS FILE, BUMP THE PINNED TAG. ***
// A daily workflow in the PRIVATE Otd-llc/otd-content-archive repo runs this
// against production. It checks this repo out at the `content-export-v1` TAG, not
// main, so that a merged PR here cannot reach the production credential it holds.
// The consequence: your change does not take effect on the schedule until the tag
// moves, and nothing warns you.
//
//   git tag -f content-export-v1 <sha> && git push -f origin content-export-v1
//
// Then re-run the workflow once to confirm it still passes.
//
// dotenv defaults to override:false, so under `pnpm db:prod` -- which sets
// DATABASE_URL to prod BEFORE importing this file -- the prod URL survives. Run
// directly, it falls back to .env.local (LOCAL).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  serializeContentFile,
  contentPathFor,
  assertNoLabelCaseCollision,
} from "@/lib/content-export";

// A partial read must never rotate a good archive out. Calibrated against the
// live catalog (176 / 69 / 7 at 2026-07-28) with headroom. Do NOT lower these to
// make a run succeed -- a run that trips a floor is telling you the read failed.
const FLOOR = { guideCards: 150, miniLessons: 60, exams: 6 };

const CHECK = process.argv.includes("--check");

function archiveRoot(): string {
  // Resolved from the repo root so the default sibling path means the same thing
  // regardless of where the script was invoked from.
  const repoRoot = process.cwd();
  if (!existsSync(join(repoRoot, "package.json"))) {
    throw new Error(`run from the repo root (cwd is ${repoRoot})`);
  }
  const configured = process.env.CONTENT_ARCHIVE_DIR;
  return configured
    ? resolve(configured)
    : resolve(repoRoot, "..", "otd-content-archive", "content");
}

// Which database this archive tree mirrors. Written into the tree itself so the
// tree is self-describing: `content/` says "I am production", `local-snapshot/`
// says "I am the dev box". Nothing else can tell them apart -- see assertSource.
const SOURCE_PIN = ".archive-source.json";

/**
 * Every file currently in the archive, as archive-relative forward-slash paths.
 *
 * SOURCE_PIN is excluded deliberately. Everything this returns and does not
 * re-write is treated as an orphan and deleted, so including the pin would delete
 * it on every run and report the archive permanently STALE under --check.
 */
function existingFiles(root: string): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else if (entry.endsWith(".json") && rel !== SOURCE_PIN) out.add(rel);
    }
  };
  walk(root, "");
  return out;
}

/**
 * Refuse to mirror one database into another database's archive.
 *
 * The exporter prints the source host but never checked it, and the two trees are
 * indistinguishable by content: a non-production clone clears every floor
 * (176/69/7 against floors of 150/60/6). The archive README records this actually
 * happening TWICE on 2026-08-14. Rejecting `localhost` is not enough -- a bad
 * DATABASE_URL on a runner has to be *reachable* to do damage, and the vitest
 * branch pool is exactly that: a real, reachable Neon database that is not prod.
 * So the check is an equality test against the host this tree was pinned to.
 *
 * Absent pin: adopt the current host and carry on, rather than hard-failing a
 * tree that predates this check. That is a deliberate one-time trust of the first
 * run -- commit the pin ahead of deploying this if that window matters.
 */
function assertSource(root: string, host: string): void {
  const pinPath = join(root, SOURCE_PIN);

  if (!existsSync(pinPath)) {
    if (CHECK) {
      console.log(`  pin     : none (skipped; --check writes nothing)`);
      return;
    }
    mkdirSync(root, { recursive: true });
    writeFileSync(pinPath, `${JSON.stringify({ host }, null, 2)}\n`, "utf8");
    console.log(`  pin     : ADOPTED ${host} (first run; ${SOURCE_PIN} created)`);
    return;
  }

  let pinned: string | undefined;
  try {
    pinned = JSON.parse(readFileSync(pinPath, "utf8")).host;
  } catch {
    throw new Error(`${pinPath} is unreadable or not JSON. Fix or delete it; do not export past it.`);
  }
  if (!pinned) throw new Error(`${pinPath} has no "host". Fix or delete it; do not export past it.`);

  if (pinned !== host) {
    throw new Error(
      `WRONG DATABASE FOR THIS ARCHIVE.\n` +
        `  archive : ${root}\n` +
        `  pinned  : ${pinned}\n` +
        `  actual  : ${host}\n` +
        `This tree mirrors ${pinned}. Exporting ${host} into it would overwrite that ` +
        `mirror with another database's content, and the floors cannot tell them apart. ` +
        `Point DATABASE_URL at the right database, or CONTENT_ARCHIVE_DIR at the right tree.`,
    );
  }
  console.log(`  pin     : ok (${pinned})`);
}

/**
 * The target host, for the banner. A malformed DATABASE_URL otherwise surfaces as
 * a bare `TypeError: Invalid URL` from deep in the script with the value masked
 * by CI, which is what a mangled Actions secret looked like the first time this
 * ran on a runner.
 */
function targetHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(
      `DATABASE_URL is not a valid URL (length ${url.length}, starts ${JSON.stringify(url.slice(0, 12))}). ` +
        "A secret set through a shell pipe can pick up a trailing newline; set it with an explicit value instead.",
    );
  }
}

async function main() {
  const { db } = await import("@/lib/db");
  const root = archiveRoot();
  const host = targetHost();

  console.log("");
  console.log(`  source  : ${host}`);
  console.log(`  archive : ${root}`);
  console.log(`  mode    : ${CHECK ? "--check (no writes)" : "write"}`);
  // Before any read: a wrong target must stop here, not after a full export.
  assertSource(root, host);
  console.log("");

  // ── read ────────────────────────────────────────────────────────────────
  // Guides, keyed by project slug + revision label. Every revision, not just the
  // published one: an unpublished draft is exactly the work with no other copy.
  const guides = await db.guide.findMany({
    select: {
      title: true,
      trackSnapshot: true,
      revision: {
        select: { label: true, project: { select: { slug: true } } },
      },
      cards: {
        select: {
          stage: true,
          ordinal: true,
          eyebrow: true,
          title: true,
          lead: true,
          contentBlocks: true,
          isGate: true,
          completionRef: true,
        },
        orderBy: { ordinal: "asc" },
      },
    },
  });

  assertNoLabelCaseCollision(
    guides.map((g) => ({
      projectSlug: g.revision.project.slug,
      label: g.revision.label,
    })),
  );

  const miniLessons = await db.miniLesson.findMany({
    select: {
      slug: true,
      title: true,
      summary: true,
      contentBlocks: true,
      published: true,
      accessTier: true,
      seoTitle: true,
      seoDescription: true,
      byline: true,
      lastVerifiedAt: true,
      cluster: true,
      clusterOrdinal: true,
      // readingMinutes / questionCount / diagramSrc are DERIVED from
      // contentBlocks by the client extension in src/lib/db.ts. Exporting them
      // would archive a value the importer immediately recomputes, so a drifted
      // derivation would show up as archive churn. Deliberately omitted.
      relatedProjects: {
        select: {
          role: true,
          ordinal: true,
          project: { select: { slug: true } },
        },
        orderBy: { ordinal: "asc" },
      },
    },
    orderBy: { slug: "asc" },
  });

  const exams = await db.exam.findMany({
    select: {
      title: true,
      passThreshold: true,
      questions: true,
      project: { select: { slug: true } },
    },
  });

  const cardCount = guides.reduce((n, g) => n + g.cards.length, 0);
  console.log(`  guides       : ${guides.length} (${cardCount} cards)`);
  console.log(`  mini-lessons : ${miniLessons.length}`);
  console.log(`  exams        : ${exams.length}`);
  console.log("");

  // ── floors, BEFORE anything is written ──────────────────────────────────
  const shortfalls: string[] = [];
  if (cardCount < FLOOR.guideCards) shortfalls.push(`guide cards ${cardCount} < ${FLOOR.guideCards}`);
  if (miniLessons.length < FLOOR.miniLessons) shortfalls.push(`mini-lessons ${miniLessons.length} < ${FLOOR.miniLessons}`);
  if (exams.length < FLOOR.exams) shortfalls.push(`exams ${exams.length} < ${FLOOR.exams}`);
  if (shortfalls.length > 0) {
    console.error("  REFUSING: the source looks partial, so the archive is left untouched.");
    for (const s of shortfalls) console.error(`    - ${s}`);
    console.error("");
    console.error("  If the catalog genuinely shrank, adjust FLOOR deliberately in this file.");
    await db.$disconnect();
    process.exit(1);
  }

  // ── serialize ───────────────────────────────────────────────────────────
  const files = new Map<string, string>();

  for (const g of guides) {
    const slug = g.revision.project.slug;
    const label = g.revision.label;
    files.set(
      contentPathFor.guide(slug, label),
      serializeContentFile({ title: g.title, trackSnapshot: g.trackSnapshot }),
    );
    for (const c of g.cards) {
      files.set(contentPathFor.guideCard(slug, label, c.stage), serializeContentFile(c));
    }
  }

  for (const l of miniLessons) {
    const { relatedProjects, ...rest } = l;
    files.set(
      contentPathFor.miniLesson(l.slug),
      serializeContentFile({
        ...rest,
        relatedProjects: relatedProjects.map((r) => ({
          projectSlug: r.project.slug,
          role: r.role,
          ordinal: r.ordinal,
        })),
      }),
    );
  }

  for (const e of exams) {
    const { project, ...rest } = e;
    files.set(contentPathFor.exam(project.slug), serializeContentFile(rest));
  }

  // ── diff against what is on disk ────────────────────────────────────────
  const onDisk = existingFiles(root);
  const changed: string[] = [];
  const added: string[] = [];
  for (const [rel, body] of files) {
    const abs = join(root, rel);
    if (!existsSync(abs)) added.push(rel);
    else if (readFileSync(abs, "utf8") !== body) changed.push(rel);
  }
  // Orphans: rows that were deleted or renamed. Without pruning, the "mirror" is
  // an append-only log and a restore would resurrect deleted lessons.
  const orphans = [...onDisk].filter((rel) => !files.has(rel));

  const dirty = added.length + changed.length + orphans.length;
  const show = (label: string, list: string[]) => {
    if (list.length === 0) return;
    console.log(`  ${label} (${list.length}):`);
    for (const r of list.slice(0, 10)) console.log(`    ${r}`);
    if (list.length > 10) console.log(`    ... ${list.length - 10} more`);
  };
  show("added", added);
  show("changed", changed);
  show("orphaned", orphans);

  if (CHECK) {
    console.log("");
    console.log(dirty === 0 ? "  archive is up to date." : `  archive is STALE (${dirty} file(s)).`);
    await db.$disconnect();
    process.exit(dirty === 0 ? 0 : 1);
  }

  // ── write ───────────────────────────────────────────────────────────────
  for (const [rel, body] of files) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
  for (const rel of orphans) rmSync(join(root, rel), { force: true });

  const bytes = [...files.values()].reduce((n, b) => n + Buffer.byteLength(b), 0);
  console.log("");
  console.log(`  wrote ${files.size} file(s), ${(bytes / 1024).toFixed(1)} KB` +
    (orphans.length ? `, pruned ${orphans.length}` : ""));
  if (dirty === 0) console.log("  (no content changed)");
  console.log("");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
