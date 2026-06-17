---
name: board-design-validation
description: >-
  Recursive validation protocol that a curriculum board's design.md must pass
  BEFORE any part, BOM line, or revision is created. Use when working on a board
  in docs/boards/*, editing or reviewing a board design.md, about to add/create a
  part in the parts library, import or edit a BOM, create or advance a board
  revision, or whenever the user asks to "validate a board", "check the design",
  "prove the design", "add a part to a board", "source the BOM", "design.md",
  "DESIGN_VALIDATION", or work toward making a board "part-ready". Surface this
  protocol before any irreversible hardware-commitment step.
---

# Board-Design Validation

The board lifecycle's `DESIGN_VALIDATION` checklist items are **honest human
attestations**, not machine proofs. A board's design must be *proven* — not merely
plausible — before any part is created, BOM imported, or revision advanced.

## Do this

1. **Read `docs/boards/_protocol.md`** — the canonical, board-agnostic Recursive
   Board-Design Validation Protocol. It is the source of truth; follow it exactly.
2. **Run it, or at minimum surface it to the user and get explicit go-ahead** before
   any part/BOM/revision step. Confirm the cadence (pass-by-pass with approval, or
   batch-and-checkpoint).
3. Copy `docs/boards/_template/validation-log.md` into the board folder if missing,
   and **log every pass** there (lens · findings + severity · fix · re-proof · residual).

## The gate (do not cross without it)

A board is **NOT part-ready** until: **≥ 10 recursive audit passes**, a **dry pass**
(zero new material findings), every applicable core + conditional audit clean, every
risk de-risked or scheduled, and `validation-log.md` complete. Until then: **do not
create parts in the library, do not import/edit the BOM, do not create or advance the
revision.**

## The engine (summary — full detail in `_protocol.md`)

**Prove → find → improve → re-prove**, one audit lens per pass, to the pad/number
level, worst-case (min/max/temp) not typical, with fresh adversarial eyes each pass.
Re-run earlier audits a fix could disturb. **Verify every load-bearing finding against
the actual datasheet/code before folding it in** — reviewers can be wrong too.

Core audits (every board): requirements & traceability · net integrity & sequencing ·
math · physics · part-truth (datasheet) · footprint↔symbol↔pinout · power integrity ·
FMEA · DFM/solderability · sourcing/lifecycle · layout-readiness · learnability ·
internal consistency · pipeline conformance. Conditional audits fire on project flags
(mains/Li-ion/thermal/stripboard/RF). See `docs/boards/_protocol.md` for each.
