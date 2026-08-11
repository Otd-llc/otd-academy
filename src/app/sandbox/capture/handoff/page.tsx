// SANDBOX — the sandboxed handoff, framed for offline capture. DEV ONLY.
//
// THIS IS THE RIG FROM /sandbox/edge, NOT A REBUILD. The cut was assembling two
// separately-rendered clips, stack.mp4 and board.mp4, with a hard cut between
// them at 4.0 s. That is why the gerbers never became the board on screen: the
// collapse-to-thickness and the cross-fade on a shared turntable only ever
// existed in the sandbox. Importing the same component is the point; a
// reimplementation for capture would be a second thing to keep in sync.
//
// The look is passed in rather than defaulted, so the render is the CHOSEN one:
//   ?angle=hero&profile=constant&fade=0.5   -> hero lens, flat 30 deg/s, 1000 ms
import { notFound } from "next/navigation";
import { HandoffRig } from "../../edge/HandoffRig";
import type { SpinProfile } from "../../edge/spin";

type Q = { w?: string; h?: string; angle?: string; profile?: string; fade?: string };

export default function HandoffCapture({ searchParams }: { searchParams: Promise<Q> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <Stage searchParams={searchParams} />;
}

async function Stage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const w = Number(q.w ?? 1920);
  const h = Number(q.h ?? 1080);
  return (
    <div style={{ margin: 0, background: "#08090d", width: w, height: h, overflow: "hidden" }}>
      {/* blurScale 1: an offline render has no frame deadline, so it should not
          inherit the reduced-resolution sub-samples the preview needs. */}
      <HandoffRig
        w={w}
        h={h}
        blurScale={1}
        capture
        initialAngle={q.angle ?? "hero"}
        initialProfile={(q.profile as SpinProfile) ?? "constant"}
        initialFade={Number(q.fade ?? 0.5)}
      />
    </div>
  );
}
