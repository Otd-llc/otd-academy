// SANDBOX — gerber stack explode capture surface. DEV ONLY, deleted before the PR.
import { notFound } from "next/navigation";
import { StackStage } from "./StackStage";

export default async function StackCapture({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; h?: string; tiltX?: string; rotZ?: string; gap?: string; flipY?: string; frontFirst?: string; only?: string; faceFront?: string; spinTurns?: string; stagger?: string; easePow?: string; tiltSwing?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { w, h, tiltX, rotZ, gap, flipY, frontFirst, only, faceFront, spinTurns, stagger, easePow, tiltSwing } = await searchParams;
  const num = (v: string | undefined, d: number) => (v === undefined ? d : Number(v) || d);
  const clamp = (v: string | undefined, d: number) =>
    Math.min(Math.max(Number(v ?? d) || d, 256), 2560);

  return (
    <div style={{ margin: 0, padding: 0, background: "transparent", display: "inline-block", lineHeight: 0 }}>
      <StackStage
        w={clamp(w, 1600)}
        h={clamp(h, 900)}
        tiltX={num(tiltX, -0.34)}
        rotZ={num(rotZ, 0.06)}
        gap={num(gap, 5.2)}
        flipY={flipY !== "0"}
        frontFirst={frontFirst !== "0"}
        only={only}
        faceFront={faceFront === "1"}
        spinTurns={num(spinTurns, 0)}
        stagger={num(stagger, 0)}
        easePow={num(easePow, 2)}
        tiltSwing={num(tiltSwing, 0)}
      />
    </div>
  );
}
