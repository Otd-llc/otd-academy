// SANDBOX - the 10 s cut, all five form factors. DEV ONLY.
//
// ?format=<name>, not ?w=&h=&safe=. The old signature let a caller ask for
// 1080x1920 and quietly get wide's type placement over a centre-cropped 16:9
// picture, which looks like a framing bug rather than a wrong argument. A
// format name resolves to all of it at once: size, safe rows, word scale, where
// the certificate sits, and which picture to load.
import { notFound } from "next/navigation";
import { CutStage } from "./CutStage";
import { SPECS, type Format } from "./earn-place";

export default async function CutCapture({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; autoplay?: string; seam?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { format, autoplay, seam } = await searchParams;
  const f = (format && format in SPECS ? format : "wide") as Format;
  return (
    <div style={{ margin: 0, padding: 0, display: "inline-block", lineHeight: 0 }}>
      <CutStage
        format={f}
        autoplay={autoplay === "1"}
        // ?seam=<id> so the loop stitch can be compared without a rebuild.
        seam={seam}
      />
    </div>
  );
}
