# L1.01 SCHEMATIC — block-by-block rebuild map

**Status:** DRAFT, revised post-panel (2026-06-12). No DB change yet. The 3-lens panel validated the direction; the revisions below are folded in before authoring. The mode-band renderer is already in (tested).

## Panel revisions — fold in before building

**Blockers (fix or it teaches wrong / leaves a beginner stranded):**
- **B1 · Drop the PWR_FLAG from Island 1.** *(Engineer)* The current lesson deliberately defers ALL rail flags (VBUS/+5V/GND) to the single ERC pass; a lone +5V flag in Island 1 is a cargo-cult step with no ERC feedback yet and contradicts Part 3. Remove it from the regulator steps (this edits the already-live U2-island steps too); add a one-line forward-pointer ("+5V will read 'not driven' until you flag it at the ERC pass — expected"). All three rail flags land in Part 3.
- **B2 · The "how to actually draw" mechanics need a home.** *(Student, Teacher)* Net-label/port mechanics, power-symbol-vs-net-label ([79]), "same name = same net," and the worked "one net with me" framing aren't placed. Fix: make **Island 1 the explicit worked example** — "do this first one slowly with me; every island after is the same moves" — teaching place-part / W-wire / P-port / same-name=same-net inline, with [79] + the named-labels deepDive [82] attached. Introduce the **L net-label** mechanic later, at the first *signal* net (Island 5b). Keep the fade cue.
- **B3 · Split the USB front-end (Island 5).** *(Teacher blocker, Student major)* It bundled CC + ESD + fuse + diff-pair naming + pin-mapping. Split into **5a USB power & protection** (VBUS→F1→+5V rename, CC/Rd sink, D1 ESD *ahead of the fuse*) and **5b USB data** (data pair → D1 → IO19/IO20, with the **diff-pair naming as its own labeled beat** — "this is what unlocks the LAYOUT router"). Clip on 5b.

**Majors:**
- **M1 · Per-island "check" = eyeball vs the reveal SVG, NEVER ERC.** *(Engineer)* Reword the Part-2 band body so "check it" can't read as "run ERC" — ERC stays a single end pass.
- **M2 · Reconcile Part 0 roadmap to the ACTUAL islands.** *(Student, Teacher)* List the final 8 by exact name/order (below); don't promise six then build eight.
- **M3 · Strapping-pin rule belongs with LEDs/Headers, NOT USB.** *(Engineer)* USB pins (IO19/20) are *fixed*; strapping-avoidance is about *choosing free pins* — keep [51] (user-LED pick) + [63] (trap) in Island 6/7.
- **M4 · Split Part 3 into CHECK then DO.** *(Teacher)* `✓ CHECK` for the answer-key compare + eyeball checks; then a `▶ DO — IN KICAD` band for run-ERC-to-zero + export. The gate work is DO.
- **M5 · Keep the failure-mode line in each island intro.** *(Teacher)* The terse intros must retain the SCHEMATIC-specific failure "why" (no output cap → oscillates; float → boots random; no Rd → no power) that makes each check answerable. Audit the warn/gotcha blocks ([06]/[17]/[23]) survive into islands.

**Minors:**
- **m1 · Merge Island 3 (the chip) into Island 2 (Decoupling)** — caps at U1's 3V3 pins *and* tie U1 3V3/GND in one loop. *(Teacher)*
- **m2 · Move the Show-Hidden-Pins GND verify into Island 8 (grounds sweep)**, where it's already explained — not a solo menu-toggle mid-build. *(Student, Engineer)*
- **m3 · Stake a clip in Island 8** for the no-connect (Q) sweep — high-failure DO step; empty slot shows a beginner nothing. *(Student)*
- **m4 · Island 1 opens with "find U2 (drawn as AP2112K), drag it clear, then wire."** *(Student)*
- **m5 · Order Island 7:** intro → worked "first column by hand" → Insert clip → 44-pin table → ⚠ reused-net. *(Student)*
- **m6 · Swap Part 3:** answer-key SVG *before* "eyeball what ERC can't catch" (show the picture before saying "compare to it"). *(Student)*
- **m7 · Confirm every island's wire-step uses the gold `Draw it ·` "Do" badge and its check uses `Check yourself`** so the micro-mode is locally visible under the one section band. *(Student, Teacher)*

**Revised island list (Part 2, in build order):** 1 Regulator (worked example) · 2 Decoupling + the chip · 3 Boot & reset · 4 USB power & protection (5a) · 5 USB data + diff-pair naming (5b) · 6 LEDs (+ strapping-pin/free-pin rule) · 7 Headers & test points · 8 Grounds & no-connects.

