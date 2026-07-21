// SANDBOX ONLY — dev-guarded, DELETED before the PR (sandbox-round convention,
// otd-frontend-design).
//
// Why this round exists: the signpost system reformed six teaching roles and
// left the GENERIC callout alone. 25 blocks across L1.01 still fall through to
// it, every one of them `info`, so the lesson carries 25 identical blue-tinted
// tiles. Two problems, both house-rule violations rather than taste:
//
//   1. It is a filled, tinted, full-border box. The design law says a content
//      surface groups with hairlines on the deep-space field, never a card.
//   2. Being `info` on all 25, signal-blue ends up the most-repeated accent in
//      the lesson, when blue is supposed to stay secondary to gold.
//
// And the 25 are doing TWO different jobs under one treatment: 17 teaching
// asides, and 8 "Exit this stage" closers. Round H exists because the end of a
// 128-block card should not look like a mid-card footnote.
//
// Every specimen uses REAL L1.01 copy. Toggle the theme top-right: an option
// whose colour fails to flip is a theming-law bug, which is the point.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  G0, G1, G2, G3, G4, G5, G6,
  H0, H1, H2, H3, H4,
  type AsideProps,
  type ExitProps,
} from "./specimens";
import {
  G5a, G5b, G5c, G5d, G5e,
  H4a, H4b, H4c, H4d, H4e,
} from "./specimens2";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// ── real L1.01 copy ─────────────────────────────────────────────────────────

// The block in the owner's screenshot. Longest-ish, and a statement not a question.
const PROVIDED: AsideProps = {
  label: "Everything's provided: you don't source or draw a thing",
  body:
    "You won't hunt for a part or draw a single symbol. The [[KiCad starter]] you download at the schematic stage ships with every part's symbol, footprint, and 3D model already placed, and the [[exact BOM]], manufacturer part numbers and all, is specified for you. Later, if you'd rather not risk your own layout, you can even order from the verified reference files. You bring the bench (below); we bring the parts library.",
};

// A question, and the one that most wants a Q-and-A treatment.
const LEADFREE: AsideProps = {
  label: "Lead-free or leaded?",
  body:
    "Either works on this board. We recommend **lead-free** ([[SAC305]]) for two honest reasons: no lead to handle or dispose of, and it's the real commercial process. Your joints behave like production. The catch: lead-free melts ~35 °C hotter and its joints look duller, so **leaded (63/37) is more forgiving for a first board**. If you go leaded, don't eat at the bench and wash your hands.",
};

// The SHORTEST in the corpus (95 characters). A treatment with heavy furniture
// will look absurd wrapped around one sentence, which is why it is here.
const WIREBYNAME: AsideProps = {
  label: "Wire by name, not a maze",
  body: "Connect with names, not a maze of lines. Two wires with the same label are the same connection.",
};

// The LONGEST (829 characters). The opposite stress test.
const POWERSYM: AsideProps = {
  label: "Power symbol or net label?",
  body:
    "A power symbol (press **P**) is for a rail, a power/ground net lots of parts tap: VBUS, +5V, +3V3, GND. A net label (press **L**) is for a signal between a few pins: USB_D+, a reset line. The test: is it a rail many things share, or a signal between a few pins? Rail → power symbol; signal → net label. One mechanical difference: a power symbol drops straight onto the pin, but a net label rides a **wire**. So for a signal like **EN**, **IO0**, or **IO2**, draw a short wire off the pin first, then press **L** and drop the label on that wire.",
};

const EXIT_SCHEMATIC: ExitProps = {
  ord: 3,
  of: 8,
  next: "Layout",
  body:
    "You've now read every part on the board and why it's there, captured it as a schematic, and run ERC until it's clean. Attach the ERC report (the gate below tracks it). Carry one thing forward: U1 has a PCB antenna, so when you reach LAYOUT the keep-out underneath it is a hard constraint, not a suggestion.",
};

// ── page furniture ──────────────────────────────────────────────────────────

function Round({
  id,
  title,
  problem,
  children,
}: {
  id: string;
  title: string;
  problem: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`round-${id.toLowerCase()}`} className="mt-16 scroll-mt-6">
      <div className="title-rule" aria-hidden />
      <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
        ▸ Round {id}
      </p>
      <h2 className="title-section mt-1">{title}</h2>
      <p className="mt-2 max-w-2xl font-serif text-[15px] leading-relaxed text-muted">{problem}</p>
      <div className="mt-8 space-y-14">{children}</div>
    </section>
  );
}

function Option({ id, note, children }: { id: string; note: string; children: React.ReactNode }) {
  return (
    <div>
      {/* Option ID ABOVE the frame, never a badge inside it. */}
      <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em]">
        <span className="font-bold text-command-gold">{id}</span>
        <span className="text-muted">{note}</span>
      </p>
      {children}
    </div>
  );
}

/** The same option shown against every length in the corpus, since a treatment
 *  that works at 300 characters can fall apart at 95 or 829. */
function Lengths({ Comp }: { Comp: (p: AsideProps) => React.ReactNode }) {
  return (
    <div className="mt-4 space-y-6 border-l border-dashed border-panel-border/50 pl-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
        shortest in the corpus · 95 characters
      </p>
      <Comp {...WIREBYNAME} />
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
        longest · 829 characters
      </p>
      <Comp {...POWERSYM} />
    </div>
  );
}

