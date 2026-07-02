// Font buffers for the share-card kit (Task 1).
//
// ImageResponse (Satori) needs raw font buffers — it can't reach the Google CSS
// imports globals.css uses for the live site. So the three brand faces are
// VENDORED as static OFL TTFs under ./fonts and read once from disk here, cached
// for the process. All three are Open Font License (committable):
//   Bebas Neue        — display / wordmark / titles (single weight, 400)
//   Saira Condensed   — the numeral face (ExtraBold 800; tabular readouts, hex)
//   Space Mono        — mono eyebrows / labels (400 + 700)
//
// Node runtime only (fs) — every OG route that consumes the kit sets
// `runtime = "nodejs"`.

import { readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.join(process.cwd(), "src/lib/og/fonts");

// next/og font descriptor shape.
type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 800;
  style: "normal";
};

let cache: OgFont[] | null = null;

// Load + cache the four buffers. Regular and Bold mono register under the SAME
// family name ("Space Mono") with distinct weights, so CSS selects bold via
// `fontWeight: 700`. Saira registers at 800 — its CSS callers MUST set
// `fontWeight: 800` or Satori won't match it.
export async function ogFonts(): Promise<OgFont[]> {
  if (cache) return cache;
  const [bebas, saira, mono, monoBold] = await Promise.all([
    readFile(path.join(dir, "BebasNeue-Regular.ttf")),
    readFile(path.join(dir, "SairaCondensed-ExtraBold.ttf")),
    readFile(path.join(dir, "SpaceMono-Regular.ttf")),
    readFile(path.join(dir, "SpaceMono-Bold.ttf")),
  ]);
  cache = [
    { name: "Bebas Neue", data: bebas, weight: 400, style: "normal" },
    { name: "Saira Condensed", data: saira, weight: 800, style: "normal" },
    { name: "Space Mono", data: mono, weight: 400, style: "normal" },
    { name: "Space Mono", data: monoBold, weight: 700, style: "normal" },
  ];
  return cache;
}
