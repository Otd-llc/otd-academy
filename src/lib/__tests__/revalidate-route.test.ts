// Guards for POST /api/cron/revalidate.
//
// The route exists so scripts can invalidate caches they cannot reach from
// outside a request context. It is guarded by CRON_SECRET, so the thing worth
// pinning is the guard: an unauthenticated caller must get nowhere, and must not
// even learn the route exists.
//
// `updateTag` is mocked because it only works inside a request context — the
// exact limitation the route exists to work around. What is asserted is which
// tags the route ASKS for, which is the contract a caller depends on.
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (t: string) => updateTag(t) }));

const SECRET = "test-cron-secret-value";
vi.mock("@/env", () => ({ env: { CRON_SECRET: SECRET } }));

const { POST } = await import("@/app/api/cron/revalidate/route");

function post(body: unknown, auth?: string): Request {
  return new Request("https://example.test/api/cron/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => updateTag.mockClear());

describe("POST /api/cron/revalidate — authorization", () => {
  it("404s a request with no Authorization header", async () => {
    const res = await POST(post({ tags: ["projects"] }));
    expect(res.status).toBe(404);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("404s a wrong secret, and invalidates nothing", async () => {
    const res = await POST(post({ tags: ["projects"] }, "Bearer not-the-secret"));
    expect(res.status).toBe(404);
    expect(updateTag).not.toHaveBeenCalled();
  });

  // 404 rather than 401 is the point: an unauthenticated caller cannot tell this
  // route apart from one that does not exist.
  it("answers 404, never 401", async () => {
    const res = await POST(post({}, "Bearer wrong"));
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/cron/revalidate — behaviour", () => {
  const auth = `Bearer ${SECRET}`;

  it("invalidates the broad tags it is given", async () => {
    const res = await POST(post({ tags: ["mini-lessons", "projects"] }, auth));
    expect(res.status).toBe(200);
    expect(updateTag).toHaveBeenCalledWith("mini-lessons");
    expect(updateTag).toHaveBeenCalledWith("projects");
    expect(updateTag).toHaveBeenCalledTimes(2);
  });

  it("scopes lesson and guide slugs rather than evicting everything", async () => {
    const res = await POST(
      post({ lessons: ["ohms-law"], guides: ["l1-01-wroom-breakout"] }, auth),
    );
    expect(res.status).toBe(200);
    expect(updateTag).toHaveBeenCalledWith("mini-lesson-ohms-law");
    expect(updateTag).toHaveBeenCalledWith("guide-content-l1-01-wroom-breakout");
    // NOT the library-wide tag: a one-lesson seed must not evict the rest.
    expect(updateTag).not.toHaveBeenCalledWith("mini-lessons");
  });

  it("rejects a tag outside the allowlist instead of passing it through", async () => {
    const res = await POST(post({ tags: ["projects", "not-a-real-tag"] }, auth));
    expect(res.status).toBe(400);
    // ALL-OR-NOTHING: a partially-applied invalidation would be worse than none,
    // because the caller would believe the whole request landed.
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("treats an empty request as a no-op, not an error", async () => {
    const res = await POST(post({}, auth));
    expect(res.status).toBe(200);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and non-object bodies", async () => {
    expect((await POST(post("{not json", auth))).status).toBe(400);
    expect((await POST(post([1, 2, 3], auth))).status).toBe(400);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("rejects a wrong-shaped tags field", async () => {
    expect((await POST(post({ tags: "projects" }, auth))).status).toBe(400);
    expect((await POST(post({ lessons: [""] }, auth))).status).toBe(400);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
