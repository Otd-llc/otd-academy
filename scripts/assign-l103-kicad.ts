// Assign KiCad-10 standard-library symbol + footprint to l1-03's 9 new parts
// (the [S] footprint↔pinout work — Pass 6). All lib-ids are from the indexed
// standard KiCad library (no vendor downloads). Validated pad-by-pad before this
// (padCount = pin count; WS2812 1=VDD/2=DOUT/3=VSS/4=DIN = XINGLIGHT; 74AHCT125
// 7=GND/14=VCC = TI). Idempotent: upsert-by-mpn, sets the two fields.
//   Run: pnpm exec tsx scripts/assign-l103-kicad.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const ASSIGN = [
  { mpn: "SN74AHCT125DR",      sym: "74xx:74AHCT125",                 fp: "Package_SO:SOIC-14_3.9x8.7mm_P1.27mm" },
  { mpn: "XL-5050RGBC-WS2812B",sym: "LED:WS2812B",                    fp: "LED_SMD:LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm" },
  { mpn: "282837-3",           sym: "Connector:Screw_Terminal_01x03", fp: "TerminalBlock_CUI:TerminalBlock_CUI_TB007-508-03_1x03_P5.08mm_Horizontal" },
  { mpn: "282837-2",           sym: "Connector:Screw_Terminal_01x02", fp: "TerminalBlock_CUI:TerminalBlock_CUI_TB007-508-02_1x02_P5.08mm_Horizontal" },
  { mpn: "EEU-FM1C102",        sym: "Device:C_Polarized",             fp: "Capacitor_THT:CP_Radial_D10.0mm_P5.00mm" },
  { mpn: "SMAJ5.0A",           sym: "Device:D_TVS",                   fp: "Diode_SMD:D_SMA" },
  { mpn: "CDSOD323-T05C",      sym: "Device:D_TVS",                   fp: "Diode_SMD:D_SOD-323" },
  { mpn: "CL21A475KAQNNNE",    sym: "Device:C",                       fp: "Capacitor_SMD:C_0805_2012Metric" },
  { mpn: "GRM21BR61E106KA73L", sym: "Device:C",                       fp: "Capacitor_SMD:C_0805_2012Metric" },
];

async function main() {
  const { db } = await import("@/lib/db");
  // Sanity: every lib-id must exist in the indexed library before we point a part at it.
  for (const a of ASSIGN) {
    const s = await db.kicadLibSymbol.findUnique({ where: { libId: a.sym }, select: { libId: true } });
    const f = await db.kicadLibFootprint.findUnique({ where: { libId: a.fp }, select: { libId: true } });
    if (!s) throw new Error(`symbol not in index: ${a.sym}`);
    if (!f) throw new Error(`footprint not in index: ${a.fp}`);
  }
  for (const a of ASSIGN) {
    const p = await db.part.findFirst({ where: { mpn: a.mpn }, select: { id: true } });
    if (!p) throw new Error(`part not found: ${a.mpn}`);
    const r = await db.part.update({
      where: { id: p.id },
      data: { kicadSymbol: a.sym, kicadFootprint: a.fp },
      select: { mpn: true, kicadSymbol: true, kicadFootprint: true },
    });
    console.log(`  ✓ ${r.mpn.padEnd(24)} ${r.kicadSymbol}  +  ${r.kicadFootprint}`);
  }
  await db.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
