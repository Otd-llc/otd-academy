// `/hex` — the Hex Cluster spec, license and attribution target.
//
// THIS URL IS NOT A CHOICE. Every published .3mf/.stl/.step in release
// 2026-07-31 carries an immutable LICENSE.txt reading
//   Source: https://academy.onethousanddrones.com/hex
// and those objects ship `Cache-Control: immutable, max-age=31536000`. The
// release is CC BY 4.0, so mandated attribution is the entire return on it;
// until this page existed, every attribution in the wild pointed at a 307.
// `isPublicPath` opens it (src/lib/admin-routes.ts) and a routing test pins
// that open — verify SIGNED OUT, never only signed in.
//
// It answers what a maker holding a printed part actually needs, in that order:
// what the system is, the numbers, how to print it, where the files are, and
// how to credit it.
//
// Every spec value comes from `@/lib/hex-spec`, transcribed from the build
// sheet the configurator prints and pinned by a unit test. A maker must never
// find two different numbers for the same dimension across the page and the
// sheet in their hand.
//
// LAYOUT IS THE APPROVED SANDBOX, REBUILT — not the old page with overrides
// layered on. Every element below traces to a pick:
//
//   F5    a gold rule the full page height between the object and the words
//   F5b   corner ticks bracketing the graphic, so it reads as a framed view
//   F5b-5 a THREE-TILE lattice, not one part: the page is about a system whose
//         tiles carry load through each other, and one tile cannot say that
//   R3    leader dots on the spec rows
//   P4    the pitch as a dimensioned measurement rather than a captioned figure
//   I3    the identity strip stacked, one per line
//   O4    orientation as a plain figure, no frame
//   F4    download rows led by an arrow, with the size
//   C2    the credit line ruled above and below
//   H1    the house triangle eyebrow for section headings
//
// Static: no DB read, no request-time API, so it prerenders whole.
import type { Metadata } from "next";

import { ConfiguratorLink } from "@/components/hex/ConfiguratorLink";
import { HexConfiguratorFrame } from "@/components/hex/HexConfiguratorFrame";
import { ReleaseNotify } from "@/components/hex/ReleaseNotify";
import { ThemedLoop } from "@/components/hex/ThemedLoop";
import { ARRANGEMENTS, HexLattice } from "@/components/hex/HexLattice";
import { env } from "@/env";
import {
  HEX_CLEARANCE,
  HEX_CONFIGURATOR_URL,
  HEX_LICENSE,
  HEX_ORIENTATION,
  HEX_PART_COUNT,
  HEX_PITCH_MM,
  HEX_PRINT_PARAMS,
  HEX_RELEASE,
  HEX_RELEASE_FILES,
  type SpecRow,
} from "@/lib/hex-spec";
import { printableLicenseUrl, printableSetUrl } from "@/lib/printable-url";

export const metadata: Metadata = {
  // The long keyworded string lives here, not in the visible H1.
  title:
    "Hex Cluster: printable hex mounting standard, print spec and CC BY license",
  description:
    "The Hex Cluster print specification: PETG, 0.25 mm design gap, hex-face-down, and the full slicer settings. Released under CC BY 4.0 by One Thousand Drones.",
  alternates: { canonical: "/hex" },
};

const PITCH = `${HEX_PITCH_MM.toFixed(2)} mm`;

