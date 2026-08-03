// SANDBOX -- /hex as a landing page. Delete this route before the PR.
//
// The brief: a clear CTA, the configurator openable immediately, and the
// downloads plus the licence reachable without scrolling or hunting. Audience is
// BOTH, in that order -- the people being sent the link first, a cold visitor
// following a CC BY attribution link second.
//
// Six variants across three hero strategies, so the choice is made by looking
// rather than from a description:
//   A  the live configurator IS the hero
//   B  the video loop, configurator one click away
//   C  a still render, quietest and fastest
//
// Every variant carries the SAME above-the-fold payload -- open, download,
// licence -- so what is being compared is the arrangement, not the content.
import { notFound } from "next/navigation";

import {
  HEX_CLEARANCE,
  HEX_LICENSE,
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

// ── shared pieces ───────────────────────────────────────────────────────────

/** The two downloads as hairline rows. Never a filled card: this is a content
 *  surface, and a boxed download panel is the SaaS tell the house style bans. */
function Downloads({ compact = false }: { compact?: boolean }) {
  const files = [
    {
      href: SET_URL,
      name: "hex-cluster.zip",
      size: HEX_RELEASE_FILES.set.label,
      desc: `All ${HEX_PART_COUNT} parts, 3MF and STL`,
    },
    {
      href: LICENSE_URL,
      name: "LICENSE.txt",
      size: HEX_RELEASE_FILES.license.label,
      desc: "The notice that travels inside every file",
    },
  ];
  return (
    <ul className="border-t border-panel-border/60">
      {files.map((f) => (
        <li key={f.name}>
          <a
            href={f.href}
            className="group flex items-baseline gap-3 border-b border-panel-border/60 py-3 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
          >
            <span className="font-mono text-[10px] text-command-gold">▸</span>
            <span className="font-mono text-xs text-title group-hover:text-gold-light">
              {f.name}
            </span>
            <span className="font-numeral text-sm tabular-nums text-muted">
              {f.size}
            </span>
            {!compact && (
              <span className="ml-auto hidden font-serif text-xs text-muted sm:block">
                {f.desc}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The licence, stated not linked-away-to. A visitor who arrived FROM an
 *  attribution link needs to see the terms without another hop. */
function Licence({ dense = false }: { dense?: boolean }) {
  return (
    <div className={dense ? "" : "mt-6"}>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Licence
      </p>
      <p className="mt-2 font-serif text-sm leading-relaxed text-text">
        CC BY 4.0. Use it commercially, remix it, sell what you print. Keep the
        credit.
      </p>
      <p className="mt-3 max-w-xl border-y border-command-gold/40 py-2 font-mono text-[11px] leading-relaxed text-title">
        {HEX_LICENSE.credit}
      </p>
    </div>
  );
}

function OpenCta({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href="/hex?open=1"
      className={`glass-button glass-button-cta inline-flex items-center font-mono uppercase tracking-[0.16em] ${
        size === "lg" ? "px-7 py-3.5 text-sm" : "px-5 py-2.5 text-xs"
      }`}
    >
      Open the configurator
    </a>
  );
}

function Lede() {
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Free · CC BY 4.0 · {HEX_PART_COUNT} parts
      </p>
      <h1 className="title-hero mt-3">Hex Cluster.</h1>
      <p className="mt-4 max-w-xl font-serif text-base leading-relaxed text-text">
        A printable mounting standard. Hexagonal tiles that dovetail to each
        other at a {PITCH} pitch, with carriers, caps and spikes that clip in.
        Lay out a cluster in the browser and print a dimensioned build sheet for
        exactly what you made.
      </p>
    </>
  );
}

/** The cold-visitor half, identical under every variant. */
function BelowTheFold() {
  return (
    <div className="mx-auto mt-16 max-w-5xl border-t border-panel-border/60 pt-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ The spec
      </p>
      <div className="mt-6 grid gap-10 sm:grid-cols-2">
        <dl>
          {HEX_PRINT_PARAMS.slice(0, 5).map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between border-b border-panel-border/60 py-2"
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {r.label}
              </dt>
              <dd className="font-numeral text-base tabular-nums text-text">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
        <dl>
          {HEX_CLEARANCE.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between border-b border-panel-border/60 py-2"
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {r.label}
              </dt>
              <dd className="font-numeral text-base tabular-nums text-text">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ── the variants ────────────────────────────────────────────────────────────

/** A1 -- the live frame, full width, CTA and downloads riding above it. */
function A1() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Lede />
          </div>
          <div className="w-full max-w-sm">
            <Downloads compact />
          </div>
        </div>
        <div className="mt-6 aspect-[16/8] w-full border border-command-gold/25 bg-deep-space">
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
              live configurator, loaded on arrival
            </span>
          </div>
        </div>
        <div className="mt-6">
          <Licence />
        </div>
      </div>
    </section>
  );
}

/** A2 -- live frame left, a permanent action column right. Nothing to scroll to. */
function A2() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Lede />
          <div className="mt-5 aspect-[16/10] w-full border border-command-gold/25 bg-deep-space">
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                live configurator
              </span>
            </div>
          </div>
        </div>
        <aside className="lg:pt-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            ▸ Download
          </p>
          <div className="mt-3">
            <Downloads compact />
          </div>
          <div className="mt-7">
            <Licence dense />
          </div>
        </aside>
      </div>
    </section>
  );
}

/** B1 -- the loop beside the actions. Fast first paint, app loads on demand. */
function B1() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div>
          <Lede />
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <OpenCta />
            <a
              href={SET_URL}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4 hover:text-gold-light"
            >
              Download all {HEX_PART_COUNT} parts ·{" "}
              {HEX_RELEASE_FILES.set.label}
            </a>
          </div>
          <div className="mt-8">
            <Downloads />
          </div>
          <Licence />
        </div>
        <video
          className="w-full border border-panel-border/60"
          autoPlay
          muted
          loop
          playsInline
          poster="/hex/configurator-poster.jpg"
        >
          <source src="/hex/configurator.webm" type="video/webm" />
          <source src="/hex/configurator.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  );
}

/** B2 -- full-bleed loop, CTA over it, downloads in a strip immediately under. */
function B2() {
  return (
    <section className="py-10">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden border border-panel-border/60">
          <video
            className="w-full"
            autoPlay
            muted
            loop
            playsInline
            poster="/hex/configurator-poster.jpg"
          >
            <source src="/hex/configurator.webm" type="video/webm" />
            <source src="/hex/configurator.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-deep-space via-deep-space/40 to-transparent p-8">
            <h1 className="title-hero">Hex Cluster.</h1>
            <p className="mt-2 max-w-lg font-serif text-sm leading-relaxed text-text">
              A printable mounting standard. {HEX_PART_COUNT} parts, CC BY 4.0.
            </p>
            <div className="mt-5">
              <OpenCta />
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <Downloads />
          <Licence dense />
        </div>
      </div>
    </section>
  );
}

/** C1 -- document masthead. Still render right, everything else a hairline index. */
function C1() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_460px]">
        <div>
          <Lede />
          <div className="mt-7">
            <OpenCta />
          </div>
          <div className="mt-8">
            <Downloads />
          </div>
          <Licence />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hex/clean/flower.webp"
          alt="Seven hex tiles dovetailed into a ring"
          className="w-full"
        />
      </div>
    </section>
  );
}

/** C2 -- centred, quietest. The render leads, the actions sit under it. */
function C2() {
  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Free · CC BY 4.0 · {HEX_PART_COUNT} parts
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hex/clean/flower.webp"
          alt="Seven hex tiles dovetailed into a ring"
          className="mx-auto mt-4 w-full max-w-xl"
        />
        <h1 className="title-hero mt-2">Hex Cluster.</h1>
        <p className="mx-auto mt-3 max-w-xl font-serif text-base leading-relaxed text-text">
          A printable mounting standard. Tiles that dovetail to each other at a{" "}
          {PITCH} pitch.
        </p>
        <div className="mt-6">
          <OpenCta />
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-8 text-left sm:grid-cols-2">
        <Downloads />
        <Licence dense />
      </div>
    </section>
  );
}

const VARIANTS = [
  {
    id: "A1",
    note: "live configurator full width, actions above it",
    el: <A1 />,
  },
  {
    id: "A2",
    note: "live configurator left, permanent action column right",
    el: <A2 />,
  },
  {
    id: "B1",
    note: "loop beside the actions, app loads on demand",
    el: <B1 />,
  },
  {
    id: "B2",
    note: "full-bleed loop, CTA over it, downloads under",
    el: <B2 />,
  },
  { id: "C1", note: "still render, document masthead", el: <C1 /> },
  { id: "C2", note: "still render, centred and quietest", el: <C2 /> },
];

export default function HexLandingSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-screen bg-deep-space pb-24">
      <div className="border-b border-panel-border/60 px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Sandbox · /hex landing
        </p>
        <p className="mt-2 font-serif text-sm text-muted">
          Six arrangements of the same above-the-fold payload: open, download,
          licence. Toggle the theme with the control on each frame; a variant
          that only works on one is not a variant.
        </p>
      </div>

      {VARIANTS.map((v) => (
        <div key={v.id}>
          {/* Caption ABOVE the frame, never a badge inside it. */}
          <div className="flex items-baseline gap-4 px-6 pb-2 pt-12">
            <span className="font-numeral text-2xl tabular-nums text-command-gold">
              {v.id}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {v.note}
            </span>
          </div>
          <div className="mx-4 border border-panel-border/60">{v.el}</div>
        </div>
      ))}

      <div className="px-6 pt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          below the fold, identical under every variant
        </p>
      </div>
      <div className="mx-4 mt-2 border border-panel-border/60 px-6 py-4">
        <BelowTheFold />
      </div>
    </main>
  );
}
