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

// Serialize a JSON-LD object for safe embedding inside an inline HTML
// `<script type="application/ld+json">`. Plain `JSON.stringify` does NOT escape
// `<`, `>`, `&` or the U+2028/U+2029 line separators, so a value containing
// `</script>` (a project name, card title/lead, step text, …) would terminate
// the <script> element and inject live HTML/JS — a stored-XSS sink on a public
// page. Escaping these as `\uXXXX` is value-preserving for JSON-LD consumers:
// `<` is valid JSON that parses straight back to `<`.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// The public site origin (no trailing slash) — the same base as layout's
// metadataBase. JSON-LD `item`/`url` fields must be ABSOLUTE, so the pages build
// `${siteUrl()}${path}` for breadcrumb/itemList entries.
export function siteUrl(): string {
  const base = env.NEXT_PUBLIC_SITE_URL ?? "https://academy.onethousanddrones.com";
  return base.replace(/\/$/, "");
}
const PROVIDER = {
  "@type": "Organization",
  name: "One Thousand Drones",
} as const;

// The brand's official profiles. Emitted as `sameAs` on the site-wide
// Organization node so search engines bind the website, the social accounts,
// and the entity into one Knowledge-Graph identity (entity SEO / E-E-A-T).
export const SOCIAL_LINKS = [
  "https://x.com/1KDrones",
  "https://www.youtube.com/@1kDrones",
  "https://github.com/Otd-llc",
  "https://www.linkedin.com/company/one-thousand-drones",
] as const;

// One Thousand Drones LLC's verifiable federal registrations. Real, checkable
// identifiers (SAM.gov / DLA CAGE) are a strong organizational trust signal
// (E-E-A-T) and are already printed publicly on the capability briefs.
export const ORG_IDENTIFIERS = [
  { name: "CAGE", value: "1ZYS4" },
  { name: "UEI", value: "WDQXD9L9UFH3" },
] as const;

// The named human accountable for the work — the strongest E-E-A-T signal (a
// real person, not just a brand). Rendered as the /about byline + the
// Organization `founder`.
export const FOUNDER_NAME = "Joshua Tollette";

// One Thousand Drones LLC's registered business address (registered-agent
// address, public record). Emitted as the Organization `address` and shown on
// /about. Kept as one source of truth so the schema and the visible page match.
export const ORG_ADDRESS = {
  streetAddress: "9905 S Pennsylvania Ave, Ste A",
  addressLocality: "Oklahoma City",
  addressRegion: "OK",
  postalCode: "73159",
  addressCountry: "US",
} as const;

// The subject-matter the org demonstrably works in — binds the entity to its
// topics in the knowledge graph (entity SEO / E-E-A-T `knowsAbout`).
const ORG_KNOWS_ABOUT = [
  "Printed circuit board design",
  "KiCad",
  "ESP32-S3",
  "Embedded systems",
  "Schematic capture",
  "PCB layout",
  "Electronics manufacturing",
] as const;

// Site-wide Organization node (rendered once in the root layout). Carries the
// canonical name + url + `sameAs`, plus the verifiable federal identifiers and
// `knowsAbout` topics, so every page reinforces the same trusted entity.
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl()}/#organization`,
    name: "One Thousand Drones",
    legalName: "One Thousand Drones LLC",
    url: siteUrl(),
    description:
      "One Thousand Drones Academy teaches printed-circuit-board engineering through real ESP32-S3 projects designed in KiCad, where progress is gated on a clean design-rule check rather than quizzes.",
    founder: { "@type": "Person", name: FOUNDER_NAME },
    address: { "@type": "PostalAddress", ...ORG_ADDRESS },
    sameAs: [...SOCIAL_LINKS],
    knowsAbout: [...ORG_KNOWS_ABOUT],
    identifier: ORG_IDENTIFIERS.map((id) => ({
      "@type": "PropertyValue",
      name: id.name,
      value: id.value,
    })),
  };
}

// AboutPage — the /about trust surface. References the site-wide Organization
// node by @id (declared once in the layout) instead of re-declaring it, so the
// knowledge-graph entity stays single-source. PURE.
export function aboutPageJsonLd(input: { url: string }): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "AboutPage",
    url: input.url,
    mainEntity: { "@id": `${siteUrl()}/#organization` },
  };
}

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

