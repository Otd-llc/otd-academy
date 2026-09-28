// `/hex`: the Hex Cluster v2 standard, its print profile, its downloads, and
// the licence and attribution target.
//
// THIS URL IS NOT A CHOICE. Every published mesh carries a LICENSE.txt that
// names https://academy.onethousanddrones.com/hex as its source, so this page
// is where CC BY attribution lands. `isPublicPath` opens it
// (src/lib/admin-routes.ts) and a routing test pins that open: verify SIGNED
// OUT, never only signed in.
//
// DRAFT FOR OWNER REVIEW (launch item 6.4). Every sentence the owner must
// approve or write carries an `OWNER-REVIEW` comment directly above it. The
// licence lines come from `HEX_LICENSE`; every v2 number comes from
// `@/lib/hex-v2-page`, which cites the file and line each one was read from.
//
// Layout keeps the approved sandbox's grammar: the house triangle eyebrow for
// section heads (H1), leader-dot spec rows (R3), the pitch as a dimensioned
// measurement (P4), the identity strip stacked (I3), download rows led by an
// arrow with their size (F4) and the credit line ruled above and below (C2).
//
// Static: no DB read, no request-time API, so it prerenders whole.
import type { Metadata } from "next";

import { ConfiguratorLink } from "@/components/hex/ConfiguratorLink";
import { HexConfiguratorFrame } from "@/components/hex/HexConfiguratorFrame";
import { HexStill } from "@/components/hex/HexStill";
import { env } from "@/env";
import { HEX_LICENSE } from "@/lib/hex-license";
import { HEX_SAFETY_LINES } from "@/lib/hex-readme-safety";
import { HEX_CONFIGURATOR_URL } from "@/lib/hex-spec";
import {
  HEX_V2_APOTHEM_MM,
  HEX_V2_BED_MIN_MM,
  HEX_V2_FEMALE_BEARINGS,
  HEX_V2_FIRST_BUILD,
  HEX_V2_JIGS,
  HEX_V2_JOINT_DEPTH_MM,
  HEX_V2_LARGEST_PART_MM,
  HEX_V2_MAIN_BBOX_MM,
  HEX_V2_MALE_BEARINGS,
  HEX_V2_PITCH_MM,
  HEX_V2_PRINT_PROFILE,
  HEX_V2_REFERENCE_PRINTS,
  HEX_V2_RELEASE,
  HEX_V2_SET,
  HEX_V2_SLICERS,
  HEX_V2_SPOOL_GRAMS,
  HEX_V2_SUPPORT_EMAIL,
  HEX_V2_SUPPORT_REPLY_HOURS,
  HEX_V2_TOL_MM,
  firstBuildTotals,
  hoursMinutes,
  printableProxyPath,
  type SpecRow,
} from "@/lib/hex-v2-page";

export const metadata: Metadata = {
  // The long keyworded string lives here, not in the visible H1.
  title:
    "Hex Cluster: a printable bench mounting standard, print profile and CC BY license",
  description:
    "Hex Cluster v2: six-edge dovetail bases on a 165.705 mm pitch, printed in PETG on a 220 × 220 mm bed. Print profile, downloads and CC BY 4.0 attribution from One Thousand Drones.",
  alternates: { canonical: "/hex" },
};

const PITCH = `${HEX_V2_PITCH_MM.toFixed(3)} mm`;
const mm = (n: number, dp = 2) => `${n.toFixed(dp)} mm`;
const LINK =
  "text-command-gold underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light";

/** H1: the house triangle eyebrow. */
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
      ▸ {children}
    </h2>
  );
}

