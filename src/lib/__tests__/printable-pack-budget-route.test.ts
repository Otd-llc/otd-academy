// The pack route rebuilt for v2 (launch readiness 5.5), end to end, with R2
// mocked: one plate per request, a byte budget priced BEFORE any R2 read, the
// bed floor, the canonical-URL redirect and the year-long plate cache.
//
// V2 PARTS, AGAINST THE REAL TABLES. The catalogue, the geometry and the byte
// table are the generated 4.6 tables (`hex-release-tables.ts`,
// `hex-part-bytes.ts`), used as committed. The one mock on the catalogue adds a
// single GHOST slug with no byte row, which is the only way to reach "a member
// the budget cannot price" once the generator makes the two lists the same.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import type { NextRequest } from "next/server";

import { HEX_PART_BYTES } from "@/lib/hex-part-bytes";
import { PACK_BYTE_BUDGET } from "@/lib/hex-pack-budget";
import { HEX_RELEASE } from "@/lib/hex-spec";

const RELEASE = HEX_RELEASE;

/** A member of the catalogue with NO byte row: what "unknown to the budget"
 *  looks like once 4.6 has made the two tables the same list. */
const GHOST = "hex-ghost-part";

vi.mock("@/lib/hex-parts", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/hex-parts")>("@/lib/hex-parts");
  const { HEX_PART_BYTES: bytes } = await vi.importActual<
    typeof import("@/lib/hex-part-bytes")
  >("@/lib/hex-part-bytes");
  const slugs = [...Object.keys(bytes), "hex-ghost-part"].sort();
  const set = new Set(slugs);
  return {
    ...actual,
    HEX_PART_SLUGS: slugs,
    isHexPartSlug: (v: string) => set.has(v),
  };
});

const flag = vi.hoisted(() => ({ pack: true }));
vi.mock("@/lib/hex-flags", () => ({
  hexFlag: async () => flag.pack,
}));

const getBytes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/part-r2", () => ({ getR2ObjectBytes: getBytes }));

const captured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ capture: captured }));

const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="1" type="model"><mesh>
  <vertices><vertex x="0" y="0" z="0" /></vertices>
  <triangles><triangle v1="0" v2="0" v3="0" /></triangles>
 </mesh></object></resources>
 <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0" /></build>
</model>`;
let PART_3MF: Buffer;
const LICENCE = Buffer.from("Hex Cluster -- CC BY 4.0\n");

beforeAll(async () => {
  const zip = new JSZip();
  zip.file("3D/3dmodel.model", MODEL);
  PART_3MF = await zip.generateAsync({ type: "nodebuffer" });
});

beforeEach(() => {
  flag.pack = true;
  getBytes.mockReset();
  captured.mockReset();
  getBytes.mockImplementation(async (key: string) =>
    key.endsWith("LICENSE.txt") ? LICENCE : PART_3MF,
  );
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

const PATH = "/api/printable-pack";

function request(query: string): NextRequest {
  return {
    nextUrl: new URL(`https://academy.onethousanddrones.com${PATH}?${query}`),
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

/** Exactly the request written: no redirect followed. */
async function callRaw(query: string): Promise<Response> {
  vi.stubEnv("R2_ENABLED", "true");
  vi.stubEnv("R2_BUCKET", "test-bucket");
  vi.resetModules();
  const { GET } = await import("@/app/api/printable-pack/route");
  return GET(request(query));
}

/** As a browser: one 307 followed, and the target must not redirect again. */
async function call(query: string): Promise<Response> {
  const first = await callRaw(query);
  if (first.status !== 307) return first;
  const location = first.headers.get("location")!;
  const second = await callRaw(location.slice(`${PATH}?`.length));
  expect(second.status, "the canonical URL must not redirect").not.toBe(307);
  return second;
}

/** A path-relative link out of a response body, back into a query. */
const queryOf = (link: string) => link.slice(`${PATH}?`.length);

const plateEntries = (zip: JSZip) =>
  Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith(".3mf"));

