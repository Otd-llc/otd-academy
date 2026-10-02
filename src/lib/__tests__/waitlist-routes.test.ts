// The confirm and remove routes (plan P.5): show on GET, act on POST, RFC 8058
// one-click on the remove POST, the headers that keep the token out of referrer
// logs and caches. DB-backed; the route modules are imported directly.
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { db } from "@/lib/db";
import { signWaitlistToken } from "@/lib/waitlist-token";
import * as confirmRoute from "@/app/email/confirm/[token]/route";
import * as removeRoute from "@/app/email/remove/[token]/route";

const EMAIL = "doi-route@example.com";
const params = (token: string) => ({ params: Promise.resolve({ token }) });
const req = (method: string, body?: string) =>
  new Request("https://academy.test/x", {
    method,
    body,
    headers: body
      ? { "Content-Type": "application/x-www-form-urlencoded" }
      : undefined,
  });

async function clean() {
  await db.hexReleaseNotify.deleteMany({ where: { email: EMAIL } });
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
beforeEach(async () => {
  await clean();
  await db.hexReleaseNotify.create({
    data: { email: EMAIL, release: "2026-10-01" },
  });
});

const row = () => db.hexReleaseNotify.findUnique({ where: { email: EMAIL } });

describe("confirm route", () => {
  const token = () =>
    signWaitlistToken({
      kind: "confirm",
      table: "HexReleaseNotify",
      email: EMAIL,
    });

  test("GET shows the button and confirms NOTHING (scanners follow links)", async () => {
    const res = await confirmRoute.GET(req("GET"), params(token()));
    expect(res.status).toBe(200);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('<form method="post"');
    expect(html).toContain(EMAIL);
    expect((await row())?.confirmedAt).toBeNull();
  });

  test("POST confirms; a second POST says already; the row is stamped once", async () => {
    const t = token();
    const first = await confirmRoute.POST(req("POST"), params(t));
    expect(first.status).toBe(200);
    expect(await first.text()).toContain("Confirmed");
    const stamped = (await row())?.confirmedAt;
    expect(stamped).not.toBeNull();
    const second = await confirmRoute.POST(req("POST"), params(t));
    expect(await second.text()).toContain("Already confirmed");
    expect((await row())?.confirmedAt?.getTime()).toBe(stamped!.getTime());
  });

  test("a tampered or wrong-kind token is refused on both methods", async () => {
    const bad = token().replace(/.$/, (c) => (c === "a" ? "b" : "a"));
    expect((await confirmRoute.GET(req("GET"), params(bad))).status).toBe(400);
    expect((await confirmRoute.POST(req("POST"), params(bad))).status).toBe(
      400,
    );
    const removeKind = signWaitlistToken({
      kind: "remove",
      table: "HexReleaseNotify",
      email: EMAIL,
    });
    expect(
      (await confirmRoute.POST(req("POST"), params(removeKind))).status,
    ).toBe(400);
    expect((await row())?.confirmedAt).toBeNull();
  });

  test("a confirm for a row that is gone says so, with a 400", async () => {
    await clean();
    const res = await confirmRoute.POST(req("POST"), params(token()));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Nothing to confirm");
  });
});

describe("remove route", () => {
  const token = () =>
    signWaitlistToken({
      kind: "remove",
      table: "HexReleaseNotify",
      email: EMAIL,
    });

  test("GET shows the button and removes NOTHING", async () => {
    const res = await removeRoute.GET(req("GET"), params(token()));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<form method="post"');
    expect(await row()).not.toBeNull();
  });

  test("POST from the page removes the row and renders a page", async () => {
    const res = await removeRoute.POST(req("POST"), params(token()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Removed");
    expect(await row()).toBeNull();
  });

  test("RFC 8058 one-click POST removes the row and answers in plain text", async () => {
    const res = await removeRoute.POST(
      req("POST", "List-Unsubscribe=One-Click"),
      params(token()),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("Removed");
    expect(await row()).toBeNull();
    const again = await removeRoute.POST(
      req("POST", "List-Unsubscribe=One-Click"),
      params(token()),
    );
    expect(await again.text()).toBe("Already removed");
  });

  test("a confirm-kind token does not remove", async () => {
    const wrong = signWaitlistToken({
      kind: "confirm",
      table: "HexReleaseNotify",
      email: EMAIL,
    });
    expect((await removeRoute.POST(req("POST"), params(wrong))).status).toBe(
      400,
    );
    expect(await row()).not.toBeNull();
  });
});
