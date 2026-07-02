// Dynamic Open Graph image for a course landing (/courses/[slug]).
//
// Runtime: `nodejs` — reads the course via Prisma. Every failure path (unknown
// slug, DB hiccup, missing fields) falls back to a valid branded PNG, so a
// crawler can never 500. Styling is the shared FW7 kit; the course's level is its
// right-side datum (the honeycomb hex), so it stands in for the ivory-ghost
// watermark when known.

import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Eyebrow,
  CardTitle,
  HexBadge,
  DefaultFooter,
} from "@/lib/og/card";
import { OG, SIZE } from "@/lib/og/tokens";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy course";

type Params = { slug: string };

type CourseData = {
  title: string;
  tagline: string | null;
  track: string | null;
  level: string | null; // "L1" | "L2" | "L3"
  tier: "PUBLIC" | "FREE" | "PREMIUM";
};

async function resolveCourse(slug: string): Promise<CourseData> {
  const fallback: CourseData = {
    title: "One Thousand Drones Academy",
    tagline: null,
    track: null,
    level: null,
    tier: "FREE",
  };
  try {
    const c = await db.project.findUnique({
      where: { slug },
      select: {
        name: true,
        publicTitle: true,
        tagline: true,
        track: true,
        level: true,
        accessTier: true,
      },
    });
    if (!c) return fallback;
    return {
      title: c.publicTitle ?? c.name,
      tagline: c.tagline,
      track: c.track,
      level: c.level,
      tier: c.accessTier,
    };
  } catch {
    return fallback;
  }
}

// PREMIUM reads as a paid chip (gold fill); everything else is "free to read"
// (gold outline). The money bar is what matters on a share card.
function AccessChip({ tier }: { tier: CourseData["tier"] }) {
  const strong = tier === "PREMIUM";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: `1px solid ${OG.COMMAND_GOLD}`,
        borderRadius: 6,
        padding: "6px 16px",
        fontFamily: "Space Mono",
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: 3,
        textTransform: "uppercase",
        color: strong ? OG.DEEP_SPACE : OG.COMMAND_GOLD,
        backgroundColor: strong ? OG.COMMAND_GOLD : "transparent",
      }}
    >
      {strong ? "Premium" : "Free"}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<Params> }) {
  let data: CourseData = {
    title: "One Thousand Drones Academy",
    tagline: null,
    track: null,
    level: null,
    tier: "FREE",
  };
  try {
    const { slug } = await params;
    data = await resolveCourse(slug);
  } catch {
    // keep the default
  }

  const levelNum = data.level ? data.level.replace(/^L/i, "") : null;
  const eyebrow =
    data.track && data.level
      ? `${data.track} · ${data.level}`
      : (data.track ?? data.level ?? "Course");

  return renderCard(
    <Field wash frame={false}>
      {levelNum ? null : <IvoryGhost />}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Wordmark />
        <AccessChip tier={data.tier} />
      </div>
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
          <Eyebrow tri>{eyebrow}</Eyebrow>
          <CardTitle size={62} maxWidth={levelNum ? 620 : 780}>
            {data.title}
          </CardTitle>
          {data.tagline ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontFamily: "Space Mono",
                fontSize: 24,
                letterSpacing: 1,
                color: OG.MUTED,
                maxWidth: levelNum ? 620 : 820,
              }}
            >
              {data.tagline}
            </div>
          ) : null}
        </div>
        {levelNum ? <HexBadge n={levelNum} size={300} /> : null}
      </div>
      <DefaultFooter />
    </Field>,
  );
}
