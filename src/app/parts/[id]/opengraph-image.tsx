// Dynamic Open Graph image for a part detail page (/parts/[id]).
//
// Text-only: a part's committed render asset is a .glb (3D), which Satori can't
// embed, and there is no PNG thumbnail, so the MPN is the hero (Space Mono, the
// registration-mark feel), with the manufacturer + a clamped description and a
// category chip. Runtime: `nodejs` — Prisma. Every failure path (unknown id, DB
// hiccup) falls back to a branded PNG, so a crawler can never 500.

import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Eyebrow,
  DefaultFooter,
  ShareCard,
} from "@/lib/og/card";
import { OG, SIZE } from "@/lib/og/tokens";
import { db } from "@/lib/db";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy part";

type Params = { id: string };

type PartData = {
  mpn: string;
  manufacturer: string;
  description: string;
  category: string | null;
} | null;

async function resolvePart(id: string): Promise<PartData> {
  try {
    const p = await db.part.findUnique({
      where: { id },
      select: {
        mpn: true,
        manufacturer: true,
        description: true,
        categoryRef: { select: { name: true } },
      },
    });
    if (!p) return null;
    return {
      mpn: p.mpn,
      manufacturer: p.manufacturer,
      description: p.description,
      category: p.categoryRef?.name ?? null,
    };
  } catch {
    return null;
  }
}

// Clamp a description to ~140 chars at a word boundary (no trailing glyph — the
// em-dash / ellipsis bans cover placeholders too; a bare stop reads fine).
function clamp(text: string, max = 140): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > 40 ? cut.slice(0, at) : cut).trimEnd()}...`;
}

export default async function Image({ params }: { params: Promise<Params> }) {
  let part: PartData = null;
  try {
    part = await resolvePart((await params).id);
  } catch {
    part = null;
  }

  if (!part) {
    return renderCard(
      <ShareCard eyebrow="Parts" title="Parts catalog" titleSize={92} />,
    );
  }

  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <Eyebrow tri>{part.category ?? "Part"}</Eyebrow>
        <div
          style={{
            display: "flex",
            fontFamily: "Space Mono",
            fontWeight: 700,
            fontSize: 84,
            lineHeight: 1.02,
            color: OG.TITLE,
            maxWidth: 900,
          }}
        >
          {part.mpn}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontFamily: "Space Mono",
            fontSize: 28,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: OG.GOLD_LIGHT,
          }}
        >
          {part.manufacturer}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontFamily: "Space Mono",
            fontSize: 24,
            lineHeight: 1.3,
            color: OG.MUTED,
            maxWidth: 900,
          }}
        >
          {clamp(part.description)}
        </div>
      </div>
      <DefaultFooter />
    </Field>,
  );
}
