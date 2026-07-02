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

// Distractor design: every wrong option is a REAL misconception at the same
// register (usually a concept from a neighbouring stage, e.g. ERC vs DRC), never
// a joke. The answer key is spread evenly across positions (6 per index), since
// options render in stored order (no client shuffle).
const QUESTIONS: Q[] = [
  // ── Requirements ──
  { id: "req-first", section: "Requirements", prompt: "What do you pin down FIRST, before drawing anything?", options: ["Which fab will build the board", "What the board must do: its interfaces, power, and constraints", "The exact placement of every part"], correctIndex: 1 },
  { id: "req-role", section: "Requirements", prompt: "What is this board's job?", options: ["Drive motors and servos directly from its 3.3 V rail", "Convert USB data to serial with a bridge chip", "Break the ESP32-S3 module's pins out on a USB-C-powered board"], correctIndex: 2 },

  // ── BOM sourcing ──
  { id: "bom-why-first", section: "BOM sourcing", prompt: "Why lock and source every part BEFORE drawing the schematic?", options: ["So every part you draw is real, in stock, and orderable", "So the fab can quote the board before layout", "Because KiCad needs a finished BOM before the schematic editor opens"], correctIndex: 0 },
  { id: "bom-eol", section: "BOM sourcing", prompt: "A part marked EOL or OBSOLETE on your BOM is…", options: ["A supply risk: it may be impossible to buy when you order", "Fine, as long as it is cheap and in stock today", "Only a problem for through-hole parts"], correctIndex: 0 },

  // ── Schematic ──
  { id: "sch-capture", section: "Schematic", prompt: "The schematic stage is mostly about…", options: ["Deciding where each part physically sits on the board", "Choosing which parts to buy", "Capturing your already-sourced circuit as named nets in KiCad"], correctIndex: 2 },
  { id: "sch-erc", section: "Schematic", prompt: "ERC (Electrical Rules Check) flags problems like…", options: ["Traces spaced too close together for the fab", "Floating pins and power rails nothing drives", "Parts on the sheet that are out of stock"], correctIndex: 1 },
  { id: "sch-advance", section: "Schematic", prompt: "You move past the schematic stage once…", options: ["You have checked the sheet by eye, which is all this stage needs", "Your parts order has shipped", "ERC runs clean and you attach the report"], correctIndex: 2 },

  // ── Layout ──
  { id: "lay-frozen", section: "Layout", prompt: "By the layout stage, the parts list is…", options: ["Still open: you can swap parts freely while routing", "Frozen: changing a part means going back through sourcing", "Irrelevant: layout works from the schematic, never the BOM"], correctIndex: 1 },
  { id: "lay-decoupling", section: "Layout", prompt: "Where do the decoupling capacitors go?", options: ["Next to the USB connector, where power enters the board", "Anywhere: the net connects them, so placement doesn't matter", "Right at the chip's power pins"], correctIndex: 2 },

  // ── DRC + Gerber ──
  { id: "drc-check", section: "DRC + Gerber", prompt: "DRC (Design Rule Check) verifies that…", options: ["Your layout meets the fab's spacing and width limits", "Your schematic has no floating pins", "Your parts are all still in stock"], correctIndex: 0 },
  { id: "drc-gerber", section: "DRC + Gerber", prompt: "Gerber files are…", options: ["Your KiCad project files, zipped so the fab can open them", "The per-layer manufacturing files the fab builds from", "3D renders the fab uses to preview your board"], correctIndex: 1 },

  // ── Ordering ──
  { id: "ord-build", section: "Ordering", prompt: "To order, you create a Build and attach…", options: ["The PCB order and the parts order", "The ERC and DRC reports from earlier stages", "The firmware you plan to flash"], correctIndex: 0 },
  { id: "ord-reference", section: "Ordering", prompt: "Instead of betting a board on your own export, you can download…", options: ["The fab's redrawn copy of your layout", "A simulator that proves your gerbers before you order", "The verified reference gerbers and order the exact proven board"], correctIndex: 2 },

  // ── Assembly ──
  { id: "asm-screening", section: "Assembly", prompt: "Inspecting the bare board before soldering checks for…", options: ["Obvious defects, caught before you commit parts to it", "Which surface finish the fab actually used", "Whether the board enumerates over USB"], correctIndex: 0 },
  { id: "asm-continuity", section: "Assembly", prompt: "After hand-assembly, a continuity check confirms…", options: ["The 3.3 V rail reads exactly 3.3 V", "Grounds are joined and there is no VBUS-to-GND short", "Each LED lights when you touch its pads"], correctIndex: 1 },

  // ── Bring-up ──
  { id: "bru-power-first", section: "Bring-up", prompt: "During bring-up you check the power rails FIRST because…", options: ["A wrong rail can damage or confuse everything downstream", "The rail reading is a baseline you file for later", "The blink test needs the meter connected first"], correctIndex: 0 },
  { id: "bru-vbus", section: "Bring-up", prompt: "With a USB-C cable plugged in, VBUS should read about…", options: ["3.3 V", "5 V", "9 V"], correctIndex: 1 },
  { id: "bru-module", section: "Bring-up", prompt: "The ESP32-S3 module itself runs on…", options: ["5 V straight from USB", "Whatever voltage the USB host negotiates", "3.3 V from the on-board regulator"], correctIndex: 2 },
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
    update: { title: `${project.name}: Final Exam`, passThreshold: PASS_THRESHOLD, questions: QUESTIONS },
    create: {
      projectId: project.id,
      title: `${project.name}: Final Exam`,
      passThreshold: PASS_THRESHOLD,
      questions: QUESTIONS,
    },
    select: { id: true, title: true, passThreshold: true },
  });
  console.log("Seeded exam:", JSON.stringify({ ...exam, questions: QUESTIONS.length }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
