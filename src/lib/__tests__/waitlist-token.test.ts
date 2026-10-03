// The signed confirm / remove links (plan P.5). No DB.
import { describe, expect, test } from "vitest";

import {
  CONFIRM_TTL_MS,
  signWaitlistToken,
  verifyWaitlistToken,
} from "@/lib/waitlist-token";

const NOW = new Date("2026-10-01T12:00:00Z");

describe("waitlist tokens", () => {
  test("a confirm token round-trips, lowercases the address and carries an expiry", () => {
    const t = signWaitlistToken(
      { kind: "confirm", table: "PassWaitlist", email: "Ravi@Example.com" },
      NOW,
    );
    const c = verifyWaitlistToken(t, "confirm", NOW);
    expect(c).toMatchObject({
      kind: "confirm",
      table: "PassWaitlist",
      email: "ravi@example.com",
    });
    expect(c?.exp).toBe(NOW.getTime() + CONFIRM_TTL_MS);
  });

  test("a confirm token is refused once it has expired; a remove token never expires", () => {
    const late = new Date(NOW.getTime() + CONFIRM_TTL_MS + 1);
    const confirm = signWaitlistToken(
      { kind: "confirm", table: "HexReleaseNotify", email: "a@b.co" },
      NOW,
    );
    expect(verifyWaitlistToken(confirm, "confirm", late)).toBeNull();
    const remove = signWaitlistToken(
      { kind: "remove", table: "HexReleaseNotify", email: "a@b.co" },
      NOW,
    );
    const farFuture = new Date("2036-01-01T00:00:00Z");
    expect(verifyWaitlistToken(remove, "remove", farFuture)).toMatchObject({
      kind: "remove",
      email: "a@b.co",
    });
  });

  test("a token of one kind is not accepted as the other", () => {
    const remove = signWaitlistToken(
      { kind: "remove", table: "PassWaitlist", email: "a@b.co" },
      NOW,
    );
    expect(verifyWaitlistToken(remove, "confirm", NOW)).toBeNull();
    const confirm = signWaitlistToken(
      { kind: "confirm", table: "PassWaitlist", email: "a@b.co" },
      NOW,
    );
    expect(verifyWaitlistToken(confirm, "remove", NOW)).toBeNull();
  });

  test("tampering with the payload or the signature is refused", () => {
    const t = signWaitlistToken(
      { kind: "remove", table: "PassWaitlist", email: "a@b.co" },
      NOW,
    );
    const [body, sig] = t.split(".");
    const other = Buffer.from(
      JSON.stringify({
        v: 1,
        kind: "remove",
        table: "PassWaitlist",
        email: "z@b.co",
      }),
    ).toString("base64url");
    expect(verifyWaitlistToken(`${other}.${sig}`, "remove", NOW)).toBeNull();
    expect(
      verifyWaitlistToken(`${body}.${sig.slice(1)}x`, "remove", NOW),
    ).toBeNull();
    expect(verifyWaitlistToken("", "remove", NOW)).toBeNull();
    expect(verifyWaitlistToken("nodot", "remove", NOW)).toBeNull();
    expect(verifyWaitlistToken(`${body}.`, "remove", NOW)).toBeNull();
  });

  test("the per-course waitlist needs its projectId; the others carry none", () => {
    const withProject = signWaitlistToken(
      {
        kind: "confirm",
        table: "WaitlistSignup",
        email: "a@b.co",
        projectId: "proj1",
      },
      NOW,
    );
    expect(verifyWaitlistToken(withProject, "confirm", NOW)?.projectId).toBe(
      "proj1",
    );
    // A WaitlistSignup claim without a projectId is a forged or broken token.
    const body = Buffer.from(
      JSON.stringify({
        v: 1,
        kind: "remove",
        table: "WaitlistSignup",
        email: "a@b.co",
      }),
    ).toString("base64url");
    const forged = `${body}.${"a".repeat(43)}`;
    expect(verifyWaitlistToken(forged, "remove", NOW)).toBeNull();
    const plain = signWaitlistToken(
      { kind: "remove", table: "PassWaitlist", email: "a@b.co" },
      NOW,
    );
    expect(
      verifyWaitlistToken(plain, "remove", NOW)?.projectId,
    ).toBeUndefined();
  });
});
