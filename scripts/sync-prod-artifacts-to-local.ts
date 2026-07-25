// Sync PROD's learner-facing file artifacts into the LOCAL dev database.
//
//   dry run:  pnpm exec tsx scripts/sync-prod-artifacts-to-local.ts
//   apply:    pnpm exec tsx scripts/sync-prod-artifacts-to-local.ts --write
//   one board: ... --slug=l1-01-wroom-breakout
//
// WHY THIS EXISTS
// ---------------
// `localhost:3000` reads `.env.local`, whose DATABASE_URL is the LOCAL Postgres.
// Scripts that create artifacts are usually run under `pnpm db:prod`, so only PROD
// gets the new row. The dev server then keeps resolving whatever LOCAL's newest
// artifact is — silently serving an old file with no error anywhere.
//
// That cost an hour on 2026-07-25: the L1.01 KiCad starter was rebuilt on prod, but
// clicking "Download KiCad starter" on the dev server handed back a 2026-06-12
// export — the pre-ECN U1 footprint (pad 41 split into 41_1..41_21 with twelve
// 0.2 mm thermal vias) and no title block. It presents as a broken feature, not as
// stale data, because every layer is behaving correctly.
//
// R2 is a SINGLE shared bucket, so a local row can point at the very same key prod
// uses. That makes local byte-identical to prod instead of duplicating the object.
// Nothing is ever written to prod or to R2 here; this is local-DB-insert only.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { makeAdapter, isLocalDbUrl } from "@/lib/db-adapter";

// The file-backed subkinds a learner can actually download, plus the 3D model the
// board hero renders. These are the ones whose absence looks like a bug.
const SUBKINDS = ["BOM_EXPORT", "GERBER_ZIP", "BRINGUP_MEASUREMENTS_CSV", "MODEL_3D"] as const;

type Row = {
  stage: string | null;
  subkind: string | null;
  title: string | null;
  fileKey: string | null;
  fileMime: string | null;
  fileBytes: number | null;
  renderKey: string | null;
  renderBytes: number | null;
  renderMime: string | null;
  renderBounds: unknown;
  createdAt: Date;
  id: string;
};

const SELECT = {
  id: true, stage: true, subkind: true, title: true,
  fileKey: true, fileMime: true, fileBytes: true,
  renderKey: true, renderBytes: true, renderMime: true, renderBounds: true,
  createdAt: true,
} as const;