/** H1 — the house triangle eyebrow. */
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
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${className} border-t border-panel-border/60 pt-6`}>
      <Heading>{title}</Heading>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** R3 — leader dots. The dotted rule carries the eye from label to value, which
 *  is what keeps a nine-row spec readable across a wide column. */
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

/** F5b — corner ticks. Four bordered spans rather than an SVG frame, so the
 *  brackets inherit the token colour and flip with the theme for free. */
function Frame({ children }: { children: React.ReactNode }) {
  const tick = "absolute h-5 w-5 border-command-gold/70";
  return (
    <div className="relative p-6">
      <span
        aria-hidden="true"
        className={`${tick} left-0 top-0 border-l border-t`}
      />
      <span
        aria-hidden="true"
        className={`${tick} right-0 top-0 border-r border-t`}
      />
      <span
        aria-hidden="true"
        className={`${tick} bottom-0 left-0 border-b border-l`}
      />
      <span
        aria-hidden="true"
        className={`${tick} bottom-0 right-0 border-b border-r`}
      />
      {children}
    </div>
  );
}

export default function HexPage() {
  // Always real links. They resolve to the direct R2 object when the custom
  // domain is provisioned and to the `/api/printable` proxy until then, so the
  // download does not wait on a DNS change nobody in this codebase can make.
  const files = [
    {
      href: printableSetUrl(HEX_RELEASE, "hex-cluster"),
      name: "hex-cluster.zip",
      format: "ZIP",
      size: HEX_RELEASE_FILES.set.label,
      desc: `All ${HEX_PART_COUNT} parts, 3MF and STL`,
    },
    {
      href: printableLicenseUrl(HEX_RELEASE),
      name: "LICENSE.txt",
      format: "TXT",
      size: HEX_RELEASE_FILES.license.label,
      desc: "The notice that travels inside every file",
    },
  ];

  return (
    // The frame HOSTS the page rather than sitting beside it: every
    // `ConfiguratorLink` below reads its context, and the frame itself portals
    // to <body>, so wrapping costs no extra element in the layout. The page
    // stays a server component; only the host and the links are client.
    <HexConfiguratorFrame enabled={env.NEXT_PUBLIC_HEX_EMBED !== "off"}>
      {/* ── the loop, and everything a visitor came for, above the fold ─────
          Owner pick (sandbox round, option B2). The page used to open on the
          spec document, which is the right shape for a reader arriving from a
          LICENSE.txt and the wrong one for someone being handed the link: the
          configurator was a section heading near the bottom, and the downloads
          were below that.

          Order is deliberate: OPEN, DOWNLOAD, LICENCE, then the document. The
          people this gets sent to already know what it is. The people who
          follow an attribution link do not, and the document is still there,
          one screen down, unchanged. */}
      <section className="relative mx-auto max-w-[100rem] px-4 sm:px-6">
        <div className="relative overflow-hidden border border-panel-border/60">
          <ThemedLoop className="h-[58vh] min-h-[380px] w-full object-cover" />

          {/* Bottom-up scrim: legibility only. It carries no colour and states
              nothing, and it reaches full transparency well above the middle of
              the frame, so the geometry is untouched. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-deep-space via-deep-space/45 to-transparent"
          />

          <div className="absolute inset-0 flex items-end">
            <div className="w-full p-6 sm:p-12">
              <h1 className="title-hero">Hex Cluster.</h1>
              <p className="mt-3 max-w-xl font-serif text-base leading-relaxed text-text">
                A printable mounting standard. {HEX_PART_COUNT} parts,{" "}
                {HEX_LICENSE.name}.
              </p>
              {/* ConfiguratorLink, not a plain href to `?open=1`: on THIS page
                  the deep-link effect has already run, so a same-page query
                  change would do nothing. The link reads the frame's context
                  and opens it directly, and still degrades to the standalone
                  configurator with no JS or under the kill switch. */}
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

        {/* Downloads and licence, immediately under the fold line. Someone who
            arrived to fetch files never has to hunt for them. */}
        <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          {/* The capture is a WRAPPER, not a sibling: it watches for a click on
              a download anchor and only then reveals a field. It never touches
              the anchor's default action, so nothing here can delay the file. */}
          <ReleaseNotify release={HEX_RELEASE}>
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
            <p className="mt-4 font-serif text-xs leading-relaxed text-muted">
              No account, no email. Release {HEX_RELEASE}; the segment is
              immutable, so a link you save today keeps resolving to the
              geometry you downloaded.
            </p>
          </ReleaseNotify>

          <div>
            <Heading>Licence</Heading>
            <p className="mt-4 font-serif text-base leading-relaxed text-text">
              {HEX_LICENSE.name}. Use it commercially, remix it, sell what you
              print. Keep the credit.
            </p>
            <p className="mt-4 border-y border-command-gold/40 py-3 font-mono text-[11px] leading-relaxed text-title">
              {HEX_LICENSE.credit}
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-[420px_1fr]">
          {/* F5 — the rule lives on this OUTER grid item, which stretches to the
            row height, so it runs the whole page. On the sticky child it would
            stop wherever that box ends and read as unfinished. */}
          <div className="lg:border-r lg:border-command-gold/40 lg:pr-12">
            <div className="py-10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center">
              <Frame>
                {/* F5b-5 — three engaged tiles at the REAL cell pitch, inner wall
                  at low opacity for depth. The gap you see between neighbours
                  is the 0.25 mm design gap scaled up. */}
                <HexLattice
                  cells={ARRANGEMENTS.trio}
                  detail="detail"
                  className="mx-auto w-full text-command-gold"
                />
              </Frame>

              {/* P4 — a dimension line, so the number annotates a measurement
                instead of captioning a picture. */}
              <div className="mt-8">
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

              {/* I3 — stacked. A reader arriving from a LICENSE.txt needs the
                license and the release without scrolling. */}
              <dl className="mt-9 border-t border-panel-border/60 font-mono text-[10px] uppercase tracking-[0.18em]">
                {[
                  { label: "License", value: HEX_LICENSE.name },
                  { label: "Release", value: HEX_RELEASE },
                  { label: "Parts", value: String(HEX_PART_COUNT) },
                  { label: "Material", value: "PETG" },
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
            {/* No title here any more: the hero above owns the H1, and a second
                "Hex Cluster" a screen down read as the page starting twice. */}
            <div className="title-rule" aria-hidden="true" />
            <p className="mt-6 max-w-xl font-serif text-base leading-relaxed text-text">
              Dovetails on all six edges, so a tiled layout behaves as one rigid
              body.
            </p>

            <Section title="What it is">
              <div className="max-w-xl space-y-4 font-serif text-base leading-relaxed text-text">
                <p>
                  Hex Cluster is a mounting standard, not a storage system. Each
                  tile is a hexagonal base carrying a tapered dovetail on every
                  one of its six edges. Engage two tiles and the joint resists
                  in-plane pull, so a layout of any size behaves as a single
                  rigid body rather than a set of pieces that creep apart under
                  a tugged cable.
                </p>
                <p>
                  Carrier inserts drop into a tile to hold a board or a tray.
                  Caps close the free male and female dovetails around the
                  perimeter, so a finished cluster has no exposed joint. Half
                  tiles let a layout end on a straight edge instead of a
                  saw-tooth.
                </p>
              </div>
            </Section>

            <Section title="Geometry">
              {/* The pitch is the rail's dimensioned readout, so it is NOT
                repeated. What is left is the number a person about to print
                needs, and the derivation tying the two together. */}
              {/* Subordinate to the rail's pitch on purpose. Both were text-5xl
                gold Saira, which gave the page two hero numbers competing a
                few hundred pixels apart. Gold at hero scale is the page's ONE
                numeral moment and the pitch owns it; the gap is still a figure,
                just an ivory one at a smaller step, the same ink as the spec
                values it belongs with. */}
              <p className="font-numeral text-3xl tracking-wide tabular-nums text-title">
                0.25 mm
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                design gap between tiles
              </p>
              <p className="mt-6 max-w-xl font-serif text-sm leading-relaxed text-muted">
                The pitch beside this is the hex across-flats dimension plus
                that gap: a 43.85 mm circumradius gives 75.95 mm across flats,
                and the 0.25 mm clearance takes it to {PITCH}, which is 3.00 in.
                Design to the pitch if you are adapting the standard; design to
                the gap if you are printing it.
              </p>
            </Section>

            <Section title="Print spec">
              {/* O4 — orientation as a figure like any other spec value. No
                frame: it earns its emphasis from the numeral face. */}
              <div className="mb-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
                  Orientation
                </p>
                <p className="mt-1 font-numeral text-2xl tracking-wide text-title">
                  {HEX_ORIENTATION.value}
                </p>
                <p className="mt-2 max-w-xl font-serif text-sm leading-relaxed text-muted">
                  {HEX_ORIENTATION.why}
                </p>
              </div>

              <SpecRows rows={HEX_PRINT_PARAMS} />

              <h3 className="mt-9 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                ▸ Clearance and tolerance
              </h3>
              <div className="mt-4">
                <SpecRows rows={HEX_CLEARANCE} />
              </div>

              <p className="mt-6 max-w-xl font-serif text-sm leading-relaxed text-muted">
                Verify XY tolerance with a printed test cube before committing
                to a full set. At this clearance per-printer calibration is
                likely: if parts do not engage cleanly, measure shrinkage and
                re-slice with compensation rather than sanding the joints.
              </p>
              <p className="mt-3 max-w-xl font-serif text-sm leading-relaxed text-muted">
                The material is not a free choice. The gap is toleranced against
                PETG shrinkage, and the dovetail carries pull-out load through
                interlayer bonds, where PETG has the adhesion the joint needs.
              </p>
            </Section>

            <Section title="License and attribution">
              <div className="max-w-xl space-y-4 font-serif text-base leading-relaxed text-text">
                <p>
                  The geometry is released under the{" "}
                  <a
                    href={HEX_LICENSE.deed}
                    rel="license noopener"
                    className="text-command-gold underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light"
                  >
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
              </div>

              {/* C2 — ruled above and below, so the line reads as an extract to
                be lifted rather than prose to be skimmed. */}
              <p className="mt-5 max-w-xl border-y border-command-gold/40 py-3 font-mono text-xs leading-relaxed text-title">
                {HEX_LICENSE.credit}
              </p>

              <p className="mt-5 max-w-xl font-serif text-sm leading-relaxed text-muted">
                If you arrived from a LICENSE.txt inside a downloaded file, this
                page is the source URL it cites. The full legal text is at{" "}
                <a
                  href={HEX_LICENSE.legalCode}
                  rel="license noopener"
                  className="text-command-gold underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light"
                >
                  creativecommons.org
                </a>
                . CC BY runs one way: files already published under it stay
                under it, and only a future release could carry different terms.
              </p>
            </Section>
          </div>
        </div>
      </main>
    </HexConfiguratorFrame>
  );
}