**Verified sound (no change):** power-first order; named-nets-by-name in Island 1 before U1 is placed (no KiCad ordering requirement); the 1:1-GPIO-mirror+rails framing; the CC+protection merge as a clean de-dup; moving the symbol-quirks table to Part 1 (before the first wire).

---

_(Original draft sequence below — read together with the revisions above.)_

Legend: **[BAND]** mode ribbon (new) · **[reuse]** existing block, verbatim, moved here · **[NEW]** newly authored · **[clip]** empty video slot (admin-only) · **[cut]** dropped/merged.

Reuse principle: every filled diagram, deepDive, table, the quiz, and the gate are **kept** — this is a reorder + merge, so ~near-zero content loss. New authoring is the 4 bands + 8 short island intros + the trimmed Part 0 + clip slots (~15 short blocks). Net length likely **drops** (~105 → ~90) by merging the front-half "why" into each island and leaning on BOM for part-choice.

---

## Part 0 · 📖 ORIENT — meet the board (READ; the only read-only section)

1. **[BAND]** `Mode · orient · Meet the board` — *body:* "Read this once — you won't open KiCad yet. It's the map for everything you're about to wire."
2. **[reuse]** intro prose — "six small problems… follow the power left→right" (condensed to ~1 paragraph).
3. **[reuse]** `wroom-power-flow.svg` (the power-flow diagram).
4. **[NEW]** roadmap table — *"The six islands you'll build"*: one row each (Regulator · Decoupling · Boot & reset · USB front-end · LEDs · Port protection) with a one-line job. Doubles as the Part 2 table-of-contents.
5. **[reuse]** refdes primer prose ("every part has a refdes… U1, C5, R3").
   - **[cut]** the full per-sub-circuit conceptual teaching that currently lives here → relocated into the islands (Part 2). Part-choice rationale → referenced to BOM, not re-taught.

## Part 1 · ▶ DO — get set up in KiCad

