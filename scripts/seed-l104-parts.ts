// Create the 3 NEW parts the l1-04-single-servo BOM needs (every other line
// reuses the existing live catalog). Idempotent upsert on (manufacturer, mpn)
// with `update: {}` — never clobbers an existing curated part. Exact strings
// MUST match docs/boards/l1-04-single-servo/bom.csv byte-for-byte (the strict
// BOM-import key). Datasheet URLs are web-sourced (not guessed). Category left
// null: PTC/Schottky/TVS have no leaf in the 6-node category tree yet (F10).
//
// PROD write (.env.local DATABASE_URL). Run in PowerShell:
//   pnpm exec tsx scripts/seed-l104-parts.ts
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
    manufacturer: "Littelfuse",
    mpn: "miniSMDC150F-2",
    description:
      "Resettable PPTC fuse — I_hold 1.5 A / I_trip 3.0 A, V_max 6 VDC, 1812 (4532 metric). Servo-rail overcurrent protection (F2).",
    datasheetUrl:
      "https://www.littelfuse.com/assetdocs/littelfuse-ptc-minismdc-datasheet?assetguid=3ed735aa-64ed-43a6-bc20-610590bc99c6",
  },
  {
    manufacturer: "Vishay General Semiconductor",
    mpn: "SS34-E3/57T",
    description:
      "Schottky rectifier — 40 V / 3 A, V_F 0.5 V, I_FSM 100 A, SMC (DO-214AB). Shunt reverse-polarity crowbar (D2).",
    datasheetUrl: "https://www.vishay.com/docs/88751/ss32.pdf",
  },
  {
    manufacturer: "Littelfuse",
    mpn: "SMAJ6.0A",
    description:
      "Unidirectional TVS diode — V_wm 6.0 V, V_clamp 10.3 V, 400 W, SMA (DO-214AC). Servo-rail back-EMF / transient clamp (D3).",
    datasheetUrl:
      "https://www.littelfuse.com/assetdocs/tvs-diodes-smaj-datasheet?assetguid=13c2a823-03b8-4d1f-9ddc-9b44670aed9d",
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

  console.log(`\nDone. ${PARTS.length} parts upserted (idempotent).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
