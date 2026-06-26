// l1-03-ws2812-node — create the 8 NEW library parts after the design passed the
// Recursive Board-Design Validation Protocol (design-stage DRY @ Pass 12).
// Direct-Prisma seed-style write (server actions can't be scripted — requireUser/
// revalidatePath). Idempotent: upsert on the (manufacturer, mpn) unique key, so a
// re-run is a no-op. Additive only — no deletes, no BOM/revision changes.
// Strict-match note: these (manufacturer, mpn) strings MUST equal the bom.csv rows
// exactly — that's the key the BOM CSV import matches on.
// Run: pnpm exec tsx scripts/seed-l103-parts.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import type { PartCategory } from "@prisma/client";

const NEW_PARTS: Array<{
  manufacturer: string;
  mpn: string;
  description: string;
  category: PartCategory | null; // legacy enum — only MLCC maps; rest null (tree categorization deferred)
  footprint: string | null;
  datasheetUrl: string | null;
  notes: string;
}> = [
  {
    manufacturer: "Texas Instruments",
    mpn: "SN74AHCT125D",
    description:
      "Quad bus buffer gate, 3-state outputs, HCT (TTL-compatible inputs) — 3.3 V→5 V level shifter; SOIC-14",
    category: null,
    footprint: "SOIC-14",
    datasheetUrl: "https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf",
    notes: "L1.03 level shifter (U3). Datasheet-verified Pass 5.",
  },
  {
    manufacturer: "XINGLIGHT",
    mpn: "XL-5050RGBC-WS2812B",
    description:
      "Addressable RGB LED, WS2812B-compatible, integrated control IC, 5050 4-pin",
    category: null,
    footprint: "LED_5050",
    datasheetUrl:
      "https://www.lcsc.com/datasheet/lcsc_datasheet_2301111130_XINGLIGHT-XL-5050RGBC-WS2812B_C2843785.pdf",
    notes:
      "L1.03 onboard pixel (LED3). XINGLIGHT clone; datasheet LCSC C2843785, verified Pass 11 (VDD 3.5-5.5V, VIH 0.7VDD, VDI abs-max VDD+5.5V, RES >=80us). DOUT VOH unspecified (F10-4 residual).",
  },
  {
    manufacturer: "TE Connectivity",
    mpn: "282837-3",
    description:
      "3-position 5.08 mm pitch PCB screw terminal block, THT (Buchanan 282837 series)",
    category: null,
    footprint: "TerminalBlock_5.08mm_1x03",
    datasheetUrl: null,
    notes: "L1.03 strip output (J4). Reused from TB-1-POWER family.",
  },
  {
    manufacturer: "TE Connectivity",
    mpn: "282837-2",
    description:
      "2-position 5.08 mm pitch PCB screw terminal block, THT (Buchanan 282837 series)",
    category: null,
    footprint: "TerminalBlock_5.08mm_1x02",
    datasheetUrl: null,
    notes: "L1.03 5V injection (J5). Reused from TB-1-POWER family.",
  },
  {
    manufacturer: "Panasonic",
    mpn: "EEU-FR1C102",
    description:
      "1000 uF 16 V aluminum electrolytic capacitor, radial low-ESR (FR series), ~D10x20 mm",
    category: null,
    footprint: "CP_Radial_D10.0mm_P5.00mm",
    datasheetUrl: null,
    notes: "L1.03 strip inrush bulk (C10). Tall — enclosure keep-out (L9-1).",
  },
  {
    manufacturer: "Littelfuse",
    mpn: "SMAJ5.0A",
    description:
      "Uni-directional TVS diode, 5.0 V VRWM, 6.4 V VBR(min), 400 W, SMA (DO-214AC)",
    category: null,
    footprint: "D_SMA",
    datasheetUrl: null,
    notes:
      "L1.03 5V_EXT over-voltage/reverse clamp (D2). I_R ~800 uA @5 V (budgeted). Recommended strip supply <=5.25 V.",
  },
  {
    manufacturer: "Nexperia",
    mpn: "PESD5V0S1BA",
    description:
      "Bidirectional ESD protection diode, 5 V VRWM, 35/45 pF, SOD-323",
    category: null,
    footprint: "D_SOD-323",
    datasheetUrl:
      "https://assets.nexperia.com/documents/data-sheet/PESD5V0S1BA_BB_BL.pdf",
    notes:
      "L1.03 J4 DATA ESD (D3). 35/45 pF (NOT low-cap) but R8*C ~21ns << pulse; chosen for solderability. Verified Pass 11.",
  },
  {
    manufacturer: "Samsung Electro-Mechanics",
    mpn: "CL21A475KAQNNNE",
    description: "MLCC 4.7 uF +/-10% 25 V X5R, 0805",
    category: "MLCC_CAPACITOR",
    footprint: "0805",
    datasheetUrl:
      "https://datasheet.octopart.com/CL21A475KAQNNNE-Samsung-Electro-Mechanics-datasheet-81462145.pdf",
    notes:
      "L1.03 VBUS bulk (C11). New per F10-1 — keeps total VBUS bulk (5.9 uF) under the USB-2.0 10 uF inrush ceiling.",
  },
];

async function main() {
  const { db } = await import("@/lib/db");

  // createdById is required (FK to User, onDelete: Restrict). Borrow the creator of
  // any existing library part — guaranteed a valid admin (the library is non-empty).
  const seedPart = await db.part.findFirst({ select: { createdById: true } });
  if (!seedPart) throw new Error("Parts library is empty — no user to attribute to.");
  const userId = seedPart.createdById;

  console.log(`Creating ${NEW_PARTS.length} l1-03 parts (createdById=${userId})\n`);

  for (const p of NEW_PARTS) {
    const before = await db.part.findUnique({
      where: { manufacturer_mpn: { manufacturer: p.manufacturer, mpn: p.mpn } },
      select: { id: true },
    });
    const part = await db.part.upsert({
      where: { manufacturer_mpn: { manufacturer: p.manufacturer, mpn: p.mpn } },
      create: {
        manufacturer: p.manufacturer,
        mpn: p.mpn,
        description: p.description,
        category: p.category ?? undefined,
        footprint: p.footprint ?? undefined,
        datasheetUrl: p.datasheetUrl ?? undefined,
        lifecycle: "ACTIVE",
        notes: p.notes,
        createdById: userId,
      },
      update: {}, // idempotent — never clobber an existing part
      select: { id: true, manufacturer: true, mpn: true, lifecycle: true },
    });
    const tag = before ? "exists  " : "CREATED ";
    console.log(`  ${tag} ${part.manufacturer.padEnd(28)} ${part.mpn.padEnd(24)} [${part.lifecycle}] ${part.id}`);
  }

  const total = await db.part.count();
  console.log(`\nLibrary parts total: ${total}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
