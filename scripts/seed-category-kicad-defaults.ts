// Seed Category.defaultKicadSymbol / defaultKicadFootprintLib on the pilot leaves
// (Phase C) — these drive the create-form auto-suggest: pick a category → the
// symbol picker is prefilled and the footprint picker is constrained to the lib.
//
// `defaultKicadSymbol` is a full lib-id (Lib:Name); `defaultKicadFootprintLib` is
// a footprint LIB name (the footprint picker's `lib` filter). Each default is
// validated against the ingested index before it's written (skipped with a warn
// if absent). Idempotent.
//
// Run (after ingest-kicad-libs): pnpm exec tsx scripts/seed-category-kicad-defaults.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

type Default = { sym: string | null; fpLib: string | null };

const DEFAULTS: Record<string, Default> = {
  MLCC_CAPACITOR: { sym: "Device:C", fpLib: "Capacitor_SMD" },
  PASSIVE_RESISTOR: { sym: "Device:R", fpLib: "Resistor_SMD" },
  LDO_REGULATOR: { sym: null, fpLib: "Package_TO_SOT_SMD" },
  USB_CONNECTOR: { sym: null, fpLib: "Connector_USB" },
  RF_MODULE: { sym: null, fpLib: null },
  USB_UART_IC: { sym: null, fpLib: null },
};

async function main() {
  const { db } = await import("@/lib/db");

  for (const [slug, d] of Object.entries(DEFAULTS)) {
    let sym = d.sym;
    let fpLib = d.fpLib;

    if (sym) {
      const s = await db.kicadLibSymbol.findUnique({
        where: { libId: sym },
        select: { libId: true },
      });
      if (!s) {
        console.warn(`!! ${slug}: symbol ${sym} not in index — skipping symbol default`);
        sym = null;
      }
    }
    if (fpLib) {
      const n = await db.kicadLibFootprint.count({ where: { lib: fpLib } });
      if (n === 0) {
        console.warn(`!! ${slug}: footprint lib ${fpLib} has no rows — skipping fp default`);
        fpLib = null;
      }
    }

    const res = await db.category.updateMany({
      where: { slug },
      data: { defaultKicadSymbol: sym, defaultKicadFootprintLib: fpLib },
    });
    console.log(`${slug}: sym=${sym ?? "—"} fpLib=${fpLib ?? "—"} (${res.count} updated)`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
