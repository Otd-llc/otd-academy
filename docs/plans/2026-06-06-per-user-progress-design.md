# Per-user progress, grades & optional board exams — Design

> **Status:** design (validated in brainstorming 2026-06-06). Implementation plan to follow in a separate doc.
> **For Claude:** when implementing, use superpowers:writing-plans to turn this into a task-by-task plan.

**Goal:** Turn Foundry from a shared single-tenant build tool into a self-serve learning platform: any signed-in learner progresses through shared curriculum boards on their *own* track, earns recorded grades, and can take an optional server-scored board exam that confers "mastery."

**Validated decisions (brainstorming):**
1. **Audience:** open self-serve learners (no instructor/cohort yet).
2. **Exam role:** optional, server-scored; passing → `MASTERED`; ties into the `ProjectDependency` DAG.
3. **Gate fidelity:** *hybrid* — quizzes gate every stage per-user; a small allowlist of "proof" artifacts is checked per-learner; the deep fab chain (gerbers/builds/measurements) stays the shared reference, ungated for learners.
4. **Sub-decisions:** explicit `Project.publishedRevisionId`; proof artifacts are enrollment-scoped; stages-alone = `COMPLETED`, exam = `MASTERED`; **open registration is in scope this iteration**.

---

## 1. Core architectural shift

Today the gate engine answers *"is this **revision** past stage X?"* by reading the shared `Revision.currentStage`. Every learner would share one position. The new model answers *"is **this learner** past stage X on this board?"* — so a learner's position lives on a new per-user **`Enrollment`**, and `Revision.currentStage` reverts to meaning only *"where the **author** is in building the canonical reference."*

Two parallel, non-conflicting notions of "stage position":

| | carrier | who advances it | action |
|---|---|---|---|
| **Author / reference build** | `Revision.currentStage` | ADMIN | `advanceStage` (unchanged, + `requireAdmin`) |
| **Learner progress** | `Enrollment.currentStage` | the learner | `advanceEnrollment` (new) |

They do **not** share a gate predicate: the author predicates check author-only signals (git commits, build/board/measurement state, design-review checklists) a learner can't produce, so the learner path uses a separate lightweight gate — a per-enrollment proof artifact at three design stages, ANDed with the stage quiz. Quizzes become **learner-only** (`withQuizGate` is removed from the author path). See §4.

---

## 2. Data model (`prisma/schema.prisma`)

### New enums
```prisma
enum UserRole        { ADMIN  LEARNER }
enum EnrollmentStatus { IN_PROGRESS  COMPLETED  MASTERED }
```

### `User` — gains a role
```prisma
role UserRole @default(LEARNER)
enrollments Enrollment[]
```

### `Project` — designates the learner-facing revision
```prisma
publishedRevisionId String?   @unique
publishedRevision   Revision? @relation("PublishedRevision", fields: [publishedRevisionId], references: [id], onDelete: SetNull)
exam        Exam?
enrollments Enrollment[]
```
`publishedRevision` is the revision whose `Guide` learners follow (typically a frozen reference). Until an admin sets it, the project isn't enrollable.

### `Enrollment` — the per-user progress carrier
```prisma
model Enrollment {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  revisionId    String   // snapshot of project.publishedRevisionId at enroll time
  revision      Revision @relation("EnrollmentRevision", fields: [revisionId], references: [id], onDelete: Restrict)
  currentStage          Stage @default(REQUIREMENTS)   // ← the learner's OWN position
  currentStageEnteredAt DateTime @default(now())
  status        EnrollmentStatus @default(IN_PROGRESS)
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  masteredAt    DateTime?
  quizPasses  QuizPass[]
  examResults ExamResult[]
  artifacts   Artifact[]  @relation("EnrollmentArtifacts")
  @@unique([userId, projectId])
  @@index([userId])
}
```

