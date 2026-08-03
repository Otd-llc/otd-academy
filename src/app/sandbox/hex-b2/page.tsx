// SANDBOX -- B2 built out properly. Delete this route before the PR.
//
// Full-bleed loop with the CTA over it, downloads and licence immediately
// under, spec below the fold. Built against the real tokens rather than the
// sandbox's shorthand, so what you are looking at is what would ship.
//
// TWO HOUSE RULES THIS HAD TO DESIGN AROUND
//
// 1. No gradient-as-accent. The obvious way to keep white text legible over
//    video is a gradient scrim, and that is the single most generic move
//    available. Instead the masthead is a SOLID deep-space band with a gold
//    top-rule, overlapping the video's lower edge -- the sanctioned
//    "gold top-rule masthead" framing. Type never sits on moving pixels, so it
//    stays legible without a wash, and the band doubles as the thing that stops
//    the video looking like a stock header image.
//
// 2. No filled cards. Downloads, licence and spec are hairline-grouped rows on
//    the bare field. The file sizes take the Saira numeral face with
//    tabular-nums, because a size is a readout.
import { notFound } from "next/navigation";
import Link from "next/link";

import { ThemedLoop } from "@/components/hex/ThemedLoop";
import {
  HEX_CLEARANCE,
  HEX_LICENSE,
  HEX_ORIENTATION,
  HEX_PART_COUNT,
  HEX_PITCH_MM,
  HEX_PRINT_PARAMS,
  HEX_RELEASE,
  HEX_RELEASE_FILES,
} from "@/lib/hex-spec";
import { printableLicenseUrl, printableSetUrl } from "@/lib/printable-url";

export const metadata = { robots: { index: false, follow: false } };

const SET_URL = printableSetUrl(HEX_RELEASE, "hex-cluster");
const LICENSE_URL = printableLicenseUrl(HEX_RELEASE);
const PITCH = `${HEX_PITCH_MM.toFixed(2)} mm`;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
      â–¸ {children}
    </p>
  );
}

/** A spec pair. Hairline row, mono label, Saira value -- the instrument
 *  readout, not a table cell. */
function Row({
  label,
  value,
  aside,
}: {
  label: string;
  value: string;
  aside?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-panel-border/60 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </dt>
      <dd className="text-right">
        <span className="font-numeral text-lg tabular-nums text-text">
          {value}
        </span>
        {aside && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gray-3">
            {aside}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function HexB2() {
  if (process.env.NODE_ENV === "production") notFound();

  const files = [
    {
      href: SET_URL,
      name: "hex-cluster.zip",
      size: HEX_RELEASE_FILES.set.label,
      desc: `Every part in 3MF and STL, with the licence`,
    },
    {
      href: LICENSE_URL,
      name: "LICENSE.txt",
      size: HEX_RELEASE_FILES.license.label,
      desc: "The same notice that travels inside every file",
    },
  ];

  return (
    <main className="pb-24">
      {/* â”€â”€ the loop, full bleed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative">
        <ThemedLoop className="h-[46vh] min-h-[320px] w-full object-cover sm:h-[58vh]" />

        {/* The masthead. Solid, not a scrim: a gold top-rule over deep space,
            overlapping the video's lower edge so the two read as one object. */}
        <div className="relative -mt-px border-t-2 border-command-gold bg-deep-space">
          <div className="mx-auto max-w-6xl px-6 py-7 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div>
                <Eyebrow>
                  Free Â· CC BY 4.0 Â· {HEX_PART_COUNT} parts Â· {PITCH} pitch
                </Eyebrow>
                <h1 className="title-hero mt-2">Hex Cluster.</h1>
                <p className="mt-3 max-w-xl font-serif text-base leading-relaxed text-text">
                  A printable mounting standard. Hexagonal tiles that dovetail
                  to each other, with carriers, trays and caps that clip in. Lay
                  a cluster out in the browser, print a dimensioned build sheet
                  for exactly what you made.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <Link
                  href="/hex?open=1"
                  className="glass-button glass-button-cta inline-flex items-center px-7 py-3.5 font-mono text-sm uppercase tracking-[0.16em]"
                >
                  Open the configurator
                </Link>
                <a
                  href={SET_URL}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
                >
                  Download all {HEX_PART_COUNT} parts
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ downloads + licence, immediately under. No scrolling to find them. */}
      <section className="mx-auto max-w-6xl px-6 pt-10 sm:px-8">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Download</Eyebrow>
            <ul className="mt-3 border-t border-panel-border/60">
              {files.map((f) => (
                <li key={f.name}>
                  <a
                    href={f.href}
                    className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-panel-border/60 py-3.5 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
                  >
                    <span className="font-mono text-[10px] text-command-gold">
                      â–¸
                    </span>
                    <span className="font-mono text-xs text-title group-hover:text-gold-light">
                      {f.name}
                    </span>
                    <span className="font-numeral text-base tabular-nums text-muted">
                      {f.size}
                    </span>
                    <span className="w-full font-serif text-xs text-muted sm:ml-auto sm:w-auto">
                      {f.desc}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-serif text-xs leading-relaxed text-muted">
              No account, no email. If you arrived from a LICENSE.txt inside a
              downloaded file, this page is the source URL it cites.
            </p>
          </div>

          <div>
            <Eyebrow>Licence</Eyebrow>
            <p className="mt-3 font-serif text-sm leading-relaxed text-text">
              CC BY 4.0. Use it commercially, remix it, sell what you print.
              Keep the credit. It runs one way: files already published under it
              stay under it.
            </p>
            <p className="mt-4 border-y border-command-gold/40 py-3 font-mono text-[11px] leading-relaxed text-title">
              {HEX_LICENSE.credit}
            </p>
            <a
              href={HEX_LICENSE.legalCode}
              rel="license noopener"
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4 hover:text-gold-light"
            >
              Full legal text
            </a>
          </div>
        </div>
      </section>

      {/* â”€â”€ the spec, for whoever arrived cold â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mx-auto mt-16 max-w-6xl px-6 sm:px-8">
        <Eyebrow>Print it</Eyebrow>
        <p className="mt-3 max-w-2xl font-serif text-sm leading-relaxed text-muted">
          Hex bases print {HEX_ORIENTATION.value}. {HEX_ORIENTATION.why}
        </p>
        <div className="mt-7 grid gap-x-12 gap-y-2 sm:grid-cols-2">
          <dl>
            {HEX_PRINT_PARAMS.map((r) => (
              <Row
                key={r.label}
                label={r.label}
                value={r.value}
                aside={r.aside}
              />
            ))}
          </dl>
          <dl>
            {HEX_CLEARANCE.map((r) => (
              <Row
                key={r.label}
                label={r.label}
                value={r.value}
                aside={r.aside}
              />
            ))}
            <Row label="Cell pitch" value={PITCH} aside="centre to centre" />
            <Row
              label="Parts"
              value={String(HEX_PART_COUNT)}
              aside="in the set"
            />
          </dl>
        </div>
        <p className="mt-6 max-w-2xl font-serif text-xs leading-relaxed text-muted">
          The 0.25 mm design gap is toleranced against PETG shrinkage, so the
          material is not a free choice. Two parts, the spike and the ball
          joint, rest on a line by design and want support or a brim; the rest
          stand on their own.
        </p>
      </section>
    </main>
  );
}
