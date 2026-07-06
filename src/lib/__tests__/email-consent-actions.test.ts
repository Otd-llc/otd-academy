// Tests for setEmailConsent (GDPR opt-in). Throwaway user so it never touches the
// seed fixture. Verifies: a new user starts opted OUT (schema default false);
// opting in flips consent true and stamps emailConsentUpdatedAt; opting out flips
// it false; an untrusted non-boolean argument can never enable consent; and the
// action requires a signed-in user.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { setEmailConsent } from "@/lib/actions/email-consent";

const EMAIL = "consent-learner@example.com";
let userId = "";

async function row() {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { emailConsent: true, emailConsentUpdatedAt: true },
  });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "Consent", role: "LEARNER" },
  });
  userId = user.id;
  mockAuth.mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: userId } });
});

describe("setEmailConsent", () => {
  test("a new user starts opted out with no recorded choice", async () => {
    const u = await row();
    expect(u.emailConsent).toBe(false);
    expect(u.emailConsentUpdatedAt).toBeNull();
  });

  test("opting in flips consent true and stamps the timestamp", async () => {
    mockAuth.mockResolvedValue({ user: { email: EMAIL } });
    const res = await setEmailConsent(true);
    expect(res.emailConsent).toBe(true);
    const u = await row();
    expect(u.emailConsent).toBe(true);
    expect(u.emailConsentUpdatedAt).toBeInstanceOf(Date);
  });

  test("opting out flips consent false and re-stamps the timestamp", async () => {
    const res = await setEmailConsent(false);
    expect(res.emailConsent).toBe(false);
    const u = await row();
    expect(u.emailConsent).toBe(false);
    expect(u.emailConsentUpdatedAt).toBeInstanceOf(Date);
  });

  test("a truthy non-boolean argument can never enable consent", async () => {
    // A server-action argument is deserialized from the client and must be coerced,
    // not trusted. A truthy string must NOT be read as opt-in.
    // @ts-expect-error deliberately passing a non-boolean to exercise the coercion
    const res = await setEmailConsent("yes");
    expect(res.emailConsent).toBe(false);
  });

  test("throws when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(setEmailConsent(true)).rejects.toThrow();
  });
});