### `QuizPass` — re-keyed per learner
```prisma
// was @@unique([revisionId, stage]); now:
enrollmentId String
enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
@@unique([enrollmentId, stage])
```
`revisionId` is dropped (derivable via the enrollment). `score`/`total` stay (now meaningful per learner — the grade).

### `Artifact` — proof artifacts attach to an enrollment
```prisma
enrollmentId String?
enrollment   Enrollment? @relation("EnrollmentArtifacts", fields: [enrollmentId], references: [id], onDelete: Cascade)
@@index([enrollmentId])
```
Author/reference artifacts keep `enrollmentId = null` (revision-scoped, as today). A learner's REQUIREMENTS_DOC / SCHEMATIC_FILE / ASSEMBLY_PHOTO upload sets `enrollmentId`. This sidesteps the frozen-revision problem (`assertNotFrozen` blocks writes to the shared frozen reference) and keeps the two worlds cleanly separated.

### `Exam` + `ExamResult` — optional, server-scored
```prisma
model Exam {
  id            String  @id @default(cuid())
  projectId     String  @unique
  project       Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title         String
  passThreshold Int     // percent (0–100) the learner must reach
  questions     Json    // bank WITH correct answers — NEVER serialized to the client
  createdAt / updatedAt
  results       ExamResult[]
}

model ExamResult {
  id           String     @id @default(cuid())
  examId       String
  exam         Exam       @relation(fields: [examId], references: [id], onDelete: Cascade)
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  score        Int
  total        Int
  passed       Boolean
  answers      Json?      // learner's submitted answers, for review
  submittedAt  DateTime   @default(now())
  @@index([enrollmentId])
}
```
The question bank lives server-side; the client receives questions *without* the answer key. A `submitExam` action scores authoritatively (contrast the soft, client-scored stage quizzes).

---

## 3. Auth: open registration + roles (`src/auth.ts`, `src/lib/auth-helpers.ts`)

Currently `signIn` returns `allowlist.has(email)` (closed door) and `jwt` *throws* when an email leaves the allowlist. New behavior — the allowlist becomes the **ADMIN** roster, not the gate:

- **`signIn` callback:** accept any Google account with `email_verified === true` (open registration). Drop the allowlist rejection.
- **`jwt` callback:** stop throwing on non-allowlist. Resolve role: `allowlist.has(email) ? ADMIN : LEARNER`; if the DB `User.role` differs, update it once; attach `role` to the token.
- **`session` callback (new):** copy `token.role → session.user.role` (augment the `next-auth` module types).
- **`requireAdmin()`** in `auth-helpers.ts`: `requireUser()` + assert `role === "ADMIN"`, else throw `Forbidden`.
- **Authorization sweep:** every *curriculum-authoring* mutation requires admin — `advanceStage`/`regressStage`, freeze, project/revision/guide CRUD, part/asset/BOM authoring, `materializeGuide`, `publishedRevision` setter. Every *learner* action (`enroll`, `advanceEnrollment`, `recordQuizPass`, `submitExam`) requires only `requireUser()`. (Implementation plan enumerates each action file.)

`ALLOWED_EMAILS` semantics change in docs/env comments: "ADMIN roster," not "sign-in allowlist." CI/build stubs unaffected.

---

## 4. Per-user gate engine

The author predicates in `STAGES[stage].exitGate` check author-scoped signals a learner can't produce (`revision.schematicCommit`/`layoutCommit`, build/board/measurement state, design-review checklists). So the **learner path does NOT reuse them.** It shares the quiz-gate AND mechanism and the `Stage` order, but runs a separate, lightweight predicate. The author predicates stay exactly as-is for the reference build.

### Quizzes become learner-only
`withQuizGate` and `GateContext.quizPasses` are removed from the **author** path — an admin building the reference shouldn't be quiz-gated (quizzes test *learner* comprehension). `STAGES` reverts to the un-wrapped `BASE_STAGES`; `loadGateContext` drops its `QuizPass` query and `GateContext` drops `quizPasses`. This unwinds #36's author-side wiring — but the quiz CONTENT, `QuizBlock`, and `recordQuizPass` are all preserved and re-pointed at the enrollment.

