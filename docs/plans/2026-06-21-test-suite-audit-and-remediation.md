# Test-suite audit — 2026-06-21

**Why:** A full `pnpm test` takes ~13 minutes. The cause is structural, not slow logic:
the suite runs integration tests against the **remote PRODUCTION Neon DB**, and
[`vitest.config`](../../vitest.config.ts) sets `fileParallelism: false` (every one of
the 155 files runs strictly serial). That flag exists only because the DB-backed tests
share and mutate the same rows in one prod database, so concurrent workers would corrupt
each other.

This audit answers the real question — **is each DB-backed test good, and is its
coverage actually required?** — before we change *how* the suite runs. 77 files import
`@/lib/db`; six independent reviewers classified all 77 against the module under test.
Read-only; no test was modified.

## Headline numbers

| Verdict | Count | Meaning |
|---|---:|---|
| **KEEP-DB** | 52 | Genuine integration test of our logic; the DB is load-bearing (multi-table invariants, raw-SQL CHECK/partial-unique constraints, transactions/cascades, real stage/gate logic). Coverage justified. |
| **CONVERT-TO-UNIT** | 17 | Tests our logic but the DB is incidental (pure functions, validation, mapping, single mockable action). Prod-coupled out of habit. The biggest fast + de-risk win. |
| **FRAMEWORK-ONLY** | 5 | Effectively asserts Prisma/enum/migration behavior, not our code. Low value — collapse or drop the DB round-trip. |
| **REDUNDANT** | 2 | Coverage duplicated elsewhere. |
| **DELETE** | 1 | Obsolete *and* actively dangerous (mutates the shared prod fixture). |

**The good news:** ~68% genuinely need a DB — the suite is not bloated with fake
integration tests. Coverage is largely required.
**The lever:** 25 files (32%) don't belong in a serial-prod-DB lane, **plus 5 more
that already mock `@/lib/db` and never hit Neon** (`stripe`, `stripe-webhook`,
`checkout-actions`, `project-price-actions`, `refresh-route`) but still pay the serial
tax by being globally serialized.

## Two-track plan

### Track A — quick, low-risk (default run becomes seconds)
Pull everything that doesn't need Neon out of the serial lane into a **parallel unit
lane** that is the default `pnpm test`:
- **Reclassify (no code change):** the 5 already-mocked files above — they're unit
  tests mislabeled by an import heuristic.
- **Convert (17):** mock/stub the data layer; see the CONVERT rows below.
- **Collapse (5 FRAMEWORK):** drop the throwaway-row round-trip, keep any real assertion
  as a no-DB check.
- **Cut/merge (3):** `m8a-checkpoint` (delete), `m9a-checkpoint` + `m9b-checkpoint`
  (redundant demo scripts).

### Track B — the real fix for the 52 genuine integration tests
Even perfectly-justified, the 52 KEEP-DB tests are slow because they hit a **remote**
prod DB serially. Point the integration lane at a **local/ephemeral Postgres** and
enable `fileParallelism` for it. This:
- drops the integration run from ~13 min toward ~1 min (no network latency; parallel),
- removes the prod-mutation hazard entirely (CLAUDE.md's "never run two vitest at once"
  goes away), and
- lets the **checkpoint tests that mutate the shared `esp32-sensor-breakout` /
  BUILD-001 fixture** (`m8c`, `m9c`) be rebuilt on throwaway rows safely.

The audit also tells us *which* tests belong in this lane (the 52) vs. which to evict
(the 25) — so Track B is scoped, not a blind "move everything local."

## Highest-value, highest-risk cluster: the checkpoint tests
`m8a / m9a / m9b / m9c / m8c` are "demoable checkpoint" narrative scripts that mutate
and restore the **shared seeded fixture** rather than throwaway rows — exactly the
corruption class CLAUDE.md warns about. `m8a-checkpoint` deletes/recreates the seeded
BRINGUP artifact and rewrites all 5 BUILD-001 board statuses on prod; a crash mid-test
leaves the shared fixture wrong. `m8b-checkpoint` is a legit live-R2 test (env-gated).

## Loose ends found
- `check-artifact-owner-xor.test.ts` test #2 is a dead stub (`// For now, skip.`) —
  implement or delete.
- `uploads-download.test.ts` and `m8b-checkpoint.test.ts` have env-gated (skipped)
  live-R2 cases — fine, just noting they don't run in CI.

## Full classification (77 files)

