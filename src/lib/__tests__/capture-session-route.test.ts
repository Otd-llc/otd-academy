import { beforeEach, describe, expect, test, vi } from "vitest";

// capture-token reads AUTH_SECRET from @/env; give it a deterministic one so the
// real signCaptureToken/verifyCaptureToken round-trip in-test.
vi.mock("@/env", () => ({ env: { AUTH_SECRET: "test-secret" } }));

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { guideCard: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

import { GET } from "@/app/api/capture/session/route";
import { signCaptureToken } from "@/lib/capture-token";

const BASE = "https://academy.onethousanddrones.com/api/capture/session";
const req = (token?: string) =>
  new Request(token ? `${BASE}?token=${encodeURIComponent(token)}` : BASE);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/capture/session", () => {
  test("400 with no token", async () => {
    expect((await GET(req())).status).toBe(400);
  });

  test("401 with a bad token", async () => {
    expect((await GET(req("not.a.token"))).status).toBe(401);
  });

  test("200 returns the slot bundle incl. script for a video block", async () => {
    findUnique.mockResolvedValue({
      contentBlocks: [
        {
          type: "video",
          src: "",
          alt: "solder a row",
          caption: "First solder joint",
          captureHint: "KiCad ▸ pcb",
          aspect: "16:9",
          script: "Today we solder the first row…",
        },
      ],
    });
    const token = signCaptureToken({ cardId: "c1", blockIndex: 0, kind: "video" });
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      kind: "video",
      hint: "KiCad ▸ pcb",
      caption: "First solder joint",
      aspect: "16:9",
      script: "Today we solder the first row…",
    });
  });

  test("200 with script:'' when the block has no script", async () => {
    findUnique.mockResolvedValue({
      contentBlocks: [{ type: "video", src: "", alt: "a" }],
    });
    const token = signCaptureToken({ cardId: "c1", blockIndex: 0, kind: "video" });
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect((await res.json()).script).toBe("");
  });
});
