// §5 public titles + benefit taglines → curriculum projects.
//
// One-off, idempotent seed-style script. Writes via Prisma directly (the
// `"use server"` action layer can't be scripted headlessly — see
// populate-curriculum-dag.ts for the why). Applies the §5 "Public title" +
// "Benefit tagline" copy from docs/plans/2026-06-09-public-narrative-skill-tree.md
// onto Project.publicTitle / Project.tagline for all 22 curriculum projects.
//
// Source of truth:
//   - 16 curriculum slugs: copied verbatim from the §5 table (l1-01..l3-05 +
//     l3-de-ads1292r).
//   - 6 bench tools (bn-01..bn-06): titles are from the §5 paragraph under the
//     table ("Build Your Bench" arc); the §5 doc gives NO taglines for these, so
//     the taglines below were AUTHORED on-voice (factual, ESP32-flavored) and
//     should be refined by review. They are NOT from the doc.
//
// Idempotent: updateMany by slug (no throw if a slug is absent — warns instead).
// Re-running is a no-op. Touches only the 22 slugs below; any other rows are
// left alone. Non-destructive content writes.
//
// Run: tsx scripts/seed-public-titles.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

interface PublicCopy {
  publicTitle: string;
  tagline: string;
}

const PUBLIC_COPY: Record<string, PublicCopy> = {
  // ── Curriculum (§5 table — verbatim) ───────────────────────────────────────
  "l1-01-wroom-breakout": {
    publicTitle: "ESP32-S3 USB-C Breakout Board",
    tagline: "The core board every other project builds on.",
  },
  "l1-02-espnow-link": {
    publicTitle: "ESP-NOW Wireless Link (ESP32)",
    tagline: "Make two ESP32 boards talk directly — no Wi-Fi router.",
  },
  "l1-03-ws2812-node": {
    publicTitle: "WS2812 Addressable-LED Driver (ESP32)",
    tagline: "Drive a strip of addressable RGB LEDs.",
  },
  "l1-04-single-servo": {
    publicTitle: "ESP32 Servo Driver Board",
    tagline: "Build a board that moves a servo on command.",
  },
  "l1-05-internal-adc": {
    publicTitle: "ESP32 Analog Sensing (Internal ADC)",
    tagline: "Read analog signals — and learn why the built-in ADC isn't enough.",
  },
  "l2-01-battery-power-module": {
    publicTitle: "ESP32 Li-ion Battery & Power Module",
    tagline: "Cut the cord: rechargeable power every project reuses.",
  },
  "l2-02-ads1220-sense": {
    publicTitle: "ADS1220 24-bit Precision ADC (ESP32)",
    tagline: "Read microvolt-level signals with a precision SPI ADC.",
  },
  "l2-03-motor-driver": {
    publicTitle: "DRV8833 DC Motor Driver (ESP32)",
    tagline: "Drive real DC motors over a wireless command link.",
  },
  "l2-04-power-led-driver": {
    publicTitle: "Constant-Current Power-LED Driver (ESP32)",
    tagline: "Drive high-power LEDs the right way.",
  },
  "l2-05-isolated-spi-bridge": {
    publicTitle: "Isolated SPI Bridge (ESP32)",
    tagline: "Galvanic isolation for clean, safe measurements.",
  },
  "l3-de-ads1292r": {
    publicTitle: "ADS1292R Biopotential Front-End (ESP32)",
    tagline: "Read ECG/EMG-class signals — the stepping-stone to EEG.",
  },
  "l3-01-eeg-front-end": {
    publicTitle: "★ 8-Channel EEG Front-End on ESP32",
    tagline: "Design the analog board that reads real brainwaves — the BCI.",
  },
  "l3-02-brushless-motor": {
    publicTitle: "Brushless (BLDC) Motor Driver (ESP32)",
    tagline: "Spin a brushless motor with back-EMF commutation.",
  },
  "l3-03-lighting-array": {
    publicTitle: "Multi-Channel Power-LED Lighting Array (ESP32)",
    tagline: "Scale to a thermally-managed lighting array.",
  },
  "l3-04-bms": {
    publicTitle: "Multi-Cell Battery Management System (BMS)",
    tagline: "Charge and protect multi-cell packs safely.",
  },
  "l3-05-wireless-hub": {
    publicTitle: "★ ESP-NOW Wireless Fleet Hub (ESP32)",
    tagline: "Command a swarm: many devices, one hub.",
  },
  // ── Bench tools (§5 paragraph — titles from doc; taglines AUTHORED) ─────────
  "bn-01-usb-c-power-meter": {
    publicTitle: "ESP32 USB-C Power Meter",
    tagline: "Measure USB-C voltage and current on your bench.",
  },
  "bn-02-dc-electronic-load": {
    publicTitle: "ESP32 DC Electronic Load",
    tagline: "Sink a programmable constant current to test supplies and cells.",
  },
  "bn-03-dds-function-generator": {
    publicTitle: "ESP32 DDS Function Generator",
    tagline: "Generate clean waveforms with direct digital synthesis.",
  },
  "bn-04-curve-tracer": {
    publicTitle: "ESP32 Curve Tracer",
    tagline: "Plot the I-V curve of any component you probe.",
  },
  "bn-05-spot-welder-controller": {
    publicTitle: "ESP32 Spot-Welder Controller",
    tagline: "Time precise weld pulses for building battery packs.",
  },
  "bn-06-tec-thermal-chamber": {
    publicTitle: "ESP32 TEC Thermal Chamber",
    tagline: "Hold a precise temperature with closed-loop Peltier control.",
  },
};

async function main() {
  const { db } = await import("@/lib/db");

  let updated = 0;
  let missing = 0;
  for (const [slug, copy] of Object.entries(PUBLIC_COPY)) {
    const res = await db.project.updateMany({
      where: { slug },
      data: { publicTitle: copy.publicTitle, tagline: copy.tagline },
    });
    if (res.count === 0) {
      console.warn(`No project for slug ${slug}`);
      missing++;
    } else {
      updated += res.count;
    }
  }
  console.log(
    `public titles: ${Object.keys(PUBLIC_COPY).length} slugs in map | ${updated} rows updated | ${missing} missing`,
  );

  await db.$disconnect();
  console.log("seed-public-titles: complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