| File | Verdict | needsDB | Shared state | Note |
|---|---|---|---|---|
| part-facts-actions | KEEP-DB | yes | throwaway | Trust state-machine + optimistic concurrency + category bridge. |
| gate-assembly-e2e | KEEP-DB | yes | shared | Stage gate red→green over rev/build/board/checklist. |
| enrollment-actions | KEEP-DB | yes | throwaway | Learner gate: quiz/proof/entitlement/terminal. |
| project-dependencies-actions | KEEP-DB | yes | throwaway | Raw recursive cycle CTE + advisory lock + SSI. |
| parts-mcp-tools | KEEP-DB | yes | throwaway | Trust-filtered lookup + frozen-BOM resolution; merge candidate. |
| guide-save-card | KEEP-DB | yes | shared | Gate field-lock + strict-boundary write-suppression. |
| m9a-checkpoint | REDUNDANT | yes | shared | Demo script; covered by gate-assembly + boards tests; mutates fixture. |
| part-asset-model | FRAMEWORK-ONLY | yes | throwaway | Asserts Prisma defaults + @@unique. |
| part-fact-model | FRAMEWORK-ONLY | yes | throwaway | Asserts enum storage + JSON round-trip + @@unique. |
| check-checklist-owner-xor | KEEP-DB | yes | throwaway | DB CHECK (3-way XOR) constraint. |
| index-build-one-unfrozen | KEEP-DB | yes | throwaway | Partial unique index (WHERE frozenAt IS NULL). |
| index-revision-label-ci | KEEP-DB | yes | throwaway | Functional case-insensitive unique index. |
| purge-digikey-data | KEEP-DB | yes | throwaway | Transactional dk*-null sweep + cascade delete. |
| checklists-actions | KEEP-DB | yes | shared | Freeze guards, ordinal defaulting, atomic reorder, ASSEMBLY gate. |
| artifacts-actions | CONVERT-TO-UNIT | no | shared | Sanitize + owner/stage/subkind validation + freeze; mockable. |
| bom-lines-actions | KEEP-DB | yes | shared | Unique-constraint freeze ordering, CSV strict-match upsert. |
| bringup-actions | CONVERT-TO-UNIT | no | shared | Board-status aggregation + truncation + freeze; mockable. |
| check-project-dependencies | KEEP-DB | yes | throwaway | Multi-table edge walk + stage-ordering gate. |
| projects-actions | CONVERT-TO-UNIT | no | shared | Slug/track Zod, auth, flag toggles; trivial CRUD. |
| part-datasheet-actions | CONVERT-TO-UNIT | no | shared | R2 gate + Zod short-circuit before DB. |
| uploads-download | KEEP-DB | partial | shared | Live-R2 round-trip (env-skipped); kind!=FILE guard. |
| kicad-search | KEEP-DB | yes | throwaway | pg_trgm ranking + prefix/glob raw-SQL search. |
| set-published-revision | KEEP-DB | yes | throwaway | Admin gate + cross-project + guide-exists bar. |
| index-board-serial-ci | KEEP-DB | yes | throwaway | Case-insensitive functional unique index. |
| load-learner-gate-context | CONVERT-TO-UNIT | no | throwaway | Loads artifacts+quizPass then maps; mockable. |
| check-bomline-refdes-count | KEEP-DB | yes | throwaway | DB CHECK (raw SQL bypasses Zod); defense-in-depth. |
| stages-actions | KEEP-DB | yes | shared+throwaway | Stage state-machine: gates, freeze cascades, DAG, Serializable. |
| errata-actions | KEEP-DB | yes | shared+throwaway | Post-freeze write-path + cross-project guard. |
| parts-query | KEEP-DB | partial | throwaway | Trust-filter + bomFrozenAt revision resolution. |
| parts-actions | KEEP-DB | yes | shared+throwaway | Unique (mfr,mpn), categoryId dual-write, KiCad-ref FK. |
| artifact-render | KEEP-DB | yes | shared+throwaway | recordArtifact render-trio persistence + HEAD-fail drop. |
| boards-actions | KEEP-DB | yes | shared+throwaway | CI-unique serial index + frozen-Build/Revision policy. |
| m9b-checkpoint | REDUNDANT | yes | shared | Checklist CRUD on seeded BUILD-001; overlaps checklists-actions. |
| parts-list | KEEP-DB | yes | throwaway | ILIKE/lifecycle/sort/pagination + materialized-path subtree. |
| stripe | CONVERT-TO-UNIT | no (mocked) | n/a | Already mocks db/stripe/env; misfiled into DB lane. |
| refresh-availability | KEEP-DB | partial | throwaway | DigiKey stubbed; event-write + per-part failure isolation. |
| index-build-one-unfrozen-concurrent | KEEP-DB | yes | throwaway | Partial unique index under Serializable contention. |
| check-artifact-payload-xor | KEEP-DB | yes | throwaway | Raw-SQL CHECK (kind/payload XOR). |
| guide-model | FRAMEWORK-ONLY | yes | shared | Plain Prisma create round-trip; couples to l1-01 slug. |
| part-assets-actions | KEEP-DB | yes | throwaway | Trust state machine + optimistic concurrency + cascade. |
| builds-actions | KEEP-DB | yes | throwaway | Stage gates, REGRESS transitions, partial-unique concurrency. |
| measurements-actions | KEEP-DB | yes | throwaway | Atomic bulk insert + freeze gates. |
| m8a-checkpoint | DELETE | yes | shared | Mutates+restores seeded BUILD-001 on prod; predicate re-impl. |
| m8c-checkpoint | KEEP-DB | yes | shared | Post-freeze erratum + cross-project reject; convert to throwaway. |
| part-assets-r2 | CONVERT-TO-UNIT | no | throwaway | R2-off gate + Zod superRefine + null fallback; mockable. |
| quiz-actions | KEEP-DB | yes | throwaway | Server re-scoring vs DB answer keys + ownership + upsert. |
| checkout-actions | CONVERT-TO-UNIT | no (mocked) | n/a | Already mocks db/stripe/auth; no Neon hit. |
| revisions-commit-pinning | CONVERT-TO-UNIT | no | throwaway | SHA-format Zod + frozen guard; mockable. |
| entitlement-actions | KEEP-DB | yes | throwaway | Admin gate + upsert idempotency on [userId,projectId]. |
| check-board-silkscreen-format | KEEP-DB | yes | throwaway | Real Postgres CHECK via raw SQL. |
| refresh-route | FRAMEWORK-ONLY | no (mocked) | n/a | Mocks db/env/digikey; tests cron auth/route wiring. Fine as-is. |
| project-dependency-no-self-edge | KEEP-DB | yes | throwaway | Real Postgres CHECK (no self-edge) via raw SQL. |
| kicad-export | KEEP-DB | yes | throwaway | Multi-table assembler (parts/assets/facts/BOM) + artifact write. |
| stripe-webhook | CONVERT-TO-UNIT | no (mocked) | n/a | Already mocks @/lib/db; security-critical, misfiled into DB lane. |
| revisions-actions | KEEP-DB | yes | shared | Copy-forward cascade invariants (BOM clone, build-scoped exclusion). |
| guide-completion | KEEP-DB | yes | throwaway | Authoritative-done = real stage gate; gate-vs-ref divergence. |
| load-gate-context | KEEP-DB | yes | shared | Loader shape + BRINGUP gate; multi-relation read. |
| project-price-actions | CONVERT-TO-UNIT | no (mocked) | n/a | Already mocks db/stripe/auth; pure validation+ordering. |
| m9c-checkpoint | KEEP-DB | yes | shared | Bulk Serializable tx + (stage,step) grouping; convert to throwaway. |
| exam-actions | KEEP-DB | yes | throwaway | Answer-key non-leak + enrollment status transitions. |
| learner-board-availability | KEEP-DB | yes | throwaway | Prereq DAG gating over ProjectDependency + enrollment. |
| project-visibility-actions | CONVERT-TO-UNIT | weak | throwaway | Admin-gate + single-column update; borderline redundant. |
| kicad-resolver | KEEP-DB | yes | throwaway | Layered cache resolver: write-through + flatten. |
| model-render-schema | FRAMEWORK-ONLY | weak | throwaway | Asserts Prisma column round-trip + enum exists. |
| check-artifact-owner-xor | KEEP-DB | yes | n/a | Real DB CHECK via raw SQL; **test #2 is an empty stub**. |
| uploads-actions | CONVERT-TO-UNIT | no | shared | R2 mocked; rows only carry freeze/size logic; mockable. |
| gate-bom-sourcing-e2e | KEEP-DB | yes | throwaway | advanceStage gate over multi-table rows + DB CHECK guard. |
| guides-actions | KEEP-DB | yes | shared | Guide.revisionId unique race (P2002) + freeze + reorder. |
| dependents-at-risk | CONVERT-TO-UNIT | no | throwaway | Pure stage-index filter over edge rows. |
| m8b-checkpoint | KEEP-DB | yes | shared | Live R2 PUT/HEAD/GET (env-skipped in CI). |
| skill-tree | KEEP-DB | yes | throwaway | Fuses projects+deps+enrollments+tiers into per-node state. |
| freeze-cascade | KEEP-DB | yes | shared | Same-tx Revision+Build freeze cascade. |
| waitlist-actions | CONVERT-TO-UNIT | no | throwaway | Tier/coming-soon branch + Zod + idempotent upsert. |
| check-checklist-item-checked-xor-napplicable | KEEP-DB | yes | shared | Raw-SQL negative insert proving DB CHECK. |
| admin-authz | CONVERT-TO-UNIT | no | shared | requireAdmin throws before DB lookup; auth mocked. |
| index-build-label-ci | KEEP-DB | yes | throwaway | Raw-SQL case-insensitive unique index. |
| require-admin | CONVERT-TO-UNIT | no | throwaway | Reads one User.role row; mockable. |

## Recommended sequence (each step its own reviewed PR — none started)
1. **Track A reclassify + convert** — fast unit lane default; 22 files leave the DB lane,
   3 cut/merged. Pure speed + de-risk, no integration coverage lost.
2. **Track B local-DB integration lane** — the load-bearing infra change; needs your
   call on target (local Docker Postgres vs. ephemeral Neon branch).
3. **Fix the checkpoint fixture coupling** — `m8c`/`m9c` to throwaway rows; delete `m8a`.
4. **Tidy** — implement or delete the `check-artifact-owner-xor` stub.

*Nothing in this plan has been executed. No test files were modified during the audit.*
