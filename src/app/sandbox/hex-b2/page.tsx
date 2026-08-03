// SANDBOX -- B2, as it actually was. Delete this route before the PR.
//
// Full-bleed loop inside a hairline frame, title and CTA sitting DIRECTLY on
// the footage at lower-left, downloads and licence in a strip immediately
// under. Two earlier attempts drifted off it and are worth naming so they do
// not come back: one moved the type into a solid band BELOW the video, the
// other put it in a bordered panel ON the video. Both were reactions to the
// same thing -- the house style bans gradient-as-accent, and a bottom-up scrim
// is how type stays legible over moving pixels here.
//
// The scrim stays. It is not an accent: it carries no colour, states nothing,
// and exists purely so the type underneath is readable. Swapping it for a
// panel changed the layout into a different option, which is not a trade worth
// making for a rule it was never really breaking.
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
      &#9656; {children}
    </p>
  );
}

/** A spec pair. Hairline row, mono label, Saira value: the instrument readout,
 *  not a table cell. */
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
      format: "ZIP",
      size: HEX_RELEASE_FILES.set.label,
      desc: `All ${HEX_PART_COUNT} parts, 3MF and STL`,
    },
    {
      href: LICENSE_URL,
      name: "LICENSE.txt",
      format: "TXT",
      size: HEX_RELEASE_FILES.license.label,
      desc: "The notice that travels inside every file",
    },
  ];

  return (
    <main className="mx-auto max-w-[100rem] px-4 pb-24 sm:px-6">
      {/* -- the loop, in a hairline frame, type over it -------------------- */}
      <section className="relative overflow-hidden border border-panel-border/60">
        <ThemedLoop className="h-[64vh] min-h-[420px] w-full object-cover" />

        {/* Bottom-up scrim. Legibility only: no colour, no message, and it goes
            to fully transparent well before the middle of the frame so the
            geometry above is untouched. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-deep-space via-deep-space/45 to-transparent"
        />

        <div className="absolute inset-0 flex items-end">
          <div className="w-full p-8 sm:p-12">
            <h1 className="title-hero">Hex Cluster.</h1>
            <p className="mt-3 max-w-xl font-serif text-base leading-relaxed text-text">
              A printable mounting standard. {HEX_PART_COUNT} parts, CC BY 4.0.
            </p>
            <Link
              href="/hex?open=1"
              className="glass-button glass-button-cta mt-7 inline-flex items-center px-8 py-4 font-mono text-sm uppercase tracking-[0.16em]"
            >
              Open the configurator
            </Link>
          </div>
        </div>
      </section>

      {/* -- downloads + licence, immediately under ------------------------- */}
      <section className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-2">
        <div>
          {/* Each row is a DOWNLOAD and now says so three ways: a gold arrow in
              place of the generic list triangle, a square format badge, and the
              size as a Saira readout. Before, the only cue that these were files
              was the extension inside the filename, which is a lot to ask of
              someone scanning. Still hairline rows on the bare field: the cues
              are inside the row, not a box drawn around it. */}
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
            No account, no email. If you arrived from a LICENSE.txt inside a
            downloaded file, this page is the source URL it cites.
          </p>
        </div>

        <div>
          <Eyebrow>Licence</Eyebrow>
          <p className="mt-3 font-serif text-base leading-relaxed text-text">
            CC BY 4.0. Use it commercially, remix it, sell what you print. Keep
            the credit.
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
      </section>

      {/* -- the spec, for whoever arrived cold ----------------------------- */}
      <section className="mt-16">
        <Eyebrow>Print it</Eyebrow>
        <p className="mt-3 max-w-2xl font-serif text-sm leading-relaxed text-muted">
          Hex bases print {HEX_ORIENTATION.value}. {HEX_ORIENTATION.why}
        </p>
        <div className="mt-7 grid gap-x-14 gap-y-2 sm:grid-cols-2">
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
