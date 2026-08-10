// /beta — the L1.01 open-beta landing page.
//
// PUBLIC. Every visitor the campaign sends is anonymous by definition, so this
// route is named in `isPublicPath`; without that the whole campaign 307s to
// /sign-in, and it would fail invisibly to anyone checking while signed in.
//
// Three things decide the shape of this page, and all three are measurements
// rather than preferences:
//
//   - The hero carries the decision. Users spend ~57% of viewing time above the
//     fold with a sharp drop after it, so the board, the claim and the CTA are
//     all above it and nothing below is load-bearing.
//   - The <video> POSTER is the LCP candidate, not the stream. A 39 kB JPEG
//     carries first paint; the 741 kB clip arrives after and costs nothing in
//     LCP. That is why a hero loop is affordable here at all.
//   - There is NO email form, deliberately. Sign-up already fires signed_up and
//     email_captured, so a second form would be a second funnel measuring one
//     thing, and every extra field costs conversion.
//
// The board loop is captured, not screen-recorded: an exact 2pi revolution, its
// background composited at the theme token so the clip is frameless and its
// edges are invisible against the field (measured within 1/255 in both themes).
// See docs/beta-media.md. That also means it must stay on the plain field: over
// a section band or a raised surface a rectangle appears.
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { BoardLoop } from "@/components/beta/BetaMedia";
import { BetaCheckSection } from "@/components/beta/BetaCheckSection";

const PROJECT_SLUG = "l1-01-wroom-breakout";
const REV = "v1";
const guideHref = (stage: string) => `/projects/${PROJECT_SLUG}/${REV}/guide/${stage}`;

export const metadata: Metadata = {
  // The visible H1 stays short (bench-hero scales to ~100px and a long title
  // wraps badly); the keyworded string lives here instead.
  title: "Open beta: design a real ESP32-S3 board, free",
  description:
    "L1.01 is finished and free while it is in beta. Design an ESP32-S3 USB-C breakout in KiCad, from requirements to bring-up, and tell us where the course loses you.",
  alternates: { canonical: "/beta" },
  openGraph: {
    title: "Open beta: design a real ESP32-S3 board, free",
    description:
      "Eight gated cards, a final exam, and a board you drew yourself. Free while in beta, in exchange for telling us where it broke.",
    url: "/beta",
  },
};

export default function BetaPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPEN BETA"
        title="Build it for real"
        lead="Free, in exchange for telling us where it broke."
        meta={[
          { label: "COURSE", value: "L1.01" },
          { label: "COST", value: "Free" },
          { label: "STAGES", value: <span className="font-numeral tabular-nums">8</span> },
        ]}
      />

      <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* Frameless on purpose: the clip's background IS the field colour, so a
            border would put a widget around something that should read as the
            object itself. */}
        <BoardLoop className="aspect-video w-full" />
        <div>
          <p className="font-serif text-base text-text">
            An ESP32-S3 USB-C breakout, designed by you in KiCad. The parts a dev
            kit hides are the parts you draw, down to the antenna keep-out.
          </p>
          <div className="mt-6">
            <Link
              href={guideHref("REQUIREMENTS")}
              className="glass-button-cta inline-flex px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em]"
            >
              Start L1.01
            </Link>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Email link · no password · no card
          </p>
        </div>
      </div>

      <ul className="mt-14 border-t border-panel-border/60">
        {[
          [
            "You design it",
            "Requirements to bring-up across eight gated cards. You draw the schematic, lay out the board, and run the checks. Not a kit walkthrough.",
          ],
          [
            "It costs nothing",
            "L1.01 is free and stays free. No card, no trial. An email link is the whole sign-up.",
          ],
          [
            "We want the bad news",
            "Every card carries a report box. Tell us what confused you, what you expected instead, and above all where you stopped.",
          ],
        ].map(([heading, body]) => (
          <li key={heading} className="border-b border-panel-border/60 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
              ▸ {heading}
            </p>
            <p className="mt-2 text-sm text-text">{body}</p>
          </li>
        ))}
      </ul>

      {/* Reads the question out of the published card, and renders it with the
          real QuizBlock in its pure self-check mode. Nothing is recorded. */}
      <BetaCheckSection guideHref={guideHref("SCHEMATIC")} />
    </main>
  );
}
