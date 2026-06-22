// Per-canonical-page DefinedTerm declarations (EMI doc §5). Exactly ONE Library
// page declares a given coined term — one canonical URL, no other page
// re-declares the schema. Keyed by mini-lesson slug: the /library/[slug] route
// emits `definedTermJsonLd` ONLY when the slug has an entry here, so the term is
// claimed on its single canonical home.
//
// `description` is VERBATIM from the term's source doc — never paraphrase (the
// whole point of a vocabulary moat is one stable spelling + definition).
export interface DefinedTermDecl {
  name: string;
  alternateName?: string;
  description: string;
  termSetName: string;
  /** App-relative; the route builds the absolute url from siteUrl(). */
  termSetPath: string;
}

export const LIBRARY_DEFINED_TERMS: Record<string, DefinedTermDecl> = {
  // Embodied Motor Imagery — canonical home is /library/motor-imagery-bci.
  // Description copied verbatim from docs/plans/2026-06-16-emi-vocabulary-moat.md §5.
  "motor-imagery-bci": {
    name: "Embodied Motor Imagery",
    alternateName: "EMI",
    description:
      "One Thousand Drones' approach to non-invasive brain-computer control that uses overtrained, bilateral procedural motor programs as a high-signal, low-variance input — contrasted with standard abstract motor imagery.",
    termSetName: "One Thousand Drones BCI Glossary",
    termSetPath: "/glossary",
  },
};
