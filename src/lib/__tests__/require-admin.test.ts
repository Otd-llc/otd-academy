// Tests for `requireAdmin` — the authz guard for curriculum-authoring mutations.
// It builds on `requireUser` (session → DB User row) and additionally asserts
// the DB `role` mirror is ADMIN, throwing Forbidden for LEARNERs.
//
// Self-contained: creates its own LEARNER + ADMIN users (does not depend on the
// seed operator's role), so it stays correct regardless of seed ordering.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Mock @/auth — we control the session per-test by mutating the mock.
const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";

const LEARNER_EMAIL = "require-admin-learner@example.com";
const ADMIN_EMAIL = "require-admin-admin@example.com";

beforeAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [LEARNER_EMAIL, ADMIN_EMAIL] } },
  });
  await db.user.create({
    data: { email: LEARNER_EMAIL, name: "Learner", role: "LEARNER" },
  });
  await db.user.create({
    data: { email: ADMIN_EMAIL, name: "Admin", role: "ADMIN" },
  });
});

afterAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [LEARNER_EMAIL, ADMIN_EMAIL] } },
  });
});

describe("requireAdmin", () => {
  test("throws Forbidden for a LEARNER", async () => {
    mockAuth.mockResolvedValue({ user: { email: LEARNER_EMAIL } });
    await expect(requireAdmin()).rejects.toThrow(/Forbidden/);
  });

  test("returns the user for an ADMIN", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
    const user = await requireAdmin();
    expect(user.email).toBe(ADMIN_EMAIL);
    expect(user.role).toBe("ADMIN");
  });

  test("throws Unauthorized when no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow(/Unauthorized/);
  });
});
