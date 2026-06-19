import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({ env: { CRON_SECRET: "test-secret" } }));
vi.mock("@/lib/db", () => ({ db: {} }));

const digikeyConfigured = vi.fn(() => false);
const makeDigikeyClient = vi.fn(async () => ({ searchByMpn: vi.fn() }));
vi.mock("@/lib/digikey", () => ({
  digikeyConfigured: () => digikeyConfigured(),
  makeDigikeyClient: () => makeDigikeyClient(),
}));

const refreshAvailability = vi.fn(async (_a: unknown) => ({ checked: 3, changed: 1 }));
vi.mock("@/lib/refresh-availability", () => ({
  refreshAvailability: (a: unknown) => refreshAvailability(a),
}));

import { GET } from "@/app/api/cron/refresh-availability/route";

const URL_ = "https://academy.onethousanddrones.com/api/cron/refresh-availability";

beforeEach(() => {
  vi.clearAllMocks();
  digikeyConfigured.mockReturnValue(false);
});

describe("GET /api/cron/refresh-availability", () => {
  test("401 with no Authorization header", async () => {
    const res = await GET(new Request(URL_));
    expect(res.status).toBe(401);
  });

  test("401 with the wrong secret", async () => {
    const res = await GET(new Request(URL_, { headers: { authorization: "Bearer nope" } }));
    expect(res.status).toBe(401);
  });

  test("200 + skipped when DigiKey is not configured", async () => {
    const res = await GET(
      new Request(URL_, { headers: { authorization: "Bearer test-secret" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toMatch(/not configured/);
    expect(refreshAvailability).not.toHaveBeenCalled();
  });

  test("runs the refresh when authorized + configured", async () => {
    digikeyConfigured.mockReturnValue(true);
    const res = await GET(
      new Request(URL_, { headers: { authorization: "Bearer test-secret" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, checked: 3, changed: 1 });
    expect(refreshAvailability).toHaveBeenCalledOnce();
  });
});
