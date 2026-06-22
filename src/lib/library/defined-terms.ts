// Per-canonical-page DefinedTerm declarations, keyed by mini-lesson slug: the
// /library/[slug] route emits `definedTermJsonLd` ONLY when the slug has an entry
// here. The mechanism is generic.
//
// DISCLOSURE POLICY (locked 2026-06-22): the academy Library is GENERIC EDUCATION
// ONLY. OTD's coined vocabulary moat (e.g. "Embodied Motor Imagery") lives on the
// apex site / whitepaper — NOT here — so it is intentionally absent from this map.
// Only add an entry for a term that is genuinely generic/educational and that OTD
// is content to define publicly from the academy. Do NOT add proprietary
// moat terms here. See the disclosure guardrail in the implementation plan.
export interface DefinedTermDecl {
  name: string;
  alternateName?: string;
  description: string;
  termSetName: string;
  /** App-relative; the route builds the absolute url from siteUrl(). */
  termSetPath: string;
}

export const LIBRARY_DEFINED_TERMS: Record<string, DefinedTermDecl> = {};
