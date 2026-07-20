// SANDBOX ONLY — the L1.01 signpost specimen sheet. Dev-guarded, and DELETED
// before the PR (per the sandbox-round convention in otd-frontend-design).
//
// Why this exists: L1.01 carries 188 signposts across 8 stages, and the same
// teaching role is expressed several different ways. The SCHEMATIC orient band
// even states the contract out loud — "**Do ·** = do it in KiCad, **Check** = a
// quick gut-check, **Eyeball it** = verify by eye" — but only Do and Check have
// dedicated components; Eyeball it falls through to a generic grey box. Every
// specimen below uses REAL L1.01 copy so the owner judges the actual text.
//
// Each round shows the LIVE baseline first (option 0), then the candidates.
// Toggle the theme with the control at the top right: any option whose colour
// fails to flip is a theming-law bug, which is the point of showing both.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SelfCheckBlock } from "@/components/guide/SelfCheckBlock";
import {
  A0, A1, A2, A3, A4, A5, A6,
  B0, B1, B2, B3, B4,
  C0, C1, C2, C3, C4,
  D0, D1, D2, D3,
  E0, E1, E2,
  F0, F1, F2, F3,
  type BandProps,
} from "./specimens";
import {
  A7, A8, A9, A10, A11, A12,
  B5, B6, B7, B8, B9,
  C5, C6, C7, C8, C9,
  D4, D5, D6, D7, D8,
  E3, E4, E5, E6, E7,
  F4, F5, F6, F7,
} from "./specimens2";
import {
  A9a, A9b, A9c, A9d, A12a, A12b, A12c, A12d,
  B9a, B9b, B9c, B9d,
  C9a, C9b, C9c, C9d,
  D4a, D4b, D4c, D8a, D8b, D8c,
  E6a, E6b, E6c, E6d,
  F4a, F4b, F4c, F7a, F7b, F7c,
} from "./specimens3";
import {
  A12b1, A12b2, A12b3, A12b4,
  BT1, BT2, BT3, BT4,
  D8c1, D8c2, D8c3, D8c4,
  E6d1, E6d2, E6d3, E6d4,
  F7c1, F7c2, F7c3, F7c4,
} from "./specimens4";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// ── real L1.01 copy ───────────────────────────────────────────────────

const ORIENT: BandProps = {
  mode: "orient",
  title: "Meet the board",
  body:
    "Read this once. You won't open KiCad yet. It's the map for everything you're about to wire. As you go: **Do ·** = do it in KiCad, **Check** = a quick gut-check, **Eyeball it** = verify by eye.",
  ord: 1,
};

const DO_BAND: BandProps = {
  mode: "do",
  venue: "in KiCad",
  title: "Build it, island by island",
  body:
    "Each sub-circuit is one island: meet it, wire it, then eyeball it against the reference. Hold the full [[ERC]] for the very end. Run it per-island and it's just a wall of 'not connected' noise.",
  ord: 2,
};

const PROVE_IT: BandProps = {
  mode: "check",
  title: "Prove it",
  body: "Trace the things ERC can't see against the answer key, then run the checker.",
  ord: 3,
};

const DO_STEP = {
  title: "wire the decoupling, then tie the module",
  body: "Caps first, right at U1's power pins, then connect the module itself.",
  steps: [
    "First, place the parts. **Ctrl+F** to **U1**, click its body to select it, press **M**, and drag it to the centre of the sheet: it's the hub every other island feeds into.",
    "Drop a **+3V3** and a **GND** port on each of **C1, C2, C3**: the +3V3 you made in the regulator island; same name, same net, no wire drawn between.",
    "Now the module: **U1's 3V3** pin → a +3V3 port, **U1's visible GND** pin → a GND port. This is the headline connection: the regulator can be perfect and the chip stays dark if 3V3 isn't on the rail.",
  ],
};

// What the Do step consumes (the LEGO parts-callout move) and what you should
// see after each step. Written for the sandbox from the step text itself.
const DO_USES = ["Ctrl+F", "M", "U1", "C1 C2 C3", "+3V3", "GND"];
const DO_FIXES = [
  "Press Esc to drop the move, then Ctrl+F for U1 again and re-press M with the cursor over its body.",
  "The port has to land ON the leg's endpoint. Zoom in until the pin's circle is visible, then place it.",
  "Check the label spelling: +3V3 and 3V3 are two different nets, and ERC will call the second one undriven.",
];
const DO_PROOFS = [
  "U1 sits centre-sheet with C1, C2, C3 beside it.",
  "Each cap has a +3V3 and a GND port on its legs, no wires drawn.",
  "U1's 3V3 and GND pins carry ports, not bare pin ends.",
];