### Learner gate (`src/lib/learner-gates.ts`, new)
```ts
const LEARNER_PROOF: Partial<Record<Stage, ArtifactSubkind>> = {
  REQUIREMENTS: "REQUIREMENTS_DOC",
  SCHEMATIC:    "SCHEMATIC_FILE",
  LAYOUT:       "LAYOUT_FILE",
};
export interface LearnerGateContext {
  enrollmentArtifacts: Pick<Artifact, "subkind">[];
  quizPasses: Set<Stage>;
}
export function learnerExitGate(stage: Stage, ctx: LearnerGateContext): GateResult {
  const reasons: string[] = [];
  const proof = LEARNER_PROOF[stage];
  if (proof && !ctx.enrollmentArtifacts.some((a) => a.subkind === proof))
    reasons.push(`Upload your ${PROOF_LABEL[proof]} on this stage to advance.`);
  if (!ctx.quizPasses.has(stage)) reasons.push(QUIZ_NOT_PASSED_MSG);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
```
Only the three design stages require a per-enrollment proof artifact; every other stage is quiz-only (the deep fab chain stays the shared reference — §6). `loadLearnerGateContext(tx, enrollmentId)` loads just the enrollment's artifacts + its quiz-pass `Set` — far lighter than the author `loadGateContext`, and crucially it leaves the author loader **and its ~20 tests untouched**.

### `advanceEnrollment` (new action, `src/lib/actions/enrollment.ts`)
1. `requireUser()`; load the caller's `Enrollment` for the project (`@@unique[userId, projectId]`).
2. `ctx = loadLearnerGateContext(tx, enrollment.id)`; `gate = learnerExitGate(enrollment.currentStage, ctx)`.
3. On pass: conditional `UPDATE Enrollment SET currentStage = next WHERE id = … AND currentStage = expected` (same optimistic-lock pattern as `advanceStage`). Advancing into the terminal `REVISION` sets `status = COMPLETED`, `completedAt = now`.
4. No build-freeze, no cross-project DAG check, no `StageTransition` (author concerns). An `EnrollmentEvent` history row is deferred (not MVP).

---

## 5. Exam flow → mastery → DAG unlock (`src/lib/actions/exam.ts`)