6. **[BAND]** `Mode · do — in KiCad · Get set up` — *body:* "From here, keep KiCad open — every step below is something you do."
7. **[reuse]** `action: downloadKicadStarter` (the download button).
8. **[clip]** Video — *open the project + schematic editor* (existing slot; you're re-recording).
9. **[reuse]** "What your symbols look like" table (the starter quirks — U2-as-AP2112K, J1 DP/DN, hidden GND pins, LED A/K) + the "if a pin shows only a number" note + the "library part is a draft" deepDive.
10. **[reuse]** "place by convention" callout (→ rename label to `Draw it · place by convention` stays) + `schematic-conventions.svg` (now `IC`).
11. **[reuse]** KiCad keys table (A/P/W/L/M/R/Q…) + the Insert-key note + KLC sourceRef.

## Part 2 · ▶ DO — build it, island by island

12. **[BAND]** `Mode · do — in KiCad · Build it, island by island` — *body:* "Each sub-circuit is one island: meet it, wire it, check it, then the next."

**Island 1 — Regulator (U2)**
13. **[NEW]** intro — "**The regulator.** USB gives 5 V; the chip wants 3.3 V. **U2** (the RT9080 you sourced) holds it steady, with a 1 µF cap in and out to stay stable. Wire it:"
14. **[clip]** Video — *wire the regulator island* (existing slot).
15. **[reuse]** the "wire the regulator with me" **steps** (U2 island: +5V/VIN, EN→VIN, +3V3/VOUT, C5/C6, GND, PWR_FLAG).
16. **[reuse]** `l1-01-sub-power.svg` (reveal: "see it wired").
17. **[reuse]** check-yourself ("why a regulator not a divider") + **[reuse]** LDO-dropout deepDive.
18. **[reuse]** "named labels beat long wires" deepDive (the same-name=same-net idea).

**Island 2 — Decoupling (C1/C2/C3/C7)**
19. **[NEW]** intro — "**Decoupling.** The chip grabs tiny gulps of current faster than the regulator can answer; a small cap at each power pin holds a reserve. Place C2/C3/C7 (0.1 µF) at U1's 3V3 pins and C1 (10 µF) as bulk."
20. **[reuse]** decoupling table + check-yourself + "why three small caps" deepDive + `l1-01-sub-mcu.svg`.
21. **[clip]** *(optional)* Video — *drop the decoupling ports.*

**Island 3 — The chip (U1)**
22. **[NEW]** short do-step — "**The module.** Connect U1's 3V3 → +3V3 and its visible GND → GND; turn on View ▸ Show Hidden Pins to confirm the pad's hidden GND pins join by name."

**Island 4 — Boot & reset (R1/R2/SW1/SW2)**
23. **[NEW]** intro — "**Boot & reset.** EN and GPIO0 must sit at a defined level at power-up, so each gets a 10 kΩ pull-up; the two buttons override them. Wire R1+SW1 on EN, R2+SW2 on IO0."
24. **[reuse]** boot/reset table + check-yourself + "why 10k / weak" deepDive + `l1-01-sub-bootreset.svg`.

**Island 5 — USB front-end (J1/D1/F1/R3/R4)** *(the dense one)*
25. **[NEW]** intro — "**The USB front-end.** The port that touches the outside world: CC resistors tell the charger to send power, the data pair routes through ESD protection, and a polyfuse guards the rail."
26. **[reuse]** CC-sink prose + table + check + deepDive; the F1/D1 protection prose + tables + deepDive; the "wire by name not number / D−=IO19, D+=IO20 / diff-pair naming" prose; the doubled-data-pins note.
27. **[clip]** **(NEW slot)** Video — *wire the USB front-end* (J1 data → D1 → IO19/IO20, CC to Rd, the diff-pair net names).
28. **[reuse]** `l1-01-sub-usb.svg` (reveal).

**Island 6 — Indicator LEDs (R5/R6/LED1/LED2)**
29. **[NEW]** intro — "**Indicators.** An LED needs a series resistor to set its current. LED1 (power) on +3V3, LED2 (user) on a free GPIO — both through 470 Ω."
30. **[reuse]** LED table + check + Ohm's-law deepDive + the user-LED-pin-pick callout + `l1-01-sub-leds.svg`.

**Island 7 — Headers & test points (J2/J3, TP1/TP2)**
31. **[NEW]** intro — "**Break it out.** Mirror every GPIO to the headers so a breadboard can reach it. The rail positions (GND/+3V3/+5V) are convenience rails you add."  *(carries the corrected 1:1-mirror wording)*
32. **[reuse]** "first header column with me" worked steps + **[clip]** Insert-key march video (existing slot) + the 44-pin table + the ⚠ reused-net prose + jump-row warning + `l1-01-sub-headers.svg` + `l1-01-sub-test-points.svg`.

**Island 8 — Grounds & no-connects**
33. **[reuse]** "grounds & loose ends" callout + prose (one GND net; Q on every open pin) + check-yourself + "ERC is the net" deepDive.

## Part 3 · ✓ CHECK — prove it & export (the gate)

34. **[BAND]** `Mode · check · Prove it & export` — *body:* "Run the checks KiCad gives you, then export the report the gate wants."
35. **[reuse]** "eyeball what ERC can't catch" warn (VIN-on-+5V, LED polarity, D+/D− not swapped).
36. **[reuse]** `l1-01-schematic-reference.svg` (the answer-key) — compare your sheet.
37. **[reuse]** "run ERC" callout + prose + the "ERC says…/you do" table + PWR_FLAG deepDive.
38. **[clip]** Video — *open Inspect ▸ ERC, run to 0, save the .rpt* (existing slot).
39. **[reuse]** "export & upload" steps (clean ERC → plot PDF → attach the `ERC_REPORT`) + KiCad-manual sourceRef.

## Close

40. **[reuse]** Quiz (incl. Q8 header-trap + the hardened distractors) — renders under the CHECK band.
41. **[reuse]** "Exit this stage" advance banner.

---

## Net effect
- **Learn/do is now explicit:** one ORIENT section, then everything is DO (each island: intro → wire → check) under gold bands, then a CHECK section. The student always knows the mode.
- **De-duplicated with BOM** and the front-half/back-half overlap removed → shorter.
- **Clips:** 5 staked (open / regulator / **USB-front-end NEW** / headers / ERC) + 2 optional (decoupling, boot/reset). Empty = admin-only, so over-provisioning is free.
- **Reused verbatim:** all 8 sub-circuit SVGs, the answer-key + power-flow + conventions diagrams, every deepDive, every table, the quiz, the gate.

## Your call before I build
- Sequence look right? Any island you'd order differently, or an "optional" clip you definitely want staked (or dropped)?
- Part 0 roadmap as a **table** (my draft) vs a short bulleted prose list?
- On approval I author the ~15 new blocks + the reorder, dump the assembled card for a final read, safeParse all 8, then apply.
