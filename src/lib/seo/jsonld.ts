// Pure JSON-LD builders for the public SEO surface (schema.org structured data).
//
// Each builder returns a plain JSON-serializable object with
// `"@context": "https://schema.org"`. They take ALREADY-RESOLVED fields (never a
// Prisma row), so they stay pure and unit-testable; the RSC pages resolve the DB
// data and hand the scalars in. The objects are emitted into the page via the
// `<JsonLd>` component (`src/components/seo/JsonLd.tsx`).

import type { ContentBlock } from "@/lib/schemas/guide";
import { env } from "@/env";

const SCHEMA_CONTEXT = "https://schema.org" as const;

// The public site origin (no trailing slash) — the same base as layout's
// metadataBase. JSON-LD `item`/`url` fields must be ABSOLUTE, so the pages build
// `${siteUrl()}${path}` for breadcrumb/itemList entries.
export function siteUrl(): string {
  const base = env.NEXT_PUBLIC_SITE_URL ?? "https://foundry.onethousanddrones.com";
  return base.replace(/\/$/, "");
}
const PROVIDER = {
  "@type": "Organization",
  name: "One Thousand Drones",
} as const;

// Course — the project-as-course summary (rendered on the guide hub). Maps the
// curriculum `level` to schema.org `educationalLevel` when present; omits it
// otherwise so we never advertise an empty value.
export function courseJsonLd(input: {
  name: string;
  description: string | null;
  level?: string | null;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Course",
    name: input.name,
    description: input.description ?? undefined,
    provider: PROVIDER,
    ...(input.level ? { educationalLevel: input.level } : {}),
  };
}

// BreadcrumbList — the navigational trail (Home › Courses › Project › Stage).
// `items` are pre-built {name, absolute-url}; positions are 1-indexed per spec.
export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}

// HowTo — one guide card rendered as a how-to. The card's `steps` content blocks
// (`{ type: "steps", ordered, items: string[] }`, see
// `src/lib/schemas/guide.ts`) are the ordered instructions: each string item
// becomes a `HowToStep` { text }. Multiple steps blocks are concatenated in
// document order. A card with no steps block yields a valid HowTo with `step`
// omitted. PURE — takes the already-extracted card fields, not the DB row.
// (BOM → `supply` enrichment is intentionally out of scope for this cut.)
export function guideCardToHowTo(input: {
  cardTitle: string;
  cardLead: string | null;
  contentBlocks: ContentBlock[];
}): object {
  const steps = input.contentBlocks
    .filter(
      (b): b is Extract<ContentBlock, { type: "steps" }> => b.type === "steps",
    )
    .flatMap((b) => b.items)
    .map((text) => ({ "@type": "HowToStep", text }));

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "HowTo",
    name: input.cardTitle,
    description: input.cardLead ?? undefined,
    ...(steps.length > 0 ? { step: steps } : {}),
  };
}

// ItemList — the `/courses` index as an ordered list of Course links. Inline
// builder (kept here so all JSON-LD shapes live together + are testable). Each
// item is a positioned ListItem pointing at the course's absolute guide URL.
export function courseListJsonLd(
  items: { name: string; url: string }[],
): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    itemListElement: items.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.name,
      url: entry.url,
    })),
  };
}
