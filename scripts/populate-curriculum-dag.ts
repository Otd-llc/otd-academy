// ESP32 curriculum → curriculum DAG population.
//
// One-off, idempotent seed-style script. Writes via Prisma directly (the
// `"use server"` action layer can't be scripted headlessly because
// `requireUser()` reads an Auth.js request-context session, and the actions
// call `revalidatePath` which throws outside a Next request). This script
// replicates each action's data shape and — for edges — the SAME recursive-CTE
// cycle check the action runs, inside a Serializable transaction.
//
// Faithful to the handoff:
//   - 22 projects (16 main incl. ADS1292R de-risk + 6 bench tools).
//   - 33 ProjectDependency edges, inserted ordered by dependsOn level asc.
//   - v1 Revision @ REQUIREMENTS (+ INIT StageTransition) per project.
//   - REQUIREMENTS_REVIEW canonical checklist materialized per project, then
//     per-board §6 gotcha appends (antenna keep-out on all; isolation
//     post-regulator on the isolated boards) that are NOT already canonical.
//
// Idempotent: projects upsert by slug; edges/revisions/checklists/items are
// existence-checked before insert. Re-running is a no-op. Leaves the
// `esp32-sensor-breakout` seed project untouched (not in the set).
//
// Run: tsx scripts/populate-curriculum-dag.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

type Track = "SENSE" | "ACT" | "POWER" | "COMMS";
type Level = "L1" | "L2" | "L3" | null;
type Stage = "REQUIREMENTS" | "LAYOUT" | "BRINGUP";
type Kind = "DE_RISK" | "FOUNDATION" | "SHARED_BLOCK";

interface ProjectSpec {
  slug: string;
  name: string;
  level: Level;
  track: Track;
  criticalPath: boolean;
  requiresStripboard: boolean;
  hasMainsNet: boolean;
  disciplineTaught: string;
  description: string;
}

