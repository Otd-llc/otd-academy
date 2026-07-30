// Give RV1 (Bourns 3362P-1-103LF) a real KiCad footprint.
//
// WHY THIS EXISTS. KiCad 10 ships no 3362 land pattern. Every 3362-adjacent
// footprint in `Potentiometer_THT` is a different Bourns body (3386 = 9.53 mm,
// 3266 = 4.83 mm, 3296 = 9.53 mm multiturn) and, worse, they use the triangular
// 0.1 x 0.2 inch pin pattern. The 3362P does not: its datasheet (REV 06/20)
// prints "ALL PINS IN-LINE ON 2.54 (.100) CENTER". Pointing the part at any of
// them would ship a land pattern the part does not fit.
//
// With no symbol/footprint and no asset, the export auto-STUBS the part, and
// the stub footprint generator only draws pads for TWO-terminal parts. A
// 3-terminal trimpot would ship as an outline with no pads at all, which is
// worse than wrong: it is unusable.
//
// So the footprint is hand-authored from the datasheet and lives in the repo at
// `docs/boards/l1-05-internal-adc/kicad/3362P-1-103LF.kicad_mod`, where it is
// reviewable in a diff. This script uploads it and points a FOOTPRINT PartAsset
// at it.
//
// TRUST. The asset is created UNVERIFIED, deliberately. The pad pattern, lead
// diameter and body size are datasheet-exact; where the body sits relative to
// the pin row is the one dimension the datasheet drawing does not resolve
// cleanly, so it is drawn to the conservative reading (see starter-pack.md).
// Verifying it means holding a real 3362P against a 1:1 printout. That is the
// owner's `[S]` tick, not this script's.
//
// SAFETY. Additive and reversible: it mints a NEW r2Key rather than overwriting
// any object, and re-running replaces the row's key rather than duplicating the
// asset. Dry run is the default.
//
//   LOCAL: pnpm exec tsx scripts/seed-l105-trimpot-footprint.ts --write
//   PROD:  pnpm db:prod scripts/seed-l105-trimpot-footprint.ts --yes -- --write   (owner only)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { createId } from "@paralleldrive/cuid2";

const MPN = "3362P-1-103LF";
const SRC = "docs/boards/l1-05-internal-adc/kicad/3362P-1-103LF.kicad_mod";
const FILENAME = "3362P-1-103LF.kicad_mod";
const CONTENT_TYPE = "text/plain; charset=utf-8";

/** Cheap structural guards, so a mangled file cannot become a part's footprint. */
function assertLooksRight(text: string) {
  const pads = [...text.matchAll(/\(pad "(\d)" thru_hole circle\s*\(at ([-\d.]+) ([-\d.]+)\)/g)];
  if (pads.length !== 3) throw new Error(`expected 3 THT pads, found ${pads.length}`);
  const xs = pads.map((m) => Number(m[2]));
  const ys = pads.map((m) => Number(m[3]));
  if (!ys.every((y) => y === 0)) throw new Error(`pads are not in-line: y = ${ys.join(", ")}`);
  if (xs.join(",") !== "0,2.54,5.08") throw new Error(`pad pitch is not 2.54 in-line: x = ${xs.join(", ")}`);
  if (!text.includes("(drill 0.8)")) throw new Error("expected a 0.8 mm drill for the 0.46 mm leads");
  if (!/\(footprint "3362P-1-103LF"/.test(text)) throw new Error("footprint name is not 3362P-1-103LF");
}

async function main() {
  const write = process.argv.includes("--write");
  const dbUrl = process.env.DATABASE_URL ?? "";
  const target = /localhost|127\.0\.0\.1/.test(dbUrl) ? "LOCAL" : "*** PROD ***";
  console.log(`DB target: ${target}   mode: ${write ? "WRITE" : "dry run"}\n`);

  const text = readFileSync(SRC, "utf8");
  assertLooksRight(text);
  const body = Buffer.from(text, "utf8");
  console.log(`${SRC}: ${body.byteLength} bytes, structure ok`);

  const { db } = await import("@/lib/db");
  const part = await db.part.findFirst({
    where: { mpn: MPN },
    select: { id: true, manufacturer: true, mpn: true },
  });
  if (!part) throw new Error(`part not found: ${MPN}`);
  console.log(`part: ${part.manufacturer} / ${part.mpn} (${part.id})`);

  const existing = await db.partAsset.findFirst({
    where: { partId: part.id, kind: "FOOTPRINT" },
    select: { id: true, r2Key: true, trust: true },
  });
  const key = `parts/${part.id}/footprint-${createId()}.kicad_mod`;
  console.log(existing ? `replacing asset ${existing.id} (was ${existing.r2Key})` : "creating a new FOOTPRINT asset");
  console.log(`new r2Key: ${key}`);

  if (!write) {
    console.log("\ndry run, nothing written. re-run with --write to apply.");
    await db.$disconnect();
    return;
  }

  const { putR2Object, ensureR2Enabled } = await import("@/lib/part-r2");
  ensureR2Enabled();
  await putR2Object(key, body, CONTENT_TYPE);
  console.log("uploaded to R2");

  if (existing) {
    await db.partAsset.update({
      where: { id: existing.id },
      data: {
        r2Key: key,
        filename: FILENAME,
        byteSize: body.byteLength,
        contentType: CONTENT_TYPE,
        ref: "3362P-1-103LF",
        source: "hand-made",
        trust: "UNVERIFIED",
        verifiedById: null,
        verifiedAt: null,
      },
    });
  } else {
    // createdById is a required FK and there is no system user, so borrow an
    // existing asset's creator (the adding-parts convention).
    const creator = await db.partAsset.findFirst({ select: { createdById: true } });
    if (!creator) throw new Error("no existing PartAsset to borrow a createdById from");
    await db.partAsset.create({
      data: {
        partId: part.id,
        kind: "FOOTPRINT",
        r2Key: key,
        filename: FILENAME,
        byteSize: body.byteLength,
        contentType: CONTENT_TYPE,
        ref: "3362P-1-103LF",
        source: "hand-made",
        trust: "UNVERIFIED",
        createdById: creator.createdById,
      },
    });
  }
  console.log("done. the footprint is now the part's FOOTPRINT asset (UNVERIFIED).");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
