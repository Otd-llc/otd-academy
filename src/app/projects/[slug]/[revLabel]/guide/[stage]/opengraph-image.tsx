// Dynamic Open Graph image for a single public lesson card (Task B2).
//
// /projects/[slug]/[revLabel]/guide/[stage]/opengraph-image — Next App Router
// co-locates this with the lesson route; it auto-wires the rendered PNG into the
// `og:image` / `twitter:image` tags (B1's generateMetadata sets the rest), so we
// do NOT reference this file from generateMetadata.
//
// Runtime: `nodejs` (NOT edge) — we read the title via Prisma, which can't run on
// the edge. Data is resolved with tight selects (project name + the card's title
// for the stage). EVERY failure path falls back to a valid, on-brand image: a
// missing project, an unknown stage, or a DB hiccup still returns a 1200×630 PNG
// rather than throwing (a throwing OG route would 500 the crawler's image fetch).
//
// Brand palette pulled from src/app/globals.css @theme tokens:
//   deep-space  #08090d   (near-black navy background)
//   command-gold #c8963e  (accent / "FOUNDRY" wordmark + rule)
//   gold-light  #e8b865   (stage label)
// Fonts: plain system sans (no custom-font fetch — keeps the route robust).

import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import {
  GUIDE_STAGES,
  type GuideStage,
} from "@/lib/guide-templates/stage-skeletons";
import { STAGE_LABELS } from "@/lib/stages";

// Prisma read → must be the Node runtime, not edge.
export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Project Foundry build-guide lesson";

// Brand tokens (kept inline so this file is self-contained / can't drift if the
// theme file moves). Source: src/app/globals.css @theme.
const DEEP_SPACE = "#08090d";
const BG_2 = "#0f1018";
const COMMAND_GOLD = "#c8963e";
const GOLD_LIGHT = "#e8b865";
const PANEL_BORDER = "#3a3f50";
const WHITE = "#ffffff";
const MUTED = "#aaaaaa";

type Params = { slug: string; revLabel: string; stage: string };

function isGuideStage(s: string): s is GuideStage {
  return (GUIDE_STAGES as readonly string[]).includes(s);
}

// Human label for a stage: prefer the curated STAGE_LABELS map (e.g.
// "BOM SOURCING", "DRC + GERBER", "BRING-UP"), else de-underscore the raw value.
function stageLabel(stageUpper: string): string {
  return (
    (STAGE_LABELS as Record<string, string>)[stageUpper] ??
    stageUpper.replace(/_/g, " ")
  );
}

// Resolve only what the image needs, swallowing any DB error → fallback strings.
async function resolveData(params: Params): Promise<{
  projectName: string;
  stageText: string;
}> {
  const stageUpper = (params.stage ?? "").toUpperCase();
  const fallbackStage = stageUpper ? stageLabel(stageUpper) : "BUILD GUIDE";
  try {
    const project = await db.project.findUnique({
      where: { slug: params.slug },
      select: { name: true },
    });
    if (!project) {
      return { projectName: "Project Foundry", stageText: fallbackStage };
    }

    // Prefer the authored card title for the stage; fall back to the label map.
    let stageText = fallbackStage;
    if (isGuideStage(stageUpper)) {
      const decodedLabel = decodeURIComponent(params.revLabel ?? "");
      const card = await db.guideCard.findFirst({
        where: {
          stage: stageUpper,
          guide: {
            revision: {
              project: { slug: params.slug },
              label: { equals: decodedLabel, mode: "insensitive" },
            },
          },
        },
        select: { title: true },
      });
      if (card?.title) stageText = card.title;
    }

    return { projectName: project.name, stageText };
  } catch {
    // DB unavailable / bad params → still emit a branded card.
    return { projectName: "Project Foundry", stageText: fallbackStage };
  }
}

export default async function Image({
  params,
}: {
  params: Promise<Params>;
}) {
  // Even param resolution is guarded so the route can never throw.
  let projectName = "Project Foundry";
  let stageText = "BUILD GUIDE";
  try {
    const resolved = await params;
    const data = await resolveData(resolved);
    projectName = data.projectName;
    stageText = data.stageText;
  } catch {
    // keep the defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: DEEP_SPACE,
          backgroundImage: `radial-gradient(1200px 600px at 80% -10%, ${BG_2} 0%, ${DEEP_SPACE} 60%)`,
          padding: "72px 80px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: WHITE,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 34,
            letterSpacing: 8,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: WHITE }}>PROJECT&nbsp;</span>
          <span style={{ color: COMMAND_GOLD }}>FOUNDRY</span>
        </div>

        {/* Body: stage label + project name */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: GOLD_LIGHT,
              marginBottom: 24,
            }}
          >
            {stageText}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              lineHeight: 1.05,
              fontWeight: 800,
              color: WHITE,
              maxWidth: 1040,
            }}
          >
            {projectName}
          </div>
        </div>

        {/* Footer rule + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              height: 4,
              width: 220,
              backgroundColor: COMMAND_GOLD,
              marginBottom: 20,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Build Guide · Design → Bring-up
          </div>
        </div>

        {/* Gold hairline frame */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: `1px solid ${PANEL_BORDER}`,
            borderRadius: 16,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
