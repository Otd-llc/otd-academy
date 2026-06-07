# Per-user progress, grades & optional exams — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task-by-task. Design rationale lives in [2026-06-06-per-user-progress-design.md](2026-06-06-per-user-progress-design.md) — read it first.

**Goal:** Turn Foundry into a self-serve learning platform: any signed-in learner enrolls in a shared curriculum board, progresses on their *own* track gated by per-user quizzes + proof artifacts, earns recorded grades, and can take an optional server-scored board exam that confers `MASTERED`. Completion (not the exam) unlocks dependent boards via the DAG.

**Architecture:** A new `Enrollment` row is the per-user progress carrier (its own `currentStage`); the shared `Revision.currentStage` reverts to "where the author is on the reference build." Author and learner are two parallel flows over the same `Stage` enum — the author keeps `advanceStage`/`STAGES[stage].exitGate` untouched; the learner gets a separate lightweight gate (`learnerExitGate`) + `advanceEnrollment`. Quizzes become learner-only. Open Google registration with an `ADMIN`/`LEARNER` role; `ALLOWED_EMAILS` becomes the admin roster.

**Tech stack:** Next.js 16 (RSC + client islands), Auth.js v5 (JWT + PrismaAdapter, Google), Prisma 7 + Neon Postgres, Zod 4, Tailwind v4, Vitest 4.

**Ships as 4 sequential PRs** (each: hand-authored SQL → `migrate deploy`, full `tsc` + full vitest, PR when CI green). Mind the `ci-shared-test-db` concurrency footgun — **one PR at a time**; if a PR shows no `build` check, rebase+push to re-queue.

---

## Conventions (apply to every task)

- **Migrations:** NEVER `prisma migrate dev` against shared Neon. Hand-author `prisma/migrations/<UTC-timestamp>_<name>/migration.sql`, keep `schema.prisma` in lockstep, apply with `pnpm prisma migrate deploy`. Timestamps must sort AFTER `20260606010000`; use `20260607HHMMSS_…` placeholders, bumping per migration.
- **Test DB:** vitest runs against the Neon `ci-test` branch via `NEON_TEST_DATABASE_URL`. `auth()` is mocked per test (`vi.mock("@/auth")`) to a session `{ user: { email } }`; `requireUser` resolves it from the DB. The fixture user is `seed@example.com`.
- **After any schema change:** run full `pnpm tsc` (`tsc --noEmit`) AND full `pnpm vitest run` — enum-mirror maps + fixtures break in ways a task's own tests miss.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Use `git commit -F <file>`; before `gh`, run `$env:GH_TOKEN = ''`; `gh pr create --body-file`.
- **TDD:** write the failing test → run it red → minimal implementation → run it green → commit. One behavior per test.

---

# SLICE 1 — Auth: roles + open registration  (PR A)

**Outcome:** anyone with a verified Google account can sign in as `LEARNER`; `ALLOWED_EMAILS` members are `ADMIN`; every curriculum-authoring mutation requires admin. Independently shippable (no learner features yet).

### Task 1.1 — `User.role` schema + enum

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20260607000000_user_role/migration.sql`.

**Step 1:** Add to `schema.prisma`:
```prisma
enum UserRole { ADMIN  LEARNER }
```
and inside `model User { … }` add:
```prisma
role UserRole @default(LEARNER)
```

**Step 2:** Write `migration.sql`:
```sql
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LEARNER');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'LEARNER';
```

**Step 3:** Apply + regenerate:
Run `pnpm prisma migrate deploy` then `pnpm prisma generate`.
Expected: "1 migration applied", client regenerated.

**Step 4:** `pnpm tsc` — expect exit 0 (no usages yet).

**Step 5:** Commit `prisma/schema.prisma` + the migration dir. `feat(auth): User.role enum (ADMIN/LEARNER)`.

### Task 1.2 — admin allowlist helper + `requireAdmin` (TDD)

**Files:** Create `src/lib/admin-allowlist.ts`; Modify `src/lib/auth-helpers.ts`; Create `src/lib/__tests__/require-admin.test.ts`.

**Step 1 — failing test** (`require-admin.test.ts`): mock `@/auth`, create a LEARNER user + reuse the ADMIN seed user; assert `requireAdmin()` throws `Forbidden` for the learner and returns the user for an admin.
```ts
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
// learner: db.user.create({ data: { email: "learner-1.1@example.com", role: "LEARNER" }})
// mockAuth → that email → expect requireAdmin() rejects /Forbidden/
// mockAuth → "seed@example.com" (ADMIN after Task 1.5 seed) → resolves
```

**Step 2:** Run red: `pnpm vitest run require-admin` — FAIL (`requireAdmin` undefined).

**Step 3 — implement.** `admin-allowlist.ts`:
```ts
import { env } from "@/env";
const ADMIN_EMAILS = new Set(
  env.ALLOWED_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}