- **`getExam(projectId)`** — returns the exam's questions **stripped of answers** for rendering.
- **`submitExam(enrollmentId, answers)`** — `requireUser()`; load the server-side bank; score; write `ExamResult`. If `score% ≥ passThreshold`: set `Enrollment.status = MASTERED`, `masteredAt`. Idempotent re-takes allowed (best/most-recent recorded).
- **Eligibility:** exam is offered once `Enrollment.status >= COMPLETED` (stages done). It never *blocks* completion (it's optional).

### Unlock semantics (CONFIRMED 2026-06-06)
Because the exam is **optional**, normal progression cannot require it. Therefore:
- A downstream board is **available** to a learner when every prerequisite project (DAG `dependsOn` edges) is at least **`COMPLETED`** by that learner.
- **`MASTERED`** is a stronger credential (transcript badge); it can gate future *mastery-only/advanced* boards but does not block ordinary progression.

Availability is computed by `learnerBoardAvailability(userId)` over `ProjectDependency` + the user's enrollments. `enroll(projectId)` refuses if prerequisites aren't `COMPLETED`.

---

## 6. What learners are NOT gated on (hybrid scope)

The proof-artifact allowlist (per-enrollment, checked by the learner's gate):

| Stage | Proof subkind |
|---|---|
| REQUIREMENTS | `REQUIREMENTS_DOC` |
| SCHEMATIC | `SCHEMATIC_FILE` |
| LAYOUT | `LAYOUT_FILE` (or `ASSEMBLY_PHOTO` at the end) |

`Build`-scoped stages (DRC_GERBER, ORDERING, ASSEMBLY, BRINGUP — `PCB_ORDER`, `BRINGUP_LOG`, measurements) are **not** required for a learner. For learners those late stages are **quiz-only** (the card teaches them; the shared reference build demonstrates the real work). The learner still traverses all nine stages; advancing into the terminal `REVISION` flips the enrollment to `COMPLETED` (no freeze — that's a revision concern). A future "full-fidelity" iteration can promote the build chain to per-enrollment `Build`s.

---

## 7. UI

- **Board page** — for a signed-in learner: "Enroll" (if available) / "Continue" (resume at `enrollment.currentStage`); locked state with prerequisite list when unavailable.
- **Guide** — reads `enrollment.currentStage` (not the revision's). The footer gate affordance, stage tracker, and quiz "required to advance" badge all consult the per-enrollment context. (Touches `loadGateContext` callers + the guide page loader.)
- **Exam page** — rendered once `COMPLETED`; questions sans answers; submit → grade + mastery badge.
- **Transcript / progress** (`/learn` or `/me`) — the learner's enrolled boards, per-stage quiz grades, exam grade + mastery badges, overall progress.
- **Admin** — a `publishedRevision` setter on the project/revision admin UI; admin-only authoring UNCHANGED behind `requireAdmin`.

---

## 8. Migration & data (hand-authored SQL → `prisma migrate deploy`; never `migrate dev` on shared Neon)

1. `CREATE TYPE` for `UserRole`, `EnrollmentStatus`; `ALTER TABLE "User" ADD COLUMN role … DEFAULT 'LEARNER'`.
2. Create `Enrollment`, `Exam`, `ExamResult`; add `Project.publishedRevisionId`, `Artifact.enrollmentId`.
3. `QuizPass` re-key: add `enrollmentId`; **data migration** — for each project with existing `QuizPass` rows, create an `Enrollment` for the operator (`joshtol`) against the project's current revision and re-point those rows; then drop the old `revisionId` column + unique index and add `@@unique([enrollmentId, stage])`.
4. Backfill `User.role = ADMIN` for current `ALLOWED_EMAILS` members.
5. Seed: `prisma/seed.ts` gains an `Enrollment` (+ its `QuizPass` rows re-keyed) for the fixture so the ~23 integration tests still pass.

---

## 9. Test fallout (expected, same shape as the quiz-gate change)

- **Author path gets simpler:** removing `quizPasses` from `GateContext`/`loadGateContext` means the ~20 author gate tests drop the `quizPasses` ctx field, and the `passAllQuizzes` helper + seed `QuizPass` seeding are removed from the author-advance tests (#36's author-side wiring unwinds). `stages.test.ts` drops its quiz-gate `describe` block.
- New learner tests: `learnerExitGate` (proof+quiz, pass/block), `loadLearnerGateContext`, `advanceEnrollment` (optimistic lock, terminal→COMPLETED), `submitExam` (scoring, pass→MASTERED, answer key never leaves the server), `enroll` (prereq gating), role authorization (learner blocked from admin mutations), `learnerBoardAvailability`.
- Run full `tsc` **and** full vitest after the schema change (enum-mirror maps + fixtures break in ways the task's own checks miss).

---

## 10. Suggested PR slicing (for the implementation plan)

1. **Auth/roles + open registration** (`User.role`, callbacks, `requireAdmin`, authorization sweep) — independently shippable.
2. **Enrollment model + per-user gate engine** (`Enrollment`, `loadGateContext` arg, `advanceEnrollment`, `QuizPass` re-key + migration, enrollment-aware guide).
3. **Exam + mastery + DAG unlock** (`Exam`/`ExamResult`, `submitExam`, availability, enroll gating).
4. **Transcript / progress UI** + admin `publishedRevision` setter.

Each slice: hand-authored SQL, full `tsc` + vitest, PR when CI green (mind the `ci-shared-test-db` concurrency footgun — one PR at a time).
