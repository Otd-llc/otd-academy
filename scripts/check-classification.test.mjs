// Self-test for the classification guard's detection predicate.
// Run: `node --test scripts/check-classification.test.mjs` (no deps; not part of
// the vitest suite, which only collects src/**/*.test.tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, SELF_EXEMPT } from "./check-classification.mjs";

// Filename-only cases pass a null reader — detection must trip on the name alone.
const nameOnly = (p) => detect(p, () => null);

test("skill hyphen-terminal tokens trip (the #318 gap this closes)", () => {
  // Canonical example from the skill's SKILL.md naming contract.
  assert.ok(nameOnly("OTD-Swarm-DiligenceBrief-2026-07-19-confidential-ITAR.md"));
  assert.ok(nameOnly("OTD-Investor-One-Pager-2026-08-01-confidential.md"));
  assert.ok(nameOnly("OTD-Update-2026-08-01-internal.md"));
  assert.ok(nameOnly("OTD-Update-2026-08-01-internal-EAR.pdf"));
});

test("regulatory token trips whatever Axis-A precedes it (incl. public)", () => {
  assert.equal(nameOnly("OTD-Cap-2026-08-01-public-CUI.md"), "controlled (CUI/ITAR/EAR) filename token");
  assert.ok(nameOnly("OTD-Cap-2026-08-01-confidential-ITAR.md"));
  assert.ok(nameOnly("some-brief-EAR.docx"));
});

test("legacy dot-delimited form still trips (no regression from #318)", () => {
  assert.ok(nameOnly("OTD-Investor-One-Pager-2026-08-01.confidential.md"));
  assert.ok(nameOnly("notes.internal.md"));
});

test("public Axis-A alone is allowed", () => {
  assert.equal(nameOnly("OTD-Teaser-2026-08-01-public.md"), null);
});

test("ordinary source/doc names with 'internal' do NOT false-positive", () => {
  assert.equal(nameOnly("docs/internal-state.md"), null);
  assert.equal(nameOnly("src/lib/internal-api.ts"), null);
  assert.equal(nameOnly("src/components/InternalToolbar.tsx"), null);
  assert.equal(nameOnly("scripts/some-internal-helper.mjs"), null);
});

test("content banner trips for every axis, in prose or HTML comment", () => {
  assert.equal(detect("anything.md", () => "CLASSIFICATION: CONFIDENTIAL\n"), "CLASSIFICATION: CONFIDENTIAL banner");
  assert.equal(detect("anything.md", () => "# Title\n<!-- CLASSIFICATION: INTERNAL -->\n"), "CLASSIFICATION: INTERNAL banner");
  assert.equal(detect("anything.md", () => "CLASSIFICATION: CUI"), "CLASSIFICATION: CUI banner");
  assert.equal(detect("anything.md", () => "classification: itar"), "CLASSIFICATION: ITAR banner");
});

test("CLASSIFICATION: PUBLIC and loose prose do NOT trip", () => {
  assert.equal(detect("anything.md", () => "CLASSIFICATION: PUBLIC\n"), null);
  assert.equal(detect("readme.md", () => "This confidential-looking word is fine in prose.\n"), null);
});

test("guard's own files are exempt", () => {
  for (const f of SELF_EXEMPT) assert.equal(detect(f, () => "CLASSIFICATION: CONFIDENTIAL"), null);
});
