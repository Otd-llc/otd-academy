# Classification guard

This repository is **public**. Confidential, internal, and export-controlled
documents must never be committed here. The External Docs Standard (the
`otd-external-docs` skill) classifies every external or stakeholder document;
anything marked `CONFIDENTIAL` / `INTERNAL`, or carrying a regulatory-control token
(`CUI` / `ITAR` / `EAR`), lives OUTSIDE this repository (an out-of-tree store or a
private repo). This guard turns a mistaken commit into a hard failure instead of a
silent leak. Confidential material has reached public `main` before; this is the
mechanism that prevents a repeat.

## How a document is detected

A file trips the guard if EITHER holds:

1. **Filename token.** The guard keys on the same token strings the skill emits, so
   the two sides agree (SKILL.md, "the literal tokens"). It trips on a terminal,
   hyphen-delimited token immediately before the extension:

   - `-confidential` / `-internal` (optionally with an appended regulatory token),
     e.g. `OTD-Swarm-DiligenceBrief-2026-07-19-confidential.md` or
     `...-confidential-ITAR.md`.
   - a regulatory token `-CUI` / `-ITAR` / `-EAR` on its own, whatever Axis-A class
     precedes it, e.g. `OTD-Capability-Statement-2026-08-01-public-CUI.md` (the CUI
     still trips even though the doc is otherwise public).

   `-public` on its own is allowed. The legacy dot-delimited form
   (`....confidential.md` / `....internal.md`) is also still caught. Because the
   token must be the final path segment before the extension, ordinary source names
   like `docs/internal-state.md` or `src/lib/internal-api.ts` do NOT trip.

2. **Classification banner.** A line near the top reads:

       CLASSIFICATION: CONFIDENTIAL

   (`INTERNAL`, `CUI`, `ITAR`, or `EAR` also trip; an HTML-comment form such as
   `<!-- CLASSIFICATION: CONFIDENTIAL -->` is matched too). `CLASSIFICATION: PUBLIC`
   is allowed.

Loose words like "confidential" in prose do NOT trip it. Only the explicit token or
banner does, to keep false positives out of a large public codebase.

## Where it runs

- **Local pre-commit hook** (`.githooks/pre-commit`) blocks the commit before it is
  created. It installs automatically: `pnpm install` runs a `prepare` script that
  points `core.hooksPath` at `.githooks`. To install by hand:
  `git config core.hooksPath .githooks`.
- **CI** (`.github/workflows/classification-guard.yml`) is the backstop. It runs on
  every pull request and on pushes to `main`, with no dependencies, so it cannot be
  skipped by `--no-verify` or a missing local hook. It first runs the detection
  self-test, then scans the tree.
- **`.gitignore`** ignores token-named files so `git add .` will not sweep them in.
  That is convenience; the hook and CI are the real barrier.

Run it manually any time: `pnpm check:classification`. Run the detection self-test
with `pnpm test:classification`.

## The out-of-tree store

Classified documents live in a private store OUTSIDE this repository, so the guard
can never scan them because they are not in the tree at all.

- **Location:** `$OTD_CLASSIFIED_STORE` if set, otherwise a sibling of the repo root
  named `otd-classified` (i.e. next to `project-foundry`, never inside it).
- **Move a file there:** `pnpm classify:stash <file>`. It creates the store, moves
  the file out of the tree, and refuses to run if the store resolves to somewhere
  inside the repo (which would defeat the point). Point `$OTD_CLASSIFIED_STORE` at a
  private repo or an encrypted volume for anything sensitive.

## Make it a hard block (one-time, repo admin)

Add `guard` (the job in `classification-guard.yml`) as a **required status check**
in the `main` branch protection rules. Until then the CI job is visible but
advisory; the required-check setting is what turns a red X into an actual merge
block.

## If the guard fires

Move the file out of the repository tree with `pnpm classify:stash <file>`. A
confidential document belongs in the out-of-tree store, never in this public repo.
If it is a genuine false positive, add the path to `SELF_EXEMPT` in
`scripts/check-classification.mjs` with a comment explaining why.