export default function AsideSandboxPage() {
  // Dev-only: this route never exists in a production build.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Sandbox"
          title="The last two callouts"
          lead="25 blocks in L1.01 still render as the generic tinted tile. They are doing two different jobs. Pick one treatment per round."
        />
        <div className="shrink-0 pt-2">
          <ThemeToggle />
        </div>
      </div>

      <Round
        id="G"
        title="The teaching aside"
        problem="17 blocks: explainers, conventions and questions that sit beside the build without being part of it. They must read as OPTIONAL context, so the treatment has to carry less weight than the Do spine and the alert ladder, while still being findable. Bodies run from 95 to 829 characters, so every option is shown against both extremes."
      >
        <Option id="G0" note="LIVE BASELINE · tinted filled tile, blue on all 25">
          <G0 {...PROVIDED} />
          <Lengths Comp={G0} />
        </Option>
        <Option id="G1" note="bracket rules · top and bottom hairline, no side walls">
          <G1 {...PROVIDED} />
          <Lengths Comp={G1} />
        </Option>
        <Option id="G2" note="gold left-accent spine · same vocabulary as the Do block">
          <G2 {...PROVIDED} />
          <Lengths Comp={G2} />
        </Option>
        <Option id="G3" note="margin note · label leaves the column entirely (needs 1232px+)">
          <G3 {...PROVIDED} />
          <Lengths Comp={G3} />
        </Option>
        <Option id="G4" note="label in a break in the hairline · reads as a seam, not an object">
          <G4 {...PROVIDED} />
          <Lengths Comp={G4} />
        </Option>
        <Option id="G5" note="display-face question · Bebas asks, Lora answers">
          <G5 {...LEADFREE} />
          <Lengths Comp={G5} />
        </Option>
        <Option id="G6" note="quiet indent · no rule at all, maximum recession">
          <G6 {...PROVIDED} />
          <Lengths Comp={G6} />
        </Option>
      </Round>

      <Round
        id="H"
        title="Exit this stage"
        problem="8 blocks, one per stage: the closing handoff that says what you achieved, what the gate wants, and what carries into the next stage. Today it is the same blue tile as a mid-card footnote, so the end of a 128-block card is invisible. This one should feel like a document closing."
      >
        <Option id="H0" note="LIVE BASELINE · identical to every other aside">
          <H0 {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H1" note="gold masthead rule · a document close">
          <H1 {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H2" note="stage readout · Saira numerals, the card's numeral moment">
          <H2 {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H3" note="bracket close · rules above and below, plus the next stage">
          <H3 {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H4" note="display-face sign-off · bookends the card's opening voice">
          <H4 {...EXIT_SCHEMATIC} />
        </Option>
      </Round>

      <Round
        id="G5 · round 2"
        title="Variations on the display-face question"
        problem="Subtle gradient, drawn the way the house already draws it: on a RULE or as a wash that dies, never as an accent colour or a filled panel. The two existing recipes are the licence here, `.title-rule` (a hairline whose gold burns out across the left 60%, opening every page) and `.section-band` (a 90deg gold wash, 10% to 2% to transparent). Each option below is one idea about WHERE the fade goes."
      >
        <Option id="G5" note="round-1 original, for comparison · flat rule, no gradient">
          <G5 {...LEADFREE} />
        </Option>
        <Option id="G5a" note="title-rule idiom · full-width hairline, gold burns out to the right">
          <G5a {...LEADFREE} />
          <Lengths Comp={G5a} />
        </Option>
        <Option id="G5b" note="the spine falls away · vertical fade, gold at the top, gone by the end">
          <G5b {...LEADFREE} />
          <Lengths Comp={G5b} />
        </Option>
        <Option id="G5c" note="underline hugs the words · rule sized to the question, not the column">
          <G5c {...LEADFREE} />
          <Lengths Comp={G5c} />
        </Option>
        <Option id="G5d" note="section-band wash on the question line only · the riskiest, closest to a fill">
          <G5d {...LEADFREE} />
          <Lengths Comp={G5d} />
        </Option>
        <Option id="G5e" note="a seam · the rule fades out at BOTH ends, so nothing has a hard edge">
          <G5e {...LEADFREE} />
          <Lengths Comp={G5e} />
        </Option>
      </Round>

      <Round
        id="H4 · round 2"
        title="Variations on the display-face sign-off"
        problem="Same gradient discipline. The question each one answers: how does a 128-block card END? A rule that dissolves says 'this thread is finished' in a way a flat rule cannot, because a flat rule looks like every other divider in the card."
      >
        <Option id="H4" note="round-1 original, for comparison · flat rule">
          <H4 {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H4a" note="the flanking rule dissolves · card ends by fading, not stopping">
          <H4a {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H4b" note="reuses the REAL .title-rule class · closes with the divider every page opens with">
          <H4b {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H4c" note="dissolving rule + the Saira stage numerals · adds the numeral moment">
          <H4c {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H4d" note="a bracket that closes · rule above fades right, rule below fades left">
          <H4d {...EXIT_SCHEMATIC} />
        </Option>
        <Option id="H4e" note="vertical wash · the last inches darken back into the field">
          <H4e {...EXIT_SCHEMATIC} />
        </Option>
      </Round>

      <p className="mt-16 border-t border-panel-border/60 pt-4 font-serif text-[15px] leading-relaxed text-muted">
        Pick one per round, or ask for variations on any option and I will run a
        third round. Nothing here ships until you choose.
      </p>
    </main>
  );
}