```
Append to `auth-helpers.ts`:
```ts
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Forbidden: admin only");
  return user;
}
```
(Authority for authz is the DB `role` mirror, synced from the allowlist on sign-in — Task 1.4. Known limitation: admin *revocation* takes effect on the user's next sign-in; acceptable for the small operator set, hardening deferred.)

**Step 4:** Run green. **Step 5:** Commit. `feat(auth): requireAdmin + admin allowlist helper`.

### Task 1.3 — seed user is ADMIN

**Files:** Modify `prisma/seed.ts` (the `tx.user.upsert` at ~line 22).

**Step 1:** Set role on both branches:
```ts
const user = await tx.user.upsert({
  where: { email: "seed@example.com" },
  update: { role: "ADMIN" },
  create: { email: "seed@example.com", name: "Seed Operator", role: "ADMIN" },
});
```

**Step 2:** Re-seed the test DB: `pnpm db:seed`. Expected: completes; seed user now ADMIN.

**Step 3:** Commit. `chore(seed): seed operator is ADMIN`.

### Task 1.4 — open registration + role sync in Auth.js (TDD-lite)

**Files:** Modify `src/auth.ts`; Create `src/types/next-auth.d.ts`.

**Step 1 — type augmentation** (`src/types/next-auth.d.ts`):
```ts
import type { UserRole } from "@prisma/client";
declare module "next-auth" {
  interface Session { user: { role?: UserRole } & import("next-auth").DefaultSession["user"]; }
}
declare module "next-auth/jwt" {
  interface JWT { role?: UserRole; }
}
```

**Step 2 — rewrite `src/auth.ts` callbacks** (rename `allowlist` → `adminEmails`):
```ts
async signIn({ profile, account }) {
  if (account?.provider !== "google") return false;
  if (!profile?.email) return false;
  if (profile.email_verified !== true) return false;
  return true;                       // open registration
},
async jwt({ token, user }) {
  const email = (user?.email ?? token.email)?.toLowerCase();
  if (!email) return token;
  const role = adminEmails.has(email) ? "ADMIN" : "LEARNER";
  token.role = role;
  if (user) {                        // first sign-in: sync the DB mirror requireAdmin reads
    await db.user.update({ where: { email }, data: { role } }).catch(() => {});
  }
  return token;
},
async session({ session, token }) {
  if (session.user) session.user.role = (token.role as "ADMIN" | "LEARNER") ?? "LEARNER";
  return session;
},
```
Delete the throwing `jwt` allowlist check (no longer rejects non-admins). Keep `adminEmails` parsed from `env.ALLOWED_EMAILS` (or import `isAdminEmail`).

**Step 3:** `pnpm tsc` — expect 0 (the augmentation types `session.user.role`).

**Step 4:** Commit. `feat(auth): open Google registration; sync ADMIN/LEARNER role`.

### Task 1.5 — authorization sweep (TDD with learner-reject tests)

**Files:** Modify the mutating actions in `src/lib/actions/*.ts`; Create `src/lib/__tests__/admin-authz.test.ts`.

The rule: **every exported action that CREATES / UPDATES / DELETES / FREEZES / ADVANCES curriculum or parts data swaps `requireUser()` → `requireAdmin()`.** Read-only actions (`previewRegress`, `part-glance`, `kicad-search`, download/read paths) keep `requireUser()`. The learner actions live in their own files (`quiz.ts`, and the new `enrollment.ts`/`exam.ts`) and stay `requireUser()`.

In scope (mutations → `requireAdmin`): `revisions(-form)`, `bom-lines`, `builds(-form)`, `artifacts`, `bringup`, `errata(-form)`, `boards(-form)`, `measurements(-form)`, `project-dependencies`, `projects`, `stages` (advance/regress), `checklists(-form)`, `guides(-form)`, `part-datasheet`, `part-facts(-form)`, `part-assets(-form)`, `uploads`, `parts`, `kicad-export` (if it writes). **Out (stay `requireUser`):** `quiz.ts`, `part-glance.ts`, `kicad-search.ts`, any read/preview/download.

**Step 1 — failing test** (`admin-authz.test.ts`): create a LEARNER user; mock `auth()` to it; assert a representative mutation from each major area rejects:
```ts
await expect(createProject({ … })).rejects.toThrow(/Forbidden/);
await expect(advanceStage({ revisionId })).rejects.toThrow(/Forbidden/);
await expect(createArtifact({ … })).rejects.toThrow(/Forbidden/);
// …one per area is enough to lock the rule
```

**Step 2:** Run red — FAIL (still `requireUser`, learner passes).

**Step 3 — implement the sweep.** In each in-scope file, replace the `requireUser` import/calls in mutations with `requireAdmin`. Because existing `*-actions.test.ts` run as the ADMIN seed user, they stay green — they verify you didn't OVER-gate; this new test verifies you didn't UNDER-gate.

**Step 4:** Run green: `pnpm vitest run admin-authz`. Then full `pnpm vitest run` — expect all green (existing author tests unaffected; seed user is ADMIN).

**Step 5:** `pnpm tsc` 0. Commit. `feat(auth): gate curriculum-authoring mutations behind requireAdmin`.

### Task 1.6 — ship PR A

`pnpm tsc` + full `pnpm vitest run` green → branch `feature/per-user-auth-roles` → PR. Body notes: open registration live; `ALLOWED_EMAILS` is now the admin roster (update the env comment in `src/env.ts` + `.env.local.example`). Merge when CI green.

---

# SLICE 2 — Enrollment + per-user learner gate  (PR B)

**Outcome:** a learner enrolls in a board and advances their own `currentStage`, gated by per-user quizzes + proof artifacts at the 3 design stages. Quizzes become learner-only. Author gate path is *simplified* (loses quiz-gating).

### Task 2.1 — schema: Enrollment, Exam-less core, QuizPass re-key, Artifact/Project columns

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20260607010000_enrollment_per_user_progress/migration.sql`.

**Step 1 — schema.** Add:
```prisma
enum EnrollmentStatus { IN_PROGRESS  COMPLETED  MASTERED }

model Enrollment {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  revisionId    String
  revision      Revision @relation("EnrollmentRevision", fields: [revisionId], references: [id], onDelete: Restrict)
  currentStage          Stage @default(REQUIREMENTS)
  currentStageEnteredAt DateTime @default(now())
  status        EnrollmentStatus @default(IN_PROGRESS)
  startedAt     DateTime  @default(now())
  completedAt   DateTime?
  masteredAt    DateTime?
  quizPasses  QuizPass[]
  artifacts   Artifact[]  @relation("EnrollmentArtifacts")
  @@unique([userId, projectId])
  @@index([userId])
}
```
On `User` add `enrollments Enrollment[]`. On `Project` add `publishedRevisionId String? @unique`, `publishedRevision Revision? @relation("PublishedRevision", fields: [publishedRevisionId], references: [id], onDelete: SetNull)`, `enrollments Enrollment[]`. On `Revision` add the back-relations: `enrollments Enrollment[] @relation("EnrollmentRevision")` and `publishedFor Project? @relation("PublishedRevision")`. On `Artifact` add `enrollmentId String?` + `enrollment Enrollment? @relation("EnrollmentArtifacts", fields: [enrollmentId], references: [id], onDelete: Cascade)` + `@@index([enrollmentId])`.
Re-key `QuizPass`: drop `revisionId`/`revision`/`@@unique([revisionId, stage])`/`@@index([revisionId])`; add `enrollmentId String` + `enrollment Enrollment @relation(...)` + `@@unique([enrollmentId, stage])` + `@@index([enrollmentId])`.

**Step 2 — migration.sql** (new tables/columns first, then the QuizPass data migration, then the re-key):
```sql
CREATE TYPE "EnrollmentStatus" AS ENUM ('IN_PROGRESS','COMPLETED','MASTERED');

CREATE TABLE "Enrollment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "revisionId" TEXT NOT NULL REFERENCES "Revision"("id") ON DELETE RESTRICT,
  "currentStage" "Stage" NOT NULL DEFAULT 'REQUIREMENTS',
  "currentStageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "masteredAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "Enrollment_userId_projectId_key" ON "Enrollment"("userId","projectId");
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

ALTER TABLE "Project" ADD COLUMN "publishedRevisionId" TEXT;
ALTER TABLE "Project" ADD CONSTRAINT "Project_publishedRevisionId_fkey"
  FOREIGN KEY ("publishedRevisionId") REFERENCES "Revision"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "Project_publishedRevisionId_key" ON "Project"("publishedRevisionId");

ALTER TABLE "Artifact" ADD COLUMN "enrollmentId" TEXT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE;
CREATE INDEX "Artifact_enrollmentId_idx" ON "Artifact"("enrollmentId");

-- QuizPass re-key. Existing rows are per-revision (the operator's). Migrate each
-- to an Enrollment owned by the project's ADMIN creator against the revision.
ALTER TABLE "QuizPass" ADD COLUMN "enrollmentId" TEXT;

INSERT INTO "Enrollment" ("id","userId","projectId","revisionId","currentStage","status")
SELECT gen_random_uuid()::text, p."createdById", p."id", r."id", r."currentStage", 'IN_PROGRESS'
FROM (SELECT DISTINCT q."revisionId" FROM "QuizPass" q) src
JOIN "Revision" r ON r."id" = src."revisionId"
JOIN "Project"  p ON p."id" = r."projectId"
ON CONFLICT ("userId","projectId") DO NOTHING;

UPDATE "QuizPass" q SET "enrollmentId" = e."id"
FROM "Revision" r JOIN "Enrollment" e ON e."revisionId" = r."id"
WHERE q."revisionId" = r."id";

DELETE FROM "QuizPass" WHERE "enrollmentId" IS NULL;
ALTER TABLE "QuizPass" ALTER COLUMN "enrollmentId" SET NOT NULL;
ALTER TABLE "QuizPass" ADD CONSTRAINT "QuizPass_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE;
DROP INDEX IF EXISTS "QuizPass_revisionId_stage_key";
DROP INDEX IF EXISTS "QuizPass_revisionId_idx";
ALTER TABLE "QuizPass" DROP COLUMN "revisionId";
CREATE UNIQUE INDEX "QuizPass_enrollmentId_stage_key" ON "QuizPass"("enrollmentId","stage");
CREATE INDEX "QuizPass_enrollmentId_idx" ON "QuizPass"("enrollmentId");
```
(`gen_random_uuid()` is fine on Neon/pgcrypto; Prisma cuids elsewhere are not required for a backfill.)

**Step 3:** `pnpm prisma migrate deploy` + `pnpm prisma generate`. Verify with Neon MCP that `QuizPass` has `enrollmentId` and 0 null rows.

**Step 4:** `pnpm tsc` — EXPECT FAILURES (loadGateContext/seed/quiz still reference `QuizPass.revisionId`). That's the to-do list for 2.2–2.7. Commit schema + migration only. `feat(progress): Enrollment model + QuizPass re-key migration`.

### Task 2.2 — remove author-side quiz gating

**Files:** Modify `src/lib/stages.ts`, `src/lib/load-gate-context.ts`, `prisma/seed.ts`, `src/lib/__tests__/stages.test.ts`, and the author-advance tests that import `passAllQuizzes`; Delete `src/lib/__tests__/quiz-pass-helper.ts`.

**Step 1:** In `stages.ts`: delete `withQuizGate`, `QUIZ_NOT_PASSED_MSG`, and the `quizPasses` field from `GateContext`. Export `STAGES = BASE_STAGES` directly (rename `BASE_STAGES`→`STAGES`, drop the `Object.fromEntries` wrap).

**Step 2:** In `load-gate-context.ts`: delete the `quizRows`/`quizPasses` block and the `quizPasses` key in the returned object.

**Step 3:** In `seed.ts`: delete the `quizPass.deleteMany/createMany` block (lines ~411–420) — per-revision QuizPass no longer exists. (A fixture *enrollment* with quiz passes is seeded in Task 2.8.)

**Step 4:** In `stages.test.ts`: remove the quiz-gate `describe` block and the `quizPasses` default from the `ctx()` helper. In each author-advance test (`stages-actions`, `gate-*-e2e`, `freeze-cascade`, `checklists-actions`, `guide-completion`, etc.) remove the `passAllQuizzes(...)` calls + import. Delete `quiz-pass-helper.ts`.

**Step 5:** `pnpm tsc` 0; `pnpm vitest run` green. Commit. `refactor(gates): quizzes are learner-only; drop author quiz-gate`.

### Task 2.3 — learner gate predicate (TDD)

**Files:** Create `src/lib/learner-gates.ts`, `src/lib/__tests__/learner-gates.test.ts`.

**Step 1 — failing test:** for `learnerExitGate("SCHEMATIC", ctx)`: blocked when no `SCHEMATIC_FILE` enrollment artifact; blocked when quiz not passed; ok when both present. For `learnerExitGate("ORDERING", ctx)`: quiz-only (no proof artifact needed).

**Step 2:** Run red.

**Step 3 — implement** (uses `GateResult` from `stages.ts`):
```ts
import type { Artifact, ArtifactSubkind, Stage } from "@prisma/client";
import type { GateResult } from "@/lib/stages";

export const QUIZ_NOT_PASSED_MSG =
  "Comprehension check not passed yet — pass the quiz on this stage's guide card.";
const LEARNER_PROOF: Partial<Record<Stage, ArtifactSubkind>> = {
  REQUIREMENTS: "REQUIREMENTS_DOC", SCHEMATIC: "SCHEMATIC_FILE", LAYOUT: "LAYOUT_FILE",
};
const PROOF_LABEL: Record<string, string> = {
  REQUIREMENTS_DOC: "requirements doc", SCHEMATIC_FILE: "schematic", LAYOUT_FILE: "layout file",
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

**Step 4:** Green. **Step 5:** Commit. `feat(progress): learnerExitGate predicate`.

### Task 2.4 — loadLearnerGateContext (TDD)

**Files:** Create `src/lib/load-learner-gate-context.ts`, `src/lib/__tests__/load-learner-gate-context.test.ts`.

**Step 1 — failing test:** seed an enrollment + one `SCHEMATIC_FILE` enrollment artifact + a `SCHEMATIC` quiz pass; assert the loader returns `{ enrollmentArtifacts: [{subkind:"SCHEMATIC_FILE"}], quizPasses: Set(["SCHEMATIC"]) }`.

**Step 2:** Red.

**Step 3 — implement:**
```ts
export async function loadLearnerGateContext(tx: TxClient, enrollmentId: string): Promise<LearnerGateContext> {
  const [artifacts, quiz] = await Promise.all([
    tx.artifact.findMany({ where: { enrollmentId }, select: { subkind: true } }),
    tx.quizPass.findMany({ where: { enrollmentId }, select: { stage: true } }),
  ]);
  return { enrollmentArtifacts: artifacts, quizPasses: new Set(quiz.map((q) => q.stage)) };
}
```

**Step 4:** Green. **Step 5:** Commit. `feat(progress): loadLearnerGateContext`.

### Task 2.5 — `enroll` action (TDD)

**Files:** Create `src/lib/actions/enrollment.ts`, `src/lib/__tests__/enrollment-actions.test.ts`.

**Step 1 — failing test:** as a LEARNER, `enroll({ projectId })` for a project whose `publishedRevisionId` is set → creates an `Enrollment` at REQUIREMENTS; calling again is idempotent (returns the same row); a project with no `publishedRevisionId` → throws "not open for enrollment". (DAG prereq gating arrives in Slice 3 — not asserted here.)

**Step 2:** Red.

**Step 3 — implement** `enroll`: `requireUser()`; load project `select: { id, publishedRevisionId }`; throw if null; `upsert` Enrollment on `userId_projectId` (`create` with `revisionId = publishedRevisionId`, `update: {}`); `revalidatePath`; return the enrollment id + status. Serializable tx + `withTxRetry`.

**Step 4:** Green. **Step 5:** Commit. `feat(progress): enroll action`.

### Task 2.6 — `advanceEnrollment` action (TDD)

**Files:** Modify `src/lib/actions/enrollment.ts`; `enrollment-actions.test.ts`.

**Step 1 — failing tests:** (a) blocked when the current stage's quiz isn't passed (returns `{ok:false, reasons:[QUIZ_NOT_PASSED_MSG]}`); (b) blocked at SCHEMATIC without a proof artifact; (c) advances REQUIREMENTS→SCHEMATIC when gate passes; (d) advancing into REVISION sets `status=COMPLETED` + `completedAt`; (e) optimistic-lock: a stale `expected` stage → "stale state".

**Step 2:** Red.

**Step 3 — implement** (mirror `advanceStage` structure):
```ts
export async function advanceEnrollment(input: unknown): Promise<AdvanceEnrollmentResult> {
  const { projectId } = advanceEnrollmentSchema.parse(input);
  const user = await requireUser();
  return withTxRetry(() => db.$transaction(async (tx) => {
    const e = await tx.enrollment.findUniqueOrThrow({
      where: { userId_projectId: { userId: user.id, projectId } },
      select: { id: true, currentStage: true, project: { select: { slug: true } } },
    });
    const stage = e.currentStage as StageName;
    const to = nextStage(stage);
    if (!to) throw new Error("Already at the final stage.");
    const ctx = await loadLearnerGateContext(tx, e.id);
    const gate = learnerExitGate(stage, ctx);
    if (!gate.ok) return { ok: false as const, reasons: gate.reasons };
    const now = new Date();
    const terminal = to === "REVISION";
    const rows = await tx.$executeRaw`
      UPDATE "Enrollment"
      SET "currentStage" = ${to}::"Stage", "currentStageEnteredAt" = ${now}
          ${terminal ? Prisma.sql`, "status" = 'COMPLETED', "completedAt" = ${now}` : Prisma.empty}
      WHERE "id" = ${e.id} AND "currentStage" = ${stage}::"Stage"`;
    if (rows === 0) throw new Error("Stale state — refresh.");
    revalidatePath(`/learn/${e.project.slug}`);
    return { ok: true as const, toStage: to };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
```
(`nextStage`/`StageName` import from `@/lib/stages`; export `nextStage` from there or inline `STAGE_ORDER`.)

**Step 4:** Green. **Step 5:** Commit. `feat(progress): advanceEnrollment with learner gate`.

### Task 2.7 — re-point `recordQuizPass` to the enrollment (TDD)

**Files:** Modify `src/lib/actions/quiz.ts`, `src/components/guide/QuizBlock.tsx` + `QuizContext` plumbing in `GuideBlocks.tsx`; `src/lib/__tests__/quiz-actions.test.ts` (create if absent).

**Step 1 — failing test:** `recordQuizPass({ enrollmentId, stage, score, total })` with full score upserts a `QuizPass` on `(enrollmentId, stage)`; partial score is refused.

**Step 2:** Red (schema still expects `revisionId`).

**Step 3 — implement:** change `recordQuizPassSchema` `revisionId`→`enrollmentId`; upsert on `enrollmentId_stage`; drop `assertNotFrozen` (enrollment artifacts/passes aren't frozen) OR keep an enrollment-status guard (refuse if `status !== IN_PROGRESS`? no — re-passing is fine; just upsert). Revalidate the learner guide path. Thread `enrollmentId` (not `revisionId`) through `QuizContext` → `QuizBlock`.

**Step 4:** Green. **Step 5:** Commit. `feat(progress): record quiz pass per enrollment`.

### Task 2.8 — seed a fixture enrollment; ship PR B

**Files:** Modify `prisma/seed.ts`.

**Step 1:** After the fixture revision is seeded, create an `Enrollment` for `seed@example.com` on the fixture project (`revisionId` = the fixture revision; `publishedRevisionId` set on the project), then `quizPass.createMany` keyed on that `enrollmentId` for the 8 stages (delete-then-createMany under the existing 20s tx timeout). Set `project.publishedRevisionId`.

**Step 2:** `pnpm db:seed`; `pnpm tsc` 0; full `pnpm vitest run` green.

**Step 3:** Branch `feature/per-user-enrollment` → PR B. Merge when CI green.

---

# SLICE 3 — Exam + mastery + DAG unlock  (PR C)

### Task 3.1 — Exam + ExamResult schema + migration

**Files:** `prisma/schema.prisma`; `prisma/migrations/20260607020000_exam/migration.sql`.

**Step 1 — schema:**
```prisma
model Exam {
  id            String  @id @default(cuid())
  projectId     String  @unique
  project       Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title         String
  passThreshold Int                 // percent 0–100
  questions     Json                // [{id,prompt,options[],correctIndex}] — answer key server-only
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  results       ExamResult[]
}
model ExamResult {
  id           String     @id @default(cuid())
  examId       String
  exam         Exam       @relation(fields: [examId], references: [id], onDelete: Cascade)
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  score Int
  total Int
  passed Boolean
  answers Json?
  submittedAt DateTime @default(now())
  @@index([enrollmentId])
}
```
Add `exam Exam?` to `Project`; `examResults ExamResult[]` to `Enrollment`.

**Step 2 — migration.sql:** `CREATE TABLE "Exam" (…)`, `CREATE TABLE "ExamResult" (…)`, unique on `Exam.projectId`, index on `ExamResult.enrollmentId`. Apply + generate. `pnpm tsc` 0. Commit.

### Task 3.2 — `getExam` strips the answer key (TDD)

**Files:** `src/lib/actions/exam.ts`, `src/lib/__tests__/exam-actions.test.ts`.

**Step 1 — failing test:** seed an exam with `correctIndex` on each question; `getExam(projectId)` returns questions with `prompt`/`options` but **no** `correctIndex` field on any question.

**Step 2:** Red. **Step 3:** implement `getExam`: `requireUser()`; load exam; map questions to `{ id, prompt, options }` (drop `correctIndex`). **Step 4:** Green. Commit.

### Task 3.3 — `submitExam` server-scores → MASTERED (TDD)

**Files:** `src/lib/actions/exam.ts`; `exam-actions.test.ts`.

**Step 1 — failing tests:** a perfect/above-threshold submission writes an `ExamResult{passed:true}` and sets the enrollment `status=MASTERED` + `masteredAt`; a below-threshold submission writes `passed:false` and leaves status unchanged; only a `COMPLETED`/`MASTERED` enrollment may submit (an `IN_PROGRESS` one throws "finish the board first").

**Step 2:** Red.

**Step 3 — implement** `submitExam({ projectId, answers })`: `requireUser()`; load the caller's enrollment + the exam (with answer key) in a Serializable tx; refuse if `status === IN_PROGRESS`; score `answers[i] === question.correctIndex`; `passed = round(score/total*100) >= passThreshold`; insert `ExamResult`; if `passed` set enrollment `status=MASTERED, masteredAt=now`. Revalidate. Return `{ score, total, passed }`.

**Step 4:** Green. **Step 5:** Commit. `feat(exam): server-scored submitExam → MASTERED`.

### Task 3.4 — board availability + enroll prereq gating (TDD)

**Files:** Create `src/lib/learner-board-availability.ts`; Modify `src/lib/actions/enrollment.ts` (enroll prereq check); tests.

**Step 1 — failing tests:** `learnerBoardAvailability(userId)` marks a board with an incomplete prerequisite (DAG `dependsOn`) as `locked` with the missing prereqs listed, and a board whose prereqs are all `COMPLETED`/`MASTERED` as `available`. `enroll` into a locked board throws "prerequisites not complete".

**Step 2:** Red.

**Step 3 — implement:** read `ProjectDependency` `dependsOn` edges + the user's enrollments; a project is available iff every prerequisite project has an enrollment with `status IN ('COMPLETED','MASTERED')`. Add the same check to `enroll` before creating the row.

**Step 4:** Green. **Step 5:** Commit. `feat(progress): completion-gated board availability`.

### Task 3.5 — seed a WROOM exam (optional) + ship PR C

Seed a small exam for `foundry-l1-01-wroom-breakout` (so the flow is demoable). `pnpm tsc` + full vitest green → branch `feature/per-user-exam` → PR C. Merge when CI green.

---

# SLICE 4 — Learner UI: guide, board, exam, transcript  (PR D)

> UI tasks verify via the webapp-testing skill (Playwright, headless Chromium, `wait_for_load_state('networkidle')`) + the auth-cookie method in [[verifying-auth-gated-pages]] — borrow the `authjs.session-token` cookie, use curl.exe/Playwright, not Invoke-WebRequest.

### Task 4.1 — admin `setPublishedRevision` + control

**Files:** `src/lib/actions/revisions.ts` (or `projects.ts`) — `setPublishedRevision({ projectId, revisionId })` behind `requireAdmin`, validates the revision belongs to the project + has a `Guide`; a control on the revision/project admin UI. TDD the action (admin-only; rejects a revision without a guide). Commit.

### Task 4.2 — enrollment-aware guide page

**Files:** `src/app/projects/[slug]/[revLabel]/guide/**` (+ `page.tsx`). For a signed-in learner with an enrollment, the guide reads `enrollment.currentStage` (not the revision's), threads `enrollmentId` into `QuizContext`/`QuizBlock` and the advance affordance (calls `advanceEnrollment`), and renders the learner gate's reasons. Admin preview keeps the author view. Verify with Playwright: a learner sees their own stage; passing the quiz + uploading the proof unlocks advance. Commit.

### Task 4.3 — board page: enroll / continue / locked

**Files:** the project/board landing page. Show **Enroll** (available), **Continue** (resume at `currentStage`), or **Locked** + prerequisite list, from `learnerBoardAvailability`. Playwright-verify the three states. Commit.

### Task 4.4 — exam page

**Files:** `src/app/learn/[slug]/exam/**`. Offered once `status ≥ COMPLETED`; renders `getExam` questions (no answer key in the payload — verify in the page source), submits to `submitExam`, shows score + mastery badge. Commit.

### Task 4.5 — transcript / progress

**Files:** `src/app/learn/**` (or `/me`). Per-user list of enrolled boards: stage progress, per-stage quiz grades (`score/total`), exam grade + `MASTERED` badge. Reads straight off Enrollment + QuizPass + ExamResult. Commit.

### Task 4.6 — ship PR D

Full `pnpm tsc` + vitest green; Playwright smoke of the learner journey (enroll → advance a stage gated by quiz+proof → finish → exam → mastery → next board unlocks). Branch `feature/per-user-learner-ui` → PR D. Merge when CI green.

---

## Cross-cutting / known limitations
- **Admin revocation staleness:** authz reads the DB `role` mirror, synced on sign-in; removing someone from `ALLOWED_EMAILS` takes effect on their next sign-in. Hardening (re-sync on hourly jwt refresh) is deferred.
- **Build chain not per-learner:** DRC_GERBER→BRINGUP are quiz-only for learners (shared reference demonstrates the real work). Full per-enrollment `Build`s are a future iteration.
- **Soft quiz scoring:** stage quizzes stay client-scored (cheatable, fine for self-paced); only the **exam** is server-scored, because it yields a credential.
- **Re-seed dependency:** the fixture enrollment (Task 2.8) is what keeps the ~23 integration tests green after the QuizPass re-key — don't drop it.
