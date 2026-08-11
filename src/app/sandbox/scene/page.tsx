// SANDBOX — the whole beta set, running live. DEV ONLY, deleted before the PR.
//
// The three motion pieces at the timings and parameters that were actually
// captured, so what is on screen here is what is in `out/beta-set/`. Live
// three.js rather than the encoded mp4s, because the point of this page is
// judging the motion, not the encode.
//
// These are three separate loops, not a cut. Assembling them into one film is a
// later job and a different set of decisions.
import { notFound } from "next/navigation";
import { BoardStage } from "../capture/board/BoardStage";
import { StackStage } from "../capture/stack/StackStage";
import { RevealStage } from "../capture/reveal/RevealStage";
import { PanelWrap } from "./PanelWrap";
import { CineStage } from "../capture/cine/CineStage";
import { ThemeToggle } from "./ThemeToggle";

const W = 1100;
const H = 620;

function Piece({
  id,
  note,
  spec,
  children,
}: {
  id: string;
  note: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <section data-opt={id} className="mx-auto mt-16 max-w-5xl px-4 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-blue">{id}</p>
      <p className="mt-1 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {note}
      </p>
      <div className="mt-4 border-t border-signal-blue/30" />
      <div className="mt-6" style={{ width: W, height: H, maxWidth: "100%" }}>
        {children}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">{spec}</p>
    </section>
  );
}

export default function BetaSetSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <ThemeToggle note="Live three.js at the captured parameters · three loops, not a cut" />

      <Piece
        id="1 · BOARD TURNTABLE"
        note="The shipped /beta hero. One exact revolution, 30 degrees per second"
        spec="12 s · 741 / 748 kB encoded · seam drift 0.18%"
      >
        <BoardStage src="/_capture/l1-01.glb" w={W} h={H} autoplay periodMs={12000} />
      </Piece>

      <Piece
        id="2 · GERBER EXPLODE (V1)"
        note="Eight real answer-key sheets, out and back, one turn. The plain glide you picked"
        spec="7 s · 697 / 827 kB · seam drift 0.01% · tiltX -0.34, gap 7.5, stagger 0, ease 2"
      >
        <StackStage
          w={W}
          h={H}
          tiltX={-0.34}
          rotZ={0.04}
          gap={7.5}
          autoplay
          periodMs={7000}
          spinTurns={1}
        />
      </Piece>

      <Piece
        id="3 · CINEMATIC CUT"
        note="Pushed in, following the cursor to the last answer · the academy's own fanfare · the certificate spins in as a 3D object"
        spec="11 s loop · beats 1 and 3 are 3D, beat 2 is the real captured celebration"
      >
        <CineStage w={W} h={H} autoplay periodMs={11000} />
      </Piece>

      <Piece
        id="3a · STRAIGHT CAPTURE, FOR COMPARISON"
        note="Answer the last question, submit, the app plays its OWN celebration. Nothing rebuilt: this is CertificateReveal, the component ExamForm swaps in on a pass"
        spec="5.5 s · 103 kB · synthetic cursor · signin-rise driven on the virtual clock"
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent UI capture */}
        <video
          src="/_capture/finish-dark.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-contain"
        />
      </Piece>

      <Piece
        id="3b · THE SAME FOOTAGE ON A PANEL"
        note="Identical capture, wrapped on a rotating panel over a deep-space field. Same content, so the only variable is the treatment"
        spec="Live three.js · compare against 3a"
      >
        <PanelWrap src="/_capture/finish-dark.mp4" w={W} h={H} />
      </Piece>

      <Piece
        id="3c · THE OLD ONE, FOR REFERENCE"
        note="What it looked like before: a 4496 px scroll through the whole exam and an invented gold ring. The fanfare already existed and this did not use it"
        spec="14 s · superseded"
      >
        <RevealStage w={W} h={H} autoplay periodMs={14000} />
      </Piece>

      <div className="mx-auto mt-16 max-w-5xl px-4 pb-24 sm:px-6">
        <div className="border-t border-panel-border/60 pt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            ▸ What is here and what is not
          </p>
          <ul className="mt-4 space-y-2 text-sm text-text">
            <li>
              Three loops at the captured parameters. The encoded pairs live in
              the promo repo under <code>out/beta-set/</code>, with an inventory
              in <code>docs/asset-inventory.md</code>.
            </li>
            <li>
              Fifteen stills are not shown here: they are flat page captures, and
              a still needs no preview.
            </li>
            <li>
              No cut. Joining these into one film is a separate set of decisions
              (order, bed, joins) and none of it has been made.
            </li>
            <li>
              Live is the wrong shipping choice for all three. This page costs
              three.js plus a 5 MB GLB and runs three GPU loops at once; the
              encoded clips start from a 39 kB poster and cost nothing after
              decode.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
