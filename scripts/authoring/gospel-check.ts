// Diff a card's shared-subsystem facts against L1.01's equivalent card.
//
// L1.01 is gospel for anything the boards share (owner directive, 2026-07-30):
// stackup, net classes, the PCBWay .kicad_dru, the via preset, the USB pair, pour
// and stitch, the DRC flow. Authoring runs ahead of the board, so the failure mode
// is not a wrong number, it is a MISSING one: a step that says "match the fab
// floor" where L1.01 says "0.6 mm annulus / 0.3 mm drill" reads fine and cannot be
// followed. This flags exactly that.
//
//   pnpm exec tsx scripts/authoring/gospel-check.ts l1-02-espnow-link LAYOUT
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

/** Facts L1.01 states that a shared-subsystem card should state too. */
const SHARED = [
  "0.25", "0.5 mm", "0.6", "0.3 mm", "1.6 mm", "net class", "layer pair",
  "F.Cu", "B.Cu", "kicad_dru", "Custom Rules", "PCBWay", "Edge.Cuts",
  "Rule Area", "keep-out", "ifferential", "ratsnest", "refill", "stitch",
  "unconnected", "Exclude", "ERC", "DRC",
];

async function main() {
  const [slug, stage] = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (!slug || !stage) {
    console.error("usage: gospel-check.ts <slug> <STAGE>");
    process.exit(1);
  }
  const { db } = await import("@/lib/db");
  const text = async (s: string, st: string) => {
    const c = await db.guideCard.findFirst({
      where: { stage: st as never, guide: { revision: { label: "v1", project: { slug: s } } } },
      select: { contentBlocks: true },
    });
    return c ? JSON.stringify(c.contentBlocks) : null;
  };
  const gospel = await text("l1-01-wroom-breakout", stage);
  const mine = await text(slug, stage);
  if (!gospel) { console.error(`L1.01 has no ${stage} card to compare against.`); process.exit(1); }
  if (!mine) { console.error(`${slug} has no ${stage} card.`); process.exit(1); }

  const count = (hay: string, needle: string) => hay.split(needle).length - 1;
  const missing: string[] = [];
  console.log(`${slug} ${stage}  vs  l1-01 ${stage}`);
  console.log("  probe".padEnd(18) + "L1.01   this");
  for (const p of SHARED) {
    const a = count(gospel, p);
    const b = count(mine, p);
    let flag = "";
    if (a > 0 && b === 0) { flag = "  <-- L1.01 states this, this card does not"; missing.push(p); }
    else if (a === 0 && b > 0) flag = "  <-- this card only, check the design doc";
    console.log("  " + p.padEnd(16) + String(a).padStart(5) + String(b).padStart(7) + flag);
  }
  console.log(missing.length
    ? `\n${missing.length} shared fact(s) missing: ${missing.join(", ")}`
    : "\nNo shared fact stated by L1.01 is missing here.");
}
main().catch((e) => { console.error(e); process.exit(1); });