function Section({
  title,
  children,
  className = "mt-12",
  id,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Set only on sections something else links to. `scroll-mt` keeps the
   *  heading clear of the sticky header once jumped to. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`${className} scroll-mt-24 border-t border-panel-border/60 pt-6`}
    >
      <Heading>{title}</Heading>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** R3: leader dots carry the eye from label to value. */
function SpecRows({ rows }: { rows: SpecRow[] }) {
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

/** A visible hole in the draft. Rendered on purpose so it cannot be missed in
 *  review; every one must be filled or removed before the page goes public. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-xl border border-dashed border-command-gold/60 px-4 py-3 font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-command-gold">
      {children}
    </p>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-xl space-y-4 font-serif text-base leading-relaxed text-text">
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-xl font-serif text-sm leading-relaxed text-muted">
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.85em] text-title">{children}</code>;
}

const bearings = (list: readonly number[]) => list.join(" / ");

export default function HexPage() {
  const first = firstBuildTotals();

  const files = [
    {
      href: printableProxyPath(HEX_V2_RELEASE, `sets/${HEX_V2_SET.name}.zip`),
      name: `${HEX_V2_SET.name}.zip`,
      format: "ZIP",
      size: HEX_V2_SET.sizeLabel,
      // OWNER-REVIEW
      desc: "Every part as 3MF. STL and STEP come per part.",
    },
    {
      href: printableProxyPath(HEX_V2_RELEASE, "LICENSE.txt"),
      name: "LICENSE.txt",
      format: "TXT",
      // TODO(publish): the byte count of the published v2 LICENSE.txt.
      size: "TODO",
      desc: "The notice that travels inside every file",
    },
  ];

  const geometry: SpecRow[] = [
    { label: "Cell pitch", value: PITCH, aside: "centre to centre" },
    // OWNER-REVIEW: which extent is "footprint width" (1.21). Drafted as the
    // flat-to-flat extent of hex-main, 169.21; the long, corner-to-corner
    // extent is the next row.
    { label: "Footprint width", value: mm(HEX_V2_MAIN_BBOX_MM.y) },
    { label: "Corner to corner", value: mm(HEX_V2_MAIN_BBOX_MM.x) },
    { label: "Base height", value: mm(HEX_V2_MAIN_BBOX_MM.z, 0) },
    { label: "Joint clearance", value: mm(HEX_V2_TOL_MM) },
  ];

  return (
    // The frame HOSTS the page: every `ConfiguratorLink` below reads its
    // context, and the frame portals to <body>, so wrapping costs no element.
    <HexConfiguratorFrame enabled={env.NEXT_PUBLIC_HEX_EMBED !== "off"}>
      {/* ── hero: a static still, so reduced motion shows the same picture ── */}
      <section className="relative mx-auto max-w-[100rem] px-4 sm:px-6">
        <div className="relative overflow-hidden border border-panel-border/60">
          <HexStill className="h-[58vh] min-h-[380px] w-full object-cover" />

          {/* Bottom-up scrim: legibility only. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-deep-space via-deep-space/45 to-transparent"
          />

          <div className="absolute inset-0 flex items-end">
            <div className="w-full p-6 sm:p-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                &#9656; Open hardware release
              </p>
              <h1 className="title-hero mt-3">
                Hex <span className="accent">cluster</span>
                <span className="tdot">.</span>
              </h1>
              {/* OWNER-REVIEW */}
              <p className="mt-4 max-w-xl font-serif text-[15px] leading-relaxed text-text">
                A bench mounting standard you print yourself, {HEX_LICENSE.name}.
              </p>
              <p className="mt-7">
                <ConfiguratorLink
                  href={HEX_CONFIGURATOR_URL}
                  placement="hero"
                  className="glass-button glass-button-cta inline-flex items-center px-8 py-4 font-mono text-sm uppercase tracking-[0.16em]"
                >
                  Open the configurator
                </ConfiguratorLink>
              </p>
            </div>
          </div>
        </div>

        {/* Downloads and licence, immediately under the hero. */}
        <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          <div>
            <ul className="border-t border-panel-border/60">
              {files.map((f) => (
                <li key={f.name}>
                  <a
                    href={f.href}
                    download
                    className="group flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-panel-border/60 py-4 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="font-mono text-base leading-none text-command-gold transition-transform group-hover:translate-y-0.5"
                    >
                      &darr;
                    </span>
                    <span className="badge border-command-gold/50 text-command-gold">
                      {f.format}
                    </span>
                    <span className="font-mono text-sm text-title group-hover:text-gold-light">
                      {f.name}
                    </span>
                    <span className="font-numeral text-lg tabular-nums text-text">
                      {f.size}
                    </span>
                    <span className="w-full font-serif text-xs text-muted sm:ml-auto sm:w-auto sm:text-right">
                      {f.desc}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {/* OWNER-REVIEW */}
            <p className="mt-4 font-serif text-xs leading-relaxed text-muted">
              No account, no email. Release {HEX_V2_RELEASE}. A release is never
              overwritten, so a link you save today keeps giving you the same
              files.
            </p>
            {!HEX_V2_SET.sizeMeasured ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold">
                TODO(publish): set size is an estimate until the object is
                published
              </p>
            ) : null}
          </div>

          <div>
            <Heading>Licence</Heading>
            <p className="mt-4 font-serif text-base leading-relaxed text-text">
              {HEX_LICENSE.name}. Use it commercially, remix it, sell what you
              print. Just credit us,{" "}
              <a href="#attribution" className={LINK}>
                like this
              </a>
              .
            </p>
            <p className="mt-4 border-y border-command-gold/40 py-3 font-mono text-[11px] leading-relaxed text-title">
              {HEX_LICENSE.credit}
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-[420px_1fr]">
          {/* The rule lives on this OUTER grid item, which stretches to the row
              height, so it runs the whole page. */}
          <div className="lg:border-r lg:border-command-gold/40 lg:pr-12">
            <div className="py-10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center">
              {/* P4: a dimension line, so the number annotates a measurement. */}
              <div>
                <div className="flex items-center gap-2" aria-hidden="true">
                  <span className="h-3 w-px bg-command-gold/70" />
                  <span className="h-px flex-1 bg-command-gold/70" />
                  <span className="h-3 w-px bg-command-gold/70" />
                </div>
                <p className="mt-3 text-center font-numeral text-5xl tabular-nums tracking-wide text-command-gold">
                  {PITCH}
                </p>
                <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  cell pitch, centre to centre
                </p>
              </div>

              {/* I3: stacked, so a reader arriving from a LICENSE.txt sees the
                  licence and the release without scrolling. */}
              <dl className="mt-9 border-t border-panel-border/60 font-mono text-[10px] uppercase tracking-[0.18em]">
                {[
                  { label: "License", value: HEX_LICENSE.name },
                  { label: "Release", value: HEX_V2_RELEASE },
                  { label: "Material", value: "PETG" },
                  {
                    label: "Bed",
                    value: `≥ ${HEX_V2_BED_MIN_MM} × ${HEX_V2_BED_MIN_MM} mm`,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="flex justify-between border-b border-panel-border/60 py-2"
                  >
                    <dt className="text-command-gold">{m.label}</dt>
                    <dd className="text-title">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="py-10 lg:pl-12">
            <div className="title-rule" aria-hidden="true" />
            {/* OWNER-REVIEW */}
            <p className="mt-6 max-w-xl font-serif text-base leading-relaxed text-text">
              Every base carries a dovetail on all six edges, so a layout of any
              size locks together and moves as one piece.
            </p>

            <Section title="What it is">
              <Prose>
                {/* OWNER-REVIEW */}
                <p>
                  Hex Cluster is a mounting standard for the bench. The unit is
                  a hexagonal base, {mm(HEX_V2_MAIN_BBOX_MM.z, 0)} tall, that
                  locks to its neighbours on all six edges. Covers, caps, mounts
                  and accessories fix to that grid, and the grid carries the
                  load between them.
                </p>
                {/* OWNER-REVIEW */}
                <p>
                  You print every part on your own machine. Plan a layout in the
                  configurator, download the plates, and add to it one cell at a
                  time.
                </p>
              </Prose>
            </Section>

            <Section title="Start small">
              <Prose>
                {/* OWNER-REVIEW: the proposed first build. */}
                <p>
                  Print the tolerance ladder and the dovetail gauge first (they
                  are below, under{" "}
                  <a href="#jigs" className={LINK}>
                    print these first
                  </a>
                  ). Then print two <Code>hex-main</Code> bases and slide one
                  onto the other along a single joint. That joint is the whole
                  system at its smallest: pull on it, check the fit, and build
                  out from there.
                </p>
              </Prose>
              <div className="mt-6 grid max-w-xl grid-cols-3 border-t border-panel-border/60">
                {[
                  { label: "print time", value: hoursMinutes(first.minutes) },
                  { label: "filament", value: `${Math.round(first.grams)} g` },
                  {
                    label: `${HEX_V2_SPOOL_GRAMS / 1000} kg spools`,
                    value: first.spools.toFixed(2),
                  },
                ].map((s) => (
                  <div key={s.label} className="border-b border-panel-border/60 py-4">
                    <p className="font-numeral text-3xl tabular-nums tracking-wide text-title">
                      {s.value}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              <Note>
                {HEX_V2_FIRST_BUILD.map((b) => `${b.count} × ${b.part}`).join(
                  ", ",
                )}
                . K2 Plus reference, supports excluded, slower printers up to
                ~4×.
              </Note>
            </Section>

            <Section title="Geometry">
              <SpecRows rows={geometry} />
              {/* OWNER-REVIEW */}
              <Note>
                The pitch follows from the base. Two neighbours each reach{" "}
                {HEX_V2_APOTHEM_MM.toFixed(3)} mm from their centre to the
                shared edge, and their dovetails overlap by twice the{" "}
                {mm(HEX_V2_JOINT_DEPTH_MM, 0)} joint depth less twice the{" "}
                {mm(HEX_V2_TOL_MM)} clearance, which leaves {PITCH}. Design to
                the pitch if you are adapting the standard.
              </Note>
            </Section>

            <Section title="Dovetails">
              <SpecRows
                rows={[
                  {
                    label: "Male edges",
                    value: `${bearings(HEX_V2_MALE_BEARINGS)}°`,
                    aside: "NE, NW, S",
                  },
                  {
                    label: "Female edges",
                    value: `${bearings(HEX_V2_FEMALE_BEARINGS)}°`,
                    aside: "N, SW, SE",
                  },
                ]}
              />
              {/* OWNER-REVIEW */}
              <Note>
                Bearings are measured counter-clockwise from east. Male and
                female alternate around the hexagon, and every edge sits
                opposite one of the other gender, so any base meets any
                neighbour male to female. One base design tiles in every
                direction.
              </Note>
            </Section>

            <Section title="Halves and quarters">
              <Prose>
                {/* OWNER-REVIEW */}
                <p>
                  A cell holds one <Code>hex-main</Code>, two halves, four
                  quarters, or any mix that covers the cell&rsquo;s four
                  quadrants once. The halves are <Code>hex-half-n</Code>,{" "}
                  <Code>-s</Code>, <Code>-e</Code> and <Code>-w</Code>; the
                  quarters are <Code>hex-quarter-nw</Code>, <Code>-ne</Code>,{" "}
                  <Code>-sw</Code> and <Code>-se</Code>. Use them to end a
                  layout on a straight edge.
                </p>
                {/* OWNER-REVIEW */}
                <p>
                  All four quarters differ. The dovetail pattern repeats three
                  times around the hexagon and the quarter cut four times, so no
                  quarter is a turned copy of another, and each has its own
                  file.
                </p>
              </Prose>
            </Section>

            <Section title="Caps">
              <Prose>
                {/* OWNER-REVIEW */}
                <p>
                  A cap closes a dovetail with no neighbour on it, so an outside
                  edge shows a finished face. <Code>edge</Code> caps cover one
                  flat of a full base. <Code>cut-ns</Code> and{" "}
                  <Code>cut-ew</Code> each cover the long cut side of a half:{" "}
                  <Code>cut-ns</Code> for an east or west half,{" "}
                  <Code>cut-ew</Code> for a north or south one.
                </p>
                {/* OWNER-REVIEW */}
                <p>
                  Each comes <Code>solid</Code>, or <Code>1h</Code> with the
                  base&rsquo;s side hole carried through it. The last letter is
                  the face the cap presents: a cap on a male edge is an{" "}
                  <Code>-f</Code>, and on a female edge an <Code>-m</Code>.
                </p>
              </Prose>
            </Section>

            <Section title="Print profile">
              <SpecRows rows={HEX_V2_PRINT_PROFILE} />
              {/* OWNER-REVIEW */}
              <Note>
                The largest part, a half base, is{" "}
                {HEX_V2_LARGEST_PART_MM.x.toFixed(2)} ×{" "}
                {HEX_V2_LARGEST_PART_MM.y.toFixed(2)} mm, and every part prints
                one to a plate. It needs a bed of at least {HEX_V2_BED_MIN_MM} ×{" "}
                {HEX_V2_BED_MIN_MM} mm; a 180 mm bed such as the Prusa Mini will
                not take it.
              </Note>

              <h3 className="mt-9 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                ▸ Slicers
              </h3>
              {/* OWNER-REVIEW */}
              <Note>
                The 3MF files open in {HEX_V2_SLICERS.slice(0, -1).join(", ")}{" "}
                and {HEX_V2_SLICERS[HEX_V2_SLICERS.length - 1]}. Cura has no
                per-object brim: its brim setting applies to the whole plate.
              </Note>

              <h3 className="mt-9 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                ▸ Time and filament, per part
              </h3>
              <dl className="mt-4 max-w-xl space-y-3">
                {HEX_V2_REFERENCE_PRINTS.map((p) => (
                  <div key={p.part} className="flex items-baseline gap-2">
                    <dt className="font-mono text-[11px] tracking-[0.06em] text-muted">
                      {p.part}
                    </dt>
                    <span
                      aria-hidden="true"
                      className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-panel-border"
                    />
                    <dd className="whitespace-nowrap font-numeral text-lg tabular-nums tracking-wide text-title">
                      {hoursMinutes(p.minutes)}
                      <span className="ml-3 text-text">
                        {Math.round(p.grams)} g
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              {/* The caveat is the text item 6.4 fixes; keep it verbatim. */}
              <Note>
                K2 Plus reference, supports excluded, slower printers up to ~4×.
                Grams are PETG at 1.27 g/cm³ and vary by about 3% between
                brands.
              </Note>
            </Section>

            <Section title="Pipe">
              <p className="max-w-xl font-serif text-base leading-relaxed text-text">
                3/4 in Sch 40, OD 26.67 mm (US). Metric 25/32 mm pipe does not
                fit.
              </p>
            </Section>

            <Section title="Tools">
              {/* OWNER-REVIEW: the whole list is a draft. Fastener and magnet
                  sizes are from hex-cluster docs/naming-v2.md; confirm what a
                  first build actually needs before this ships. */}
              <ul className="ml-5 max-w-xl list-disc space-y-1.5 font-serif text-base leading-relaxed text-text marker:text-command-gold">
                <li>Calipers, to read the tolerance ladder</li>
                <li>Flush cutters and a deburring blade, for brims</li>
                <li>An M6 hex key, for the side bolts</li>
                <li>5 × 1 mm neodymium magnets, for covers that take them</li>
                <li>
                  A soldering iron with a heat-set tip, for brass inserts
                </li>
                <li>
                  A PVC pipe cutter, primer and solvent cement, for pipe runs
                </li>
              </ul>
            </Section>

            <Section id="jigs" title="Print these first">
              {/* OWNER-REVIEW: the order and the reading/action lines. */}
              <p className="max-w-xl font-serif text-sm leading-relaxed text-muted">
                Small prints that tell you how your printer lands on this
                system before you spend hours on a base.
              </p>
              <ul className="mt-4 max-w-xl border-t border-panel-border/60">
                {HEX_V2_JIGS.map((j) => (
                  <li
                    key={j.stem}
                    className="border-b border-panel-border/60 py-5"
                  >
                    <a
                      href={printableProxyPath(
                        HEX_V2_RELEASE,
                        `3mf/${j.stem}.3mf`,
                      )}
                      download
                      className="group flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className="font-mono text-base leading-none text-command-gold"
                      >
                        &darr;
                      </span>
                      <span className="badge border-command-gold/50 text-command-gold">
                        3MF
                      </span>
                      <span className="title-card group-hover:text-gold-light">
                        {j.title}
                      </span>
                      <span className="font-mono text-[11px] text-muted">
                        {j.stem}
                      </span>
                    </a>
                    <p className="mt-3 font-serif text-sm leading-relaxed text-text">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                        Reading{" "}
                      </span>
                      {j.reading}
                    </p>
                    <p className="mt-1.5 font-serif text-sm leading-relaxed text-text">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                        Action{" "}
                      </span>
                      {j.action}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="safety" title="Safety">
              {/* Decision 2.6: the owner's approved words (2026-09-28). The
                  set-zip README reads the same constant, so the two agree. */}
              <ul className="ml-5 max-w-xl list-disc space-y-1.5 font-serif text-base leading-relaxed text-text marker:text-command-gold">
                {HEX_SAFETY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Section>

            <Section id="release-notes" title="Release notes">
              {/* OWNER-REVIEW: filled from the 4.6 diff at publish. */}
              <SpecRows
                rows={[
                  { label: "Release", value: HEX_V2_RELEASE },
                  { label: "Mates with earlier v2 prints", value: "TODO" },
                ]}
              />
              <div className="mt-4">
                <Placeholder>
                  TODO(publish): what changed in this release, from the 4.6
                  diff
                </Placeholder>
              </div>
            </Section>

            <Section id="attribution" title="License and attribution">
              <Prose>
                <p>
                  The geometry is released under the{" "}
                  <a href={HEX_LICENSE.deed} rel="license noopener" className={LINK}>
                    {HEX_LICENSE.fullName} license
                  </a>{" "}
                  ({HEX_LICENSE.name}). You may share it and adapt it, for any
                  purpose, including commercially. Attribution is the one
                  condition, and it is the whole return: it is why the files are
                  free.
                </p>
                <p>Crediting it means three things:</p>
                <ul className="ml-5 list-disc space-y-1.5 marker:text-command-gold">
                  <li>Credit {HEX_LICENSE.holder}.</li>
                  <li>Link the license.</li>
                  <li>Say whether you changed anything.</li>
                </ul>
                <p>
                  You can do that however suits your platform. This line is
                  ready to paste:
                </p>
              </Prose>

              {/* C2: ruled above and below, so it reads as an extract to lift. */}
              <p className="mt-5 max-w-xl border-y border-command-gold/40 py-3 font-mono text-xs leading-relaxed text-title">
                {HEX_LICENSE.credit}
              </p>

              <Note>
                If you arrived from a LICENSE.txt inside a downloaded file, this
                page is the source URL it cites. The full legal text is at{" "}
                <a href={HEX_LICENSE.legalCode} rel="license noopener" className={LINK}>
                  creativecommons.org
                </a>
                . CC BY runs one way: files already published under it stay
                under it, and only a future release could carry different terms.
              </Note>
            </Section>

            <Section id="support" title="Support">
              {/* OWNER-REVIEW */}
              <p className="max-w-xl font-serif text-base leading-relaxed text-text">
                Questions about a print or a fit go to{" "}
                <a href={`mailto:${HEX_V2_SUPPORT_EMAIL}`} className={LINK}>
                  {HEX_V2_SUPPORT_EMAIL}
                </a>
                . We aim to reply within {HEX_V2_SUPPORT_REPLY_HOURS} hours.
              </p>
            </Section>

            <Section id="accessibility" title="Accessibility">
              {/* TODO-owner: link the approved statement (decision 1.11). */}
              <Placeholder>
                TODO-owner: accessibility statement link (1.11)
              </Placeholder>
            </Section>
          </div>
        </div>
      </main>
    </HexConfiguratorFrame>
  );
}