// Product — a parts-catalog entry as schema.org Product (rendered on the public
// `/parts/[id]` detail page). `name`/`mpn` are the manufacturer part number;
// `brand` is the manufacturer; `category` is the human label; `datasheetUrl`,
// when present, is attached as a `subjectOf` CreativeWork. Optional fields are
// omitted (never advertised empty). PURE — takes already-resolved scalars.
export function productJsonLd(input: {
  mpn: string;
  manufacturer: string;
  description: string | null;
  category: string | null;
  url: string;
  datasheetUrl: string | null;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: input.mpn,
    mpn: input.mpn,
    brand: { "@type": "Brand", name: input.manufacturer },
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.datasheetUrl
      ? {
          subjectOf: {
            "@type": "CreativeWork",
            name: "Datasheet",
            url: input.datasheetUrl,
          },
        }
      : {}),
  };
}

// Product + Offer — a sellable item on the /pricing storefront (the All-Access
// Pass, or a representative single project). `priceCents` is the price actually
// offered right now (launch price while the window is open). Emits a schema.org
// Offer with `priceCurrency: "USD"` and the decimal price; `availability` is
// InStock (a digital product is always available). PURE — takes resolved scalars.
export function productOfferJsonLd(input: {
  name: string;
  description: string | null;
  url: string;
  priceCents: number;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: input.name,
    url: input.url,
    brand: { "@type": "Brand", name: "One Thousand Drones" },
    ...(input.description ? { description: input.description } : {}),
    offers: {
      "@type": "Offer",
      price: (input.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: input.url,
    },
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

// TechArticle — a public Library mini-lesson as a technical article. Schema is
// SEO hygiene (no rich-result / ranking lift per the 2026-06 validation) — keep
// it minimal + accurate. PURE: takes resolved scalars, not a Prisma row.
export function techArticleJsonLd(input: {
  headline: string;
  description: string | null;
  url: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "TechArticle",
    headline: input.headline,
    mainEntityOfPage: input.url,
    publisher: PROVIDER,
    ...(input.description ? { description: input.description } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.authorName
      ? { author: { "@type": "Organization", name: input.authorName } }
      : {}),
  };
}

// LearningResource — the same page as an educational resource (pairs with the
// TechArticle; both are hygiene-level). `educationalLevel` omitted when absent.
export function learningResourceJsonLd(input: {
  name: string;
  description: string | null;
  url: string;
  educationalLevel?: string | null;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "LearningResource",
    name: input.name,
    url: input.url,
    provider: PROVIDER,
    ...(input.description ? { description: input.description } : {}),
    ...(input.educationalLevel ? { educationalLevel: input.educationalLevel } : {}),
  };
}

// VideoObject — a `youtube` content block as schema.org VideoObject, so an
// embedded lesson video is eligible for video rich results and is bound to the
// page as its own entity (not just YouTube's). Takes the bare, schema-validated
// videoId and derives the three URLs: the YouTube-CDN thumbnail, the
// youtube-nocookie embed (matches the renderer), and the canonical watch URL.
// `description` falls back to `name` so the node is never description-less
// (Google recommends one). `uploadDate` is required for rich-result eligibility
// but not derivable from the id, so it is optional here and omitted when the
// author has not supplied it (the node stays valid, just hygiene-level). PURE.
export function videoObjectJsonLd(input: {
  name: string;
  description: string | null;
  videoId: string;
  uploadDate?: string | null;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "VideoObject",
    name: input.name,
    description: input.description ?? input.name,
    thumbnailUrl: `https://i.ytimg.com/vi/${input.videoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${input.videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${input.videoId}`,
    ...(input.uploadDate ? { uploadDate: input.uploadDate } : {}),
  };
}

// DefinedTerm — claims authorship of a coined term (e.g. "Embodied Motor
// Imagery"). Emitted on ONE canonical page only; every other mention links to
// that url, none re-declare the schema (EMI doc §5).
export function definedTermJsonLd(input: {
  name: string;
  alternateName?: string;
  description: string;
  url: string;
  termSetName: string;
  termSetUrl: string;
}): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "DefinedTerm",
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: input.termSetName,
      url: input.termSetUrl,
    },
  };
}
