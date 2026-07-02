// Dynamic Open Graph image for the public guide HUB.
//
// /projects/[slug]/[revLabel]/guide/opengraph-image — the share image for the
// build-guide landing of a project revision. Co-located so Next wires the PNG
// into the hub's `og:image` / `twitter:image` tags automatically.
//
// Runtime: `nodejs` (NOT edge) — reads the project name via Prisma. Every failure
// path (missing project, DB hiccup, bad params) falls back to a valid, on-brand
// PNG instead of throwing, so a crawler's image fetch can never 500. Styling is
// the shared FW7 kit (src/lib/og); this route owns only the data + fallback.

import { renderCard, ShareCard } from "@/lib/og/card";
import { SIZE } from "@/lib/og/tokens";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy build guide";

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

export default async function Image({ params }: { params: Promise<Params> }) {
  let projectName = "One Thousand Drones Academy";
  try {
    const { slug } = await params;
    projectName = await resolveProjectName(slug);
  } catch {
    // keep the default
  }

  return renderCard(
    <ShareCard eyebrow="Build guide" title={projectName} titleSize={88} />,
  );
}
