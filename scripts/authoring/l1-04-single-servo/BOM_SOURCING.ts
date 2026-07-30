// L1.04 single-servo driver — BOM_SOURCING card.
//
// Authored ahead of the board from docs/boards/l1-04-single-servo/{design.md §4
// and §8, bom.csv, validation-log.md}, with L1.01's BOM_SOURCING card as gospel
// for the sourcing method itself (exact MPN, stock plus lifecycle, a package you
// can hand-solder, a named second source, and the jellybean escape hatch for
// passives).
//
// The new material is the servo subsystem's four sourcing decisions: a PTC
// chosen by two currents at once, a Schottky wired backwards on purpose, a TVS
// whose standoff had to clear the rail ceiling, and a through-hole electrolytic
// whose voltage rating is set by the TVS clamp rather than by the rail.
//
// Two findings from this board's own validation run are taught as first-hand
// material rather than hidden: the SS34-E3/57T package is SMC (DO-214AB) and not
// SMA (pass 3.1), and F2's maximum working voltage is 6 VDC and not the 8 V that
// was carried across from the part it replaced (pass 7.1 / 8.1).
import {
  type Blk, band, sect, prose, check, gotcha, dive, shot, tube, does, ref, exit,
  publishCard,
} from "../lib";

const BLOCKS: Blk[] = [
  tube("BOM sourcing: the parts that make a servo rail behave"),

  prose(
    "Every part on the L1.01 core carries straight over, already sourced and already soldered once by you. The servo subsystem adds **eight lines and three genuinely new part numbers**, and all three of the new ones are protection. That is the shape of this BOM: a familiar core, plus a small set of parts whose whole job is to survive a mistake.\n\nThe sourcing method has not changed. Every line still needs an exact [[MPN]], stock and an Active lifecycle, a package you can solder with an iron, and a named second source where the line is critical. What is new is *how the numbers get picked*, because two of these parts are chosen against a specific current and a specific voltage, and getting either one wrong turns a guard rail into a nuisance.",
  ),

  band("orient", "Read the servo lines the way the design chose them", "Read this one. The BOM is frozen and nothing here is yours to pick. What is yours is understanding why each number is that number."),
  {
    type: "callout", severity: "info", label: "The four checks, unchanged from L1.01",
    body: "Every line on this BOM clears the same four checks you learned on the breakout. **An exact MPN**, so the size, tolerance and rating are all pinned rather than wished for. **In stock and Active** at your distributor, so you can actually get it. **A package you can hand-build**, which on this board means 0805 or larger, leaded SMD, and through-hole. **A second source** named for anything critical. The jellybean escape hatch still applies too: if a plain 470 Ω 0805 resistor is sold out, another reputable maker's 470 Ω 0805 at the same tolerance drops straight in. The chips, diodes, fuses and connectors are the lines you order exactly.",
  },

  // ── 01 ────────────────────────────────────────────────────────────────────
  sect("01", "F2: a fuse chosen by two currents at once", "A resettable fuse is picked by what it must let through and what it must stop. Those are two different numbers."),
  prose(
    "**F2** is a [[PTC]], a resettable fuse: a polymer that conducts happily until too much current heats it, at which point it goes high-resistance and starves the fault. Cool it down and it comes back. No replacement, no fuse holder.\n\nPicking one is a two-sided problem. Its **hold current** has to sit *above* the worst thing you legitimately expect, or it nuisance-trips during normal use. Its **trip current** has to sit *below* a real fault, or it never protects anything. On this board the worst legitimate load is a servo stall at **0.9 A**, and that stall is not a fault. It is the demonstration the whole lesson is built around, so the fuse must ride straight through it.\n\nThe chosen part is the **miniSMDC150F-2**: **1.5 A hold, 3.0 A trip, 6 VDC maximum**. A PTC's hold current falls as it gets warm, roughly to 0.8 of its rating at 60 °C, which still leaves about **1.2 A against a 0.9 A stall**. Clear margin, and a real short still pushes past 3 A and opens the rail.",
  ),
  {
    type: "table",
    columns: ["Number", "Value", "What it has to clear"],
    rows: [
      [{ text: "Hold current" }, { text: "1.5 A, about 1.2 A derated hot" }, { text: "The 0.9 A worst-case stall, which must keep working" }],
      [{ text: "Trip current" }, { text: "3.0 A" }, { text: "A shorted connector or a servo far outside this board's class" }],
      [{ text: "Maximum voltage" }, { text: "6 VDC" }, { text: "The rail's 5.5 V ceiling, with 0.5 V left over" }],
      [{ text: "Series resistance" }, { text: "0.04 ohm typical, 0.11 ohm aged worst case" }, { text: "At 0.9 A that is a 0.10 V drop and 0.089 W of heat, both negligible" }],
      [{ text: "Package" }, { text: "1812 SMD" }, { text: "Large enough to place and solder with an iron" }],
    ],
  },
  shot(
    "The miniSMDC series datasheet: the row for the 150F part, with hold, trip and maximum voltage all on one line.",
    "Littelfuse PolySwitch miniSMDC datasheet PDF, electrical characteristics table, zoomed so the miniSMDC150F row is legible: I_hold 1.5 A, I_trip 3.0 A, V_max 6 V.",
  ),
  check(
    "**Why not fit a 1.0 A fuse, since the servo only draws 0.1 to 0.2 A while it moves?** Because it would trip the first time the servo hit an obstacle. A 0.9 A stall is a legitimate operating state on this board, and a fuse that opens during it turns your brownout demonstration into a dead rail. Hold above the worst legitimate load, trip below the fault.",
  ),
  dive(
    "The 6 V that was nearly 8 V",
    "This board's validation run caught a real error worth showing you. An earlier draft used a 1.1 A PTC from the same family, and when the part was swapped up to the 1.5 A version to gain margin on the stall, the maximum-voltage figure came along with it. The 1.1 A member of that family is rated **8 V**. The 1.5 A member is rated **6 VDC**.\n\nNothing broke, because 6 V still clears the rail's 5.5 V ceiling. But the margin the design *thought* it had, 2.5 V, was really **0.5 V**, and that changed the honest answer to a question the guide has to be able to answer: can you plug in a 6 V supply? With 8 V of standoff you could have argued yes. With 6 V, no.\n\nThe lesson generalises. When you substitute a part, **re-read every rating you copied from the old one**. Ratings do not travel with a part number just because the family name did. This is exactly why the servo rail's ceiling is written down as a hard 5.5 V in the requirements rather than left as a vague 'about 5 V'.",
  ),

  // ── 02 ────────────────────────────────────────────────────────────────────
  sect("02", "D2: a diode wired backwards on purpose", "The reverse-polarity protection on this board is a crowbar, and it costs nothing while everything is fine."),
  prose(
    "Somebody will wire the screw terminal backwards. It is a two-screw connector with no keying, and the person using it is a beginner. So the board is built to survive it.\n\nThe obvious fix is a diode **in series** with the supply: current flows one way and not the other. It works, and it costs you a [[forward voltage]] drop of roughly 0.4 V out of the servo's supply, forever, on every board, in exchange for protecting against a mistake most people never make.\n\nThis board uses a **shunt crowbar** instead. **D2** sits *across* the rail, cathode to the positive side, so in normal operation it is reverse-biased and does nothing at all. Wire the terminal backwards and D2 is suddenly forward-biased: it conducts hard, holds the rail at about **-0.4 V** so the electrolytic capacitor and the servo never see meaningful reverse voltage, and the current it draws pushes **F2** past its trip point. The diode makes the fault loud. The fuse does the interrupting.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "D2", decoration: "ref" }, { text: "SS34-E3/57T", decoration: "mpn" }, { text: "40 V / 3 A Schottky in SMC (DO-214AB), shunt reverse-polarity crowbar. 100 A surge rating carries the fault until F2 trips" }],
      [{ text: "D3", decoration: "ref" }, { text: "SMAJ6.0A", decoration: "mpn" }, { text: "400 W unidirectional TVS in SMA (DO-214AC), 6.0 V standoff, clamps to 10.3 V" }],
      [{ text: "F2", decoration: "ref" }, { text: "miniSMDC150F-2", decoration: "mpn" }, { text: "1812 PTC, 1.5 A hold / 3.0 A trip / 6 VDC max, servo-rail overcurrent" }],
    ],
  },
  check(
    "**Why a shunt crowbar rather than a series diode?** A series diode costs about 0.4 V of the servo's supply on every board every day, to defend against a mistake that happens rarely. The crowbar is completely invisible in normal operation and turns a reversed supply into a tripped, self-resetting fuse.",
  ),
  shot(
    "SMC beside SMA: D2's body is visibly the larger of the two, and they do not share a footprint.",
    "The two diode packages side by side at the same scale: DO-214AB (SMC) and DO-214AC (SMA), with a ruler or an 0805 part in frame for scale. Package names legible.",
  ),
  gotcha(
    "SS34-E3/57T is SMC, not SMA",
    "The suffix decides the package. **SS34-E3/57T is DO-214AB, which is SMC.** The SMA-package variant is SS34A-E3/61T, and it is not stocked at this board's distributor. Assign the **SMC footprint**, and do not reuse the SMA pads you drew for D3. The larger body is a bonus here: it hand-solders more easily and it dissipates the reverse-polarity fault better.",
  ),

  // ── 03 ────────────────────────────────────────────────────────────────────
  sect("03", "D3: a clamp whose standoff has to clear the rail", "Pick a TVS one size too small and it leaks and warms up while nothing is wrong."),
  prose(
    "A servo contains a DC motor and its own H-bridge driver. Every time that bridge commutates, and every time the motor is released from a stall, the motor's inductance dumps energy back onto the supply as a voltage spike. Most of it recirculates inside the servo's own body diodes. What escapes lands on **VSERVO**, where **D3** catches it.\n\nA transient voltage suppressor is a diode that stays out of the way below its **standoff voltage** and conducts hard above it. Choosing that standoff is the whole decision. Too high and the spike gets through. Too low and it sits partially conducting at normal rail voltage, leaking and warming.\n\nThe first draft used a **SMAJ5.0A**, standoff 5.0 V, on a rail whose maximum is 5.5 V. That puts the part on its own leakage knee during completely normal operation. The board uses the **SMAJ6.0A**: standoff **6.0 V**, breakdown starting at **6.67 V**, clamping to **10.3 V** at its 400 W peak. Comfortably asleep through 5.5 V, and its clamp sits well below the 16 V that C8 can take.",
  ),
  shot(
    "The SMAJ series datasheet, with the 6.0 V row showing standoff, breakdown and clamping voltage side by side.",
    "Littelfuse SMAJ TVS datasheet PDF, electrical ratings table, zoomed on the SMAJ6.0A row: V_wm 6.0 V, V_BR min 6.67 V, V_C 10.3 V, I_pp 38.8 A.",
  ),
  check(
    "**What goes wrong with a 5.0 V standoff part on a rail that can legitimately reach 5.5 V?** It never gets to be fully off. Standoff is the voltage below which the part is effectively invisible. Run the rail above it and the TVS leaks continuously, warms, and ages, all while nothing is actually wrong.",
  ),

  // ── 04 ────────────────────────────────────────────────────────────────────
  sect("04", "C8: the one part on this board with a polarity", "A 1000 microfarad electrolytic is a different animal from the ceramics you have soldered so far."),
  prose(
    "**C8** is a **1000 µF, 16 V aluminium electrolytic**, through-hole, from Panasonic's low-ESR FM series. Three things about it are new to you.\n\nIt is **polarised**. Every ceramic capacitor on your L1.01 board could go in either way round. This one cannot. It has a marked negative lead and a shorter leg, and putting it in backwards is one of the few genuine ways to make a hobby board fail loudly.\n\nIts **voltage rating is set by the clamp, not by the rail**. The rail tops out at 5.5 V, so 6.3 V would seem like enough. But D3 clamps transients at up to **10.3 V**, and C8 is sitting right there when it does. 16 V gives real headroom over that clamp.\n\nAnd **low ESR is part of the specification**. Equivalent series resistance is the small resistance in series with the ideal capacitor inside every electrolytic. A high-ESR part cannot deliver a fast current step no matter how many microfarads it claims, because the resistance drops the voltage on the way out. The FM series is chosen for that, not for its capacitance alone.",
  ),
  {
    type: "table",
    columns: ["Ref", "Part", "Role"],
    rows: [
      [{ text: "C8", decoration: "ref" }, { text: "EEU-FM1C102", decoration: "mpn" }, { text: "1000 uF / 16 V radial through-hole, low-ESR FM series. Polarised. Servo-rail bulk reservoir" }],
      [{ text: "C9", decoration: "ref" }, { text: "CL21B104KBCNNNC", decoration: "mpn" }, { text: "100 nF 0805 ceramic. The high-frequency partner C8 is too slow to be" }],
      [{ text: "R7", decoration: "ref" }, { text: "RC0805FR-07470RL", decoration: "mpn" }, { text: "470 ohm 0805, in series with the servo signal. The same part as the LED resistors" }],
    ],
  },
  shot(
    "The electrolytic's polarity marks: the stripe down the negative side and the shorter negative lead.",
    "Macro of the EEU-FM1C102 can showing the negative stripe, beside the part's two leads with the shorter one identifiable. Both marks legible at card width.",
    "See it wired · which leg is negative",
  ),
  check(
    "**The rail never exceeds 5.5 V, so why is C8 rated 16 V rather than 6.3 V?** Because D3's clamping voltage is 10.3 V, and when D3 clamps a transient, C8 is sitting on that same node seeing it. The capacitor's rating has to clear the clamp, not the rail.",
  ),
  dive(
    "Why 1000 microfarads, and why a ceramic beside it",
    "The capacitor's job is to cover the *fast* part of the servo's current demand, the part the external supply cannot answer in time because of the resistance and inductance of the wire between them.\n\nThe sizing sum is the same one you would use for any bulk cap. A current step **I** held for a time **t** pulls a capacitor's voltage down by **I x t / C**. The servo's start-up inrush is about **1.3 A** for roughly a millisecond, so 1.3 A x 1 ms / 1000 µF is about **1.3 V** of dip on a 5 V rail. Uncomfortable, survivable, and it recovers as the supply catches up. At the servo's internal drive rate the steps are far shorter, so the dip is smaller still.\n\nWhat the capacitor is *not* for is the sustained stall. A 0.9 A stall lasting seconds is supplied by the external source. No practical capacitor holds a rail up for that long, and it does not have to.\n\n**C9**, the 100 nF ceramic beside it, is there because a big electrolytic is physically slow. Its internal structure gives it inductance, so it stops behaving like a capacitor at high frequency. The small ceramic covers exactly the range the big one has given up on. This pairing is the same one you already have on the 3.3 V rail, at a different scale.",
  ),

  // ── 05 ────────────────────────────────────────────────────────────────────
  sect("05", "The connectors, and the two things not on the BOM", "One screw terminal, one snapped header, and two items you buy that this board's part list does not contain."),
  prose(
    "**J4** is a 2-position **5.08 mm** screw terminal, through-hole, the same part L1.03 used. The wide pitch is deliberate: it takes real supply wire and it is hard to mis-seat. **J5** is one 1x3 piece snapped off the same **0.1 inch breakaway header** strip that gives you J2 and J3, so the servo connector costs you nothing new.\n\nThe BOM cannot contain the servo itself or its supply, because they are not soldered to the board. Both still have specifications, and both are yours to buy.\n\nThe **servo** must be micro class, up to MG90S, and specified as working from a 3.3 V signal. Hobby servos publish no input-threshold number at all, so this is mitigation by choosing a known-good part rather than by reading a datasheet. The **supply** must be a **regulated 5 V**, comfortably above 2 A so a stall never makes it sag, and ideally current-limited so a wiring mistake is boring. A bench supply is perfect. A 6 V adapter is not acceptable at any price.",
  ),
  {
    type: "table",
    columns: ["Item", "Spec", "Why"],
    rows: [
      [{ text: "J4", decoration: "ref" }, { text: "282837-2, 2-pos 5.08 mm screw terminal, THT" }, { text: "Takes real supply wire; wide pitch is hard to mis-seat. Reused from L1.03" }],
      [{ text: "J5", decoration: "ref" }, { text: "PRPC040SAAN-RC, snapped to 1x3" }, { text: "The same breakaway header strip as J2 and J3, so no new line item" }],
      [{ text: "The servo (not on the BOM)" }, { text: "Micro class up to MG90S, 3.3 V signal compatible" }, { text: "Sized to the 0.9 A stall the rail protects. Hobby servos publish no input threshold, so the kit names a proven one" }],
      [{ text: "The supply (not on the BOM)" }, { text: "Regulated 5 V, 2 A or better, current-limited if you have it" }, { text: "Must not sag under stall, must not exceed 5.5 V, must not be a 6 V adapter" }],
    ],
  },
  shot(
    "The two connectors: the 5.08 mm screw terminal beside a 1x3 piece snapped off the breakaway header strip.",
    "J4 screw terminal and a snapped 1x3 section of the PRPC040SAAN-RC strip, side by side, with the rest of the breakaway strip visible behind to show where the 1x3 came from.",
  ),
  check(
    "**You have a 5 V 1 A phone charger in the drawer. Good enough for the servo rail?** Marginal, and it will make the lesson confusing. A 0.9 A stall is most of that charger's rated output, so its own output will sag and you will see the servo weaken exactly when you are trying to observe a clean stall. Buy the headroom: 2 A or better.",
  ),

  // ── the BOM itself ────────────────────────────────────────────────────────
  band("orient", "in your BOM · How every line earns its place", "The BOM below is sourced and locked. You are not choosing parts here. You are reading how each line was chosen."),
  does("Read the locked BOM", [
    {
      text: "**Exact MPN on every line:** manufacturer plus full part number. Watch the suffixes on the diodes, because that is where the package hides.",
      proof: "Every line carries a manufacturer and a full part number, not just a value.",
    },
    {
      text: "**In stock and Active** at your distributor. The three new lines were screened live when this board was sourced, and all three were Active and deep in stock.",
      proof: "Every line is in stock and Active, not end-of-life.",
    },
    {
      text: "**A package you can hand-solder.** On this board that means 0805 or bigger for passives, leaded SMD for the actives, and through-hole for the connectors and the electrolytic. The 0805 floor is the same one from L1.01: about 2.0 x 1.25 mm, against an 0402's 1.0 x 0.5 mm, which is a quarter of the area and really wants paste and a stencil. Nothing here is harder than the USB-C connector you already did.",
      proof: "Every package is 0805 or larger, leaded SMD, or through-hole.",
    },
    {
      text: "**A second source where it matters.** F2's is the Bel Fuse 0ZCG0150FF2C at the same 1.5 A hold and 3 A trip. D2's is any 40 V / 3 A Schottky in DO-214AB. D3's is another maker's SMAJ6.0A.",
      proof: "Each of the three new critical lines names a second source.",
    },
    {
      text: "**Order the servo and the supply separately.** They are not on this list because they do not get soldered, and the build stops dead without them.",
      proof: "A micro-class 3.3 V-compatible servo and a regulated 5 V supply of 2 A or better are on your order.",
    },
  ]),
  shot(
    "A distributor listing for one of the new lines: quantity in stock and an Active lifecycle status, side by side.",
    "DigiKey product page for miniSMDC150F-2, cropped to the part header plus the stock quantity and the lifecycle status field. Both legible at card width.",
  ),
  { type: "bomTable", caption: "The live BOM: the L1.01 core plus the servo subsystem", collapsed: false },
  {
    type: "table",
    columns: ["Ref", "Qty", "MPN", "Package", "Sourcing note"],
    rows: [
      [{ text: "F2", decoration: "ref" }, { text: "1" }, { text: "miniSMDC150F-2", decoration: "mpn" }, { text: "1812" }, { text: "New line. Chosen on hold and trip together. Second source: Bel Fuse 0ZCG0150FF2C" }],
      [{ text: "D2", decoration: "ref" }, { text: "1" }, { text: "SS34-E3/57T", decoration: "mpn" }, { text: "SMC / DO-214AB" }, { text: "New line. Check the suffix: this is the SMC part, and the SMA variant is not stocked" }],
      [{ text: "D3", decoration: "ref" }, { text: "1" }, { text: "SMAJ6.0A", decoration: "mpn" }, { text: "SMA / DO-214AC" }, { text: "New line. 6.0 V standoff, chosen above the rail's 5.5 V ceiling" }],
      [{ text: "C8", decoration: "ref" }, { text: "1" }, { text: "EEU-FM1C102", decoration: "mpn" }, { text: "Radial THT" }, { text: "Reused from L1.03. Polarised. 16 V rating clears D3's 10.3 V clamp" }],
      [{ text: "J4", decoration: "ref" }, { text: "1" }, { text: "282837-2", decoration: "mpn" }, { text: "THT, 5.08 mm" }, { text: "Reused from L1.03" }],
      [{ text: "J5", decoration: "ref" }, { text: "1" }, { text: "PRPC040SAAN-RC", decoration: "mpn" }, { text: "THT 0.1 inch" }, { text: "Same breakaway strip as J2 and J3, snapped to 1x3" }],
    ],
  },
  tube("Screen the three new lines and lock the BOM"),

  {
    type: "quiz",
    prompt: "Quick check: sourcing",
    gate: true,
    questions: [
      {
        id: "ptc-two-currents", reviewId: "l104-ptc-two-currents",
        q: "F2 holds 1.5 A and trips at 3.0 A. What is the design logic behind that pair of numbers?",
        options: [
          "Hold above the worst legitimate load, so a 0.9 A stall keeps working, and trip below a real fault's current",
          "Two numbers for two different servos",
          "They are whatever came with the 1812 footprint",
        ],
        answer: 0,
        explain: "A stall is a legitimate operating state on this board. Only a genuine short should open the rail, so the fuse has to ride the stall and still catch the fault.",
      },
      {
        id: "crowbar-how", reviewId: "l104-crowbar-how",
        q: "How does D2 protect the board when the supply is wired backwards?",
        options: [
          "It blocks the reverse current the way a check valve blocks flow",
          "It conducts hard, holds the rail near a diode drop below ground, and forces F2 to trip",
          "It absorbs the fault energy as heat for as long as the fault lasts",
        ],
        answer: 1,
        explain: "It is a crowbar: it shorts the fault deliberately so the fuse does the interrupting. In normal operation it is reverse-biased and costs nothing.",
      },
      {
        id: "crowbar-why-not-series",
        q: "Why not just put a diode in series with the servo supply instead?",
        options: [
          "A series diode cannot handle 0.9 A",
          "A series diode would need its own heatsink",
          "A series diode drops about 0.4 V out of the servo's supply all the time, in exchange for a fault that is rare",
        ],
        answer: 2,
        explain: "The crowbar costs nothing while everything is fine, which is almost always. That is the trade the design is making.",
      },
      {
        id: "tvs-standoff",
        q: "The first draft of this board used a 5.0 V standoff TVS. Why was it changed to 6.0 V?",
        options: [
          "The rail can legitimately reach 5.5 V, so a 5.0 V part would sit partly conducting during normal operation",
          "The 5.0 V part was out of stock",
          "Servo transients turned out to be larger than expected",
        ],
        answer: 0,
        explain: "Standoff is the voltage below which the part is effectively invisible. It has to clear the rail's legitimate maximum, or the clamp leaks and warms while nothing is wrong.",
      },
      {
        id: "c8-voltage-rating",
        q: "The servo rail never exceeds 5.5 V. Why is C8 rated at 16 V?",
        options: [
          "Bigger capacitors only come in higher voltage ratings",
          "Because D3 clamps transients at up to 10.3 V, and C8 sees that clamp",
          "To reduce its equivalent series resistance",
        ],
        answer: 1,
        explain: "The capacitor's rating has to clear the clamping voltage of the part protecting it, not just the steady rail.",
      },
    ],
  },

  exit(
    "The core carries over already sourced. Three new part numbers are locked, each chosen against a number you can now name: a fuse that rides a 0.9 A stall and trips at 3 A, a crowbar that costs nothing until the day it saves you, and a clamp whose standoff clears the rail. C8 is polarised and rated to the clamp rather than the rail. The servo and its supply are on your order even though they are not on this list. The quick check above is the gate. Next you draw all of it.",
  ),

  ref("PolySwitch miniSMDC resettable PPTC datasheet (Littelfuse): hold, trip, maximum voltage and resistance for the 150F part", "https://www.littelfuse.com/assetdocs/littelfuse-ptc-minismdc-datasheet?assetguid=3ed735aa-64ed-43a6-bc20-610590bc99c6"),
  ref("SMAJ series TVS diode datasheet (Littelfuse): standoff, breakdown and clamping voltage for the SMAJ6.0A", "https://www.littelfuse.com/assetdocs/tvs-diodes-smaj-datasheet?assetguid=13c2a823-03b8-4d1f-9ddc-9b44670aed9d"),
  ref("SS3x Schottky rectifier datasheet (Vishay General Semiconductor): 40 V / 3 A ratings, forward voltage and the DO-214AB package", "https://www.vishay.com/docs/88751/ss32.pdf"),
  ref("EEU-FM1C102 product listing (DigiKey): the Panasonic FM series 1000 uF / 16 V low-ESR electrolytic, with its datasheet", "https://www.digikey.com/en/products/detail/panasonic-industry/EEU-FM1C102/613727"),
  ref("Ceramic capacitor basics (PSMA): why the dielectric class sets the capacitance you actually keep under voltage", "https://www.psma.com/sites/default/files/uploads/files/Ceramic%20Capacitor%20Basics.pdf"),
];

publishCard({ slug: "l1-04-single-servo", stage: "BOM_SOURCING", blocks: BLOCKS })
  .catch((e) => { console.error(e); process.exit(1); });
