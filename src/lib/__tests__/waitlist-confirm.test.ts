// Double opt-in: the inline confirmation send, its ledger, confirm / remove,
// and the retention sweep (plan P.5). DB-backed; Resend is an injected fetch.
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { db } from "@/lib/db";
import {
  confirmWaitlistRow,
  confirmationEmail,
  doubleOptInEnabled,
  removeWaitlistRow,
  RESEND_COOLDOWN_MS,
  sendWaitlistConfirmation,
  sweepWaitlists,
} from "@/lib/waitlist-confirm";
import { verifyWaitlistToken } from "@/lib/waitlist-token";

const EMAIL = "doi-test@example.com";
const ABOUT = {
  list: "the Hex Cluster release notice",
  promise: "when the next release lands",
};
const NOW = new Date("2026-10-01T12:00:00Z");

type Sent = { url: string; body: Record<string, unknown> };
function fakeResend(status = 200): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const f = (async (url: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(status === 200 ? '{"id":"x"}' : "nope", { status });
  }) as typeof fetch;
  return { fetch: f, sent };
}

async function clean() {
  await db.hexReleaseNotify.deleteMany({
    where: { email: { startsWith: "doi-" } },
  });
  await db.passWaitlist.deleteMany({
    where: { email: { startsWith: "doi-" } },
  });
  await db.waitlistSignup.deleteMany({
    where: { email: { startsWith: "doi-" } },
  });
}

let prevSwitch: string | undefined;
beforeAll(() => {
  prevSwitch = process.env.WAITLIST_DOUBLE_OPT_IN;
  process.env.WAITLIST_DOUBLE_OPT_IN = "true";
});
afterAll(async () => {
  if (prevSwitch === undefined) delete process.env.WAITLIST_DOUBLE_OPT_IN;
  else process.env.WAITLIST_DOUBLE_OPT_IN = prevSwitch;
  await clean();
});
beforeEach(clean);

describe("the switch", () => {
  test("reads live from process.env and defaults on", () => {
    expect(doubleOptInEnabled()).toBe(true);
    process.env.WAITLIST_DOUBLE_OPT_IN = "false";
    expect(doubleOptInEnabled()).toBe(false);
    process.env.WAITLIST_DOUBLE_OPT_IN = "0";
    expect(doubleOptInEnabled()).toBe(false);
    process.env.WAITLIST_DOUBLE_OPT_IN = "true";
    expect(doubleOptInEnabled()).toBe(true);
  });
});

describe("the confirmation email", () => {
  test("carries both links in html and text, names the list and the 7-day deletion, no em-dash", () => {
    const mail = confirmationEmail({
      about: ABOUT,
      confirmUrl: "https://academy.test/email/confirm/T1",
      removeUrl: "https://academy.test/email/remove/T2",
      host: "academy.test",
      postalAddress: "Somewhere 1",
    });
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("https://academy.test/email/confirm/T1");
      expect(part).toContain("https://academy.test/email/remove/T2");
      expect(part).toContain("7 days");
      expect(part).not.toContain("—");
    }
    expect(mail.subject).toBe("Confirm: the Hex Cluster release notice");
  });
});

