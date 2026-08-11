// SANDBOX — reveal capture surface. DEV ONLY, deleted before the PR.
import { notFound } from "next/navigation";
import { RevealStage } from "./RevealStage";

export default async function RevealCapture({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; h?: string; autoplay?: string; periodMs?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { w, h, autoplay, periodMs } = await searchParams;
  const clamp = (v: string | undefined, d: number) =>
    Math.min(Math.max(Number(v ?? d) || d, 256), 2560);
  return (
    <div style={{ margin: 0, padding: 0, background: "transparent", display: "inline-block", lineHeight: 0 }}>
      <RevealStage
        w={clamp(w, 1600)}
        h={clamp(h, 900)}
        autoplay={autoplay === "1"}
        periodMs={Number(periodMs ?? 14000) || 14000}
      />
    </div>
  );
}