// The Gotcha, split into the three things a warning owes the reader.
const LEDGER = {
  headline: "an LDO without its output cap can oscillate",
  trap: "Don't treat C5/C6 as optional.",
  cost: "An LDO without its output capacitor can oscillate. That turns your clean rail into noise.",
  fix: "Keep C5 and C6 on the schematic, and in LAYOUT place them tight to U2's pins.",
  body: "",
};

// Answer-key lines and why-lines for the tickable verify variants.
const TRACE_PROOFS = [
  "U2's VIN wire lands on the +5V label, downstream of F1.",
  "The bar on each LED symbol points at the GND port.",
  "D+ leaves D1 on the D+ pin, D- on the D- pin.",
];
const TRACE_FIXES = [
  "Move U2's VIN wire to the +5V net, downstream of F1.",
  "Rotate the LED symbol, or move the GND port to the cathode side.",
  "Swap the two labels at D1's outputs, then re-run ERC.",
];
const TRACE_WHYS = [
  "Both are valid rails, so ERC cannot tell them apart, but VIN on raw VBUS drops the fuse's overcurrent protection.",
  "A backwards LED just stays dark. ERC has nothing to say about it.",
  "A swapped pair enumerates as nothing at all, and looks identical on the schematic.",
];

const GOTCHA = {
  headline: "an LDO without its output cap can oscillate",
  body:
    "Don't treat C5/C6 as optional. An LDO without its output capacitor can oscillate. That turns your clean rail into noise.",
};

const EYEBALL = {
  headline: "what ERC can't catch",
  body:
    "ERC checks connectivity, not intent, so before your **final** ERC run, trace three things by eye against the answer-key image just above. These are exactly the slips a green ERC won't save you from.",
  items: [
    "U2 VIN sits on +5V (after the fuse), not raw VBUS: both are valid rails, so ERC can't tell them apart, but **VIN on raw VBUS means the regulator loses the fuse's overcurrent protection.**",
    "Each LED's bar/flat side (K) faces GND: backwards it just stays dark, and ERC says nothing.",
    "USB_D+ and USB_D- aren't swapped through D1.",
  ],
};

const SELF_CHECK =
  "In one line, what do C2/C3 do? They sit right at the chip's power pins and keep its 3.3 V steady when it suddenly pulls current.";

const ASIDES = [
  {
    verb: "Setup",
    headline: "Get KiCad + the starter open",
    body: "First, get KiCad and the starter project open.",
  },
  {
    verb: "Keys",
    headline: "The KiCad 10 keys you'll use",
    body:
      "A handful of keys do most of the work: hover over a part and press the key. (Live list: Preferences → Hotkeys, or press ? in the editor.)",
  },
  {
    verb: "Alternative",
    headline: "have hot air? Reflow them instead",
    body:
      "Same order, different heat. If you own a hot-air station, paste-and-reflow puts U1 and J1 down just as well, and alignment is a little more forgiving because molten paste pulls the part true.",
  },
];

const SECTIONS = [
  {
    num: "02",
    title: "Decoupling & the module",
    body: "A steady rail at the regulator is not the same as a steady rail at the chip a few centimetres away.",
    severity: "info" as const,
  },
  {
    num: "02",
    title: "Set up PCBWay's rules: before you route",
    body:
      "Load your factory's limits into KiCad now, before the first trace: from then on it won't let you draw one PCBWay can't build.",
    severity: "warn" as const,
  },
  {
    num: "01",
    title: "Order of operations",
    body:
      "A soldering iron sits at ~340 °C and never looks hot: it burns instantly, so it goes back in its stand the moment it leaves your hand.",
    severity: "critical" as const,
  },
];

// ── sheet furniture ───────────────────────────────────────────────────

function Round({
  id,
  title,
  problem,
  locked,
  children,
}: {
  id: string;
  title: string;
  problem: string;
  /** Set once the owner has picked, so the round reads as closed. */
  locked?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`round-${id.toLowerCase()}`} className="mt-16 scroll-mt-6">
      <div className="title-rule" aria-hidden />
      <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
        ▸ Round {id}
      </p>
      <h2 className="title-section mt-1">{title}</h2>
      {locked ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 border-y border-status-green/50 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-status-green">
          <span className="border border-status-green/60 px-1.5 py-0.5 font-bold">Locked</span>
          {locked}
        </p>
      ) : null}
      <p className="mt-2 max-w-2xl font-serif text-[15px] leading-relaxed text-muted">{problem}</p>
      <div className="mt-8 space-y-12">{children}</div>
    </section>
  );
}

