// The magic-link send's failure contract: every failure is recorded exactly
// once, BEFORE the body is read, and then surfaces as a PLAIN Error (never an
// AuthError, never a silent return). See CLAUDE.md "Signup abuse defense".
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureNow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/analytics", () => ({ captureNow }));

import { MAGIC_LINK_SEND_FAILED, sendMagicLinkEmail } from "@/lib/magic-link-send";

const MSG = {
  apiKey: "re_test",
  from: "OTD <noreply@example.test>",
  to: "learner@example.test",
  subject: "Sign in",
  html: "<p>link</p>",
  text: "link",
};

const fetchMock = vi.fn();

beforeEach(() => {
  captureNow.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Assert a thrown value is a plain Error: not a subclass (AuthError, SyntaxError). */
async function expectPlainError(p: Promise<unknown>): Promise<Error> {
  const err = await p.then(
    () => {
      throw new Error("expected a rejection, got a resolve");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(Error);
  expect(Object.getPrototypeOf(err)).toBe(Error.prototype);
  return err as Error;
}

describe("sendMagicLinkEmail — failures", () => {
  it("429: captures once with the status, then throws a plain Error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ name: "rate_limit_exceeded" }), { status: 429 }),
    );
    await expectPlainError(sendMagicLinkEmail(MSG));
    expect(captureNow).toHaveBeenCalledTimes(1);
    expect(captureNow).toHaveBeenCalledWith(
      MAGIC_LINK_SEND_FAILED,
      { status: 429 },
      "server:auth",
    );
  });

  it("500 with a NON-JSON body: still captures once, and the throw is a plain Error, not a SyntaxError", async () => {
    // The old code did `await res.json()` here, which threw a SyntaxError out of
    // the error path before anything was recorded.
    fetchMock.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", { status: 500 }),
    );
    const err = await expectPlainError(sendMagicLinkEmail(MSG));
    expect(err.message).toContain("500");
    expect(captureNow).toHaveBeenCalledTimes(1);
    expect(captureNow).toHaveBeenCalledWith(
      MAGIC_LINK_SEND_FAILED,
      { status: 500 },
      "server:auth",
    );
  });

  it("captures BEFORE the body is read", async () => {
    const order: string[] = [];
    captureNow.mockImplementationOnce(async () => {
      order.push("capture");
    });
    const res = new Response("nope", { status: 503 });
    const text = res.text.bind(res);
    res.text = async () => {
      order.push("body");
      return text();
    };
    fetchMock.mockResolvedValue(res);
    await expectPlainError(sendMagicLinkEmail(MSG));
    expect(order).toEqual(["capture", "body"]);
  });

  it("fetch rejects: captures once, then throws a plain Error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expectPlainError(sendMagicLinkEmail(MSG));
    expect(captureNow).toHaveBeenCalledTimes(1);
    expect(captureNow).toHaveBeenCalledWith(
      MAGIC_LINK_SEND_FAILED,
      { status: "fetch_rejected" },
      "server:auth",
    );
  });

  it("carries no address or body in the event", async () => {
    fetchMock.mockResolvedValue(new Response("learner@example.test", { status: 422 }));
    await expectPlainError(sendMagicLinkEmail(MSG));
    expect(JSON.stringify(captureNow.mock.calls)).not.toContain("example.test");
  });
});

describe("sendMagicLinkEmail — success", () => {
  it("a 200 resolves and records nothing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    await expect(sendMagicLinkEmail(MSG)).resolves.toBeUndefined();
    expect(captureNow).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      from: MSG.from,
      to: MSG.to,
      subject: MSG.subject,
      html: MSG.html,
      text: MSG.text,
    });
  });
});

describe("the Resend provider sends through this helper", () => {
  it("auth.ts has no second, unrecorded Resend POST", () => {
    const src = readFileSync("src/auth.ts", "utf8");
    expect(src).toContain("await sendMagicLinkEmail(");
    expect(src).not.toContain("api.resend.com");
  });
});