const PROJECTS: ProjectSpec[] = [
  {
    slug: "l1-01-wroom-breakout",
    name: "L1.01 WROOM breakout",
    level: "L1",
    track: "COMMS",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Foundation: WROOM + USB-C + 3.3V LDO + USB-UART bridge + two-transistor auto-program circuit; antenna keep-out",
    description:
      "Universal-core board: ESP32-WROOM module, USB-C, 3.3V LDO, USB-UART bridge, and the two-transistor auto-program (DTR/RTS) circuit. PCB-only — a dev kit would skip the very subsystem it teaches. WROOM antenna keep-out per datasheet.",
  },
  {
    slug: "l1-02-espnow-link",
    name: "L1.02 ESP-NOW link",
    level: "L1",
    track: "COMMS",
    criticalPath: true,
    requiresStripboard: true,
    hasMainsNet: false,
    disciplineTaught:
      "Comms: ESP-NOW pairing + TX/RX role flashing; channel + peer addressing",
    description:
      "ESP-NOW pairing across a TX/RX pair, channel and peer addressing, role flashing. Stripboard de-risk before PCB.",
  },
  {
    slug: "l1-03-ws2812-node",
    name: "L1.03 WS2812 node",
    level: "L1",
    track: "ACT",
    criticalPath: true,
    requiresStripboard: true,
    hasMainsNet: false,
    disciplineTaught:
      "Act: addressable-LED bit-bang/RMT drive; 3.3V-to-5V level shifting and dedicated 5V LED rail",
    description:
      "Addressable WS2812 drive via RMT. 3.3V ESP32 logic is out of spec for 5V WS2812 — level-shift via 74AHCT125, run the strip ~4.5V, or substitute SK6812. Dedicated 5V LED rail. Stripboard de-risk before PCB.",
  },
  {
    slug: "l1-04-single-servo",
    name: "L1.04 single servo",
    level: "L1",
    track: "ACT",
    criticalPath: true,
    requiresStripboard: true,
    hasMainsNet: false,
    disciplineTaught:
      "Act: PWM servo drive; brownout-on-stall mitigation (separate supply, bulk cap, wide power traces)",
    description:
      "PWM hobby-servo drive. Brownout-on-stall mitigation: separate supply rail, bulk cap sized for stall current, wide/short high-current traces (double-tracked on stripboard). Stripboard de-risk before PCB.",
  },
  {
    slug: "l1-05-internal-adc",
    name: "L1.05 internal ADC",
    level: "L1",
    track: "SENSE",
    criticalPath: true,
    requiresStripboard: true,
    hasMainsNet: false,
    disciplineTaught:
      "Sense: internal ADC limitations (noise, nonlinearity); ADC1-vs-ADC2 with WiFi active",
    description:
      "Internal ADC limitations: noise, nonlinearity, and the ADC1-vs-ADC2 trap. ADC2 pins are unusable while WiFi/ESP-NOW is active — all sampled inputs route to ADC1. Stripboard de-risk before PCB.",
  },
  {
    slug: "l2-01-battery-power-module",
    name: "L2.01 battery power module",
    level: "L2",
    track: "POWER",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Power: single-cell charging + load-share + LDO-after-switcher quiet rails",
    description:
      "Single-cell Li-ion charging, load-share, and LDO-after-switcher quiet rails. Becomes a hierarchical sheet in foundry-lib; portable downstream boards consume it via SHARED_BLOCK edges and pin to its known-good version.",
  },
  {
    slug: "l2-02-ads1220-sense",
    name: "L2.02 ADS1220 sense",
    level: "L2",
    track: "SENSE",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Sense: precision SPI ADC layout (24-bit ADS1220); low-noise reference + analog ground",
    description:
      "Precision 24-bit SPI ADC (ADS1220): low-noise reference, analog ground, layout discipline. First rung of the locked biopotential de-risk chain ADS1220 → ADS1292R → ADS1299.",
  },
  {
    slug: "l2-03-motor-driver",
    name: "L2.03 motor driver",
    level: "L2",
    track: "ACT",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Act: brushed-DC H-bridge drive (DRV8833); ESP-NOW commanded actuator latency",
    description:
      "Brushed-DC H-bridge drive (DRV8833) as an ESP-NOW-commanded actuator; actuator latency. Runs on the USB-C-rechargeable shared battery + low-noise block.",
  },
  {
    slug: "l2-04-power-led-driver",
    name: "L2.04 power LED driver",
    level: "L2",
    track: "POWER",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Power: constant-current LED driver; deliberate linear-vs-switching topology tradeoff",
    description:
      "Constant-current power-LED driver with a deliberate linear-vs-switching topology tradeoff. DC-only — no student-laid-out mains copper.",
  },
  {
    slug: "l2-05-isolated-spi-bridge",
    name: "L2.05 isolated SPI bridge",
    level: "L2",
    track: "COMMS",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Comms: digital SPI isolator + isolated DC-DC; post-regulation of noisy isolated rail",
    description:
      "Digital SPI isolator + isolated DC-DC. Isolated DC-DC converters are themselves noisy — the isolated secondary rail must be post-regulated/filtered before feeding analog circuitry. EEG-prep lesson.",
  },
  {
    slug: "l3-01-eeg-front-end",
    name: "L3.01 EEG front-end",
    level: "L3",
    track: "SENSE",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Sense capstone: 8-ch ADS1299 biopotential AFE, galvanic isolation, Cyton-protocol firmware compatibility",
    description:
      "Sense capstone: 8-channel ADS1299 biopotential AFE with galvanic isolation. Don't clone the Cyton — fork the open Cyton schematic as reference for the hard analog front-end, replace the PIC32 + RFduino half with a single ESP32-WROOM, and speak the Cyton serial protocol to inherit the OpenBCI GUI / BrainFlow ecosystem. Buy one real Cyton as known-good reference + software target.",
  },
  {
    slug: "l3-02-brushless-motor",
    name: "L3.02 brushless motor",
    level: "L3",
    track: "ACT",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Act capstone: three-phase brushless drive at teaching RPMs; back-EMF sensing and commutation",
    description:
      "Act capstone: three-phase brushless drive at teaching RPMs, back-EMF sensing, and commutation. FPV-domain battery-powered actuator. High-current supply discipline carries over from the servo board.",
  },
  {
    slug: "l3-03-lighting-array",
    name: "L3.03 lighting array",
    level: "L3",
    track: "ACT",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Act capstone: multi-channel power-LED + addressable scale; thermal management and DC distribution",
    description:
      "Act capstone: multi-channel power-LED + addressable scale, thermal management, DC distribution. DC-only — no student-laid-out mains copper; mains enters only via certified relay modules.",
  },
  {
    slug: "l3-04-bms",
    name: "L3.04 BMS",
    level: "L3",
    track: "POWER",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Power capstone: multi-cell BMS AFE (BQ769x0); balancing CC/CV charge; fire-safety protections",
    description:
      "Power capstone: multi-cell BMS AFE (BQ769x0), balancing CC/CV charge, fire-safety protections. Builds on the single-cell charging + load-share lessons of the battery power module.",
  },
  {
    slug: "l3-05-wireless-hub",
    name: "L3.05 wireless hub",
    level: "L3",
    track: "COMMS",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Comms capstone: ESP-NOW many-to-one fleet scaling + latency; integration of neural-mapping software",
    description:
      "Comms capstone: ESP-NOW many-to-one fleet scaling and latency; the many-to-one endpoint of the ESP-NOW chain seeded by the link pair. Integration of neural-mapping software. May be deployed portable in fleet trials.",
  },
  {
    slug: "l3-de-ads1292r",
    name: "L3 de-risk ADS1292R",
    level: "L3",
    track: "SENSE",
    criticalPath: true,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Sense: biopotential AFE basics (ADS1292R 2-ch); right-leg-drive / bias and lead-off detection",
    description:
      "Middle rung of the locked biopotential de-risk chain ADS1220 → ADS1292R → ADS1299. 2-channel ADS1292R board: right-leg-drive / bias and lead-off detection before the 8-channel ADS1299 capstone.",
  },
  // ─── Bench tools (level: null — CurriculumLevel is L1|L2|L3 only) ───
  {
    slug: "bn-01-usb-c-power-meter",
    name: "BN-01 USB-C power meter",
    level: null,
    track: "POWER",
    criticalPath: false,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught: "Bench: high-side V/I sense on USB-C; logging/display via ESP32",
    description:
      "Inline USB-C power meter: high-side V/I sense, logging/display via an ESP32-WROOM. Source from a USB-C wall PD supply or include a periodic-pulse load to prevent power-bank auto-shutoff.",
  },
  {
    slug: "bn-02-dc-electronic-load",
    name: "BN-02 DC electronic load",
    level: null,
    track: "POWER",
    criticalPath: false,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Bench: op-amp + MOSFET CC sink loop; thermal management; ESP32 setpoint + telemetry",
    description:
      "DC electronic load: op-amp + MOSFET constant-current sink loop, thermal management, ESP32 setpoint + telemetry. Power-source choice documented to avoid power-bank auto-shutoff.",
  },
  {
    slug: "bn-03-dds-function-generator",
    name: "BN-03 DDS function generator",
    level: null,
    track: "ACT",
    criticalPath: false,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Bench: DDS waveform synthesis (AD983x); precision clock + DAC output stage",
    description:
      "DDS function generator (AD983x): waveform synthesis, precision clock, DAC output stage; ESP32-WROOM for control + UI.",
  },
  {
    slug: "bn-04-curve-tracer",
    name: "BN-04 curve tracer",
    level: null,
    track: "SENSE",
    criticalPath: false,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Bench: swept DAC + current-sense ADC for device I-V curves; plotting via ESP32",
    description:
      "Curve tracer: swept DAC + current-sense ADC for device I-V curves; plotting via an ESP32-WROOM.",
  },
  {
    slug: "bn-05-spot-welder-controller",
    name: "BN-05 spot welder controller",
    level: null,
    track: "POWER",
    criticalPath: false,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Bench: precise pulse timing + high-current gate drive; UI + safety interlocks",
    description:
      "Spot-welder controller: precise pulse timing, high-current gate drive, UI + safety interlocks via ESP32-WROOM. DC/low-voltage control only — no student-laid-out mains copper.",
  },
  {
    slug: "bn-06-tec-thermal-chamber",
    name: "BN-06 TEC thermal chamber",
    level: null,
    track: "POWER",
    criticalPath: false,
    requiresStripboard: false,
    hasMainsNet: false,
    disciplineTaught:
      "Bench: PID thermal control; bidirectional TEC H-bridge drive; telemetry logging",
    description:
      "TEC thermal chamber: PID thermal control, bidirectional TEC H-bridge drive, telemetry logging via ESP32-WROOM.",
  },
];

