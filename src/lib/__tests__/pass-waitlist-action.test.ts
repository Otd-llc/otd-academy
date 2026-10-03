// joinPassWaitlist — the userId stamp only ever lands on the SUBMITTER'S OWN
// row. Twin of the same rule in hex-release-notify.test.ts; found by plan
// validation (2026-09-30): a signed-in visitor typing a stranger's address used
// to claim that row.
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const mockAuth = vi.fn<() => Promise<unknown>>(async () => null);
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { joinPassWaitlist } from "@/lib/actions/pass-waitlist";

const EMAIL = "pass-waitlist-stamp-test@example.com";
const OTHER = "pass-waitlist-stamp-test-2@example.com";

async function clean() {
  await db.passWaitlist.deleteMany({
    where: { email: { in: [EMAIL, OTHER] } },
  });
}

beforeEach(async () => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
  await clean();
});
afterAll(clean);

describe("joinPassWaitlist userId stamp", () => {
  test("a mixed-case address is stored lowercase, and its case-variant is the same row", async () => {
    // 20261001120000_email_hygiene: one row per address whatever the typing.
    // Before it, these were two rows and two digests.
    await joinPassWaitlist({ email: EMAIL.toUpperCase() });
    await joinPassWaitlist({ email: EMAIL });
    const rows = await db.passWaitlist.findMany({
      where: { email: { in: [EMAIL, EMAIL.toUpperCase()] } },
    });
    expect(rows.map((r) => r.email)).toEqual([EMAIL]);
  });

  test("anonymous submit leaves userId null", async () => {
    await joinPassWaitlist({ email: EMAIL });
    const row = await db.passWaitlist.findUnique({ where: { email: EMAIL } });
    expect(row?.userId).toBeNull();
  });

  test("a signed-in visitor submitting SOMEONE ELSE'S address does not claim the row", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "signed-in-stranger@example.com" },
    });
    await joinPassWaitlist({ email: EMAIL });
    const row = await db.passWaitlist.findUnique({ where: { email: EMAIL } });
    expect(row?.userId).toBeNull();
  });

  test("a signed-in visitor submitting THEIR OWN address is stamped, case-insensitively", async () => {
    const me = await db.user.findFirst({ select: { id: true, email: true } });
    expect(me, "the seed has no user").not.toBeNull();
    const typed = me!.email.toUpperCase();
    await db.passWaitlist.deleteMany({
      where: { email: { in: [typed, me!.email] } },
    });
    mockAuth.mockResolvedValue({ user: { email: me!.email } });
    await joinPassWaitlist({ email: typed });
    // Stored lowercase since 20261001120000_email_hygiene: the row is under the
    // canonical address, whatever the visitor typed.
    const row = await db.passWaitlist.findUnique({
      where: { email: me!.email.toLowerCase() },
    });
    expect(row?.userId).toBe(me!.id);
    await db.passWaitlist.deleteMany({
      where: { email: { in: [typed, me!.email.toLowerCase()] } },
    });
  });

  test("an existing userId on a row is never overwritten", async () => {
    await db.passWaitlist.create({
      data: { email: OTHER, userId: "someone-else" },
    });
    mockAuth.mockResolvedValue({ user: { email: OTHER } });
    await joinPassWaitlist({ email: OTHER });
    const row = await db.passWaitlist.findUnique({ where: { email: OTHER } });
    expect(row?.userId).toBe("someone-else");
  });
});
