// Restore authored lesson content from the archive produced by export-content.ts.
//
//   npx tsx scripts/import-content.ts                    # DRY RUN against LOCAL
//   npx tsx scripts/import-content.ts --write            # apply to LOCAL
//   pnpm db:prod scripts/import-content.ts -- --write    # apply to PRODUCTION
//
// DRY RUN IS THE DEFAULT. Nothing is written without --write. A dry run prints
// exactly what would change, per record, so a restore is reviewed before it
// happens rather than after.
//
// WHAT IT RESTORES, AND WHAT IT WILL NOT. This is a CONTENT archive, so it
// restores content into structure that already exists:
//
//   Project    must exist. Never created -- a project carries pricing, access
//              tier and curriculum edges that are not in this archive, so
//              inventing one would be a silent lie.
//   Revision   must exist, matched by label case-insensitively (the DB unique is
//              case-insensitive while the column is case-preserving).
//   Guide      created if missing, from the archived title + track.
//   GuideCard  upserted on the [guideId, stage] unique.
//   MiniLesson upserted on slug, with its project links.
//   Exam       upserted on the projectId unique.
//
// `createdById` is resolved at import time to an admin on the TARGET database,
// never carried from the archive: a user id from one database is meaningless in
// another, and the archive is deliberately PII-free.
//
// Derived MiniLesson columns (readingMinutes / questionCount / diagramSrc) are
// recomputed by the client extension in src/lib/db.ts on write, so they are
// neither archived nor set here.
//
// dotenv defaults to override:false, so under `pnpm db:prod` the prod URL set by
// with-prod-db.ts survives. Run directly, it falls back to .env.local (LOCAL).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { serializeContentFile } from "@/lib/content-export";

/**
 * Compare two JSON values the way the ARCHIVE sees them.
 *
 * The archive is written with recursively sorted keys, so a raw
 * JSON.stringify() of a Prisma value compares key ORDER as well as content and
 * reports every record as changed. Canonicalise both sides through the exporter's
 * own serializer so "unchanged" means unchanged.
 */
function sameJson(a: unknown, b: unknown): boolean {
  return serializeContentFile(a) === serializeContentFile(b);
}

const WRITE = process.argv.includes("--write");

/**
 * `--only <slug>[,<slug>]` narrows the import to named lesson slugs.
 *
 * WHY THIS EXISTS. The archive is an export of PRODUCTION, so importing it into a
 * target that holds content prod does not have OVERWRITES that content. That bit
 * for real on 2026-07-29: l2-01-battery-power-module was authored locally and
 * deliberately held back from prod pending a safety review, so the archive carried
 * a 13-block skeleton while the local database held 79 authored blocks. A full
 * import would have replaced the authored lesson with the skeleton, and the only
 * copy was that database. Narrow the blast radius when you only mean to land one
 * lesson's edits.
 */
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  if (i === -1) return null;
  const raw = process.argv[i + 1];
  if (!raw || raw.startsWith("--")) throw new Error("--only needs a slug (or comma-separated slugs)");
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
})();

/**
 * A card losing most of its blocks is far more likely to be an accidental clobber
 * than an intended edit, so it stops the run unless explicitly allowed. Compares
 * counts only — a same-size rewrite is a normal edit and passes through.
 */
const ALLOW_SHRINK = process.argv.includes("--allow-shrink");
const SHRINK_FACTOR = 0.5;

type Plan = {
  creates: string[];
  updates: string[];
  unchanged: string[];
  skipped: string[];
};

function archiveRoot(): string {
  const repoRoot = process.cwd();
  if (!existsSync(join(repoRoot, "package.json"))) {
    throw new Error(`run from the repo root (cwd is ${repoRoot})`);
  }
  const configured = process.env.CONTENT_ARCHIVE_DIR;
  const root = configured
    ? resolve(configured)
    : resolve(repoRoot, "..", "otd-content-archive", "content");
  if (!existsSync(root)) {
    throw new Error(`archive not found at ${root} (set CONTENT_ARCHIVE_DIR)`);
  }
  return root;
}