interface EdgeSpec {
  dependent: string;
  kind: Kind;
  dependsOn: string;
  dentStage: Stage; // dependentStageGated
}

// All 33 edges (the handoff's "32" total is an arithmetic slip; both the
// dependsOn-count column and the §4 enumeration sum to 33). depStage
// (dependsOnStageRequired) is BRINGUP throughout.
const EDGES: EdgeSpec[] = [
  { dependent: "l1-02-espnow-link", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l1-03-ws2812-node", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l1-04-single-servo", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l1-05-internal-adc", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l2-01-battery-power-module", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l2-02-ads1220-sense", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l2-03-motor-driver", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l2-03-motor-driver", kind: "SHARED_BLOCK", dependsOn: "l2-01-battery-power-module", dentStage: "LAYOUT" },
  { dependent: "l2-04-power-led-driver", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l2-05-isolated-spi-bridge", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-de-ads1292r", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-de-ads1292r", kind: "DE_RISK", dependsOn: "l2-02-ads1220-sense", dentStage: "REQUIREMENTS" },
  { dependent: "l3-01-eeg-front-end", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-01-eeg-front-end", kind: "DE_RISK", dependsOn: "l3-de-ads1292r", dentStage: "REQUIREMENTS" },
  { dependent: "l3-01-eeg-front-end", kind: "DE_RISK", dependsOn: "l2-05-isolated-spi-bridge", dentStage: "REQUIREMENTS" },
  { dependent: "l3-01-eeg-front-end", kind: "SHARED_BLOCK", dependsOn: "l2-01-battery-power-module", dentStage: "LAYOUT" },
  { dependent: "l3-02-brushless-motor", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-02-brushless-motor", kind: "DE_RISK", dependsOn: "l2-03-motor-driver", dentStage: "REQUIREMENTS" },
  { dependent: "l3-02-brushless-motor", kind: "SHARED_BLOCK", dependsOn: "l2-01-battery-power-module", dentStage: "LAYOUT" },
  { dependent: "l3-03-lighting-array", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-03-lighting-array", kind: "DE_RISK", dependsOn: "l2-04-power-led-driver", dentStage: "REQUIREMENTS" },
  { dependent: "l3-03-lighting-array", kind: "DE_RISK", dependsOn: "l1-03-ws2812-node", dentStage: "REQUIREMENTS" },
  { dependent: "l3-04-bms", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-04-bms", kind: "DE_RISK", dependsOn: "l2-01-battery-power-module", dentStage: "REQUIREMENTS" },
  { dependent: "l3-05-wireless-hub", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "l3-05-wireless-hub", kind: "FOUNDATION", dependsOn: "l1-02-espnow-link", dentStage: "REQUIREMENTS" },
  { dependent: "l3-05-wireless-hub", kind: "SHARED_BLOCK", dependsOn: "l2-01-battery-power-module", dentStage: "LAYOUT" },
  { dependent: "bn-01-usb-c-power-meter", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "bn-02-dc-electronic-load", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "bn-03-dds-function-generator", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "bn-04-curve-tracer", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "bn-05-spot-welder-controller", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
  { dependent: "bn-06-tec-thermal-chamber", kind: "FOUNDATION", dependsOn: "l1-01-wroom-breakout", dentStage: "REQUIREMENTS" },
];

// §6 gotcha items to APPEND to each board's REQUIREMENTS_REVIEW checklist —
// only the gotchas NOT already in the canonical REQUIREMENTS_REVIEW template.
// (WS2812 level-shift / servo brownout / ADC1-only / auto-shutoff are already
// canonical items, so they are not re-appended here.)
const ANTENNA_KEEPOUT_ITEM =
  "WROOM antenna keep-out zone confirmed against module datasheet (no copper / no ground pour under antenna).";
const ISOLATION_POSTREG_ITEM =
  "Isolated secondary rail has post-regulator + filter before feeding analog front-end.";
// Boards whose front-end sits behind an isolation barrier.
const ISOLATION_BOARDS = new Set([
  "l2-05-isolated-spi-bridge",
  "l3-01-eeg-front-end",
]);

const LEVEL_RANK: Record<string, number> = { L1: 1, L2: 2, L3: 3 };

async function main() {
  const { db } = await import("@/lib/db");

  // ─── Resolve attributing User ───────────────────────────
  // Prefer the real app owner, then any non-seed user, then the seed user.
  const author =
    (await db.user.findUnique({ where: { email: "ravenduanesavage@gmail.com" } })) ??
    (await db.user.findFirst({
      where: { email: { not: "seed@example.com" } },
      orderBy: { createdAt: "asc" },
    })) ??
    (await db.user.findUniqueOrThrow({ where: { email: "seed@example.com" } }));
  console.log(`author: ${author.email} (${author.id})`);

  // ─── Step 2: 22 projects (upsert by slug) ───────────────
  const idBySlug = new Map<string, string>();
  let createdProjects = 0;
  for (const p of PROJECTS) {
    const before = await db.project.findUnique({ where: { slug: p.slug }, select: { id: true } });
    const row = await db.project.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        track: p.track,
        level: p.level ?? null,
        criticalPath: p.criticalPath,
        disciplineTaught: p.disciplineTaught,
        requiresStripboard: p.requiresStripboard,
        hasMainsNet: p.hasMainsNet,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        track: p.track,
        level: p.level ?? null,
        criticalPath: p.criticalPath,
        disciplineTaught: p.disciplineTaught,
        requiresStripboard: p.requiresStripboard,
        hasMainsNet: p.hasMainsNet,
        createdById: author.id,
      },
    });
    idBySlug.set(p.slug, row.id);
    if (!before) createdProjects++;
  }
  console.log(`projects: ${PROJECTS.length} present (${createdProjects} newly created)`);

  // ─── Step 3: 33 edges, ordered by dependsOn level asc ───
  const sortedEdges = [...EDGES].sort((a, b) => {
    const pa = PROJECTS.find((p) => p.slug === a.dependsOn);
    const pb = PROJECTS.find((p) => p.slug === b.dependsOn);
    const ra = pa?.level ? LEVEL_RANK[pa.level] : 99;
    const rb = pb?.level ? LEVEL_RANK[pb.level] : 99;
    return ra - rb;
  });

  let createdEdges = 0;
  for (const e of sortedEdges) {
    const dependentId = idBySlug.get(e.dependent);
    const dependsOnId = idBySlug.get(e.dependsOn);
    if (!dependentId || !dependsOnId) {
      throw new Error(`edge references unknown project: ${e.dependent} -> ${e.dependsOn}`);
    }

    const existing = await db.projectDependency.findFirst({
      where: {
        dependentProjectId: dependentId,
        dependsOnProjectId: dependsOnId,
        dependentStageGated: e.dentStage,
      },
      select: { id: true },
    });
    if (existing) continue;

    // Replicate the action's cycle check inside a Serializable tx. (Advisory
    // lock omitted — this is a single-threaded writer, so the lock's only job,
    // serializing concurrent inverse-edge inserts, has no counterpart here.)
    await db.$transaction(
      async (tx) => {
        const cycle = await tx.$queryRawUnsafe<Array<{ exists: boolean }>>(
          `WITH RECURSIVE descendants AS (
            SELECT "dependsOnProjectId" AS pid FROM "ProjectDependency"
              WHERE "dependentProjectId" = $1
            UNION
            SELECT pd."dependsOnProjectId" FROM "ProjectDependency" pd
              INNER JOIN descendants d ON pd."dependentProjectId" = d.pid
          )
          SELECT EXISTS (SELECT 1 FROM descendants WHERE pid = $2) AS exists`,
          dependsOnId,
          dependentId,
        );
        if (cycle[0]?.exists) {
          throw new Error(
            `Edge ${e.dependent} -> ${e.dependsOn} (${e.dentStage}) would create a cycle.`,
          );
        }
        await tx.projectDependency.create({
          data: {
            dependentProjectId: dependentId,
            dependsOnProjectId: dependsOnId,
            kind: e.kind,
            dependentStageGated: e.dentStage,
            dependsOnStageRequired: "BRINGUP",
            createdById: author.id,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    createdEdges++;
  }
  console.log(`edges: ${EDGES.length} present (${createdEdges} newly created)`);

  // ─── Step 4: v1 revision + REQUIREMENTS_REVIEW + appends ─
  let createdRevisions = 0;
  let materializedChecklists = 0;
  let appendedItems = 0;

  for (const p of PROJECTS) {
    const projectId = idBySlug.get(p.slug)!;

    // v1 revision @ REQUIREMENTS (case-insensitive label match) + INIT.
    let revision = await db.revision.findFirst({
      where: { projectId, label: { equals: "v1", mode: "insensitive" } },
      select: { id: true },
    });
    if (!revision) {
      revision = await db.$transaction(async (tx) => {
        const rev = await tx.revision.create({
          data: { projectId, label: "v1" }, // currentStage defaults to REQUIREMENTS
          select: { id: true },
        });
        await tx.stageTransition.create({
          data: {
            revisionId: rev.id,
            fromStage: null,
            toStage: "REQUIREMENTS",
            direction: "INIT",
            gateSnapshot: { v: 1, kind: "init", ts: new Date().toISOString() },
            transitionedBy: author.id,
          },
        });
        return rev;
      });
      createdRevisions++;
    }
    const revisionId = revision.id;

    // Materialize canonical REQUIREMENTS_REVIEW (guard on (revisionId, subkind)).
    let checklist = await db.checklist.findFirst({
      where: { revisionId, subkind: "REQUIREMENTS_REVIEW" },
      select: { id: true },
    });
    if (!checklist) {
      checklist = await db.checklist.create({
        data: {
          revisionId,
          stage: "REQUIREMENTS",
          subkind: "REQUIREMENTS_REVIEW",
          title: "REQUIREMENTS review checklist",
          createdById: author.id,
          items: {
            create: [
              { ordinal: 0, label: "WS2812 level-shift strategy chosen (74AHCT125 / SK6812 / 4.5V strip rail)." },
              { ordinal: 1, label: "Servo brownout mitigation strategy chosen (bulk cap + separate supply rail)." },
              { ordinal: 2, label: "ADC1-only constraint recorded (ADC2 unusable while WiFi/ESP-NOW active)." },
              { ordinal: 3, label: "Auto-shutoff prevention strategy chosen (idle current spec + USB-PD wall source vs power bank vs always-on draw)." },
            ],
          },
        },
        select: { id: true },
      });
      materializedChecklists++;
    }
    const checklistId = checklist.id;

    // Per-board §6 appends (idempotent: skip if label already present).
    const appends: string[] = [ANTENNA_KEEPOUT_ITEM]; // every board has a WROOM
    if (ISOLATION_BOARDS.has(p.slug)) appends.push(ISOLATION_POSTREG_ITEM);

    for (const label of appends) {
      const exists = await db.checklistItem.findFirst({
        where: { checklistId, label },
        select: { id: true },
      });
      if (exists) continue;
      const max = await db.checklistItem.aggregate({
        where: { checklistId },
        _max: { ordinal: true },
      });
      await db.checklistItem.create({
        data: { checklistId, ordinal: (max._max.ordinal ?? -1) + 1, label },
      });
      appendedItems++;
    }
  }
  console.log(
    `revisions: ${PROJECTS.length} present (${createdRevisions} new) | ` +
      `REQUIREMENTS_REVIEW materialized: ${PROJECTS.length} present (${materializedChecklists} new) | ` +
      `gotcha items appended this run: ${appendedItems}`,
  );

  await db.$disconnect();
  console.log("populate-curriculum-dag: complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
