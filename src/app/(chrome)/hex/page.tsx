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
// Static: no DB read, no request-time API, so it prerenders whole. The one
// conditional is a NEXT_PUBLIC env var, inlined at build.
import type { Metadata } from "next";

import { HexBodyGlyph } from "@/components/hex/HexBodyGlyph";
import {
  HEX_CLEARANCE,
  HEX_CONFIGURATOR_URL,
  HEX_LICENSE,
  HEX_ORIENTATION,
  HEX_PART_COUNT,
  HEX_PITCH_MM,
  HEX_PRINT_PARAMS,
  HEX_RELEASE,
  type SpecRow,
} from "@/lib/hex-spec";
import { printableLicenseUrl, printableSetUrl } from "@/lib/printable-url";

export const metadata: Metadata = {
  // The long keyworded string lives here, not in the visible H1.
  title: "Hex Cluster: printable hex mounting standard, print spec and CC BY license",
  description:
    "The Hex Cluster print specification: PETG, 0.25 mm design gap, hex-face-down, and the full slicer settings. Released under CC BY 4.0 by One Thousand Drones.",
  alternates: { canonical: "/hex" },
};

/** A hairline spec row: mono label, value in the numeral face. Not a table
 *  fill and not a card — the document-index look the system asks for. */
function Row({ row }: { row: SpecRow }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-panel-border/60 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        {row.label}
      </dt>
      <dd className="text-right">
        <span className="font-numeral text-lg tabular-nums tracking-wide text-title">
          {row.value}
        </span>
        {/* The aside is `muted`, not `gray-3`: these qualifiers are part of the
            spec (the inch equivalent, the upper bound), not disabled meta, and
            gray-3 is close to unreadable against deep-space at this size. */}
        {row.aside ? (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {row.aside}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
      ▸ {children}
    </h2>
  );
}

export default function HexPage() {
  // Always real links. They resolve to the direct R2 object when the custom
  // domain is provisioned and to the `/api/printable` proxy until then, so the
  // download does not wait on a DNS change nobody in this codebase can make.
  // If the release is not in the bucket yet, the proxy answers 404 rather than
  // this page lying about a file that exists.
  const setUrl = printableSetUrl(HEX_RELEASE, "hex-cluster");
  const licenseFileUrl = printableLicenseUrl(HEX_RELEASE);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* HERO — sandbox option E2, the owner's pick. The part IS the hero: the
          outer silhouette of the real Hex-TB-Main geometry, so the page says
          "hex, dovetailed on six edges" before a word is read. Built from the
          approved option rather than layered over the previous PageHeader hero;
          that header is gone from this page, not overridden. */}
      <header className="mb-12">
        <div className="title-rule" aria-hidden="true" />
        <div className="mt-8 flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-10">
          <HexBodyGlyph
            variant="outline"
            className="h-40 w-auto shrink-0 text-command-gold sm:h-44"
          />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
              Cell pitch
            </p>
            {/* The page's numeral moment. Saira, gold, tabular. */}
            <p className="font-numeral text-6xl tracking-wide tabular-nums text-command-gold sm:text-7xl">
              {HEX_PITCH_MM.toFixed(2)} mm
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              centre to centre · 0.25 mm design gap
            </p>
            <h1 className="title-section mt-5">Hex Cluster</h1>
            <p className="mt-2 max-w-md font-serif text-base leading-relaxed text-text">
              A printable mounting standard. Dovetails on all six edges, so a
              tiled layout behaves as one rigid body.
            </p>
          </div>
        </div>

        {/* The identity strip the old PageHeader carried. Kept, and kept BELOW
            the hero: a reader arriving from a LICENSE.txt needs the licence and
            the release visible without scrolling, and E2's hero has no slot for
            them. Hairline row, not a filled bar. */}
        <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-2 border-t border-panel-border/60 pt-4 font-mono text-[10px] uppercase tracking-[0.18em]">
          {[
            { label: "License", value: HEX_LICENSE.name },
            { label: "Release", value: HEX_RELEASE },
            { label: "Parts", value: String(HEX_PART_COUNT) },
            { label: "Material", value: "PETG" },
          ].map((m) => (
            <div key={m.label} className="flex gap-2">
              <dt className="text-command-gold">{m.label}</dt>
              <dd className="text-title">{m.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="border-t border-panel-border/60 pt-6">
        <SectionHeading>What it is</SectionHeading>
        <div className="mt-3 space-y-4 font-serif text-base leading-relaxed text-text">
          <p>
            Hex Cluster is a mounting standard, not a storage system. Each tile
            is a hexagonal base carrying a tapered dovetail on every one of its
            six edges. Engage two tiles and the joint resists in-plane pull, so
            a layout of any size behaves as a single rigid body rather than a
            set of pieces that creep apart under a tugged cable.
          </p>
          <p>
            Carrier inserts drop into a tile to hold a board or a tray. Caps
            close the free male and female dovetails around the perimeter, so a
            finished cluster has no exposed joint. Half tiles let a layout end
            on a straight edge instead of a saw-tooth.
          </p>
        </div>
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <SectionHeading>Geometry</SectionHeading>
        {/* The pitch is the hero's readout, so it is NOT repeated here. What is
            left is the number a person about to print needs, and the derivation
            that ties the two together. */}
        <div className="mt-5">
          <p className="font-numeral text-5xl tracking-wide tabular-nums text-command-gold sm:text-6xl">
            0.25 mm
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            design gap between tiles
          </p>
        </div>
        <p className="mt-6 font-serif text-sm leading-relaxed text-muted">
          The pitch above is the hex across-flats dimension plus that gap: a
          43.85 mm circumradius gives 75.95 mm across flats, and the 0.25 mm
          clearance takes it to {HEX_PITCH_MM.toFixed(2)} mm, which is 3.00 in.
          Design to the pitch if you are adapting the standard; design to the
          gap if you are printing it.
        </p>
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <SectionHeading>Print spec</SectionHeading>

        <div className="mt-4 border-l-2 border-l-command-gold pl-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
            Orientation: {HEX_ORIENTATION.value}
          </p>
          <p className="mt-2 font-serif text-sm leading-relaxed text-text">
            {HEX_ORIENTATION.why}
          </p>
        </div>

        <dl className="mt-7 border-t border-panel-border/60">
          {HEX_PRINT_PARAMS.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </dl>

        <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          Clearance and tolerance
        </h3>
        <dl className="mt-3 border-t border-panel-border/60">
          {HEX_CLEARANCE.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </dl>
        <p className="mt-4 font-serif text-sm leading-relaxed text-muted">
          Verify XY tolerance with a printed test cube before committing to a
          full set. At this clearance per-printer calibration is likely: if
          parts do not engage cleanly, measure shrinkage and re-slice with
          compensation rather than sanding the joints.
        </p>
        <p className="mt-3 font-serif text-sm leading-relaxed text-muted">
          The material is not a free choice. The gap is toleranced against PETG
          shrinkage, and the dovetail carries pull-out load through interlayer
          bonds, where PETG has the adhesion the joint needs. The README shipped
          inside the {HEX_RELEASE} archive says PLA. That is an error in an
          immutable file; this page is the authority.
        </p>
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <SectionHeading>Files</SectionHeading>
        <p className="mt-3 font-serif text-base leading-relaxed text-text">
          Release {HEX_RELEASE}. {HEX_PART_COUNT} parts as 3MF and STL, with
          STEP kept per part for remixing. The release segment is immutable: a
          link you save today keeps resolving to the geometry you downloaded.
        </p>
        <ul className="mt-5 border-t border-panel-border/60">
          <li>
            <a
              href={setUrl}
              className="group flex flex-col gap-1.5 border-b border-panel-border/60 py-5 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                ▸ Complete set
              </span>
              <span className="title-card group-hover:text-gold-light">
                hex-cluster.zip
              </span>
              <span className="text-sm text-muted">
                Every part in 3MF and STL, with the license.
              </span>
            </a>
          </li>
          <li>
            <a
              href={licenseFileUrl}
              className="group flex flex-col gap-1.5 border-b border-panel-border/60 py-5 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
                ▸ License
              </span>
              <span className="title-card group-hover:text-gold-light">
                LICENSE.txt
              </span>
              <span className="text-sm text-muted">
                The same notice that travels inside every file.
              </span>
            </a>
          </li>
        </ul>
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <SectionHeading>License and attribution</SectionHeading>
        <div className="mt-3 space-y-4 font-serif text-base leading-relaxed text-text">
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
            purpose, including commercially. Attribution is the one condition,
            and it is the whole return: it is why the files are free.
          </p>
          <p>Crediting it means three things:</p>
          <ul className="ml-5 list-disc space-y-1.5 marker:text-command-gold">
            <li>Credit {HEX_LICENSE.holder}.</li>
            <li>Link the license.</li>
            <li>Say whether you changed anything.</li>
          </ul>
          <p>
            You can do that however suits your platform. This line is ready to
            paste:
          </p>
        </div>

        <p className="mt-4 border-l-2 border-l-command-gold py-1 pl-4 font-mono text-xs leading-relaxed text-title">
          {HEX_LICENSE.credit}
        </p>

        <p className="mt-5 font-serif text-sm leading-relaxed text-muted">
          If you arrived from a LICENSE.txt inside a downloaded file, this page
          is the source URL it cites. The full legal text is at{" "}
          <a
            href={HEX_LICENSE.legalCode}
            rel="license noopener"
            className="text-command-gold underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light"
          >
            creativecommons.org
          </a>
          . CC BY runs one way: files already published under it stay under it,
          and only a future release could carry different terms.
        </p>
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <SectionHeading>Configure a cluster</SectionHeading>
        <p className="mt-3 font-serif text-base leading-relaxed text-text">
          Lay out tiles, inserts and caps in the browser, then print a
          dimensioned build sheet with the bill of materials for exactly the
          layout you made.
        </p>
        <p className="mt-5">
          {/* Both classes: `.glass-button-cta` only overrides the fill, so the
              radius, elevation and the shared focus-visible ring come from
              `.glass-button`. Alone it would ship a CTA with no keyboard focus. */}
          <a
            href={HEX_CONFIGURATOR_URL}
            className="glass-button glass-button-cta inline-flex items-center px-6 py-3 font-mono text-sm uppercase tracking-[0.16em]"
          >
            Open the configurator
          </a>
        </p>
      </section>
    </main>
  );
}
