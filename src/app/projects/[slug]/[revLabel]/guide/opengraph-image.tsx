// Dynamic Open Graph image for the public guide HUB (Task B2).
//
// /projects/[slug]/[revLabel]/guide/opengraph-image — the share image for the
// build-guide landing of a project revision. Co-located so Next wires the PNG
// into the hub's `og:image` / `twitter:image` tags automatically (B1 sets the
// rest); no reference needed from generateMetadata.
//
// Runtime: `nodejs` (NOT edge) — reads the project name via Prisma. Every failure
// path (missing project, DB hiccup, bad params) falls back to a valid, on-brand
// 1200×630 PNG instead of throwing, so a crawler's image fetch can never 500.
//
// Brand palette pulled from src/app/globals.css @theme tokens:
//   deep-space  #08090d   command-gold #c8963e   gold-light #e8b865
// Fonts: plain system sans (no custom-font fetch — keeps the route robust).

import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

// Prisma read → must be the Node runtime, not edge.
export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy build guide";

// Brand tokens (inline so this file is self-contained). Source: globals.css @theme.
const DEEP_SPACE = "#08090d";
const BG_2 = "#0f1018";
const COMMAND_GOLD = "#c8963e";
const GOLD_LIGHT = "#e8b865";
const PANEL_BORDER = "#3a3f50";
const WHITE = "#ffffff";
const MUTED = "#aaaaaa";

type Params = { slug: string; revLabel: string };

// Resolve only the project name, swallowing any DB error → branded fallback.
async function resolveProjectName(slug: string): Promise<string> {
  try {
    const project = await db.project.findUnique({
      where: { slug },
      select: { name: true },
    });
    return project?.name ?? "One Thousand Drones Academy";
  } catch {
    return "One Thousand Drones Academy";
  }
}

export default async function Image({
  params,
}: {
  params: Promise<Params>;
}) {
  let projectName = "One Thousand Drones Academy";
  try {
    const { slug } = await params;
    projectName = await resolveProjectName(slug);
  } catch {
    // keep the default
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
            letterSpacing: 6,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: WHITE }}>ONE THOUSAND DRONES&nbsp;</span>
          <span style={{ color: COMMAND_GOLD }}>ACADEMY</span>
        </div>

        {/* Body: eyebrow + project name */}
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
            Build Guide
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
            Design → Bring-up · Hands-on hardware
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
