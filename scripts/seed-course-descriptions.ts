// Seed public-facing course DESCRIPTIONS (the "what you'll build" copy rendered
// on the per-course preview pages /courses/<slug>, and the SEO substance for
// those pages). Rewrites the terse internal R&D descriptions into longer,
// learner-facing, keyword-rich copy that PRESERVES the real technical specifics
// (part numbers, concepts) — those are the search terms — while dropping the
// internal jargon (de-risk chain / SHARED_BLOCK / stripboard / "student-laid-out
// mains copper").
//
// Direct-Prisma (server actions can't be scripted). Idempotent updateMany per
// slug; warns (doesn't throw) on a missing slug. ⚠️ `.env.local` DATABASE_URL is
// PROD — this writes to production content.
//
// Run: pnpm exec tsx scripts/seed-course-descriptions.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const DESCRIPTIONS: Record<string, string> = {
  "l1-01-wroom-breakout":
    "The board every other project starts from. You design a complete ESP32 development board from scratch — the ESP32-WROOM module, a USB-C connector, a 3.3V LDO regulator, and a USB-to-UART bridge with the classic two-transistor auto-program circuit (DTR/RTS) that flashes firmware without pressing a button. Because you lay out the PCB yourself, you learn the parts a ready-made dev kit hides — right down to the WROOM antenna keep-out the datasheet demands. This is the foundation the whole curriculum builds on.",
  "l1-02-espnow-link":
    "Make two ESP32 boards talk directly to each other — no Wi-Fi router, no internet, just a fast peer-to-peer link over Espressif's ESP-NOW protocol. You'll build a transmitter/receiver pair, handle peer addressing and channel selection, and flash each board with its role. It's the first link in the wireless mesh that later scales up to a whole fleet.",
  "l1-03-ws2812-node":
    "Drive a strip of addressable RGB LEDs (WS2812 / NeoPixel) from an ESP32 using its hardware RMT peripheral for rock-solid timing. Along the way you'll solve the real-world catch: the ESP32's 3.3V logic is out of spec for 5V WS2812 data, so you'll level-shift with a 74AHCT125, run the strip at a lower voltage, or switch to SK6812 — and give the LEDs their own dedicated 5V rail.",
  "l1-04-single-servo":
    "Build a board that moves a hobby servo on command over PWM. The interesting part isn't the signal — it's the power: a stalling servo can brown out your microcontroller and reset it mid-move. You'll design around that with a separate supply rail, a bulk capacitor sized for the stall current, and wide, short high-current traces.",
  "l1-05-internal-adc":
    "Read analog signals with the ESP32's built-in ADC — and learn first-hand why the built-in ADC isn't enough. You'll measure its real noise and nonlinearity and hit the classic ADC1-vs-ADC2 trap: ADC2 pins stop working whenever Wi-Fi or ESP-NOW is active, so every sampled input has to route to ADC1. The lesson that motivates every precision ADC that follows.",
  "l2-01-battery-power-module":
    "Cut the cord. Design a rechargeable single-cell Li-ion power module with proper charging, load-sharing (so the board runs while it charges), and clean, low-noise rails using an LDO after a switching regulator. It's built as a reusable building block — every portable board later in the curriculum reuses this exact power design.",
  "l2-02-ads1220-sense":
    "Step up from the noisy internal ADC to a real precision instrument: the 24-bit ADS1220 SPI ADC, able to resolve microvolt-level signals. You'll learn the layout discipline that makes high-resolution measurement actually work — a clean low-noise voltage reference and a carefully separated analog ground. It's the first step toward reading biopotentials like ECG, and eventually EEG.",
  "l2-03-motor-driver":
    "Drive real brushed-DC motors — forward, reverse, and speed control — with a DRV8833 H-bridge, commanded wirelessly over your ESP-NOW link. You'll measure the latency of a remotely-commanded actuator and run the whole thing off the rechargeable battery module you built earlier.",
  "l2-04-power-led-driver":
    "High-power LEDs need current, not voltage — drive them wrong and they cook. You'll design a constant-current power-LED driver and make a deliberate engineering choice between a simple linear driver and a more efficient switching one, weighing heat, efficiency, and cost. All low-voltage DC — no mains.",
  "l2-05-isolated-spi-bridge":
    "Some measurements demand galvanic isolation — a complete electrical break between two halves of a circuit, for safety and noise immunity. You'll bridge SPI across a digital isolator and power the far side with an isolated DC-DC converter. The catch you'll solve: those converters are noisy, so the isolated rail has to be cleaned up before it can feed sensitive analog circuitry. Essential prep for the EEG front-end.",
  "l3-de-ads1292r":
    "Read ECG- and EMG-class signals with the ADS1292R, a 2-channel biopotential analog front-end. You'll implement right-leg-drive (bias) to reject common-mode noise and lead-off detection to know when an electrode falls off — the core techniques of real signal acquisition, and the stepping-stone between a precision ADC and a full 8-channel EEG.",
  "l3-01-eeg-front-end":
    "The flagship build: an 8-channel EEG analog front-end on the ADS1299, a 24-bit biopotential converter, with galvanic isolation between the electrodes and everything downstream. It reads real brainwaves at microvolt scale. You design the whole board yourself, from the analog front-end and its bias and reference network through the isolated power to the ESP32 that streams the samples. Your board speaks the OpenBCI Cyton serial protocol, so it drops straight into the OpenBCI GUI and BrainFlow without you writing any capture software. The brain-computer interface at the center of the whole curriculum.",
  "l3-02-brushless-motor":
    "Spin a brushless (BLDC) motor — the kind in drones and EVs — at teaching-friendly RPMs. You'll implement three-phase commutation and back-EMF sensing to track the rotor's position without a separate sensor, all battery-powered. The high-current supply discipline you learned on the servo board pays off here.",
  "l3-03-lighting-array":
    "Scale a single power LED up to a multi-channel lighting array with addressable control — and confront the two problems that come with scale: thermal management (getting the heat out) and DC power distribution (getting current in, evenly). All low-voltage DC; any mains enters only through certified relay modules.",
  "l3-04-bms":
    "Charge and protect a multi-cell lithium battery pack safely with a real battery-management analog front-end (BQ769x0). You'll implement cell balancing, constant-current/constant-voltage charging, and the fire-safety protections — overvoltage, undervoltage, and overcurrent — that any serious pack needs. It builds directly on the single-cell power module.",
  "l3-05-wireless-hub":
    "Command a swarm. Scale the two-board ESP-NOW link into a many-to-one fleet hub — one coordinator talking to many nodes — and tackle the throughput and latency problems that appear as the fleet grows. The command half of the brain-to-swarm system, and where the neural-mapping software ties in.",
  "bn-01-usb-c-power-meter":
    "Build your own inline USB-C power meter: measure voltage and current on the high side and log or display it with an ESP32. A genuinely useful bench instrument — and you'll learn the trick that keeps a power bank from auto-shutting-off under a tiny load.",
  "bn-02-dc-electronic-load":
    "A DC electronic load sinks a programmable, constant current so you can test power supplies, batteries, and chargers under real demand. You'll build the op-amp + MOSFET constant-current loop, manage the heat it dumps, and set the current — with live telemetry — from an ESP32.",
  "bn-03-dds-function-generator":
    "Generate clean, precise waveforms — sine, square, triangle — with a direct digital synthesis (DDS) chip (AD983x), a stable reference clock, and a proper DAC output stage, all driven from an ESP32. A signal generator you built yourself, on your own bench.",
  "bn-04-curve-tracer":
    "See the personality of a component. A curve tracer sweeps a voltage and measures the resulting current to plot a part's I-V curve — revealing how diodes, transistors, and other devices actually behave. You'll build the swept DAC and current-sense ADC and plot the results from an ESP32.",
  "bn-05-spot-welder-controller":
    "Time precise weld pulses for building lithium battery packs and more. You'll build the controller — precise pulse timing, high-current gate drive, a UI, and the safety interlocks that matter when serious current is involved — around an ESP32. Low-voltage control only; no mains layout.",
  "bn-06-tec-thermal-chamber":
    "Hold something at a precise temperature, hotter or colder than ambient, with a thermoelectric (Peltier) element under closed-loop PID control. You'll drive the TEC bidirectionally with an H-bridge and log the whole thing from an ESP32 — a small programmable thermal chamber for your bench.",
};

async function main() {
  const { db } = await import("@/lib/db");
  const slugs = Object.keys(DESCRIPTIONS);
  let updated = 0;
  let missing = 0;
  for (const slug of slugs) {
    const res = await db.project.updateMany({
      where: { slug },
      data: { description: DESCRIPTIONS[slug] },
    });
    if (res.count === 0) {
      console.warn(`No project for slug ${slug}`);
      missing += 1;
    } else {
      updated += res.count;
    }
  }
  console.log(
    `course descriptions: ${slugs.length} slugs in map | ${updated} rows updated | ${missing} missing`,
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
