// Seeds the L1.01 (ESP32-S3 WROOM USB-C breakout) FINAL EXAM — the optional,
// server-scored capstone that confers the Verified Certificate of Achievement.
// True-beginner level (plain core ideas, no math/edge-cases — the L1.01 audience
// bar), but COMPREHENSIVE: ~18 questions grouped by the 8 build stages, so it
// actually feels like a final covering the whole board.
//
// Idempotent: upserts on the unique projectId, so re-running updates the bank in
// place. The `questions` JSON carries the answer key (correctIndex) + a `section`
// label; getExam() strips the key (never the section). Run:
//   npx tsx scripts/seed-l101-exam.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SLUG = "l1-01-wroom-breakout";
const PASS_THRESHOLD = 75; // percent — 14 of 18

type Q = {
  id: string;
  section: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

const QUESTIONS: Q[] = [
  // ── Requirements ──
  { id: "req-first", section: "Requirements", prompt: "What do you pin down FIRST, before drawing anything?", options: ["What the board must do — its interfaces, power, and constraints", "The solder-mask color", "How heavy the board is"], correctIndex: 0 },
  { id: "req-role", section: "Requirements", prompt: "What is this board's job?", options: ["Break the ESP32-S3 module's pins out on a USB-C-powered board", "Replace your laptop", "Store files like a USB drive"], correctIndex: 0 },

  // ── BOM sourcing ──
  { id: "bom-why-first", section: "BOM sourcing", prompt: "Why lock and source every part BEFORE drawing the schematic?", options: ["So you design around parts you can actually buy", "To make the board heavier", "It doesn't matter when you source"], correctIndex: 0 },
  { id: "bom-eol", section: "BOM sourcing", prompt: "A part marked EOL or OBSOLETE on your BOM is…", options: ["A risk — it may not be available to buy", "Always the best choice", "Required to pass the stage"], correctIndex: 0 },

  // ── Schematic ──
  { id: "sch-capture", section: "Schematic", prompt: "The schematic stage is mostly about…", options: ["Capturing your already-sourced circuit and wiring it in KiCad", "Inventing brand-new parts from scratch", "Choosing the board's paint"], correctIndex: 0 },
  { id: "sch-erc", section: "Schematic", prompt: "ERC (Electrical Rules Check) flags problems like…", options: ["Floating pins and power rails that aren't driven", "Spelling mistakes in your notes", "How heavy the board is"], correctIndex: 0 },
  { id: "sch-advance", section: "Schematic", prompt: "You move past the schematic stage once…", options: ["ERC is clean and you attach the report", "You pick a nice color", "Your parts arrive in the mail"], correctIndex: 0 },

  // ── Layout ──
  { id: "lay-frozen", section: "Layout", prompt: "By the layout stage, the parts list is…", options: ["Frozen — changing a part means going back to sourcing", "Still totally open to change", "Deleted and started over"], correctIndex: 0 },
  { id: "lay-decoupling", section: "Layout", prompt: "Where do the decoupling capacitors go?", options: ["Close to the chip's power pins", "Far away in a corner", "Off the board entirely"], correctIndex: 0 },

  // ── DRC + Gerber ──
  { id: "drc-check", section: "DRC + Gerber", prompt: "DRC (Design Rule Check) verifies that…", options: ["Your layout meets the manufacturable spacing and width rules", "The board is priced correctly", "You typed quickly"], correctIndex: 0 },
  { id: "drc-gerber", section: "DRC + Gerber", prompt: "Gerber files are…", options: ["The manufacturing files the fab uses to make your board", "Photos of the finished board", "The board's source code"], correctIndex: 0 },

  // ── Ordering ──
  { id: "ord-build", section: "Ordering", prompt: "To order, you create a Build and attach…", options: ["The PCB order and the parts order", "A selfie with the board", "Nothing — ordering is automatic"], correctIndex: 0 },
  { id: "ord-reference", section: "Ordering", prompt: "Instead of betting on your own export, you can download…", options: ["Our verified reference gerbers to order the exact proven board", "A movie about PCBs", "Next week's homework"], correctIndex: 0 },

  // ── Assembly ──
  { id: "asm-screening", section: "Assembly", prompt: "Inspecting the bare board before soldering checks for…", options: ["Obvious defects before you commit parts to it", "The board's smell", "Your Wi-Fi speed"], correctIndex: 0 },
  { id: "asm-continuity", section: "Assembly", prompt: "After hand-assembly, a continuity check confirms…", options: ["Connections that should join are joined, and there are no shorts", "How much the board weighs", "Your exam score"], correctIndex: 0 },

  // ── Bring-up ──
  { id: "bru-power-first", section: "Bring-up", prompt: "During bring-up you check the power rails FIRST because…", options: ["If the rails are wrong, nothing else works — and parts can be damaged", "It simply looks nice", "Power is optional on this board"], correctIndex: 0 },
  { id: "bru-vbus", section: "Bring-up", prompt: "With a USB-C cable plugged in, VBUS should read about…", options: ["5 V", "3.3 V", "12 V"], correctIndex: 0 },
  { id: "bru-module", section: "Bring-up", prompt: "The ESP32-S3 module itself runs on…", options: ["3.3 V from the on-board regulator", "5 V straight from USB", "12 V from the wall"], correctIndex: 0 },
];

async function main() {
  const { db } = await import("@/lib/db");
  const project = await db.project.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true },
  });
  if (!project) throw new Error(`Project ${SLUG} not found`);

  const exam = await db.exam.upsert({
    where: { projectId: project.id },
    update: { title: `${project.name} — Final Exam`, passThreshold: PASS_THRESHOLD, questions: QUESTIONS },
    create: {
      projectId: project.id,
      title: `${project.name} — Final Exam`,
      passThreshold: PASS_THRESHOLD,
      questions: QUESTIONS,
    },
    select: { id: true, title: true, passThreshold: true },
  });
  console.log("Seeded exam:", JSON.stringify({ ...exam, questions: QUESTIONS.length }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
