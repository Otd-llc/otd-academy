# WS2812 Addressable-LED Driver (L1.03) — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log is what backs this board's
> `DESIGN_VALIDATION` attestations — when a tick is made, the proof is here.

| | |
| --- | --- |
| **Slug** | `l1-03-ws2812-node` |
| **Status** | `Pass 12 DRY (design-stage)` — ≥10 passes + dry achieved; **8 new parts may now be created**. Footprint↔pinout `[S]` + fab-DRU `[L]` owed at schematic/layout (F7). |
| **Passes run** | 12 |
| **Last dry pass** | **Pass 12** (design-stage — zero new material findings) |

### Pass 10 — DRY-SWEEP of the folded design (2 fresh reviewers: electrical + consistency)

**Verdict: NOT DRY.** The big Passes-4–9 fold introduced regressions — the dry-sweep
caught them (validates the rule). NEW findings:

| # | Sev | Finding (NEW / fold-induced) | Disposition |
| --- | --- | --- | --- |
| F10-1 | **MED** | **C11 = 10 µF pushes total VBUS cap (~11.2 µF w/ C5+C8+C9) over the USB-2.0 10 µF inrush ceiling** — a side-effect of the PI-2 fold, never checked. | FOLD: **C11 → 4.7 µF** (total ~6 µF, still rides the 60 mA pixel pulse) — new 4.7 µF part. |
| F10-2 | **MED** | **D3 PESD5V0S1BA is NOT "low-cap"** — 35–45 pF (bidirectional); the §4 "low C keeps the 800 kHz edge" claim is **false**. RC w/ R8 ≈ 19 ns. | FOLD: keep the part (solderable SOD-323; 19 ns ≪ 300 ns WS2812 pulse = fine) but **correct the rationale** + add the RC row. |
| F10-4 | **MED** | **Cross-domain margin row uses unjustified bounds** — VBUS,min "4.6 V" asserted (USB allows 4.40 V at the port; PTC/trace IR lowers it more) and DOUT-high ≈ VBUS is optimistic (ignores the WS2812 DOUT driver drop, unspecified for the clone). Real margin ~+0.2…+0.4 V, thinner than stated +0.75 V. | FOLD: re-derive honestly; flag residual gated on the XINGLIGHT DOUT VOH (P5-2). |
| F10-3 | LOW/MED | SMAJ5.0A standoff is **correct** (no conduction at 5 V; VBR 6.4 V), BUT 800 µA leakage at 5 V is un-budgeted AND PI-1 assumes 5V_EXT up to **5.5 V** — above D2's VRWM 5.0 V → soft-conduction at top of tolerance. **Tension to resolve.** | **DECISION:** bound 5V_EXT ≤5.25 V + accept 800 µA leakage **OR** step D2 → SMAJ6.0A (VC 10.3 V). |
| F10-6 / P10-1 | MED | **§8 cost "+~$2.50 new" contradicts the BOM** — actual ≈ **$3.85–4 new** (the two TE terminals alone are $2.30; D2/D3 added without updating). Likely **~$16–17 total**, over the $14–15 target. | FOLD: update §8 cost. |
| F10-5 | LOW | RK8 "9 mA" unchanged by D3 (D3 inactive at 4.3 V) — the "D2/D3 backstop" clause **overstates D3's role** for the steady DOUT-high case. | FOLD: trim wording. |
| P10-2 | LOW/MED | **FMEA gap on the new protection parts themselves** — D2 fail-short = dead, unindicated 5V_EXT rail (relies on the user's fused supply); D3 reverse-leakage on DATA not in its verify scope. | FOLD: extend RK10 + D3 verify scope. |
| F10-7 | info | D2/D3 footprints join the `[S]`-staged Pass-6 list — correctly staged, no action. | (staged) |

**Clean (attacked, no regression):** isolation invariant; refDes/qty consistency
(BOM import-valid; R5-8=4, C2-9=5, C1,C11=2); §7 = 6 core items; risk-register
integrity (RK10≠RK11, §7 item-6 list matches statuses); "one combined lesson"
decision reflected (no leftover tier language); all Passes-4–9 folds physically present.

### Owner decision on the Pass-10 D2 fork (resolved 2026-06-17)

**D2 = keep Littelfuse SMAJ5.0A** + **recommend a regulated strip supply ≤ 5.25 V**
(silk + guide). Chosen over SMAJ6.0A because it (a) resolves F10-3 by keeping D2 within
its no-conduction band, (b) tightens the F10-4 cross-domain margin (lower V(5V_EXT,max)
→ lower VIH), and (c) keeps the stronger 12 V crowbar (VC ~9.2 V vs ~10.3 V). The 800 µA
VRWM leakage is budgeted (off-board 5V_EXT, not VBUS). No new part added by this choice.

### Pass 11 — re-fold of all 8 Pass-10 fixes, then fresh adversarial dry-sweep

**The 8 Pass-10 fixes were folded** into design.md + bom.csv (F10-1 C11→4.7 µF new part
`CL21A475KAQNNNE`; F10-2 D3 low-cap claim deleted + §3 RC row 470 Ω·45 pF ≈ 21 ns; F10-3
5V_EXT ≤5.25 V bound + 800 µA leakage budgeted; F10-4 cross-domain margin re-derived
honestly; F10-5 RK8 D3-clause trimmed; F10-6 §8 cost → ~$4 new/~$16–17 total; P10-2 new
risk **RK17** protection-part FMEA).

**XINGLIGHT datasheet OBTAINED + verified (P5-2/F8 closed):** LCSC C2843785. Key facts
folded — VDD 3.5–5.5 V; **VIH 0.7·VDD / VIL 0.3·VDD**; **logic-input abs-max VDI =
−0.5…VDD+5.5 V** (note: the clone is *looser* than the Worldsemi VDD+0.5 V assumed in
Pass 5 — applies to *our onboard* pixel, NOT the user's external strip, so RK8 stays
bound conservatively); VOUT(port) 7 V; IOL1 12 mA; ESD 2 kV HBM; **RES ≥ 80 µs** (table) /
≥ 100 µs (note b — datasheet self-inconsistent), both ≪ the 300 µs firmware latch; pinout
1=VDD/2=DO/3=GND/4=DI. **DOUT VOH is NOT specified even in the clone's own datasheet** →
the F10-4 cross-domain residual is real and owed to bring-up. Two adversarial findings
verified against the real datasheets before folding: **PESD5V0S1BA = 35 pF typ / 45 pF max**
(Nexperia — confirms F10-2 "not low-cap"); **CL21A475KAQNNNE = 4.7 µF/25 V/X5R/0805**
(Samsung — real, in stock).

**Verdict: NOT DRY** — the fold introduced consistency regressions (the dry-pass rule
earns its keep *again*):

| # | Sev | Finding (NEW / fold-induced) | Disposition |
| --- | --- | --- | --- |
| F11-1 | MED | **§7 checklist still said "7 new parts"** while §8 + BOM now carry **8** (the new 4.7 µF C11). A part-creation step reading §7 would miss one. | FOLD: §7 → "8 new parts". |
| F11-2 | LOW | §1 I4 wording claimed the ≤5.25 V bound "keeps D2 below its 5.0 V VRWM" — false (5.25 > 5.0 VRWM; it stays below *VBR 6.4 V*, not VRWM). | FOLD: reword to "within its no-conduction band (below VBR 6.4 V; ~0.8 mA leakage at 5.0 V nominal)". |
| F11-3 | trivial | Status headers still read "post Passes 1–9 / owes a dry pass". | FOLD: → Passes 1–12, design-stage DRY. |

**Clean (attacked, no regression):** total-VBUS-bulk arithmetic (C5 1 + C8 0.1 + C9 0.1 +
C11 4.7 = 5.9 µF < 10 µF); cost arithmetic ($3.95 new); BOM refDes-count = quantity on
every row (C1=1, C11=1, the 0.1 µF row still 5, 470 Ω still 4) → import-valid; reset 300 µs
≥ datasheet 80–100 µs and ≠ the 35 µs intra-frame rule; RK8's conservative external-DIN
bound; onboard-hop +0.30 V floor still positive; isolation invariant intact.

### Pass 12 — dry-sweep after the F11 fixes (fresh adversarial: consistency + electrical)

Re-ran the consistency + electrical lenses against the F11-corrected doc. **8-new-parts
count now agrees across §7 / §8 / BOM (8 NEW rows: U3, LED3, J4, J5, C10, D2, D3, C11; C1
reused).** I4 wording accurate. No stale "7 new" / "1–9" / "C11 10 µF" remain (grep-clean).
No floating nodes introduced; every folded number re-checked at worst case.

**Verdict: DRY (design-stage).** Zero new material findings. With 12 passes run and a
design-stage dry pass achieved, the **design-stage gate is met** — the 8 new parts may be
created, the BOM imported, and the revision advanced. Still explicitly owed (F7 phase-
staging, legitimately): footprint↔symbol↔pinout `[S]` (Pass 6, at schematic), fab-DRU +
the VBUS⟂5V_EXT ERC `[L]` (at layout), and the **DOUT-VOH cross-domain residual** (F10-4)
confirmed by measurement at bring-up.

## Gate (Definition of done — all must hold before any part/BOM/revision)

- [x] Requirements traced · pins accounted + sequencing proven (Pass 4)
- [x] Every number worst-case-proven (Pass 3/5/7/11) · parts datasheet-verified (Pass 5/11 — incl. LED3 XINGLIGHT); **footprint cross-check `[S]`-staged** (Pass 6, schematic)
- [x] Power integrity proven (Pass 7) · every failure mode mitigated-or-accepted (Pass 8, RK10–RK17)
- [x] Every part hand-buildable (Pass 2/9) + sourceable, exact import strings (Pass 2/11 — 8 new + reused)
- [x] Layout constraints captured (Pass 9) · teachable (Pass 9) · consistent (Pass 11/12) · pipeline-conformant (Pass 3)
- [x] Every applicable conditional audit run (none fire — no flags) · every risk de-risked or scheduled
- [x] **≥ 10 passes AND a dry pass achieved** — 12 passes, **Pass 12 design-stage DRY**
- [ ] *Owed at schematic/layout (F7 phase-staging):* footprint↔symbol↔pinout `[S]` (Pass 6) · fab-DRU / VBUS⟂5V_EXT ERC `[L]` · the F10-4 **DOUT-VOH cross-domain residual** confirmed at bring-up

---

## Passes

### Pass 1 — Electrical / first-principles (adversarial reviewer + owner notes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 1.1 | HIGH | VBUS budget used "~350 mA" LDO input — wrong: RT9080 is a **linear** LDO so Iin ≈ Iout ≈ **500 mA** at the WiFi-TX peak. Real worst case ~560 mA. | ✅ first-principles (linear LDO passes current ~1:1) + L1.01's own 500 mA figure | §3 budget rows recomputed (continuous ~220 mA; brief peak ~560 mA < 1 A trip, bulk rides it); RK4 reframed. | §3 numbers now match L1.01's regime; §5 budget paragraph updated to agree. |
| 1.2 | CRITICAL | **Data-before-power / parasitic power**: USB on + injection off → 5 V data into unpowered strip DIN → parasitic self-power through the DIN clamp diode. Owner confirmed + noted it's inevitable in class. | ✅ mechanism confirmed; **precision added** — the driver into the strip is the *onboard-pixel DOUT* (VBUS-powered), not the AHCT125 directly | Added **R8 (470 Ω)** on onboard-DOUT→J4 → limits clamp current to ~9 mA; documented power-up order; consolidated into new **RK8**. | §3 parasitic-current row = ~9 mA; §2 topology + power-up note; RK8 DE-RISKED. Exact DIN abs-max deferred to Pass 5. |
| 1.3 | MED | VOH margin "+0.9 V" overstated the *guaranteed* min (3.94 V @ 8 mA → +0.44 V). | ✅ TI datasheet VOH table | §3 states both: +0.9 V actual (µA load) / +0.44 V guaranteed; noted 0.7·VDD tracks VDD. | Both positive → RK1 still DE-RISKED, now honestly. |
| 1.4 | MED | §3 missing the required data-timing check. | ✅ AHCT125 tpd ~9–22 ns vs 1.25 µs WS2812 bit | Added a tpd-≪-bit row to §3. | Timing now backs the §7 datasheet attestation. |
| 1.5 | MED | "Board never carries strip current" was false for the J5→J4 5 V_EXT path. | ✅ topology trace | §1 E3 + §5 corrected; added a 5 V_EXT/GND trace-ampacity layout item (RK7). | §5 now states the copper is the limit (terminals ~15 A). |
| 1.6 | LOW | Data GPIO uncommitted ("e.g. IO5"). | ✅ GPIO5 is non-strapping, non-USB (USB = GPIO19/20) on the S3 | Committed **GPIO5** in §1 F2 / I2 / §2. | — |
| 1.7 | LOW | Unused-gate parking right, but the **used** gate's enable polarity must be explicit (AHCT125 OE active-low). Owner confirmed parking hygiene. | ✅ TI pinout | §2 + RK6: **gate 1 `1OE → GND` (enable)**; gates 2–4 `nOE → VCC`, `nA → GND`. | RK6 DE-RISKED with the used-gate exception pinned. |

**Residual after Pass 1:** exact WS2812 DIN abs-max input voltage (RK8) → Pass 5
datasheet audit. Layout items (RK7) scheduled to the layout stage by design.

### Pass 2 — BOM / sourcing / DFM / solderability (adversarial reviewer + owner notes)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 2.1 | CRITICAL | **Pixel not Western-orderable**: bare "Worldsemi / WS2812B" isn't stocked at Digikey/Mouser/Newark → fails the §8 sourcing bar (the L1.01-bridge trap). | ✅ distributor search | Switched LED3 to **XINGLIGHT `XL-5050RGBC-WS2812B`** (Digikey-orderable). §4/§8/BOM updated. | §8 sourcing bar now satisfiable; exact string to confirm at part creation. |
| 2.2 | HIGH | SK6812 / "Opsco" alt is **LCSC-only** — not a valid Western second source. | ✅ distributor search | Kept SK6812 as a *noted* electrical drop-in, explicitly LCSC-only (not relied on). | §8 second-source note honest. |
| 2.3 | HIGH | 5050 solderability under-rated; owner added the fix: **mandatory flux pen**. | ✅ WS2812B datasheet ("solder once", lens heat-sensitive) | RK5 raised to Med; de-risk = mandatory flux-pen guide step + temp-controlled iron ~315 °C / quick dwell + close-up; THT-pixel fallback noted. | RK5 has a concrete build-stage plan. |
| 2.4 | — | Connector family: reuse the **TB-1-POWER** vetted part. | ✅ found in `c:\zzz\otd\hardware\...\TB-1-POWER\docs\BOM.csv` (`282837-2`) + TE confirms `282837-3` 3-pos | J4 → **TE 282837-3**, J5 → **TE 282837-2** (replaced On-Shore ED120). §1/§2/§4/§8/BOM updated. | TE 282837-2/-3 verified real, in stock, 5.08 mm, 15 A, THT. |
| 2.5 | MED | SN74AHCT125D/N, EEU-FR1C102 — confirm real/stocked. | ✅ Digikey | Kept; in-stock confirmed. | — |
| 2.6 | LOW | Reused L1.01 `(mfr, mpn)` strings must match the library exactly (incl. "Würth" ü). | ✅ library lookup (all match) | No change; noted in §8. | Reused lines won't miss the strict import. |

**Residual after Pass 2:** confirm the XINGLIGHT exact `(manufacturer, mpn)` string at
part-creation time (sourcing audit closes then).

### Pass 3 — Process / pipeline / internal consistency (adversarial reviewer)

| # | Sev | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| 3.1 | HIGH | F1's stripboard rationale was wrong: `requiresStripboard` doesn't add a DESIGN_VALIDATION conditional — it materializes a **separate `STRIPBOARD_VALIDATION` checklist + BOM_SOURCING exit gate**. | ✅ `canonical-checklist-templates.ts:148-149` (DV conditionals = mains/Li-ion/thermal only) | Corrected Friction F1; flag stays false (custom PCB). | §7 confirmed exactly the 6 core items, no conditionals. |
| 3.2 | HIGH | §7 "all risks de-risked" can't be literally true while layout/build risks are open. | ✅ wording trace | §7 item 6 redefined to **design-stage** risks; RK5/RK7 explicitly close at build/layout. | §7 honestly checkable. |
| 3.3 | MED | Risk IDs `R#` **collided** with resistor refDes (acute with R7/R8 + RK7/RK8). | ✅ inspection | Renamed all risks to **`RK#`**; added a risk-ID note up top; logged as Friction F6. | No remaining `R#`-as-risk usage; §3↔§6 refs consistent. |
| 3.4 | LOW | Handoff doc referenced by the design is absent on main/this branch (only on PR #149). | ✅ `git`/`ls` | Logged as Friction F5; softened reliance. | — |
| 3.5 | LOW | "Reuses L1.01 part" undersold that R7/R8/C8/C9 are **new placements**. | ✅ | Wording clarified ("new placement of an existing part") in §3/§4. | — |
| 3.6 | — | Cross-section consistency re-check after all edits (refDes/values/qty across §1–§8 + BOM). | ✅ | Verified: 470 Ω = `R5,R6,R7,R8` qty 4 everywhere; 0.1 µF = `C2,C3,C7,C8,C9` qty 5; J4/J5/LED3/U3/C10 agree across §2/§3/§4/§8/BOM. | Consistency audit clean as of Pass 3. |

**Residual after Pass 3:** none from this lens. Note: this pass *re-proved* the
consistency lens against Passes 1–2 edits (the RK rename + connector swap + R8
addition all cross-checked).

---

### Pass 4 — Requirements & traceability + net integrity (fresh adversarial)

Verified pinouts: SN74AHCT125 SOIC-14 (pin 7 = GND, 14 = VCC); WS2812B 5050 (VDD/DOUT/VSS/DIN).

| # | Sev | Finding (NEW) | Disposition |
| --- | --- | --- | --- |
| P4-N1 | **HIGH** | **U3 pin 7 (GND) never stated** anywhere — gate pins + VCC specified, GND implicit; C8 decap drawn only to VCC. | FOLD: net U3.7→GND, C8 14→7. |
| P4-R2 | MED | **VBUS ⟂ 5V_EXT isolation is documented-intent only** — no validation/ERC item asserts the two 5 V nets are never joined (the board's core claim). | FOLD: add isolation validation item + §2 statement (ties to RK11/RK10). |
| P4-N2 | MED | LED3 VSS/GND never explicitly netted (RK3 only covers the *strip* ground, not the onboard pixel's). | FOLD: net LED3.VSS→GND. |
| P4-S1 | MED | **Power-DOWN** case unanalyzed: USB removed while 5V_EXT on → GPIO5/3V3 may back-drive U3 input as U3.VCC collapses. | FOLD: add power-down analysis; extend power-order note. |
| P4-N3 | MED | nY-open is correct (Hi-Z) but contradicts the doc's blanket "don't float" — note the exception. | FOLD (clarify). |
| P4-N4 | MED | J4.DATA is an open 800 kHz stub when no strip attached (benign, high-Z) — unanalyzed. | FOLD into RK7. |
| P4-N5 | LOW | C10− return node unstated (safety-relevant w/ RK9). | FOLD: C10−→common GND at J5. |
| P4-R1/R3 | LOW | F3 not traced to a dedicated validation item; I2/I3 data seam. | FOLD (annotate). |

Clean: no unrequired new part; U3-vs-pixel same-rail power-up (no skew); no 5V_EXT→VBUS back-power path except the current-limited DATA net.

### Pass 5 — Part-truth / datasheet, worst-case (fresh adversarial, datasheets read)

| # | Sev | Finding (NEW) | Disposition |
| --- | --- | --- | --- |
| P5-1 | **CRITICAL** | **RK8 framing wrong:** with strip unpowered (VDD=0) the WS2812 abs-max VI = VDD+0.5 V = **+0.5 V**, so ~5 V on DIN is a **gross abs-max-VOLTAGE violation** mitigated *only* by R8 current-limiting — NOT "within abs-max." WS2812 has **no published DIN clamp-current rating**, so "9 mA safe" is an engineering bound, not spec. | FOLD: reword RK8 honestly; power-up order = PRIMARY control; reinforces the protection-cluster decision. |
| P5-2 | **HIGH** | **The XINGLIGHT XL-5050RGBC-WS2812B datasheet was never opened** — every WS2812 number is sourced to *Worldsemi WS2812B*. Clones differ on exactly VIH/abs-max/RES. LED3 "datasheet-verified" cannot be ticked. | FOLD/ACTION: obtain the XINGLIGHT datasheet at part creation; log as open until then. |
| P5-3 | MED | **Reset/latch time missing** from §3: WS2812B RES ≥ 50 µs; clones need ≥ 280 µs → set firmware latch ≥ 300 µs (clone-safe). | FOLD: add §3 row + firmware note. |
| P5-4 | MED | AHCT125 VOH 3.94 V is the **25 °C** value; over-temp guaranteed min = **3.8 V** → worst-case margin **+0.30 V**, not +0.44 V. | FOLD: correct §3 + RK1. |
| P5-5/6 | LOW | VIH 2.0 V is flat across VCC (not VCC-specific); TI recommends 0.1 µF **+** 1 µF. | FOLD (wording). |

Confirmed correct (backs §7 ticks): AHCT125 VIH/VIL/VOH-actual(4.4 V)/abs-max/tpd/OE-active-low; WS2812 VIH=0.7VDD; **RT9080 is a true linear LDO (P-MOSFET pass) → Iin≈Iout claim correct**; RT9080 dropout 0.53 V max @600 mA (3.3 V holds); LDO stable with C5/C6 + C1 10 µF on output.

### Pass 7 — Power integrity, deep (fresh adversarial)

| # | Sev | Finding (NEW) | Disposition |
| --- | --- | --- | --- |
| PI-1 | MED | **Cross-domain margin at the EXTERNAL strip's first DIN never proven** — driver = onboard DOUT (VBUS), receiver threshold = 0.7·V(5V_EXT); margin does NOT track (different rails). Worst corner: VBUS sag + 5V_EXT high. | FOLD: add §3 cross-domain row; document max V(5V_EXT). |
| PI-2 | MED | **No bulk cap on VBUS itself** — onboard pixel's 60 mA pulses share bare VBUS with the LDO input. | DECISION: add 10 µF VBUS bulk (affects BOM) or prove the omission. |
| PI-3 | LOW | C10 hot-plug inrush (tens of A) returns through the common GND (data reference bounce). | FOLD: star-ground note (layout). |

Clean: 0.1 µF shifter decap adequate; C10 correctly scoped to 5V_EXT; PTC derating holds; LDO stable.

### Pass 8 — FMEA, deep (fresh adversarial) — 6 NEW failure modes, converging on ONE gap

**The board has ZERO protection on its external connectors** (all protection — PTC, USBLC6 — is on USB). 5 of these 6 converge on a **protection cluster at J4/J5**.

| # | Sev | NEW failure mode | Disposition |
| --- | --- | --- | --- |
| RK10 | **CRITICAL** | **12 V/24 V wrong-supply into J5** (over-voltage; distinct from RK9 reverse). 12 V bricks are the most common wrong supply; no OVP on 5V_EXT. | DECISION: TVS at J5 + silk "5 V ONLY" + prove isolation. |
| RK11 | **CRITICAL** | **DATA net bridges 5V_EXT→VBUS/AHCT125** via R8 + pixel clamps (always present by topology) — converts strip faults/over-injection into onboard damage. | DECISION: needs worst-case DOUT/1Y current calc + shared clamp. |
| RK12 | HIGH | Stray-strand short across J4 (5V-GND/5V-DATA/DATA-GND); unfused 5V_EXT + C10 energy → trace burn/weld. | FOLD/DECISION: "fuse the injection supply" guidance; optional rail PTC. |
| RK13 | HIGH | **ESD onto exposed J4 DATA** (nothing protects J4; WS2812 ESD-fragile) → kills onboard pixel / degrades AHCT125. | DECISION: ESD diode on J4 DATA. |
| RK14 | HIGH | Hot-plug at J4: ground-last transient + far-end-powered-strip 2-supply contention. | FOLD (guide power-down rule) + staged Schottky. |
| RK15 | MED | Long strip lead as antenna/transient injector back into DATA→board. | FOLD: shared clamp + max-lead-length note. |
| RK16 | MED | **AHCT125 always-enabled (1OE→GND)** → strip flashes/latches full-white during GPIO5 reset / VBUS brown-out while 5V_EXT stays up. | FOLD: firmware blank-early + cap; optional 1OE-gating (note). |

**Load-bearing missing calc:** worst-case current onboard-pixel DOUT + AHCT125 1Y must absorb when J4 DATA is driven to max credible external voltage (needs WS2812 DOUT abs-max — extends P5).

### Pass 9 — Layout-readiness + learnability (fresh adversarial)

| # | Sev | Finding (NEW) | Disposition |
| --- | --- | --- | --- |
| L9-6 | **HIGH** | **"Teaches" is two separable concepts** ("level shifting AND dedicated rail + common ground") — quiz-able core ambiguous; doc's own ORIENT exposes two why-questions. | DECISION: pick a primary, or adopt two-tier framing (L9-9). |
| L9-2 | MED | Two 5 V domains lack a **"never-join" rule + star-ground point + silk distinction** (5V-USB vs 5V_EXT). | FOLD (ties P4-R2). |
| L9-3 | MED | **No test point on the shifted data line** — the lesson's most probe-worthy node ("see the 5 V swing"). | FOLD: add data TP. |
| L9-1 | MED | C10 (~Ø10×20 mm tall radial) **Z-height/enclosure keep-out** uncaptured. | FOLD: layout constraint; consider lower-profile cap. |
| L9-7 | MED | 74AHCT125 brings un-budgeted teaching surface (active-low EN, Hi-Z, parked CMOS, HCT). | FOLD (guide budget). |
| L9-8 | MED | Screw terminals + external supply + power-up order + deferred reverse guard = **4 new beginner failure surfaces**; thin for L1. | DECISION: ties to protection + two-tier. |
| L9-9 | LOW | USB-only reward path IS met (good); **two-tier framing** (Tier 1 USB-only core / Tier 2 external extension) would resolve L9-6/L9-8/L9-10. | DECISION (the elegant unifier). |
| L9-4/5/10 | LOW | Terminal wire-exit orientation vs antenna edge; pixel/R7/R8 placement intent; restate L1.01 "beginner-success wins" priority. | FOLD (layout/framing). |

## Owner decisions on Passes 4–9 (resolved 2026-06-17)

- **Protection cluster:** **TVS on 5V_EXT (D2 SMAJ5.0A) + ESD on J4 DATA (D3
  PESD5V0S1BA)** — addresses RK10/RK11/RK13/RK15, and D2 also covers RK9 reverse.
  (Full cluster w/ series Schottky/PTC NOT taken; RK12/RK14 stay accept+document.)
- **Pedagogy:** **keep ONE combined lesson**; primary graded concept sharpened to
  level-shifting (Teaches field updated), common-ground as supporting. (Two-tier NOT
  taken — L9-6/8/9 addressed by the framing edit, not a tier split.)
- **VBUS bulk:** **add 10 µF (C11)** on VBUS (PI-2).

**Passes 4–9 FOLDED** into design.md + bom.csv: U3 GND + LED3 VSS + C10− netting
(P4-N1/N2/N5), VBUS⟂5V_EXT isolation invariant + ERC item (P4-R2), power-down
analysis (P4-S1), RK8 honest reword (P5-1), VOH over-temp +0.30 V (P5-4), reset/latch
≥300 µs row (P5-3), cross-domain margin row (PI-1), D2/D3/C11 added, TP3 data test
point (L9-3, labeled pad), C10 Z-height + star-ground (L9-1/PI-3), RK10–RK16
registered, F7 (protocol phase-staging) + F8 (clone-datasheet) logged.

## Remaining

- ✅ **LED3 datasheet** — OBTAINED + verified (Pass 11, LCSC C2843785); exact string
  `XINGLIGHT` / `XL-5050RGBC-WS2812B` confirmed (P5-2/F8 closed).
- ✅ **Design-stage dry pass** — achieved at **Pass 12** (12 passes total). Design-stage
  gate met → the 8 new parts may be created, BOM imported, revision advanced.
- **Owed at schematic (`[S]`):** **Pass 6 — Footprint ↔ symbol ↔ pinout** (needs the
  chosen KiCad symbols/footprints) — per the F7 phase-staging refinement.
- **Owed at layout (`[L]`):** fab-DRU DRC + the **VBUS ⟂ 5V_EXT never-joined ERC/DRC**
  check (E3 isolation invariant).
- **Owed at bring-up:** the **F10-4 DOUT-VOH cross-domain residual** — measure onboard
  DOUT-high + the external strip's first-DIN to confirm the ~+0.2…+0.5 V margin (the
  XINGLIGHT datasheet does not specify DOUT VOH).