describe("a 20-cell build is served as one link per plate", () => {
  // What the configurator sends for 20 cells, each with a cover, and six edge
  // caps of each hand -- in the configurator's order, not the canonical one.
  const BUILD =
    `release=${RELEASE}&parts=hex-main:20,hex-main-cover:20,` +
    "hex-cap-edge-1h-m:6,hex-cap-edge-1h-f:6&plate=350x350&bedFrom=account";

  it("is priced over the budget, so the whole-pack answer is the list of plates", async () => {
    // 20 x 152 KB + 20 x 378 KB + 12 x 56 KB = 11.3 MB against 8 MB.
    const res = await call(BUILD);
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(text).toContain("11.3 MB");
    expect(text).toContain("one plate at a time");
    const links = text.split("\n").filter((l) => l.startsWith(`${PATH}?`));
    // A v2 `hex-main` is one to a 350 mm plate, so at least 20 plates.
    expect(links.length).toBeGreaterThanOrEqual(20);
    expect(text).toContain(`(${links.length} plates)`);
    links.forEach((link, i) => {
      expect(link.endsWith(`&plate_index=${i + 1}`)).toBe(true);
    });
    // Priced and planned on the tables alone.
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("serves every link: one plate each, all 52 parts across them, each under the budget", async () => {
    const text = await (await call(BUILD)).text();
    const links = text.split("\n").filter((l) => l.startsWith(`${PATH}?`));
    const n = links.length;
    let objects = 0;
    for (let i = 0; i < n; i++) {
      getBytes.mockClear();
      // THE LINK IS CANONICAL: served straight, never redirected.
      const res = await callRaw(queryOf(links[i]));
      expect(res.status, links[i]).toBe(200);
      expect(res.headers.get("content-disposition")).toContain(
        `OTD-Hex-Cluster-plate-${i + 1}-of-${n}.zip`,
      );
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.byteLength).toBeLessThanOrEqual(PACK_BYTE_BUDGET);
      const zip = await JSZip.loadAsync(body);
      const plates = plateEntries(zip);
      expect(plates.map((p) => p.name)).toEqual([
        `plates/OTD-Hex-Cluster-plate-${i + 1}-of-${n}.3mf`,
      ]);
      const readme = await zip.file("README.txt")!.async("string");
      expect(readme).toContain(`plate ${i + 1} of ${n}`);
      expect(zip.file("LICENSE.txt")).not.toBeNull();
      const model = await (
        await JSZip.loadAsync(await plates[0].async("nodebuffer"))
      )
        .file("3D/3dmodel.model")!
        .async("string");
      objects += model.match(/<object\b/g)?.length ?? 0;
      // ONLY the parts on this plate are read, once each, plus the licence.
      // Every v2 part is published under its slug, so the model says which
      // parts are on the plate.
      const onPlate = [
        ...new Set([...model.matchAll(/<object\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1])),
      ].sort();
      const keys = getBytes.mock.calls.map((c) => c[0] as string);
      expect(keys.filter((k) => k.endsWith("LICENSE.txt"))).toHaveLength(1);
      expect(
        keys
          .filter((k) => !k.endsWith("LICENSE.txt"))
          .map((k) => k.replace(`printables/${RELEASE}/3mf/`, "").replace(/\.3mf$/, ""))
          .sort(),
      ).toEqual(onPlate);
    }
    expect(objects).toBe(52);
  });

  it("gives a plate URL a year on the CDN, tagged by release", async () => {
    const text = await (await call(BUILD)).text();
    const first = text.split("\n").find((l) => l.startsWith(`${PATH}?`))!;
    const res = await callRaw(queryOf(first));
    expect(res.headers.get("vercel-cdn-cache-control")).toBe(
      "public, s-maxage=31536000",
    );
    expect(res.headers.get("vercel-cache-tag")).toBe(`pack-${RELEASE}`);
  });

  it("CONTROL: a whole pack under the budget is served whole, without the plate cache", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-main:2,hex-main-cover:2&plate=350x350`,
    );
    expect(res.status).toBe(200);
    expect(plateEntries(await JSZip.loadAsync(Buffer.from(await res.arrayBuffer())))
      .length).toBeGreaterThan(1);
    expect(res.headers.get("vercel-cdn-cache-control")).toBeNull();
    expect(res.headers.get("vercel-cache-tag")).toBeNull();
  });

  it("404s a plate the plan does not have, having read nothing", async () => {
    const res = await callRaw(
      `release=${RELEASE}&parts=hex-main&plate=350x350&plate_index=2`,
    );
    expect(res.status).toBe(404);
    expect(getBytes).not.toHaveBeenCalled();
  });
});

describe("the byte budget runs before any R2 read", () => {
  it("refuses hex-main-cover-cable:250 on a 1000 x 1000 bed, with zero R2 calls", async () => {
    // 250 x 550,006 bytes = 137.5 MB. Fits the plate cap and every grammar
    // cap, so only the budget can refuse it.
    const q = `release=${RELEASE}&parts=hex-main-cover-cable:250&plate=1000x1000`;
    const res = await callRaw(q);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("137.5 MB");
    expect(text).toContain("one plate at a time");
    expect(getBytes).not.toHaveBeenCalled();
    expect(captured).not.toHaveBeenCalled();
  });

  it("CONTROL: the same part under the budget is served, and does read", async () => {
    // 14 x 550 KB = 7.7 MB.
    const res = await callRaw(
      `release=${RELEASE}&parts=hex-main-cover-cable:14&plate=1000x1000`,
    );
    expect(res.status).toBe(200);
    expect(getBytes).toHaveBeenCalled();
  });

  it("refuses format=stl for every part, with zero R2 calls", async () => {
    const all = Object.keys(HEX_PART_BYTES).sort();
    // Every part: 293 names is over the 250-instance cap, so the grammar
    // refuses it first, flat.
    const every = await callRaw(
      `release=${RELEASE}&parts=${all.join(",")}&plate=220x220&format=stl`,
    );
    expect(every.status).toBe(400);
    // As many parts as the grammar admits: the BUDGET refuses it, and says so.
    // Σ STL bytes of these 250 is tens of megabytes.
    const most = await callRaw(
      `release=${RELEASE}&parts=${all.slice(0, 250).join(",")}&plate=220x220&format=stl`,
    );
    expect(most.status).toBe(400);
    expect(await most.text()).toContain("These STL files come to about");
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("CONTROL: a small STL selection is served as the loose zip", async () => {
    const res = await callRaw(
      `release=${RELEASE}&parts=hex-main:20&plate=220x220&format=stl`,
    );
    expect(res.status).toBe(200);
    expect(getBytes).toHaveBeenCalledWith(`printables/${RELEASE}/stl/hex-main.stl`);
  });

  it("refuses a catalogue part with no byte row as unknown, reading nothing", async () => {
    const res = await callRaw(`release=${RELEASE}&parts=${GHOST}&plate=220x220`);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Bad request");
    expect(getBytes).not.toHaveBeenCalled();
  });
});

describe("the bed", () => {
  it("refuses 180 x 180 with a message naming the floor, reading nothing", async () => {
    const res = await callRaw(`release=${RELEASE}&parts=hex-main&plate=180x180`);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("at least 220 x 220 mm");
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("refuses a bed over BED_MAX as malformed", async () => {
    const res = await callRaw(`release=${RELEASE}&parts=hex-main&plate=1001x1001`);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Bad request");
  });
});

describe("one URL per pack: anything else is a 307 to it", () => {
  it("redirects every non-canonical spelling to the one canonical query", async () => {
    const canon =
      `release=${RELEASE}&parts=hex-cap-edge-1h-f,hex-main:2&plate=256x256` +
      "&name=My%20Build&bedFrom=unknown";
    for (const q of [
      // parts unsorted, an explicit :1, a repeated part
      `release=${RELEASE}&parts=hex-main:1,hex-cap-edge-1h-f:1,hex-main&plate=256x256&name=My%20Build&bedFrom=nope`,
      // fields out of order
      `plate=256x256&release=${RELEASE}&parts=hex-cap-edge-1h-f,hex-main:2&name=My%20Build&bedFrom=unknown`,
      // a stray parameter
      `${canon}&utm_source=x`,
      // the default format spelled out
      `${canon}&format=3mf`,
      // a name spelled with + for the space
      canon.replace("My%20Build", "My+Build"),
    ]) {
      const res = await callRaw(q);
      expect(res.status, q).toBe(307);
      // PATH-RELATIVE: no scheme, no host.
      expect(res.headers.get("location"), q).toBe(`${PATH}?${canon}`);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("CONTROL: the canonical query itself is served, not redirected", async () => {
    const res = await callRaw(
      `release=${RELEASE}&parts=hex-cap-edge-1h-f,hex-main:2&plate=256x256` +
        "&name=My%20Build&bedFrom=unknown",
    );
    expect(res.status).toBe(200);
  });
});

describe("the kill switch still comes first", () => {
  it("answers 503 before the redirect, the bed floor and the budget", async () => {
    flag.pack = false;
    for (const q of [
      `plate=350x350&release=${RELEASE}&parts=hex-main`,
      `release=${RELEASE}&parts=hex-main&plate=180x180`,
      `release=${RELEASE}&parts=hex-main-cover-cable:250&plate=1000x1000`,
    ]) {
      const res = await callRaw(q);
      expect(res.status, q).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(getBytes).not.toHaveBeenCalled();
  });
});

describe("maxDuration", () => {
  it("is 30 s on both download routes", async () => {
    const pack = await import("@/app/api/printable-pack/route");
    const single = await import("@/app/api/printable/[...path]/route");
    expect(pack.maxDuration).toBe(30);
    expect(single.maxDuration).toBe(30);
  });
});
