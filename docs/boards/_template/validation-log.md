# <Board name> — validation log

> Evidence trail for the **Recursive Board-Design Validation Protocol**
> (`../_protocol.md`). One entry per pass. This log is what backs the board's
> `DESIGN_VALIDATION` attestations — when you tick "calc trail recorded", the proof
> is here. Copy this file into the board folder alongside `design.md` at kickoff.

| | |
| --- | --- |
| **Slug** | `<project-slug>` |
| **Status** | `not started` → `pass N/≥10` → **`DRY ✓ (part-ready)`** |
| **Passes run** | 0 |
| **Last dry pass** | — |

## Gate (Definition of done — all must hold before any part/BOM/revision)

- [ ] Requirements traced · pins accounted + sequencing proven
- [ ] Every number worst-case-proven · parts datasheet- + footprint-verified
- [ ] Power integrity proven · every failure mode mitigated-or-accepted
- [ ] Every part hand-buildable + sourceable (exact import strings)
- [ ] Layout constraints captured · teachable · consistent · pipeline-conformant
- [ ] Every applicable conditional audit run · every risk de-risked or scheduled
- [ ] **≥ 10 passes AND a dry pass achieved**

## Passes

<!-- Add one block per pass. Severity: CRITICAL / HIGH / MED / LOW. A pass is only
     "passed" when clean AFTER the latest change; re-prove earlier audits a fix
     could have disturbed. Stop only on a dry pass (zero new material findings)
     and never before 10 passes. -->

### Pass N — <lens> (<reviewer / fresh eyes>)

| # | Severity | Finding | Verified? | Fix / decision | Re-proof |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

**Residual after this pass:** <open items, or "none — dry">
