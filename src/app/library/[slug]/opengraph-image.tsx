// Dynamic Open Graph image for a Library mini-lesson (/library/[slug]).
//
// The differentiator: the lesson's first diagram ON the card. A Library image
// block's `src` is the diagram registry key (`/guide-diagrams/<name>.svg`); the
// export pipeline commits a dark `<name>.png` raster (Satori/resvg embed PNG
// reliably; WebP is not guaranteed), which we read and embed as a data URI.
//
// Runs on the default Node runtime (fs). Every failure path (unknown slug, no
// diagram, unreadable raster) degrades to the text-only FW7 card or the branded
// fallback, so a crawler can never 500.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Eyebrow,
  CardTitle,
  DefaultFooter,
} from "@/lib/og/card";
import { OG, SIZE } from "@/lib/og/tokens";
import { loadLessonCardMeta } from "@/lib/library/load";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy library lesson";

type Params = { slug: string };

// PNG IHDR: width big-endian uint32 at byte 16, height at 20. null if not a PNG.
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

type Diagram = { dataUri: string; ratio: number };

// A hero diagram src → its DARK committed raster, embedded. Null if the lesson has
// no diagram or the raster can't be read (→ text-only card).
//
// Takes the stored `diagramSrc` rather than re-deriving it from contentBlocks: the
// column is computed by firstDiagramSrc on write (src/lib/library/derived.ts), which
// is the identical "first image block under /guide-diagrams/" rule this used to
// re-implement inline.
async function resolveDarkDiagram(src: string | null): Promise<Diagram | null> {
  if (!src) return null;
  const name = src.replace(/^\/guide-diagrams\//, "").replace(/\.svg$/, "");
  const file = path.join(process.cwd(), "public", "guide-diagrams", `${name}.png`);
  try {
    const buf = await readFile(file);
    const dim = pngSize(buf);
    return {
      dataUri: `data:image/png;base64,${buf.toString("base64")}`,
      ratio: dim && dim.h > 0 ? dim.w / dim.h : 1.6,
    };
  } catch {
    return null;
  }
}

type LessonData = { title: string; diagram: Diagram | null };

// Reads the SHARED cached lesson rows rather than issuing its own query. This route
// is hit once per lesson (69 today) by crawlers and social unfurlers, and it used to
// SELECT contentBlocks — the fat column the index deliberately stopped selecting —
// just to re-derive the hero diagram src that `diagramSrc` already stores. Now it
// costs no DB read at all beyond the index's own hourly one.
async function resolveLesson(slug: string): Promise<LessonData> {
  try {
    const lesson = await loadLessonCardMeta(slug);
    if (!lesson) return { title: "One Thousand Drones Academy", diagram: null };
    return {
      title: lesson.title,
      diagram: await resolveDarkDiagram(lesson.diagramSrc),
    };
  } catch {
    return { title: "One Thousand Drones Academy", diagram: null };
  }
}

// Fit a diagram (aspect `ratio`) inside a maxW × maxH box, preserving ratio.
function fit(ratio: number, maxW: number, maxH: number): { w: number; h: number } {
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

export default async function Image({ params }: { params: Promise<Params> }) {
  let data: LessonData = { title: "One Thousand Drones Academy", diagram: null };
  try {
    const { slug } = await params;
    data = await resolveLesson(slug);
  } catch {
    // keep the default
  }

  const diagram = data.diagram;
  const box = diagram ? fit(diagram.ratio, 480, 420) : null;

  return renderCard(
    <Field wash frame={false}>
      {diagram ? null : <IvoryGhost />}
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
            paddingRight: 44,
          }}
        >
          <Eyebrow tri>Library</Eyebrow>
          <CardTitle size={diagram ? 60 : 78} maxWidth={diagram ? 540 : 820}>
            {data.title}
          </CardTitle>
        </div>
        {diagram && box ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 520,
              height: 440,
              backgroundColor: OG.DIAGRAM_SURFACE,
              border: `1px solid ${OG.PANEL_BORDER}`,
              borderRadius: 14,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={diagram.dataUri} width={box.w} height={box.h} alt="" />
          </div>
        ) : null}
      </div>
      <DefaultFooter />
    </Field>,
  );
}
