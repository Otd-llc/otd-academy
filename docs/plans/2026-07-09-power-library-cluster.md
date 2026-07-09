# Library cluster blueprint: Power & Batteries

**Status: DRAFT for review / authoring brief (2026-07-09).** Nothing seeded. Fundamentals
pattern + parallel handoff. Generic textbook education only. Per-lesson: **thesis · beats ·
cite (verify) · diagram · quiz · links.**

**key:** `power-batteries` · **label:** "Power & Batteries" ·
**blurb:** "Powering a board that runs: batteries, regulators, and how to size a supply."

**Why:** supports the Power Systems track + the Li-ion power-module course; strong SEO ("power an
ESP32", "LiPo safety", "LDO vs buck", "battery runtime"). Reuses the `/tools` **LiPo runtime** +
**LDO headroom** calculators inline.

**Slug prefix:** `power-` / `battery-` / topic slugs; grep first.

---

## Lessons (11)

### 01 · Power rails & a power budget
- **thesis:** A power rail is a net held at a fixed voltage that feeds many parts; sizing a supply means adding up what everything draws and leaving margin. Budget first, then pick the source.
- **beats:** what a rail is (revisited for design); peak vs average current; summing a board's draw; margin; picking the source voltage/current from the budget.
- **cite:** a power-budgeting reference (a vendor app note / Sparkfun).
- **diagram:** a rail feeding several loads with a running current tally.
- **quiz:** what do you do before choosing a supply? (add up the board's current draw + add margin)
- **links:** prereq Fundamentals "grounds and power rails" + "power and heat".

### 02 · Batteries 101
- **thesis:** A battery stores energy chemically; its capacity (mAh or Wh), nominal voltage, and safe current (C-rate) tell you how long it lasts and how hard you can push it.
- **beats:** capacity mAh vs energy Wh; nominal vs full/empty voltage; C-rate (discharge current limit); common chemistries (LiPo/Li-ion/NiMH/alkaline) at a glance; runtime = capacity / draw (rough).
- **cite:** a battery-basics reference (Battery University / a vendor primer).
- **diagram:** a discharge curve (voltage vs state-of-charge) for Li-ion.
- **quiz:** what does a 2000 mAh capacity tell you? (roughly how much charge it holds → runtime at a given draw)
- **links:** lesson 11 (runtime); `/tools` LiPo runtime calc.

### 03 · LiPo / Li-ion safety
- **thesis:** Lithium cells are energy-dense and unforgiving: over-charge, over-discharge, or a short can be dangerous. Respect the 4.2 V ceiling, use a protection circuit, and never exceed the current limits.
- **beats:** the 4.2 V full / ~3.0 V empty window; over-charge/over-discharge/short hazards; the protection PCM/BMS; why a bare cell needs protection; physical care (no puncture/heat).
- **cite:** a Li-ion safety reference (Battery University / a cell datasheet's safety section).
- **diagram:** the safe operating window (voltage band + the protection thresholds).
- **quiz:** what is the danger of charging a Li-ion cell past 4.2 V? (over-charge → damage/fire risk)
- **links:** SUPPORTING → the Li-ion power-module course.

### 04 · Battery charging
- **thesis:** A lithium cell charges in two phases: constant current until it nears full, then constant voltage while the current tapers. A single-cell charger IC does this for you; do not improvise it.
- **beats:** CC/CV explained; the charge curve; charge current (C-rate); termination; a single-cell charger IC (e.g. the TP4056 family, generically); charging from USB 5 V.
- **cite:** a charger-IC datasheet (a generic single-cell Li-ion charger) + a CC/CV explainer.
- **diagram:** the CC/CV charge curve (current + voltage vs time).
- **quiz:** what are the two phases of lithium charging? (constant current, then constant voltage)
- **links:** lesson 03 (safety).

### 05 · Linear regulators (LDO)
- **thesis:** A linear regulator drops a higher voltage to a fixed lower one by burning the difference as heat. Simple and quiet, but the wasted power is (Vin − Vout) × I, which sets a thermal limit. (The design-depth version of the Fundamentals lesson.)
- **beats:** how an LDO holds Vout; dropout voltage; dissipation = (Vin−Vout)×I → heat; the junction-temp limit (ties to Fundamentals power lesson); when an LDO is fine (small drop, low current, noise-sensitive); the AP2112K as the example.
- **cite:** the AP2112 datasheet (already used) + an LDO basics app note.
- **diagram:** an LDO with the dropped voltage × current shown becoming heat.
- **quiz:** what limits how much an LDO can step down at high current? (the heat from (Vin−Vout)×I)
- **links:** prereq Fundamentals "power and heat"; `/tools` LDO headroom calc.

### 06 · Buck regulators (step-down)
- **thesis:** A buck regulator steps a voltage down efficiently by switching, not burning: it chops the input and filters it, wasting little as heat. It is how you get 3.3 V from a battery without cooking a regulator.
- **beats:** switching vs linear (efficiency); the basic buck (switch + inductor + cap); duty cycle sets Vout; efficiency (often >85%); ripple + the inductor/cap; when to prefer buck (big drop, high current).
- **cite:** a buck-converter basics app note (TI/Analog Devices).
- **diagram:** the buck topology (switch, inductor, diode/FET, cap) with the switched waveform.
- **quiz:** why is a buck more efficient than an LDO for a big step-down? (it switches instead of burning the difference as heat)
- **links:** lesson 05 (LDO), lesson 08 (compare).

### 07 · Boost regulators (step-up)
- **thesis:** A boost regulator does the opposite of a buck: it raises a lower voltage to a higher one, so a single 3.7 V cell can drive a 5 V rail. Same switching idea, inductor-first.
- **beats:** why you need a boost (battery below the rail); the basic boost topology; duty cycle → higher Vout; efficiency + limits; input current is higher than output (energy conservation); when to use.
- **cite:** a boost-converter basics app note.
- **diagram:** the boost topology + the "low in → high out" arrow.
- **quiz:** what does a boost let a 3.7 V cell do? (drive a higher rail, e.g. 5 V)
- **links:** lesson 06 (buck).

### 08 · LDO vs switcher — picking one
- **thesis:** Choose by the drop, the current, and the noise budget. LDO for a small drop, low current, or a clean analog rail; a switcher (buck/boost) when efficiency or a big conversion matters.
- **beats:** the trade-off (efficiency vs noise vs cost/complexity); LDO wins on noise + simplicity + tiny drops; switcher wins on efficiency + big conversions; a hybrid (switcher then LDO for a clean analog rail); reading the numbers.
- **cite:** an LDO-vs-switcher comparison app note.
- **diagram:** a decision compare (LDO vs buck vs boost: efficiency / noise / when).
- **quiz:** you need a quiet 3.3 V analog rail from 3.6 V; which? (an LDO — small drop, low noise)
- **links:** lessons 05-07.

### 09 · Reverse-polarity & inrush protection
- **thesis:** A backwards battery or a big inrush surge can destroy a board. A series diode or a P-channel MOSFET ideal diode blocks reverse polarity; a little inrush control tames the turn-on surge. (Extends the Fundamentals diode deepDive to power design.)
- **beats:** reverse-polarity risk; the series diode (simple, wastes Vf) vs the P-FET ideal diode (milliohms, low loss); inrush at power-on (big caps charging); soft-start/inrush limiting (intro); where each goes on the input.
- **cite:** TI "Basics of Ideal Diodes" (SLVAE57B, already cited) + an inrush app note.
- **diagram:** a power input with the reverse-polarity P-FET + an inrush element.
- **quiz:** why prefer a P-FET ideal diode over a series diode for reverse protection? (far less wasted power/heat)
- **links:** prereq Fundamentals "diodes and LEDs" (the ideal-diode deepDive).

### 10 · Power sequencing & soft-start
- **thesis:** Some chips insist their rails come up in an order, and a board that slams all rails on at once can latch up or surge. Sequencing and soft-start bring power up gently and in the right order.
- **beats:** why order matters (some ICs need core-before-IO); the latch-up/surge risk; soft-start (ramp Vout); simple sequencing (enable chains, RC delays); when a board needs it.
- **cite:** a power-sequencing app note (TI).
- **diagram:** two rails ramping in sequence (staggered soft-start).
- **quiz:** what problem does power sequencing avoid? (rails coming up in a bad order → latch-up / surge)
- **links:** lesson 01 (rails).

### 11 · Measuring power & battery runtime
- **thesis:** Runtime is capacity divided by average draw, with a discount for efficiency and the safe voltage window. Measure the real draw, then estimate honestly.
- **beats:** average vs peak draw; runtime ≈ capacity × usable-fraction / draw; efficiency + regulator loss; measuring current (a meter in series, a sense resistor); why sleep dominates battery life.
- **cite:** a runtime-estimation reference; pairs with the calc.
- **diagram:** a runtime readout (capacity ÷ draw → hours), Saira numerals.
- **quiz:** what dominates a mostly-sleeping board's battery life? (the sleep/idle current)
- **links:** **embed `/tools` LiPo runtime calc**; MCU cluster 10 (sleep).

---

## Open decisions
1. 11 or trim (fold 07 boost into 06 if the courses don't need boost).
2. Slugs (grep; `power-and-heat`, `grounds-and-power-rails` are Fundamentals').
3. Citations unfetched (no-research); pull on go.