describe("sendWaitlistConfirmation", () => {
  test("sends once, stamps the ledger, and the mail's links verify against the row", async () => {
    await db.hexReleaseNotify.create({
      data: { email: EMAIL, release: "2026-10-01" },
    });
    const r = fakeResend();
    const outcome = await sendWaitlistConfirmation(
      db,
      { table: "HexReleaseNotify", email: EMAIL },
      ABOUT,
      r.fetch,
      NOW,
    );
    expect(outcome).toBe("sent");
    expect(r.sent).toHaveLength(1);
    const body = r.sent[0].body;
    expect(body.to).toBe(EMAIL);
    const html = String(body.html);
    const confirmToken = /\/email\/confirm\/([A-Za-z0-9_.-]+)/.exec(html)?.[1];
    const removeToken = /\/email\/remove\/([A-Za-z0-9_.-]+)/.exec(html)?.[1];
    expect(verifyWaitlistToken(confirmToken!, "confirm", NOW)).toMatchObject({
      table: "HexReleaseNotify",
      email: EMAIL,
    });
    expect(verifyWaitlistToken(removeToken!, "remove", NOW)).toMatchObject({
      table: "HexReleaseNotify",
      email: EMAIL,
    });
    // RFC 8058 one-click points at the remove link.
    const headers = body.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toContain(
      `/email/remove/${removeToken}`,
    );
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const row = await db.hexReleaseNotify.findUnique({
      where: { email: EMAIL },
    });
    expect(row?.confirmSentAt?.getTime()).toBe(NOW.getTime());
    expect(row?.confirmedAt).toBeNull();
  });

  test("a repeat inside the cooldown sends nothing; after it, one more", async () => {
    await db.hexReleaseNotify.create({
      data: { email: EMAIL, release: "2026-10-01" },
    });
    const r = fakeResend();
    const key = { table: "HexReleaseNotify" as const, email: EMAIL };
    expect(await sendWaitlistConfirmation(db, key, ABOUT, r.fetch, NOW)).toBe(
      "sent",
    );
    const soon = new Date(NOW.getTime() + 60_000);
    expect(await sendWaitlistConfirmation(db, key, ABOUT, r.fetch, soon)).toBe(
      "cooldown",
    );
    const later = new Date(NOW.getTime() + RESEND_COOLDOWN_MS + 1);
    expect(await sendWaitlistConfirmation(db, key, ABOUT, r.fetch, later)).toBe(
      "sent",
    );
    expect(r.sent).toHaveLength(2);
  });

  test("an already-confirmed row and a missing row send nothing", async () => {
    await db.passWaitlist.create({ data: { email: EMAIL, confirmedAt: NOW } });
    const r = fakeResend();
    expect(
      await sendWaitlistConfirmation(
        db,
        { table: "PassWaitlist", email: EMAIL },
        ABOUT,
        r.fetch,
        NOW,
      ),
    ).toBe("already-confirmed");
    expect(
      await sendWaitlistConfirmation(
        db,
        { table: "PassWaitlist", email: "doi-nobody@example.com" },
        ABOUT,
        r.fetch,
        NOW,
      ),
    ).toBe("no-row");
    expect(r.sent).toHaveLength(0);
  });

  test("a failed send releases the ledger and throws, so the next submit retries", async () => {
    await db.passWaitlist.create({ data: { email: EMAIL } });
    const bad = fakeResend(500);
    await expect(
      sendWaitlistConfirmation(
        db,
        { table: "PassWaitlist", email: EMAIL },
        ABOUT,
        bad.fetch,
        NOW,
      ),
    ).rejects.toThrow(/confirmation send failed/);
    const row = await db.passWaitlist.findUnique({ where: { email: EMAIL } });
    expect(row?.confirmSentAt).toBeNull();
    const good = fakeResend();
    expect(
      await sendWaitlistConfirmation(
        db,
        { table: "PassWaitlist", email: EMAIL },
        ABOUT,
        good.fetch,
        NOW,
      ),
    ).toBe("sent");
  });

  test("with the switch off it is a no-op", async () => {
    process.env.WAITLIST_DOUBLE_OPT_IN = "false";
    try {
      await db.passWaitlist.create({ data: { email: EMAIL } });
      const r = fakeResend();
      expect(
        await sendWaitlistConfirmation(
          db,
          { table: "PassWaitlist", email: EMAIL },
          ABOUT,
          r.fetch,
          NOW,
        ),
      ).toBe("disabled");
      expect(r.sent).toHaveLength(0);
    } finally {
      process.env.WAITLIST_DOUBLE_OPT_IN = "true";
    }
  });
});

