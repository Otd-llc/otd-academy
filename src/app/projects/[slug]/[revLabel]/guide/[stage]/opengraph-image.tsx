// Dynamic Open Graph image for a single public lesson card.
//
// /projects/[slug]/[revLabel]/guide/[stage]/opengraph-image — Next co-locates
// this with the lesson route; it auto-wires the rendered PNG into the og:image /
// twitter:image tags.
//
// Runtime: `nodejs` (NOT edge) — reads the title via Prisma. Data is resolved
// with tight selects. EVERY failure path (missing project, unknown stage, DB
// hiccup) falls back to a valid, on-brand PNG rather than throwing, so a crawler
// can never 500. Styling is the shared FW7 kit (src/lib/og); this route owns only
// the data resolution + fallback, plus the stage comb readout.

import type { ReactNode } from "react";
import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Center,
  CardTitle,
  DefaultFooter,
} from "@/lib/og/card";
import { OG, SIZE } from "@/lib/og/tokens";
import { db } from "@/lib/db";
import {
  GUIDE_STAGES,
  type GuideStage,
} from "@/lib/guide-templates/stage-skeletons";
import { STAGE_LABELS } from "@/lib/stages";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy build-guide lesson";

type Params = { slug: string; revLabel: string; stage: string };

function isGuideStage(s: string): s is GuideStage {
  return (GUIDE_STAGES as readonly string[]).includes(s);
}

// Human label for a stage: prefer the curated STAGE_LABELS map, else de-underscore.
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
      return {
        projectName: "One Thousand Drones Academy",
        stageText: fallbackStage,
      };
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
    return {
      projectName: "One Thousand Drones Academy",
      stageText: fallbackStage,
    };
  }
}

// The comb position: mono "STAGE" + Saira numerals + a mono board separator.
// `·` (never an em-dash). Saira numerals are the readout's numeral moment.
function StageReadout({ n, total }: { n: number | null; total: number }) {
  const num = (v: ReactNode) => (
    <span
      style={{
        display: "flex",
        fontFamily: "Saira Condensed",
        fontWeight: 800,
        fontSize: 40,
        color: OG.COMMAND_GOLD,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {v}
    </span>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: "Space Mono",
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: 5,
        textTransform: "uppercase",
        color: OG.GOLD_LIGHT,
        marginBottom: 22,
      }}
    >
      <span style={{ display: "flex" }}>Stage&nbsp;</span>
      {n ? num(n) : null}
      {n ? <span style={{ display: "flex" }}>&nbsp;/&nbsp;</span> : null}
      {num(total)}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<Params> }) {
  let projectName = "One Thousand Drones Academy";
  let stageText = "BUILD GUIDE";
  let n: number | null = null;
  const total = GUIDE_STAGES.length;
  try {
    const resolved = await params;
    const data = await resolveData(resolved);
    projectName = data.projectName;
    stageText = data.stageText;
    const stageUpper = (resolved.stage ?? "").toUpperCase();
    if (isGuideStage(stageUpper)) {
      n = (GUIDE_STAGES as readonly string[]).indexOf(stageUpper) + 1;
    }
  } catch {
    // keep the defaults
  }

  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <Center>
        <StageReadout n={n} total={total} />
        <CardTitle size={56} maxWidth={760}>
          {stageText}
        </CardTitle>
      </Center>
      <DefaultFooter tagline={projectName} />
    </Field>,
  );
}
