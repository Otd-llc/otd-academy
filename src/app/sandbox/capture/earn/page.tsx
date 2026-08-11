// SANDBOX - the EARN card, framed for offline capture. DEV ONLY.
//
// The push-in, and NO TYPE. The cut draws EARN, the ask and the link from its
// own cue layer, so baking type in here would double it. This route exists only
// so the beat renders from the same component the layout was chosen from rather
// than from a second implementation.
//
// ?format=<name>. The card's size and position come from the shared placement
// rule, which is also what places the type over it, so the two cannot disagree
// about the frame they share.
import { notFound } from "next/navigation";
import { SPECS, type Format } from "../cut/earn-place";
import { SpaceStage } from "../../space/SpaceStage";

type Q = { format?: string };

export default function EarnCapture({ searchParams }: { searchParams: Promise<Q> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <Stage searchParams={searchParams} />;
}

async function Stage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const f = (q.format && q.format in SPECS ? q.format : "wide") as Format;
  const { w, h } = SPECS[f];
  return (
    <div style={{ margin: 0, background: "#08090d", width: w, height: h, overflow: "hidden" }}>
      <SpaceStage id="g" format={f} capture />
    </div>
  );
}
