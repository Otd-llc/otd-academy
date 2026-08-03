// Tests for `notifyOnHexRelease` — the anonymous capture offered AFTER a
// printables download has already started.
//
// The behaviours worth pinning are the ones a future edit could quietly break:
// it is idempotent on email, a repeat submit does NOT overwrite `release` (the
// first one is the honest answer to "which release brought them in"), a bad
// email is REJECTED rather than stored, and the release string is bounded so an
// anonymous caller cannot write arbitrary text into the row.
//
// `@/auth` is mocked: importing it for real pulls next-auth, which drags in
// `next/server` and fails to resolve under vitest. The action only uses it to
// stamp a userId when a session happens to exist, and anonymous is the expected
// case here, so a null session is the honest default for these.
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// Outside a request scope headers() throws. Empty headers → no client IP → the
// IP rule is skipped (the limiter is unconfigured in tests anyway).
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("@/auth", () => ({ auth: async () => null }));

import { db } from "@/lib/db";
import { notifyOnHexRelease } from "@/lib/actions/hex-release-notify";

const EMAIL = "hex-notify-test@example.com";
const OTHER = "hex-notify-test-2@example.com";
const RELEASE = "2026-07-31";

async function clean() {
  await db.hexReleaseNotify.deleteMany({
    where: { email: { in: [EMAIL, OTHER] } },
  });
}

beforeEach(clean);
afterAll(clean);

describe("notifyOnHexRelease", () => {
  test("an anonymous submit creates one row carrying the release", async () => {
    const res = await notifyOnHexRelease({ email: EMAIL, release: RELEASE });
    expect(res).toEqual({ ok: true });

    const row = await db.hexReleaseNotify.findUnique({ where: { email: EMAIL } });
    expect(row?.release).toBe(RELEASE);
    // Nothing has been sent yet, so the ledger is open.
    expect(row?.notifiedAt).toBeNull();
    expect(row?.userId).toBeNull();
  });

  test("a repeat submit is a no-op, not a duplicate or a throw", async () => {
    await notifyOnHexRelease({ email: EMAIL, release: RELEASE });
    const res = await notifyOnHexRelease({ email: EMAIL, release: RELEASE });
    expect(res).toEqual({ ok: true });
    expect(await db.hexReleaseNotify.count({ where: { email: EMAIL } })).toBe(1);
  });

  test("coming back for a LATER release keeps the release that brought them in", async () => {
    await notifyOnHexRelease({ email: EMAIL, release: RELEASE });
    await notifyOnHexRelease({ email: EMAIL, release: "2027-01-01" });

    const row = await db.hexReleaseNotify.findUnique({ where: { email: EMAIL } });
    expect(row?.release).toBe(RELEASE);
  });

  test("a malformed email is refused and writes nothing", async () => {
    const res = await notifyOnHexRelease({
      email: "not-an-email",
      release: RELEASE,
    });
    expect(res.ok).toBe(false);
    expect(await db.hexReleaseNotify.count({ where: { email: EMAIL } })).toBe(0);
  });

  test("an off-grammar release is refused — this string comes from a stranger", async () => {
    for (const release of ["latest", "2026-7-31", "2026-07-31; drop", ""]) {
      const res = await notifyOnHexRelease({ email: OTHER, release });
      expect(res.ok).toBe(false);
    }
    expect(await db.hexReleaseNotify.count({ where: { email: OTHER } })).toBe(0);
  });

  test("the refusal never leaks which field failed", async () => {
    const res = await notifyOnHexRelease({ email: OTHER, release: "latest" });
    // One flat message for every refusal: a caller probing the endpoint learns
    // nothing about the shape it wants.
    expect(res.ok === false && res.error).toMatch(/email address/i);
  });
});
