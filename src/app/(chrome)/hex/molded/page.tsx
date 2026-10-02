// /hex/molded: the molded line's interest page (hex-v2 next plan §1.1.5, owner
// R3-3: the ONLY surface these designs have).
//
// What is shown here is a CONCEPT: a design for an injection-molded part on
// the Hex Cluster lattice that nobody can buy or print yet. The page exists so
// the owner can learn which one people want made first, before a tool is cut.
// Every model comes through one gate: hex-cluster's export_concept_meshes.py
// writes the manifest only after check_dfm.py is clean (draft, undercuts, wall
// band), and hex-concepts.test.ts pins this copy to the glTF it renders.
//
// Public (admin-routes `isPublicPath`): the configurator's build sheet prints
// this URL as text, and the reader may have no account. Exactly this path;
// children stay gated. The tap counter and the waitlist form land with plan
// §5.4; until then the honest action is the support address, below.
import type { Metadata } from "next";

import ModelViewer from "@/components/ModelViewer";
import { MoldedWaitlist, WantButton } from "@/components/hex/MoldedInterest";
import { hexPartWaitlistOpen } from "@/lib/actions/hex-part-interest";
import {
  HEX_CONCEPTS,
  HEX_CONCEPT_UNIT_SCALE,
  hexConceptBounds,
} from "@/lib/hex-concepts";
import { HEX_V2_PITCH_MM, HEX_V2_SUPPORT_EMAIL } from "@/lib/hex-v2-page";

export const metadata: Metadata = {
  title: "Hex Cluster molded parts: designs under consideration",
  description:
    "Injection-molded parts for the Hex Cluster lattice, shown as designs before any tool is cut. Nothing here is for sale or printable yet; tell us which to make first.",
  alternates: { canonical: "/hex/molded" },
};

const mm = (n: number, dp = 1) => `${n.toFixed(dp)} mm`;
const LINK =
  "text-command-gold underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
      ▸ {children}
    </h2>
  );
}

type Row = { label: string; value: string; aside?: string };

function SpecRows({ rows }: { rows: Row[] }) {
  return (
    <dl className="max-w-xl space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline gap-2">
          <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {r.label}
          </dt>
          <span
            aria-hidden="true"
            className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-panel-border"
          />
          <dd className="whitespace-nowrap">
            <span className="font-numeral text-lg tabular-nums tracking-wide text-title">
              {r.value}
            </span>
            {r.aside ? (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {r.aside}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function HexMoldedPage() {
  const open = await hexPartWaitlistOpen();
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        &#9656; Designs under consideration
      </p>
      <h1 className="title-hero mt-3">
        Molded <span className="accent">parts</span>
        <span className="tdot">.</span>
      </h1>
      <p className="mt-4 max-w-xl font-serif text-[15px] leading-relaxed text-text">
        Larger pieces for the Hex Cluster lattice, designed for injection
        molding rather than a printer: the wall is one thickness throughout,
        every face carries draft, and nothing here can be printed at home. None
        of them exists yet as a part you can buy. They are shown so you can tell
        us which one to have made first.
      </p>
      <p className="mt-3 max-w-xl font-serif text-sm leading-relaxed text-muted">
        Each design sits on the same {`${HEX_V2_PITCH_MM.toFixed(3)} mm `}pitch
        as the printed cells. Sizes are the CAD&rsquo;s; a molded part shrinks
        by an amount the tool is cut to allow for.
      </p>

      {HEX_CONCEPTS.map((c) => {
        const rows: Row[] = [
          { label: "Across flats", value: mm(c.bboxMm.y) },
          { label: "Corner to corner", value: mm(c.bboxMm.x) },
          { label: "Height", value: mm(c.bboxMm.z, 0) },
          {
            label: "Material",
            value: `${(c.volumeMm3 / 1000).toFixed(0)} cm³`,
            aside: "solid volume",
          },
        ];
        return (
          <section
            key={c.stem}
            id={c.stem}
            className="mt-12 scroll-mt-24 border-t border-panel-border/60 pt-6 target:border-command-gold/60"
          >
            <Heading>{c.name}</Heading>
            <p className="mt-3 max-w-xl font-serif text-base leading-relaxed text-text">
              {c.use}
            </p>
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
              <div className="border border-panel-border/60">
                <ModelViewer
                  src={c.modelSrc}
                  bounds={hexConceptBounds(c)}
                  unitScale={HEX_CONCEPT_UNIT_SCALE}
                  heightClass="h-80 sm:h-96"
                  label={`${c.name}, 3D model`}
                />
              </div>
              <div>
                <SpecRows rows={rows} />
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Concept. Not for sale, not printable.
                </p>
                <div className="mt-4">
                  <WantButton stem={c.stem} name={c.name} />
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <section
        id="interest"
        className="mt-12 scroll-mt-24 border-t border-panel-border/60 pt-6"
      >
        <Heading>Want one made</Heading>
        <MoldedWaitlist
          concepts={HEX_CONCEPTS.map((c) => ({ stem: c.stem, name: c.name }))}
          open={open}
          supportEmail={HEX_V2_SUPPORT_EMAIL}
        />
        <p className="mt-3 max-w-xl font-serif text-sm leading-relaxed text-muted">
          The printed cells, covers and accessories are a separate, finished
          release:{" "}
          <a href="/hex" className={LINK}>
            /hex
          </a>
          .
        </p>
      </section>
    </main>
  );
}
