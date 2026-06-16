// Seeds the L1.01 (ESP32-S3 WROOM USB-C breakout) final exam — the optional,
// server-scored comprehension exam that confers the Verified Certificate of
// Achievement. True-beginner level (plain core ideas, no math/edge-cases — see
// the beginner-audience bar): power path (USB-C 5V → LDO → 3.3V), why 3.3V,
// decoupling, ESD protection, and what a breakout board is.
//
// Idempotent: upserts on the unique projectId, so re-running updates the bank in
// place. The `questions` JSON carries the answer key (correctIndex); getExam()
// strips it before the client ever sees it. Run: npx tsx scripts/seed-l101-exam.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const SLUG = "l1-01-wroom-breakout";
const PASS_THRESHOLD = 70; // percent; 6 of 8 — beginner-friendly

const QUESTIONS = [
  {
    id: "role",
    prompt: "What is this ESP32-S3 WROOM breakout board's role in the course?",
    options: [
      "A finished product you sell as-is",
      "The core board every later project builds on",
      "A replacement for your computer",
    ],
    correctIndex: 1,
  },
  {
    id: "vbus",
    prompt: "When you plug a USB-C cable into the board, what voltage arrives on VBUS?",
    options: ["3.3 V", "5 V", "12 V"],
    correctIndex: 1,
  },
  {
    id: "ldo",
    prompt:
      "The ESP32-S3 module runs on 3.3 V. What part makes that 3.3 V from the USB power?",
    options: [
      "A voltage regulator (LDO)",
      "A single resistor",
      "The USB-C connector itself",
    ],
    correctIndex: 0,
  },
  {
    id: "why33",
    prompt: "Why not feed the ESP32-S3 module straight from the 5 V USB rail?",
    options: [
      "5 V would damage the 3.3 V module",
      "5 V is too weak to run it",
      "It would make the module run too slowly",
    ],
    correctIndex: 0,
  },
  {
    id: "decoupling",
    prompt:
      "What do the decoupling (bypass) capacitors near the chip's power pins do?",
    options: [
      "Store the program code",
      "Steady the supply voltage and soak up noise",
      "Make the board physically larger on purpose",
    ],
    correctIndex: 1,
  },
  {
    id: "usbc-carries",
    prompt: "The USB-C connector on this board carries…",
    options: ["Only power", "Only data", "Both power and data"],
    correctIndex: 2,
  },
  {
    id: "esd",
    prompt: "What does the ESD-protection part on the USB data lines guard against?",
    options: [
      "Static-discharge spikes from handling and plugging in",
      "The board overheating",
      "The module running out of memory",
    ],
    correctIndex: 0,
  },
  {
    id: "breakout",
    prompt: "What does “breakout board” mean?",
    options: [
      "A board that breaks if you drop it",
      "A board that brings a module's pins out to easy-to-use headers",
      "A board with no components on it",
    ],
    correctIndex: 1,
  },
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