// The owner's picks, one per round. Everything else on this page is the record
// of how the decision was reached, kept until the real components land.
const WINNERS = new Set(["A12b2", "B9b", "C9a", "D8c3", "E6d1", "F7c4"]);

function Option({
  id,
  note,
  children,
}: {
  id: string;
  note: string;
  children: React.ReactNode;
}) {
  const won = WINNERS.has(id);
  return (
    <div>
      {/* Option ID sits ABOVE the frame, never as a badge inside it. */}
      <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em]">
        <span className={`font-bold ${won ? "text-status-green" : "text-command-gold"}`}>{id}</span>
        {won ? (
          <span className="border border-status-green/60 px-1.5 py-0.5 font-bold text-status-green">Locked</span>
        ) : null}
        <span className="text-muted">{note}</span>
      </p>
      {won ? (
        <div className="border-l-2 border-status-green/60 pl-4">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

function Round2({ n = 2, note }: { n?: number; note: string }) {
  return (
    <div data-r2 className="border-t-2 border-command-gold/40 pt-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
        ▸ Round <span className="font-numeral text-sm tabular-nums">{n}</span>
      </p>
      <p className="mt-1.5 max-w-2xl font-serif text-[15px] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

export default function SignpostSandboxPage() {
  // Dev-only: this route never exists in a production build.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex justify-end">
        <ThemeToggle />
      </div>

      <PageHeader
        eyebrow="SANDBOX"
        title="Signpost specimens"
        lead="Every teaching signpost in L1.01, in both themes, using the lesson's real copy. Pick a winner per round."
        meta={[
          { label: "LESSON", value: "l1-01-wroom-breakout" },
          { label: "SIGNPOSTS", value: <span className="font-numeral tabular-nums">188</span> },
          { label: "ROUNDS", value: <span className="font-numeral tabular-nums">6</span> },
        ]}
      />

      {/* Jump nav. 58 specimens is a long scroll; the owner should be able to
          land on one round and stay there. */}
      <nav className="border-t border-panel-border/60 pt-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {[
            ["A", "Mode band"],
            ["B", "Do ladder"],
            ["C", "Gotcha"],
            ["D", "Prove it"],
            ["E", "Asides"],
            ["F", "Severity"],
          ].map(([k, label]) => (
            <li key={k}>
              <a
                href={`#round-${k.toLowerCase()}`}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none"
              >
                <span className="font-bold text-command-gold">{k}</span> {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Round
        id="A"
        locked="A12b2 · gate tag carrying the band fraction, [ do 02 / 06 ]."
        title="The mode band: orient, do, and Prove it"
        problem="Two label grammars ship today. LAYOUT writes 'Mode · do · place every part' (no venue, lowercase title); everywhere else writes 'Mode · do · in KiCad · Build it…', and the parser puts everything after the mode into the Bebas title, so 'in KiCad ·' renders at display size. The band's three colours are also hardcoded hexes, so A0 is the one option here that cannot flip to light."
      >
        {([
          ["A0", "live baseline · hardcoded hex, venue inside the display title", A0],
          ["A1", "masthead rule · no box, venue as a mono chip", A1],
          ["A2", "bracket rules · top and bottom hairlines", A2],
          ["A3", "spine only · the live spine without the box, glow or white wash", A3],
          ["A4", "registration slate · hairline frame, mode badge right", A4],
          ["A5", "numbered instrument · a Saira ordinal makes bands countable", A5],
          ["A6", "minimal change · live look, tokens, venue moved into the eyebrow", A6],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-4">
              <V {...ORIENT} />
              <V {...DO_BAND} />
              <V {...PROVE_IT} />
            </div>
          </Option>
        ))}

        <Round2 note="Fresh angles from outside the repo. A9 and A10 apply Degani's NASA flight-deck typography rules (reverse type is for exceptional short text; enlarge the initial letter when a word must be set in caps). A7 and A8 apply editorial running furniture, which matters because the SCHEMATIC card is 128 blocks long: a marker you pass once does not keep you oriented. A12 borrows the stage gate's own bracket-tag vocabulary." />

        {([
          ["A7", "thumb tab · mode pinned to the column edge, findable while scrolling", A7],
          ["A8", "running head · stage, band number, mode and venue on one line", A8],
          ["A9", "reversed plate · knocked-out type on a solid mode bar (NASA rec. 13/14)", A9],
          ["A10", "enlarged initial · Degani rec. 5, the initial doubles as the mode mark", A10],
          ["A11", "ledger head · a narrow mono column behind a rule, spec-sheet style", A11],
          ["A12", "gate tag · the bracket vocabulary the stage gate already uses", A12],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <V {...ORIENT} />
              <V {...DO_BAND} />
              <V {...PROVE_IT} />
            </div>
          </Option>
        ))}

        <Round2
          n={3}
          note="Converging on A9 (the reversed plate) and A12 (the gate tag). The A9 set asks how far the reverse should go before it stops being an exception and becomes the house style: A9d spends it on DO only, so reverse means 'hands on the keyboard' rather than 'this is a heading'. The A12 set asks what the rule between the tag and the edge should be doing."
        />

        {([
          ["A9a", "half plate · the bar shrinks to its content, reads as a tab", A9a],
          ["A9b", "title inside the plate · the case NASA actually sanctions, and the loudest", A9b],
          ["A9c", "plate to rule · solid tag fading to a hairline, tiny reverse moment", A9c],
          ["A9d", "reverse means hands on · plate for DO only, rules for orient and check", A9d],
          ["A12a", "one line · tag and title share the row, a mode change costs one line", A12a],
          ["A12b", "tag carries the ordinal · [ DO 02 ], bands countable with no extra column", A12b],
          ["A12c", "registration corners · brackets become real corner ticks", A12c],
          ["A12d", "dimension line · tag left, venue right, the rule measures between", A12d],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <V {...ORIENT} />
              <V {...DO_BAND} />
              <V {...PROVE_IT} />
            </div>
          </Option>
        ))}

        <Round2
          n={4}
          note="Converging on A12b. One question: what should the NUMBER do. A12b1 makes it an instrument value in the numeral face. A12b2 answers the question a learner three hours into SCHEMATIC actually has, which is not 'which band is this' but 'how much is left'. A12b3 puts it in the same left column the section headers already use, so bands and sections stop being two competing numbering systems. A12b4 spends the rule on it."
        />

        {([
          ["A12b1", "numeral outside the tag · the count becomes a Saira instrument value", A12b1],
          ["A12b2", "fraction · [ DO 02 / 06 ], how much of the stage is left", A12b2],
          ["A12b3", "number takes the left edge · one numbering column with the sections", A12b3],
          ["A12b4", "the rule measures progress · the hairline fills to the band's position", A12b4],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <V {...ORIENT} of={6} />
              <V {...DO_BAND} of={6} />
              <V {...PROVE_IT} of={6} />
            </div>
          </Option>
        ))}
      </Round>

      <Round
        id="B"
        locked="B9b · the Do step reveals its proof when you tick it."
        title="The Do ladder: big band vs small kicker"
        problem="24 big Do/mode bands and 27 small 'Draw it ·' kickers, with no rule for which appears when. REQUIREMENTS and BOM_SOURCING use the small Do with no band at all; DRC_GERBER runs a band every six blocks. The small Do also drops label segments: 'Draw it · do one with me · the USB differential pair' ships as just 'the USB differential pair'."
      >
        {([
          ["B0", "live baseline · gold kicker + fading rule", B0],
          ["B1", "gutter column · a Do is a visible column on the page", B1],
          ["B2", "numbered Do · Saira ordinal counts Dos inside the band", B2],
          ["B3", "one component, two weights · the band's language, one rung down", B3],
          ["B4", "tickable Do · steps as registration boxes, the Bench language", B4],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <A6 {...DO_BAND} />
              <F0 num="02" title="Decoupling & the module" body={SECTIONS[0].body} severity="info" />
              <V {...DO_STEP} n={2} />
            </div>
          </Option>
        ))}

        <Round2 note="Every option below is tickable, and the boxes really click. State is session-only here; if a tickable Do ships, decide persistence deliberately, since the stage gate already stores attestations and a Do-list probably should not double-store them. B7 borrows LEGO's parts-callout: name what the step consumes before the step starts." />

        <Option id="B5" note="gutter column + ticks">
          <B5 {...DO_STEP} />
        </Option>
        <Option id="B6" note="numbered ticks · ordinal and box together">
          <B6 {...DO_STEP} />
        </Option>
        <Option id="B7" note="callout strip · what this Do consumes, then ticks (the LEGO move)">
          <B7 {...DO_STEP} uses={DO_USES} />
        </Option>
        <Option id="B8" note="counted Do · Saira readout and a hairline that fills">
          <B8 {...DO_STEP} />
        </Option>
        <Option id="B9" note="tick + proof · each step says what you should see when it worked">
          <B9 {...DO_STEP} proofs={DO_PROOFS} />
        </Option>

        <Round2
          n={3}
          note="Converging on B9. The question these four separate: WHEN does the learner meet the evidence. B9a shows it alongside the step (read before doing), B9b only after ticking (confirm after doing), B9c makes confirming its own action, B9d names the contract once in column heads so every later Do inherits it. B9c is the one with a knock-on: if every step confirms itself, a separate Eyeball it at the end of the stage may stop earning its place."
        />

        <Option id="B9a" note="proof on the row · step and evidence on one line">
          <B9a {...DO_STEP} proofs={DO_PROOFS} />
        </Option>
        <Option id="B9b" note="proof on tick · evidence appears only after you claim the step">
          <B9b {...DO_STEP} proofs={DO_PROOFS} />
        </Option>
        <Option id="B9c" note="do then confirm · two boxes per step, verify becomes a habit">
          <B9c {...DO_STEP} proofs={DO_PROOFS} />
        </Option>
        <Option id="B9d" note="ledger with column heads · the contract stated once">
          <B9d {...DO_STEP} proofs={DO_PROOFS} />
        </Option>

        <Round2
          n={4}
          note="B9b crossed with D8c's triage. The Do step is where 'it didn't work' actually happens, so the uncertain path earns first-class treatment here more than anywhere else in the lesson. All four are clickable. The real difference is what a confident learner pays: BT2 charges them nothing, BT4 charges them a button press but turns their doubt into something the stage can act on."
        />

        <Option id="BT1" note="done or not sure · the direct port of D8c onto a Do step">
          <BT1 {...DO_STEP} proofs={DO_PROOFS} />
        </Option>
        <Option id="BT2" note="tick, key on request · nothing appears unless asked for">
          <BT2 {...DO_STEP} proofs={DO_PROOFS} />
        </Option>
        <Option id="BT3" note="two stage · tick shows the proof, 'didn't work' opens the fix">
          <BT3 {...DO_STEP} proofs={DO_PROOFS} fixes={DO_FIXES} />
        </Option>
        <Option id="BT4" note="flags that aggregate · doubt becomes something the stage acts on">
          <BT4 {...DO_STEP} proofs={DO_PROOFS} />
        </Option>
      </Round>

      <Round
        id="C"
        locked="C9a · shape-per-rung alert ladder (note / gotcha / warning)."
        title="Gotcha"
        problem="Four bare 'Gotcha' boxes exist, all in SCHEMATIC, all with no headline, so nothing scans. The same role appears six more times under a specific warn headline ('J1's tabs are the anchor, not decoration'). Two conventions, one job. Every option here takes a headline."
      >
        {([
          ["C0", "live baseline · bare label, warn box, nothing to scan", C0],
          ["C1", "named warn box · minimal change, headline in the label", C1],
          ["C2", "hazard spine · no box, headline set in the reading face", C2],
          ["C3", "tagged rule · square mono tag on a gold hairline", C3],
          ["C4", "consequence ledger · splits the trap from what it costs", C4],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <V {...GOTCHA} />
          </Option>
        ))}

        <Round2 note="Variations on C4's consequence ledger. Three of them add the rung the live Gotcha never states: what to do instead. C9 goes further and renders severity as the three-rung alert ladder technical manuals have used for decades (MIL-STD-38784 §4.8.10, NOTE / CAUTION / WARNING). That ladder is also the explanation for why a bare 'Gotcha' reads as weightless: it is the middle rung with nothing above or below it." />

        <Option id="C5" note="labelled halves · the trap and the cost each get a named rule">
          <C5 {...LEDGER} />
        </Option>
        <Option id="C6" note="three rungs · trap, costs, do this">
          <C6 {...LEDGER} />
        </Option>
        <Option id="C7" note="inline consequence · the cost rides the headline rule as a tag">
          <C7 {...LEDGER} />
        </Option>
        <Option id="C8" note="ledger rows · the table-tech language without a filled table">
          <C8 {...LEDGER} />
        </Option>
        <Option id="C9" note="alert ladder · all three rungs shown, MIL-STD-38784 §4.8.10">
          <div className="space-y-5">
            <C9
              {...LEDGER}
              rung="note"
              headline="the WROOM already carries its own decoupling"
              trap="The module has caps at the chip inside the package."
              cost="Your board caps are the bulk reservoir, not the chip's last line for fast current."
            />
            <C9 {...LEDGER} rung="caution" />
            <C9
              {...LEDGER}
              rung="warning"
              headline="a soldering iron never looks hot"
              trap="It sits at ~340 °C and gives no visual cue."
              cost="It burns instantly, so it goes back in its stand the moment it leaves your hand."
            />
          </div>
        </Option>

        <Round2
          n={3}
          note="Converging on C9. All four show the full ladder so the rungs are judged against each other, and all four add a distinct SHAPE per rung: severity currently lives in colour alone, which means a colour-blind learner reads a Note and a Warning as the same object. C9b is the honest test of whether the boxed top rung is needed once the word and the shape carry the weight."
        />

        {([
          ["C9a", "shape per rung · colour is no longer the only channel", C9a],
          ["C9b", "no box, even for warning · strictest reading of hairline-not-card", C9b],
          ["C9c", "ordered ladder · a Saira rung index makes the three explicitly ranked", C9c],
          ["C9d", "tag right · the headline leads, severity stamps the end of the rule", C9d],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-5">
              <V
                {...LEDGER}
                rung="note"
                headline="the WROOM already carries its own decoupling"
                trap="The module has caps at the chip inside the package."
                cost="Your board caps are the bulk reservoir, not the chip's last line for fast current."
              />
              <V {...LEDGER} rung="caution" />
              <V
                {...LEDGER}
                rung="warning"
                headline="a soldering iron never looks hot"
                trap="It sits at ~340 °C and gives no visual cue."
                cost="It burns instantly, so it goes back in its stand the moment it leaves your hand."
              />
            </div>
          </Option>
        ))}
      </Round>

      <Round
        id="D"
        locked="D8c3 · compact triage, verdicts at the right of each trace row."
        title="The verify family: Prove it, Eyeball it, Check yourself"
        problem="The lesson teaches three verbs and the UI honours two. 'Eyeball it' appears four times, always as a generic grey warn box, even though it is the verb the stage gate actually asks the learner to attest to. Its numbered trace targets are buried in a paragraph. Each option is shown under the Prove it band and above the real Check yourself component, so the whole verify ladder is judged at once."
      >
        {([
          ["D0", "live baseline · generic warn box, targets buried in prose", D0],
          ["D1", "green channel spine · joins the check colour instead of warn gold", D1],
          ["D2", "trace checklist · tickable targets with a count", D2],
          ["D3", "answer-key columns · numbered rows, hairline-divided", D3],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <A6 {...PROVE_IT} />
              <V {...EYEBALL} />
              <SelfCheckBlock body={SELF_CHECK} severity="info" />
            </div>
          </Option>
        ))}

        <Round2 note="Tickable verify. The argument for making this one tickable and not the Do: the stage gate asks the learner to attest to these exact three items three blocks later, so ticking here is a rehearsal of a thing that already exists. Each option still sits under the Prove it band and above the real Check yourself." />

        <Option id="D4" note="tick + proof column · an answer key inline, per target">
          <div className="space-y-6">
            <A6 {...PROVE_IT} />
            <D4 {...EYEBALL} proofs={TRACE_PROOFS} />
            <SelfCheckBlock body={SELF_CHECK} severity="info" />
          </div>
        </Option>
        <Option id="D5" note="counted trace · the same instrument as B8, green channel">
          <div className="space-y-6">
            <A6 {...PROVE_IT} />
            <D5 {...EYEBALL} />
            <SelfCheckBlock body={SELF_CHECK} severity="info" />
          </div>
        </Option>
        <Option id="D6" note="gate rehearsal · styled as the attestation it becomes">
          <div className="space-y-6">
            <A6 {...PROVE_IT} />
            <D6 {...EYEBALL} />
            <SelfCheckBlock body={SELF_CHECK} severity="info" />
          </div>
        </Option>
        <Option id="D7" note="tick rail · boxes on a continuous run, like the island rail">
          <div className="space-y-6">
            <A6 {...PROVE_IT} />
            <D7 {...EYEBALL} />
            <SelfCheckBlock body={SELF_CHECK} severity="info" />
          </div>
        </Option>
        <Option id="D8" note="tick to reveal · the why opens only after you trace it">
          <div className="space-y-6">
            <A6 {...PROVE_IT} />
            <D8 {...EYEBALL} whys={TRACE_WHYS} />
            <SelfCheckBlock body={SELF_CHECK} severity="info" />
          </div>
        </Option>

        <Round2
          n={3}
          note="Converging on D4 (answer key visible) and D8 (answer key earned). The split is a real teaching decision, not a layout one: D4 hands the learner what right looks like before they trace, D8 makes them commit first. SelfCheckBlock already bets on commit-first, so D8 is the consistent choice and D4 is the kinder one. D8c splits the difference by asking which one they are."
        />

        {([
          ["D4a", "key on the row · the same layout as B9a, one object in two colours", <D4a key="a" {...EYEBALL} proofs={TRACE_PROOFS} />],
          ["D4b", "key plus failure · what right looks like AND what wrong looks like", <D4b key="b" {...EYEBALL} proofs={TRACE_PROOFS} whys={TRACE_WHYS} />],
          ["D4c", "key first · the observation leads, the reasoning drops to context", <D4c key="c" {...EYEBALL} proofs={TRACE_PROOFS} />],
          ["D8a", "reveal the failure · ticking opens what breaks if this one is wrong", <D8a key="d" {...EYEBALL} whys={TRACE_WHYS} />],
          ["D8b", "reveal why and fix · a verify step that finds a fault gives a next move", <D8b key="e" {...EYEBALL} whys={TRACE_WHYS} proofs={TRACE_FIXES} />],
          ["D8c", "triage · looks right moves on, not sure opens the help", <D8c key="f" {...EYEBALL} proofs={TRACE_PROOFS} />],
        ] as const).map(([id, note, node]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <A6 {...PROVE_IT} />
              {node}
              <SelfCheckBlock body={SELF_CHECK} severity="info" />
            </div>
          </Option>
        ))}

        <Round2
          n={4}
          note="Converging on D8c. D8c2 argues that 'not sure' and 'found a problem' are different states wanting different answers: one wants the key, the other wants the fix, and collapsing them throws away a distinction the learner already made. D8c4 is the one that justifies building triage at all, because it tells the learner what their answers mean for the gate BEFORE they hit the upload."
        />

        {([
          ["D8c1", "triage with a tally · answered count, no re-reading to check", <D8c1 key="a" {...EYEBALL} proofs={TRACE_PROOFS} />],
          ["D8c2", "three verdicts · not sure wants the key, found a problem wants the fix", <D8c2 key="b" {...EYEBALL} proofs={TRACE_PROOFS} whys={TRACE_FIXES} />],
          ["D8c3", "compact · verdicts at the right of the row, checklist density", <D8c3 key="c" {...EYEBALL} proofs={TRACE_PROOFS} />],
          ["D8c4", "gate verdict · the footer speaks the gate's language", <D8c4 key="d" {...EYEBALL} proofs={TRACE_PROOFS} />],
        ] as const).map(([id, note, node]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              <A6 {...PROVE_IT} />
              {node}
              <SelfCheckBlock body={SELF_CHECK} severity="info" />
            </div>
          </Option>
        ))}
      </Round>

      <Round
        id="E"
        locked="E6d1 · glyph and verb in a break in the hairline."
        title="The aside family: Setup, Keys, Alternative, Route it"
        problem="An unspoken 'Verb ·' prefix convention, applied about half the time. 'KiCad 10 · PCB-editor keys' and 'The KiCad 10 keys you'll use' are the same thing written two ways. 'Route it ·' is a Do wearing an aside's clothes. All of them render as the same grey info box, at the same weight as the teaching spine."
      >
        {([
          ["E0", "live baseline · generic info box, verb is just text", E0],
          ["E1", "margin note · the verb gets its own column, visibly subordinate", E1],
          ["E2", "quiet rule · the lowest-authority signpost in the system", E2],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {ASIDES.map((a) => (
                <V key={a.verb} {...a} />
              ))}
            </div>
          </Option>
        ))}

        <Round2 note="Five more, spread across the authority range. E3 costs no vertical space at all; E7 leaves the reading column entirely. Worth deciding whether all four verbs deserve the same treatment: 'Keys' is lookup material, 'Setup' is a prerequisite, 'Alternative' is a branch, and 'Route it' is a Do wearing an aside's clothes and probably should not be in this family at all." />

        {([
          ["E3", "bracket tag · inline, zero vertical cost", E3],
          ["E4", "indent + connector · hangs off the spine like a footnote", E4],
          ["E5", "collapsed · reference material one click away, spine stays clean", E5],
          ["E6", "glyph verb · a thin-line mark per verb, same language as the mode icons", E6],
          ["E7", "true sidenote · leaves the reading column on wide screens", E7],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {ASIDES.map((a) => (
                <V key={a.verb} {...a} />
              ))}
            </div>
          </Option>
        ))}

        <Round2
          n={3}
          note="Converging on E6. E6b is the load-bearing test: it drops the verb word and lets the mark stand alone. If the three glyphs do not survive that, the glyph set is decoration and the word should stay. Judge these by covering the headline and asking what each mark means."
        />

        {([
          ["E6a", "boxed glyph · the mark in a square hairline, badge language", E6a],
          ["E6b", "glyph only · does the mark carry the verb without the word", E6b],
          ["E6c", "glyph in the margin column · E1's margin note with a mark above the verb", E6c],
          ["E6d", "glyph on a rule · the section-eyebrow grammar the lesson already uses", E6d],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {ASIDES.map((a) => (
                <V key={a.verb} {...a} />
              ))}
            </div>
          </Option>
        ))}

        <Round2
          n={4}
          note="Converging on E6d. The question underneath: does the hairline trail off, close the row, or break around the mark. E6d2 also fixes a type-law slip the earlier options share, where the headline was set in mono because it happened to sit on a mono row. E6d4 stamps the label at the END of the rule, which would match C9d and F4b and give the whole system one habit."
        />

        {([
          ["E6d1", "glyph in a break in the rule · the aside reads as a break in the spine", E6d1],
          ["E6d2", "rule is pure furniture · headline returns to the reading face", E6d2],
          ["E6d3", "rule underneath · closes the row, like the existing section eyebrow", E6d3],
          ["E6d4", "tag at the end · matches C9d and F4b, one habit across the system", E6d4],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {ASIDES.map((a) => (
                <V key={a.verb} {...a} />
              ))}
            </div>
          </Option>
        ))}
      </Round>

      <Round
        id="F"
        locked="F7c4 · sticky margin flag: rung shape, rung word, reason."
        title="Section headers that carry a severity"
        problem="LAYOUT sections 02 and 04 are authored 'warn' and ASSEMBLY 01 is authored 'critical', but SectionHeaderBlock never reads severity, so all three render identically to an ordinary section. The author's flag is written and thrown away. Each option shows info, warn and critical together."
      >
        {([
          ["F0", "live baseline · severity discarded, all three identical", F0],
          ["F1", "severity rule · the section's own hairline takes the colour", F1],
          ["F2", "severity tag · a square badge names why it is flagged", F2],
          ["F3", "flagged spine · the flag scopes the section, not the heading row", F3],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {SECTIONS.map((s, i) => (
                <V key={i} {...s} />
              ))}
            </div>
          </Option>
        ))}

        <Round2 note="Four more. F4 names the severity in the MIL-STD-38784 alert vocabulary; F6 borrows the engineering-drawing change bar and puts the mark outside the text column, so flagged sections are visible while scrolling past them; F7 is the only option where the flag teaches the learner something instead of just colouring at them." />

        {([
          ["F4", "alert-ladder word · Caution / Warning named above the head", F4],
          ["F5", "numeral carries it · Saira section number in the severity colour", F5],
          ["F6", "margin mark · a change-bar square outside the text column", F6],
          ["F7", "reason banner · the flag states why, in words", F7],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {SECTIONS.map((s, i) => (
                <V key={i} {...s} />
              ))}
            </div>
          </Option>
        ))}

        <Round2
          n={3}
          note="Converging on F4 (name the rung) and F7 (say why). Every option carries the rung SHAPE as well as the colour, for the same reason as C9 round 3. The two families answer different questions: F4 tells the learner how bad it is, F7 tells them what to do about it. They compose, so picking one from each is a legitimate outcome."
        />

        {([
          ["F4a", "word in the head row · no extra line", F4a],
          ["F4b", "word as a right-hand tag · the title keeps the left edge", F4b],
          ["F4c", "word plus a coloured top rule · two channels at once", F4c],
          ["F7a", "reason as a subhead · title first, then why it is flagged", F7a],
          ["F7b", "ladder word plus reason · names the rung and earns it", F7b],
          ["F7c", "reason in the margin · out of the reading column, beside the change bar", F7c],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {SECTIONS.map((s, i) => (
                <V key={i} {...s} />
              ))}
            </div>
          </Option>
        ))}

        <Round2
          n={4}
          note="Converging on F7c. All four reuse the LOCKED C9a rung shapes, so a margin flag and a Gotcha speak one language. F7c4 is the argument for the margin existing at all: a banner you have scrolled past has stopped warning you, and the ASSEMBLY safety section is one you are inside for ten minutes. Widen the window past 1024px or these all fall back to an indent."
        />

        {([
          ["F7c1", "rung word plus reason · the flag is complete without entering the column", F7c1],
          ["F7c2", "mark above the words · recognisable by shape at scroll speed", F7c2],
          ["F7c3", "the whole apparatus leaves · number, rung and reason all in the margin", F7c3],
          ["F7c4", "sticky · the flag pins while the section scrolls past it", F7c4],
        ] as const).map(([id, note, V]) => (
          <Option key={id} id={id} note={note}>
            <div className="space-y-6">
              {SECTIONS.map((s, i) => (
                <V key={i} {...s} />
              ))}
            </div>
          </Option>
        ))}
      </Round>

      <div className="mt-20 border-t border-panel-border/60 pt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Sandbox route · dev only · delete before the PR
        </p>
      </div>
    </main>
  );
}
