# Classification guard

This repository is **public**. Confidential and internal documents must never be
committed here. The External Docs Standard classifies every external or stakeholder
document; anything marked `CONFIDENTIAL` or `INTERNAL` lives OUTSIDE this repository
(an out-of-tree location or a private repo). This guard turns a mistaken commit into
a hard failure instead of a silent leak. Confidential material has reached public
`main` before; this is the mechanism that prevents a repeat.

## How a document is detected

A file trips the guard if EITHER holds:

1. **Filename token** — the name contains `.confidential.` or `.internal.`
   (case-insensitive), e.g. `OTD-Investor-One-Pager-2026-08-01.confidential.md`.
2. **Classification banner** — a line near the top reads:

       CLASSIFICATION: CONFIDENTIAL

   (or `CLASSIFICATION: INTERNAL`). An HTML-comment form is also matched, e.g.
   `<!-- CLASSIFICATION: CONFIDENTIAL -->`. `CLASSIFICATION: PUBLIC` is allowed here.

Loose words like "confidential" in prose do NOT trip it. Only the explicit token or
banner does, to keep false positives out of a large public codebase.

## Where it runs

- **Local pre-commit hook** (`.githooks/pre-commit`) blocks the commit before it is
  created. It installs automatically: `pnpm install` runs a `prepare` script that
  points `core.hooksPath` at `.githooks`. To install by hand:
  `git config core.hooksPath .githooks`.
- **CI** (`.github/workflows/classification-guard.yml`) is the backstop. It runs on
  every pull request and on pushes to `main`, with no dependencies, so it cannot be
  skipped by `--no-verify` or a missing local hook.
- **`.gitignore`** ignores token-named files so `git add .` will not sweep them in.
  That is convenience; the hook and CI are the real barrier.

Run it manually any time: `pnpm check:classification`.

## Make it a hard block (one-time, repo admin)

Add `classification-guard` as a **required status check** in the `main` branch
protection rules. Until then the CI job is visible but advisory; the required-check
setting is what turns a red X into an actual merge block.

## If the guard fires

Move the file out of the repository tree. A confidential document belongs in the
out-of-tree store the External Docs Standard defines, never in this public repo. If
it is a genuine false positive, add the path to `SELF_EXEMPT` in
`scripts/check-classification.mjs` with a comment explaining why.