describe("confirm and remove", () => {
  test("confirm stamps once; a second confirm is 'already'; a missing row is 'gone'", async () => {
    await db.hexReleaseNotify.create({
      data: { email: EMAIL, release: "2026-10-01" },
    });
    const claims = {
      v: 1 as const,
      kind: "confirm" as const,
      table: "HexReleaseNotify" as const,
      email: EMAIL,
    };
    expect(await confirmWaitlistRow(db, claims, NOW)).toBe("confirmed");
    const row = await db.hexReleaseNotify.findUnique({
      where: { email: EMAIL },
    });
    expect(row?.confirmedAt?.getTime()).toBe(NOW.getTime());
    expect(
      await confirmWaitlistRow(db, claims, new Date(NOW.getTime() + 1)),
    ).toBe("already");
    expect(row?.confirmedAt?.getTime()).toBe(NOW.getTime());
    expect(
      await confirmWaitlistRow(
        db,
        { ...claims, email: "doi-nobody@example.com" },
        NOW,
      ),
    ).toBe("gone");
  });

  test("remove deletes the row for exactly that list and course", async () => {
    const project = await db.project.findFirst({ select: { id: true } });
    expect(project).not.toBeNull();
    const second = await db.project.findFirst({
      where: { id: { not: project!.id } },
      select: { id: true },
    });
    await db.waitlistSignup.createMany({
      data: [
        { email: EMAIL, projectId: project!.id },
        ...(second ? [{ email: EMAIL, projectId: second.id }] : []),
      ],
    });
    await db.passWaitlist.create({ data: { email: EMAIL } });
    expect(
      await removeWaitlistRow(db, {
        v: 1,
        kind: "remove",
        table: "WaitlistSignup",
        email: EMAIL,
        projectId: project!.id,
      }),
    ).toBe("removed");
    expect(
      await db.waitlistSignup.count({
        where: { email: EMAIL, projectId: project!.id },
      }),
    ).toBe(0);
    if (second) {
      expect(
        await db.waitlistSignup.count({
          where: { email: EMAIL, projectId: second.id },
        }),
      ).toBe(1);
    }
    expect(await db.passWaitlist.count({ where: { email: EMAIL } })).toBe(1);
    expect(
      await removeWaitlistRow(db, {
        v: 1,
        kind: "remove",
        table: "PassWaitlist",
        email: EMAIL,
      }),
    ).toBe("removed");
    expect(
      await removeWaitlistRow(db, {
        v: 1,
        kind: "remove",
        table: "PassWaitlist",
        email: EMAIL,
      }),
    ).toBe("gone");
  });
});

describe("sweepWaitlists", () => {
  test("deletes unconfirmed rows past 7 days and notified rows past 12 months, keeps the rest", async () => {
    const day = 24 * 60 * 60 * 1000;
    const stale = new Date(NOW.getTime() - 8 * day);
    const fresh = new Date(NOW.getTime() - 2 * day);
    const longAgo = new Date(NOW);
    longAgo.setMonth(longAgo.getMonth() - 13);
    const recently = new Date(NOW);
    recently.setMonth(recently.getMonth() - 2);
    await db.hexReleaseNotify.createMany({
      data: [
        {
          email: "doi-stale@example.com",
          release: "2026-10-01",
          createdAt: stale,
        },
        {
          email: "doi-fresh@example.com",
          release: "2026-10-01",
          createdAt: fresh,
        },
        {
          email: "doi-old-notified@example.com",
          release: "2026-10-01",
          createdAt: longAgo,
          confirmedAt: longAgo,
          notifiedAt: longAgo,
        },
        {
          email: "doi-recent-notified@example.com",
          release: "2026-10-01",
          createdAt: recently,
          confirmedAt: recently,
          notifiedAt: recently,
        },
        {
          email: "doi-confirmed-unnotified@example.com",
          release: "2026-10-01",
          createdAt: longAgo,
          confirmedAt: longAgo,
        },
      ],
    });
    await db.passWaitlist.createMany({
      data: [
        { email: "doi-pass-stale@example.com", createdAt: stale },
        {
          email: "doi-pass-confirmed@example.com",
          createdAt: longAgo,
          confirmedAt: longAgo,
        },
      ],
    });
    const r = await sweepWaitlists(db, NOW);
    expect(r).toEqual({ unconfirmed: 2, expired: 1 });
    const left = (
      await db.hexReleaseNotify.findMany({
        where: { email: { startsWith: "doi-" } },
      })
    )
      .map((x) => x.email)
      .sort();
    expect(left).toEqual([
      "doi-confirmed-unnotified@example.com",
      "doi-fresh@example.com",
      "doi-recent-notified@example.com",
    ]);
    expect(
      (
        await db.passWaitlist.findMany({
          where: { email: { startsWith: "doi-" } },
        })
      ).map((x) => x.email),
    ).toEqual(["doi-pass-confirmed@example.com"]);
  });
});
