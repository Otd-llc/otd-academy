// Create the 9 NEW parts the l2-01-battery-power-module BOM needs (the other 17
// lines reuse the existing live catalog). Idempotent upsert on (manufacturer, mpn)
// with `update: {}` — never clobbers a curated part. Exact strings MUST equal
// docs/boards/l2-01-battery-power-module/bom.csv byte-for-byte (the strict BOM-import
// key). category = legacy enum only where a token genuinely fits (the 2 resistors =
// PASSIVE_RESISTOR); the rest land null (no leaf for boost/inductor/protection/FET/
// connector/switch — category-tree gap F10, non-blocking). Datasheet URL real http(s)
// or null (no guessing — FS8205A generic + EG1218 left null for the owner to fill).
//
// PROD write. Run in PowerShell:  pnpm exec tsx scripts/seed-l201-parts.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

interface NewPart {
  manufacturer: string;
  mpn: string;
  description: string;
  category: "PASSIVE_RESISTOR" | null;
  datasheetUrl: string | null;
}

const PARTS: NewPart[] = [
  {
    manufacturer: "Texas Instruments",
    mpn: "TLV61048DBVR",
    description:
      "Non-synchronous boost converter, SOT-23-6. Vin 2.65–5.5 V, Vout up to 14 V, 3.7 A typ (2.9 A min) switch limit, 600 kHz/1 MHz (FREQ), Vref 0.80 V, internal compensation + 2 ms soft-start. Boosts VSYS to the 5 V rail (U3).",
    category: null,
    datasheetUrl: "https://www.ti.com/lit/ds/symlink/tlv61048.pdf",
  },
  {
    manufacturer: "Bourns",
    mpn: "SRN6045TA-4R7M",
    description:
      "Semi-shielded power inductor 4.7 µH ±20%, Isat 6.8 A, Irms 4.5 A, DCR 26 mΩ, 6045 (6.0×6.0×4.5 mm). Boost inductor (L1).",
    category: null,
    datasheetUrl: "https://www.bourns.com/docs/product-datasheets/srn6045ta.pdf",
  },
  {
    manufacturer: "UMW",
    mpn: "DW01A",
    description:
      "Single-cell Li-ion/Li-Po battery protection controller, SOT-23-6. OVP 4.3 V/rel 4.1, UVP 2.4 V/rel 3.0, OCP 0.15 V, SCP 1.35 V; drives an external dual N-FET on the cell B− low side (U2).",
    category: null,
    datasheetUrl: "https://hmsemi.com/downfile/DW01A.PDF",
  },
  {
    manufacturer: "Fortune Semiconductor",
    mpn: "FS8205A",
    description:
      "Dual common-drain N-channel MOSFET, SOT-23-6. VDS 20 V, Rds(on) ~25 mΩ@4.5 V / ~32 mΩ@2.5 V. Charge + discharge switch for the DW01A 1S protection (Q1).",
    category: null,
    datasheetUrl: null,
  },
  {
    manufacturer: "Diodes Incorporated",
    mpn: "DMG3415U-7",
    description:
      "P-channel MOSFET, SOT-23. VDS −20 V, ID −4 A, Rds(on) 42.5 mΩ@−4.5 V, low-Vth logic-level; body diode drain→source. Load-share / power-path switch (Q2).",
    category: null,
    datasheetUrl: "https://www.diodes.com/datasheet/download/DMG3415U.pdf",
  },
  {
    manufacturer: "JST Sales America",
    mpn: "S2B-PH-K-S",
    description:
      "JST PH 2.0 mm 2-pin shrouded header, right-angle THT, keyed (reverse-proof). Single-cell Li-ion battery connector (J2).",
    category: null,
    datasheetUrl: "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf",
  },
  {
    manufacturer: "E-Switch",
    mpn: "EG1218",
    description:
      "SPDT slide switch, THT, 200 mA / 30 VDC, top-actuated. Board on/off — drives the boost EN pin (SW1).",
    category: null,
    datasheetUrl: null,
  },
  {
    manufacturer: "Yageo",
    mpn: "RC0805FR-0752K3L",
    description:
      "52.3 kΩ ±1% 1/8 W 0805 thick-film resistor. Boost FB divider top — sets Vout ≈ 4.98 V (R8).",
    category: "PASSIVE_RESISTOR",
    datasheetUrl: "https://www.mouser.com/datasheet/2/447/RC0805-257173.pdf",
  },
  {
    manufacturer: "Yageo",
    mpn: "RC0805FR-071ML",
    description:
      "1 MΩ ±1% 1/8 W 0805 thick-film resistor. Load-share gate pulldown (R7).",
    category: "PASSIVE_RESISTOR",
    datasheetUrl: "https://www.mouser.com/datasheet/2/447/RC0805-257173.pdf",
  },
];

async function main() {
  const { db } = await import("@/lib/db");
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
        category: p.category,
        datasheetUrl: p.datasheetUrl,
        lifecycle: "ACTIVE",
        createdById,
      },
      select: { id: true, manufacturer: true, mpn: true, category: true, lifecycle: true },
    });
    console.log(`  ${part.manufacturer.padEnd(24)} ${part.mpn.padEnd(20)} [${part.category ?? "—"}/${part.lifecycle}] id=${part.id}`);
  }
  console.log(`\nDone. ${PARTS.length} parts upserted (idempotent).`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
