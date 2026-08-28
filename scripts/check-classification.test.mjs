// Self-test for the classification guard's detection predicate.
// Run: `node --test scripts/check-classification.test.mjs` (no deps; not part of
// the vitest suite, which only collects src/**/*.test.tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, SELF_EXEMPT, ANSWER_KEY_EXEMPT } from "./check-classification.mjs";

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

// --- Exam answer keys (TD-041) ---------------------------------------------
// A bank is plain JSON: no filename token, nowhere to put a banner. The only
// thing that can catch it is its shape. `scripts/seed-l101-exam.ts` reached
// public history this way (#350) and the 2026-07-30 incident repeated it.
const bank = (n, key = "correctIndex") =>
  "[" +
  Array.from(
    { length: n },
    (_, i) => `{"id":"q${i}","prompt":"P","options":["a","b","c"],"${key}":${i % 3}}`,
  ).join(",") +
  "]";

test("an exam bank trips wherever it is named, underscore or not", () => {
  // The /scripts/_* gitignore rule keys on the underscore, so this is the gap.
  assert.match(
    detect("scripts/l1-06-decoupling-exam-bank.json", () => bank(18)),
    /exam answer key shape/,
  );
  assert.ok(detect("anywhere/else/questions.json", () => bank(18)));
  // The .ts form that actually leaked in #350.
  assert.ok(detect("scripts/seed-l106-exam.ts", () => bank(18)));
});

test("the guide-card `answer` key does NOT trip — those are public by design", () => {
  // QuizBlock.tsx is "use client" and compares `answer` in the browser, so the
  // value already ships. Tripping on it would flag 40+ correctly-public tracked
  // files (seed-*-cluster.ts, scripts/authoring/**). Measured, not assumed.
  assert.equal(detect("scripts/authoring/l1-02/SCHEMATIC.ts", () => bank(20, "answer")), null);
});

test("naming the field without a bank of questions does not trip", () => {
  assert.equal(detect("prisma/schema.prisma", () => "correctIndex Int"), null);
  assert.equal(
    detect("src/types.ts", () => "type Q = { options: string[]; correctIndex: number }"),
    null,
  );
  assert.equal(detect("docs/plans/x.md", () => "we store correctIndex: 0 per options: [ ]"), null);
  assert.equal(detect("one.json", () => bank(1)), null); // a single question is not a bank
});

test("every answer-key exemption is load-bearing, and only by path", () => {
  for (const [path, reason] of ANSWER_KEY_EXEMPT) {
    assert.ok(reason, `${path} must carry a reason`);
    // Same bytes at any other path must still trip, or the entry is hiding a rule
    // that does not actually work.
    assert.ok(
      detect("scripts/relocated.json", () => bank(5)),
      `${path}: the shape rule must trip when not exempt`,
    );
  }
});
