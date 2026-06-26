// Create the 1 NEW part the l1-05-internal-adc BOM needs (every other line
// reuses the existing live catalog). Idempotent upsert on (manufacturer, mpn)
// with `update: {}` — never clobbers an existing curated part. Exact strings
// MUST match docs/boards/l1-05-internal-adc/bom.csv byte-for-byte (the strict
// BOM-import key); manufacturer is `Bourns` (catalog convention, NOT DigiKey's
// "Bourns Inc."). Datasheet URL is web-sourced (the canonical Bourns 3362 PDF).
// Category left null: a trimpot has no leaf in the 6-node category tree yet (F10).
//
// PROD write (.env.local DATABASE_URL). Run in PowerShell:
//   pnpm exec tsx scripts/seed-l105-parts.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

interface NewPart {
  manufacturer: string;
  mpn: string;
  description: string;
  datasheetUrl: string | null;
}

const PARTS: NewPart[] = [
  {
    manufacturer: "Bourns",
    mpn: "3362P-1-103LF",
    description:
      "Cermet trimpot — 10 kΩ ±10%, single-turn (240° electrical / 270° mechanical), top-adjust, 6 mm (1/4\") THT, 0.5 W. Terminal 2 = wiper. Sweepable analog input source (RV1).",
    datasheetUrl: "https://www.bourns.com/docs/Product-Datasheets/3362.pdf",
  },
];

async function main() {
  const { db } = await import("@/lib/db");

  // Borrow an existing part's creator (createdById is a required FK; no system user).
  const seed = await db.part.findFirst({ select: { createdById: true } });
  const createdById = seed?.createdById;
  if (!createdById) throw new Error("No existing part to borrow a creator from.");

  for (const p of PARTS) {
    const part = await db.part.upsert({
      where: { manufacturer_mpn: { manufacturer: p.manufacturer, mpn: p.mpn } },
      update: {}, // never clobber an existing curated part
      create: {
        manufacturer: p.manufacturer,
        mpn: p.mpn,
        description: p.description,
        datasheetUrl: p.datasheetUrl,
        lifecycle: "ACTIVE",
        createdById,
      },
      select: { id: true, manufacturer: true, mpn: true, lifecycle: true, createdAt: true },
    });
    console.log(`  ${part.manufacturer.padEnd(30)} ${part.mpn.padEnd(20)} [${part.lifecycle}] id=${part.id}`);
  }

  console.log(`\nDone. ${PARTS.length} part upserted (idempotent).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
