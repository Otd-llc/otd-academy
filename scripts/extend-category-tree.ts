// F10 fix: the category tree only had the 6 migrated legacy-enum leaves, so most
// real parts can't be categorized. Add the missing families and categorize the 8
// l1-03 parts. Idempotent (upsert on slug/path). New leaf slugs are NOT enum tokens
// (so Part.category legacy enum stays null; categoryId carries the tree membership —
// the modern path). Run: pnpm exec tsx scripts/extend-category-tree.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");

  const existing = await db.category.findMany({
    select: { id: true, slug: true, name: true, path: true, depth: true },
  });
  const byPath = new Map<string, { id: string; path: string; depth: number }>(
    existing.map((c) => [c.path, { id: c.id, path: c.path, depth: c.depth }]),
  );

  async function ensureCat(slug: string, name: string, parentPath: string | null) {
    const parent = parentPath ? byPath.get(parentPath) : null;
    if (parentPath && !parent) throw new Error(`parent path not found: ${parentPath}`);
    const path = parent ? `${parent.path}/${slug}` : slug;
    const depth = parent ? parent.depth + 1 : 0;
    const cat = await db.category.upsert({
      where: { slug },
      create: { slug, name, parentId: parent?.id ?? null, path, depth },
      update: {}, // idempotent — never re-parent an existing node
      select: { id: true, path: true, depth: true, slug: true },
    });
    byPath.set(cat.path, { id: cat.id, path: cat.path, depth: cat.depth });
    console.log(`  cat: ${cat.path}`);
    return cat;
  }

  console.log("Categories:");
  // interior nodes
  await ensureCat("diodes", "Diodes", null);
  await ensureCat("leds", "LEDs", null);
  await ensureCat("logic", "Logic", "ics");
  // leaves
  await ensureCat("TVS_DIODE", "TVS Diodes", "diodes");
  await ensureCat("ESD_DIODE", "ESD Protection Diodes", "diodes");
  await ensureCat("LED_ADDRESSABLE", "Addressable RGB LEDs", "leds");
  await ensureCat("TERMINAL_BLOCK", "Terminal Blocks", "connectors");
  await ensureCat("ALU_ELECTROLYTIC", "Aluminum Electrolytic Capacitors", "passives/capacitors");
  await ensureCat("LOGIC_BUFFER", "Logic Buffers / Level Shifters", "ics/logic");

  const ASSIGN: Array<{ manufacturer: string; mpn: string; path: string }> = [
    { manufacturer: "Texas Instruments", mpn: "SN74AHCT125D", path: "ics/logic/LOGIC_BUFFER" },
    { manufacturer: "XINGLIGHT", mpn: "XL-5050RGBC-WS2812B", path: "leds/LED_ADDRESSABLE" },
    { manufacturer: "TE Connectivity", mpn: "282837-3", path: "connectors/TERMINAL_BLOCK" },
    { manufacturer: "TE Connectivity", mpn: "282837-2", path: "connectors/TERMINAL_BLOCK" },
    { manufacturer: "Panasonic", mpn: "EEU-FR1C102", path: "passives/capacitors/ALU_ELECTROLYTIC" },
    { manufacturer: "Littelfuse", mpn: "SMAJ5.0A", path: "diodes/TVS_DIODE" },
    { manufacturer: "Nexperia", mpn: "PESD5V0S1BA", path: "diodes/ESD_DIODE" },
    { manufacturer: "Samsung Electro-Mechanics", mpn: "CL21A475KAQNNNE", path: "passives/capacitors/MLCC_CAPACITOR" },
  ];

  console.log("\nCategorizing parts:");
  for (const a of ASSIGN) {
    const cat = byPath.get(a.path);
    if (!cat) throw new Error(`category path missing: ${a.path}`);
    const res = await db.part.updateMany({
      where: { manufacturer: a.manufacturer, mpn: a.mpn },
      data: { categoryId: cat.id },
    });
    console.log(`  ${res.count === 1 ? "OK  " : "MISS"} ${a.manufacturer} / ${a.mpn} -> ${a.path}`);
  }

  const total = await db.category.count();
  console.log(`\nCategories total: ${total}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