function readJson<T>(abs: string): T {
  return JSON.parse(readFileSync(abs, "utf8")) as T;
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((e) => statSync(join(dir, e)).isDirectory());
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((e) => e.endsWith(".json"));
}

/** Compact shape signature, so a dry run says how a record differs, not just that it does. */
function blockSummary(blocks: unknown): string {
  return Array.isArray(blocks) ? `${blocks.length} blocks` : "non-array";
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
  console.log(`  archive : ${root}`);
  console.log(`  target  : ${host}`);
  console.log(`  mode    : ${WRITE ? "*** WRITE ***" : "dry run (no writes)"}`);
  console.log("");

  // The importing author. Never taken from the archive.
  const author =
    (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) ??
    (await db.user.findFirst({ select: { id: true } }));
  if (!author) throw new Error("target database has no User row to attribute content to");

  const plan: Plan = { creates: [], updates: [], unchanged: [], skipped: [] };

  // ── guides + cards ──────────────────────────────────────────────────────
  const guidesRoot = join(root, "guides");
  const shrinking: string[] = [];
  for (const projectSlug of listDirs(guidesRoot)) {
    if (ONLY && !ONLY.has(projectSlug)) {
      plan.skipped.push(`${projectSlug} (not in --only)`);
      continue;
    }
    const project = await db.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });
    if (!project) {
      plan.skipped.push(`project ${projectSlug} (not in target; projects are never created)`);
      continue;
    }

    for (const label of listDirs(join(guidesRoot, projectSlug))) {
      const dir = join(guidesRoot, projectSlug, label);
      // Case-insensitive match: the DB unique is case-insensitive, the column is
      // case-preserving, so the archived directory name may differ in case.
      const revisions = await db.revision.findMany({
        where: { projectId: project.id },
        select: { id: true, label: true },
      });
      const revision = revisions.find(
        (r) => r.label.toLowerCase() === label.toLowerCase(),
      );
      if (!revision) {
        plan.skipped.push(`${projectSlug}@${label} (no such revision in target)`);
        continue;
      }

      const meta = existsSync(join(dir, "_guide.json"))
        ? readJson<{ title: string; trackSnapshot: string | null }>(join(dir, "_guide.json"))
        : null;

      let guide = await db.guide.findUnique({
        where: { revisionId: revision.id },
        select: { id: true },
      });
      if (!guide) {
        plan.creates.push(`guide ${projectSlug}@${revision.label}`);
        if (WRITE) {
          guide = await db.guide.create({
            data: {
              revisionId: revision.id,
              title: meta?.title ?? `${projectSlug} build guide`,
              trackSnapshot: (meta?.trackSnapshot ?? null) as never,
              createdById: author.id,
            },
            select: { id: true },
          });
        }
      }

      for (const file of listJson(dir)) {
        if (file === "_guide.json") continue;
        const stage = file.replace(/\.json$/, "");
        const card = readJson<Record<string, unknown>>(join(dir, file));
        const ref = `${projectSlug}@${revision.label}/${stage}`;

        if (!guide) {
          // Dry run against a target with no Guide row yet: the cards would be
          // created alongside it, so report rather than silently omitting them.
          plan.creates.push(`card ${ref} (${blockSummary(card.contentBlocks)})`);
          continue;
        }

        const existing = await db.guideCard.findUnique({
          where: { guideId_stage: { guideId: guide.id, stage: stage as never } },
          select: { id: true, contentBlocks: true, eyebrow: true, title: true, lead: true, ordinal: true, isGate: true },
        });

        const data = {
          ordinal: card.ordinal as number,
          eyebrow: card.eyebrow as string,
          title: card.title as string,
          lead: (card.lead ?? null) as string | null,
          contentBlocks: card.contentBlocks as never,
          isGate: card.isGate as boolean,
          completionRef: (card.completionRef ?? null) as never,
        };

        if (!existing) {
          plan.creates.push(`card ${ref} (${blockSummary(card.contentBlocks)})`);
        } else {
          const same =
            sameJson(existing.contentBlocks, card.contentBlocks) &&
            existing.eyebrow === data.eyebrow &&
            existing.title === data.title &&
            existing.lead === data.lead &&
            existing.ordinal === data.ordinal &&
            existing.isGate === data.isGate;
          if (same) {
            plan.unchanged.push(`card ${ref}`);
            continue;
          }
          const before = Array.isArray(existing.contentBlocks)
            ? existing.contentBlocks.length
            : 0;
          const after = Array.isArray(card.contentBlocks) ? card.contentBlocks.length : 0;
          if (before > 0 && after < before * SHRINK_FACTOR) {
            shrinking.push(`${ref} (${before} -> ${after} blocks)`);
            // Thrown BEFORE this card's upsert, so the clobber never lands. Cards
            // already written this run were non-shrinking and the import is
            // idempotent, so re-running after review is safe.
            if (WRITE && !ALLOW_SHRINK) {
              throw new Error(
                `refusing to shrink ${ref} from ${before} to ${after} blocks.\n` +
                  `  The archive is an export of PRODUCTION, so this target holds content prod does not.\n` +
                  `  Check whether that content is authored-but-unpushed before you overwrite it.\n` +
                  `  Narrow the run with --only <slug>, or pass --allow-shrink if the reduction is intended.`,
              );
            }
          }
          plan.updates.push(
            `card ${ref} (${blockSummary(existing.contentBlocks)} -> ${blockSummary(card.contentBlocks)})`,
          );
        }

        if (WRITE) {
          await db.guideCard.upsert({
            where: { guideId_stage: { guideId: guide.id, stage: stage as never } },
            create: { guideId: guide.id, stage: stage as never, ...data },
            update: data,
          });
        }
      }
    }
  }

  // ── mini-lessons ────────────────────────────────────────────────────────
  // `--only` names PROJECT slugs, and a library mini-lesson has its own slug rather
  // than belonging to one project, so there is no sensible subset: narrowing to a
  // lesson means "don't touch the library at all".
  if (ONLY) {
    plan.skipped.push(`library (--only names project slugs; library is not project-scoped)`);
  }
  for (const file of ONLY ? [] : listJson(join(root, "library"))) {
    const l = readJson<Record<string, unknown>>(join(root, "library", file));
    const slug = l.slug as string;
    const existing = await db.miniLesson.findUnique({
      where: { slug },
      select: { id: true, contentBlocks: true, title: true },
    });

    const data = {
      title: l.title as string,
      summary: (l.summary ?? null) as string | null,
      contentBlocks: l.contentBlocks as never,
      published: l.published as boolean,
      accessTier: l.accessTier as never,
      seoTitle: (l.seoTitle ?? null) as string | null,
      seoDescription: (l.seoDescription ?? null) as string | null,
      byline: (l.byline ?? null) as string | null,
      lastVerifiedAt: l.lastVerifiedAt ? new Date(l.lastVerifiedAt as string) : null,
      cluster: (l.cluster ?? null) as string | null,
      clusterOrdinal: l.clusterOrdinal as number,
    };

    if (!existing) plan.creates.push(`lesson ${slug} (${blockSummary(l.contentBlocks)})`);
    else if (
      sameJson(existing.contentBlocks, l.contentBlocks) &&
      existing.title === data.title
    ) {
      plan.unchanged.push(`lesson ${slug}`);
    } else {
      plan.updates.push(
        `lesson ${slug} (${blockSummary(existing.contentBlocks)} -> ${blockSummary(l.contentBlocks)})`,
      );
    }

    if (WRITE) {
      const saved = await db.miniLesson.upsert({
        where: { slug },
        create: { slug, createdById: author.id, ...data },
        update: data,
      });
      // Project links carry authored role + ordinal. Resolve slugs on the target;
      // a link to a project that is not here is reported, never invented.
      for (const link of (l.relatedProjects ?? []) as {
        projectSlug: string;
        role: string;
        ordinal: number;
      }[]) {
        const p = await db.project.findUnique({
          where: { slug: link.projectSlug },
          select: { id: true },
        });
        if (!p) {
          plan.skipped.push(`link ${slug} -> ${link.projectSlug} (project not in target)`);
          continue;
        }
        await db.projectMiniLesson.upsert({
          where: {
            projectId_miniLessonId_role: {
              projectId: p.id,
              miniLessonId: saved.id,
              role: link.role as never,
            },
          },
          create: {
            projectId: p.id,
            miniLessonId: saved.id,
            role: link.role as never,
            ordinal: link.ordinal,
          },
          update: { ordinal: link.ordinal },
        });
      }
    }
  }

  // ── exams ───────────────────────────────────────────────────────────────
  for (const file of listJson(join(root, "exams"))) {
    const slug = file.replace(/\.json$/, "");
    // An exam IS project-scoped (one per project), so --only narrows it by slug.
    if (ONLY && !ONLY.has(slug)) {
      plan.skipped.push(`exam ${slug} (not in --only)`);
      continue;
    }
    const e = readJson<{ title: string; passThreshold: number; questions: unknown }>(
      join(root, "exams", file),
    );
    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!project) {
      plan.skipped.push(`exam ${slug} (project not in target)`);
      continue;
    }
    const existing = await db.exam.findUnique({
      where: { projectId: project.id },
      select: { id: true, questions: true },
    });
    const qCount = Array.isArray(e.questions) ? e.questions.length : 0;

    if (!existing) plan.creates.push(`exam ${slug} (${qCount} questions)`);
    else if (sameJson(existing.questions, e.questions)) {
      plan.unchanged.push(`exam ${slug}`);
    } else {
      const had = Array.isArray(existing.questions) ? existing.questions.length : 0;
      plan.updates.push(`exam ${slug} (${had} -> ${qCount} questions)`);
    }

    if (WRITE) {
      const data = {
        title: e.title,
        passThreshold: e.passThreshold,
        questions: e.questions as never,
      };
      await db.exam.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, ...data },
        update: data,
      });
    }
  }

  // ── report ──────────────────────────────────────────────────────────────
  const show = (label: string, list: string[]) => {
    if (list.length === 0) return;
    console.log(`  ${label} (${list.length}):`);
    for (const r of list.slice(0, 15)) console.log(`    ${r}`);
    if (list.length > 15) console.log(`    ... ${list.length - 15} more`);
    console.log("");
  };
  show("would CREATE", plan.creates);
  show("would UPDATE", plan.updates);
  show("SKIPPED", plan.skipped);
  console.log(`  unchanged : ${plan.unchanged.length}`);
  console.log("");

  // Shown in FULL and last, so it cannot scroll past inside a long update list.
  // A --write run throws at the first of these rather than reaching here.
  if (shrinking.length) {
    console.log(`  *** ${shrinking.length} card(s) would LOSE more than half their blocks ***`);
    for (const s of shrinking) console.log(`    ${s}`);
    console.log("");
    console.log("  The archive is an export of PRODUCTION. A target holding content prod");
    console.log("  does not have (authored locally, not yet pushed) gets overwritten by it.");
    console.log("  Narrow with --only <slug>, or pass --allow-shrink if that is intended.");
    console.log("");
  }

  if (!WRITE) {
    const touched = plan.creates.length + plan.updates.length;
    console.log(
      touched === 0
        ? "  dry run: target already matches the archive."
        : `  dry run: ${touched} record(s) would change. Re-run with --write to apply.`,
    );
  } else {
    console.log(`  applied ${plan.creates.length} create(s), ${plan.updates.length} update(s).`);
  }
  console.log("");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
