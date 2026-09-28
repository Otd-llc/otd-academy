// The Hex download events THROUGH THE ONE CONSENT GATE (decision 1.14, #506).
//
// `printable_downloaded` and `printable_pack_downloaded` carry attribution
// (`src`, the first-touch `otd_src`, the referrer),
// so they are class (b): sent only when the request's c15t cookie grants
// `measurement`. The routes build no gate of their own; the rule lives in
// `@/lib/analytics` and the cookie is read by `@/lib/server-consent`, the ONE
// server consent reader. So nothing here mocks `@/lib/analytics`: the routes run
// against the real choke point, with only posthog-node, R2 and the request's
// cookie store faked.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

import { HEX_RELEASE } from "@/lib/hex-spec";
import { OPERATIONAL_EVENTS } from "@/lib/analytics";

const { sent, cookieJar, r2 } = vi.hoisted(() => ({
  sent: [] as { distinctId: string; event: string; properties: Record<string, unknown> }[],
  // What `next/headers` `cookies()` sees: the same cookies the request carries.
  cookieJar: { value: {} as Record<string, string> },
  r2: {
    headR2Object: vi.fn(),
    presignGet: vi.fn(),
    getR2ObjectBytes: vi.fn(),
  },
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture(m: { distinctId: string; event: string; properties: Record<string, unknown> }) {
      sent.push(m);
    }
    async captureImmediate(m: {
      distinctId: string;
      event: string;
      properties: Record<string, unknown>;
    }) {
      sent.push(m);
    }
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name in cookieJar.value ? { value: cookieJar.value[name]! } : undefined,
  }),
}));

vi.mock("@/lib/part-r2", () => r2);
vi.mock("@/lib/hex-flags", () => ({ hexFlag: async () => true }));

// The tables' release is published for this file only, as in
// printable-pack-budget-route.test.ts; the publication gate is proven there.
vi.mock("@/lib/printable-releases", async () => {
  const actual = await vi.importActual<typeof import("@/lib/printable-releases")>(
    "@/lib/printable-releases",
  );
  const { HEX_RELEASE: live } =
    await vi.importActual<typeof import("@/lib/hex-spec")>("@/lib/hex-spec");
  return {
    ...actual,
    isPublishedRelease: (r: string | undefined) =>
      r !== undefined && (actual.PUBLISHED_RELEASES.has(r) || r === live),
  };
});

/** c15t's own cookie after "Accept All", and after "Reject All". */
const GRANTED = "c.necessary:1,c.measurement:1,i.time:1759000000000,i.type:all";
const REFUSED = "c.necessary:1,i.time:1759000000000,i.type:necessary";

const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="1" type="model"><mesh>
  <vertices><vertex x="0" y="0" z="0" /></vertices>
  <triangles><triangle v1="0" v2="0" v3="0" /></triangles>
 </mesh></object></resources>
 <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0" /></build>
</model>`;
let PART_3MF: Buffer;

beforeAll(async () => {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", MODEL);
  PART_3MF = await zip.generateAsync({ type: "nodebuffer" });
});

beforeEach(() => {
  sent.length = 0;
  r2.headR2Object.mockReset().mockResolvedValue({ contentLength: 1234 });
  r2.presignGet.mockReset().mockResolvedValue("https://r2.example.test/signed");
  r2.getR2ObjectBytes
    .mockReset()
    .mockImplementation(async (key: string) =>
      key.endsWith("LICENSE.txt") ? Buffer.from("CC BY 4.0\n") : PART_3MF,
    );
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function setup(cookies: Record<string, string>) {
  vi.stubEnv("R2_ENABLED", "true");
  vi.stubEnv("R2_BUCKET", "test-bucket");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
  vi.resetModules();
  cookieJar.value = cookies;
  const { NextRequest } = await import("next/server");
  const analytics = await import("@/lib/analytics");
  analytics.__resetAnalyticsClientForTests();
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  const req = (url: string) =>
    new NextRequest(url, {
      headers: { referer: "https://example.test/", ...(cookie ? { cookie } : {}) },
    });
  return { req, settle: () => analytics.__lastCaptureForTests() };
}

/** One printable download; the events PostHog received. */
async function printable(cookies: Record<string, string>) {
  const { req, settle } = await setup(cookies);
  const { GET } = await import("@/app/api/printable/[...path]/route");
  const path = [HEX_RELEASE, "LICENSE.txt"];
  const res = await GET(
    req(`https://academy.onethousanddrones.com/api/printable/${path.join("/")}?src=hex_page`),
    { params: Promise.resolve({ path }) },
  );
  expect(res.status).toBe(302);
  await settle();
  return sent.filter((m) => m.event === "printable_downloaded");
}

/** One pack download, following the canonical redirect once. */
async function pack(cookies: Record<string, string>) {
  const { req, settle } = await setup(cookies);
  const { GET } = await import("@/app/api/printable-pack/route");
  const base = "https://academy.onethousanddrones.com";
  let res = await GET(
    req(`${base}/api/printable-pack?release=${HEX_RELEASE}&parts=hex-main:1&src=configurator`),
  );
  if (res.status === 307) {
    res = await GET(req(new URL(res.headers.get("location")!, base).toString()));
  }
  expect(res.status).toBe(200);
  await settle();
  return sent.filter((m) => m.event === "printable_pack_downloaded");
}

describe.each([
  ["printable_downloaded", printable],
  ["printable_pack_downloaded", pack],
] as const)("%s is class (b): through the one gate", (event, run) => {
  it("is not on the operational (class a) list", () => {
    expect(Object.hasOwn(OPERATIONAL_EVENTS, event)).toBe(false);
  });

  it.each([
    ["no c15t cookie", { otd_src: "hackaday" }],
    ["a refused c15t cookie", { c15t: REFUSED, otd_src: "hackaday" }],
  ])("sends NOTHING with %s: no download, no attribution", async (_l, cookies) => {
    expect(await run(cookies)).toEqual([]);
  });

  it("sends the event, and its attribution once measurement is granted", async () => {
    const events = await run({ c15t: GRANTED, otd_src: "hackaday" });
    expect(events).toHaveLength(1);
    expect(events[0]!.properties).toMatchObject({
      otd_src: "hackaday",
      referrer: "https://example.test/",
    });
    expect(events[0]!.properties.src).toMatch(/^(hex_page|configurator)$/);
    expect(events[0]!.properties).not.toHaveProperty("$process_person_profile");
  });
});
