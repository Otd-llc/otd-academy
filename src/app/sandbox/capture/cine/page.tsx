// SANDBOX — cinematic cut capture surface. DEV ONLY.
import { notFound } from "next/navigation";
import { CineStage } from "./CineStage";

export default async function CineCapture({
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
      <CineStage
        w={clamp(w, 1600)}
        h={clamp(h, 900)}
        autoplay={autoplay === "1"}
        periodMs={Number(periodMs ?? 11000) || 11000}
      />
    </div>
  );
}
