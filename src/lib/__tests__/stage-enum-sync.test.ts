// STAGE_VALUES (the Zod literal set in schemas/project-dependency) is a
// HAND-MIRROR of the Prisma `enum Stage`. Adding/renaming a stage in the schema
// without updating the mirror silently mis-validates (z.enum rejects the new
// stage at runtime) and the stage-clear XP map falls back to its default. This
// test couples the two so a schema change that forgets the mirror fails CI.
import { describe, expect, test } from "vitest";
import { Stage } from "@prisma/client";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";
import { STAGE_CLEAR_XP_BY_STAGE } from "@/lib/logbook/economy";

describe("Stage enum ↔ STAGE_VALUES sync", () => {
  test("STAGE_VALUES equals the Prisma Stage enum (as a set)", () => {
    expect([...STAGE_VALUES].sort()).toEqual(Object.values(Stage).sort());
  });

  test("every Stage has an explicit stage-clear XP entry (no silent fallback)", () => {
    for (const s of Object.values(Stage)) {
      expect(STAGE_CLEAR_XP_BY_STAGE[s]).toBeTypeOf("number");
    }
  });
});