async function main() {
  const write = process.argv.includes("--write");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);

  const localUrl = process.env.DATABASE_URL;
  const prodUrl = process.env.PROD_DATABASE_URL;
  if (!localUrl) throw new Error("DATABASE_URL not set");
  if (!isLocalDbUrl(localUrl)) {
    throw new Error(`refusing: DATABASE_URL must be LOCAL (got ${new URL(localUrl).hostname}). This script only ever writes to local.`);
  }
  if (!prodUrl) throw new Error("PROD_DATABASE_URL not set in .env.local");
  if (isLocalDbUrl(prodUrl)) throw new Error("PROD_DATABASE_URL looks local — refusing");

  const local = new PrismaClient({ adapter: makeAdapter(localUrl), log: ["error", "warn"] });
  const prod = new PrismaClient({ adapter: makeAdapter(prodUrl), log: ["error", "warn"] });
  console.log(`local  ${new URL(localUrl).hostname}/${new URL(localUrl).pathname.slice(1)}`);
  console.log(`prod   ${new URL(prodUrl).hostname}  (READ ONLY)\n`);

  // R2 fetch is used only to prove an object exists before pointing a row at it.
  const { getR2ObjectBytes, ensureR2Enabled } = await import("@/lib/part-r2");
  ensureR2Enabled();

  const prodProjects = await prod.project.findMany({
    where: {
      publishedRevisionId: { not: null },
      ...(slugArg ? { slug: slugArg } : {}),
    },
    select: { slug: true, publishedRevisionId: true },
    orderBy: { slug: "asc" },
  });
  if (!prodProjects.length) throw new Error(slugArg ? `no published project with slug ${slugArg} on prod` : "no published projects on prod");

  let planned = 0, skipped = 0, blocked = 0;

  for (const p of prodProjects) {
    const localProject = await local.project.findUnique({
      where: { slug: p.slug },
      select: { publishedRevisionId: true },
    });
    if (!localProject?.publishedRevisionId) {
      console.log(`${p.slug}: not published locally — skipping (run pnpm db:pull-prod to refresh local)`);
      blocked++;
      continue;
    }
    if (localProject.publishedRevisionId !== p.publishedRevisionId) {
      // Artifact R2 keys embed the revision id, so a mismatch means the keys would
      // not describe the local revision. Refuse rather than write a misleading row.
      console.log(`${p.slug}: published revision differs (prod ${p.publishedRevisionId} vs local ${localProject.publishedRevisionId}) — skipping`);
      blocked++;
      continue;
    }

    const lines: string[] = [];
    for (const subkind of SUBKINDS) {
      const newest = (client: PrismaClient, revisionId: string) =>
        client.artifact.findFirst({
          where: { revisionId, subkind: subkind as never, fileKey: { not: null } },
          orderBy: { createdAt: "desc" },
          select: SELECT,
        }) as unknown as Promise<Row | null>;

      const pRow = await newest(prod, p.publishedRevisionId!);
      if (!pRow) continue;
      const lRow = await newest(local, localProject.publishedRevisionId);

      if (lRow?.fileKey === pRow.fileKey) { lines.push(`    ${subkind.padEnd(26)} already current`); skipped++; continue; }
      if (lRow && lRow.createdAt > pRow.createdAt) {
        lines.push(`    ${subkind.padEnd(26)} LOCAL IS NEWER (${lRow.createdAt.toISOString().slice(0, 16)}) — leaving alone`);
        skipped++;
        continue;
      }

      // Prove the object is really in the bucket before a row claims it is.
      let actual: number;
      try {
        actual = (await getR2ObjectBytes(pRow.fileKey!)).length;
      } catch (e) {
        lines.push(`    ${subkind.padEnd(26)} R2 object MISSING (${(e as Error).message}) — skipping`);
        blocked++;
        continue;
      }
      if (pRow.fileBytes != null && actual !== pRow.fileBytes) {
        lines.push(`    ${subkind.padEnd(26)} R2 holds ${actual} B but prod row says ${pRow.fileBytes} B — skipping`);
        blocked++;
        continue;
      }

      const from = lRow ? `${lRow.fileBytes} B ${lRow.createdAt.toISOString().slice(0, 10)}` : "absent";
      lines.push(`    ${subkind.padEnd(26)} ${from}  ->  ${actual} B ${pRow.createdAt.toISOString().slice(0, 10)}${write ? "" : "  (dry run)"}`);
      planned++;

      if (!write) continue;

      const admin = await local.user.findFirstOrThrow({ where: { role: "ADMIN" as never }, select: { id: true } });
      await local.artifact.create({
        data: {
          revisionId: localProject.publishedRevisionId,
          stage: pRow.stage as never,
          kind: "FILE" as never,
          subkind: pRow.subkind as never,
          // Artifact.title is non-nullable; prod rows always carry one, but the
          // select types it as nullable so fall back rather than cast.
          title: pRow.title ?? pRow.subkind ?? "artifact",
          fileKey: pRow.fileKey,
          fileMime: pRow.fileMime,
          fileBytes: actual,
          renderKey: pRow.renderKey,
          renderBytes: pRow.renderBytes,
          renderMime: pRow.renderMime,
          renderBounds: pRow.renderBounds as never,
          createdBy: admin.id,
        },
      });
    }

    if (lines.length) {
      console.log(`${p.slug}`);
      lines.forEach((l) => console.log(l));
    }
  }

  console.log(`\n${write ? "WROTE" : "would write"} ${planned}; ${skipped} already current or local-newer; ${blocked} blocked`);
  if (!write && planned) console.log("re-run with --write to apply");
  await local.$disconnect();
  await prod.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
