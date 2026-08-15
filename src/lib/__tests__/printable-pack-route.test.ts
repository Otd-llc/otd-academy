// The pack endpoint, end to end, with R2 mocked.
//
// THIS ROUTE HAD NO TEST AT ALL until now, which is how a filename that
// disagreed with its own contents shipped under a green suite: everything it
// composes was unit-tested, and nothing exercised the composition. So the
// assertions here are deliberately about the SEAMS -- what order things happen
// in, which shape comes back, and whether the name on the box matches what is
// inside it.
//
// The load-bearing one is the ordering test. `packPlates` needs only the
// committed geometry table, so an over-cap request is refused on arithmetic with
// ZERO reads; reading first and counting after would let one unauthenticated GET
// pull 53 objects out of the bucket before we decided to refuse it. That is a
// security property, not an implementation detail, and it is asserted as one:
// `getBytes` must not have been called.
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import JSZip from "jszip";
import type { NextRequest } from "next/server";

import { HEX_GEOMETRY_RELEASE } from "@/lib/hex-geometry";
import { MAX_PLATES, type PlatePackFailure } from "@/lib/hex-plate";

const getBytes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/part-r2", () => ({ getR2ObjectBytes: getBytes }));

const captured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ capture: captured }));

const RELEASE = HEX_GEOMETRY_RELEASE;
/** The oldest published release. Its keys are immutable and its links are still
 *  live, but its meshes are a DIFFERENT cut from the one the geometry table was
 *  measured on. */
const OLD_RELEASE = "2026-07-31";

/** A published part, in the uniform shape every real one has: core spec, exactly
 *  one `<object id="1">`, one `<item>` with an identity transform. */
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

function request(query: string): NextRequest {
  return {
    nextUrl: new URL(
      `https://academy.onethousanddrones.com/api/printable-pack?${query}`,
    ),
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

async function call(query: string): Promise<Response> {
  // R2 config must be STUBBED, not inherited: CI has no `.env.local`, so
  // R2_ENABLED/R2_BUCKET are unset there and the route 404s before it resolves
  // anything. A test that only holds on a developer's machine is not a test.
  vi.stubEnv("R2_ENABLED", "true");
  vi.stubEnv("R2_BUCKET", "test-bucket");
  vi.resetModules();
  const { GET } = await import("@/app/api/printable-pack/route");
  return GET(request(query));
}

const bodyOf = async (res: Response) => Buffer.from(await res.arrayBuffer());
const entriesOf = async (res: Response) => {
  const zip = await JSZip.loadAsync(await bodyOf(res));
  return Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name)
    .sort();
};

beforeEach(() => {
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

describe("pack BEFORE read -- the ordering IS the security property", () => {
  it("refuses an over-cap build having touched R2 zero times", async () => {
    // 250 of the largest part (87.757 x 78 mm) is one per plate on a 100 mm
    // bed, so 250 plates against a cap of 20. Every name is real and both caps
    // in the grammar are satisfied, so this reaches the packer -- and the
    // packer answers before a single object is fetched.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:250&plate=100x100`,
    );
    expect(res.status).toBe(400);
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("CONTROL: the same shape one plate UNDER the cap is served, and does read", async () => {
    // Identical request, one number changed. Without this row the assertion
    // above passes just as well against a route that never reads R2 at all, or
    // that 400s everything.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:${MAX_PLATES}&plate=100x100`,
    );
    expect(res.status).toBe(200);
    expect(getBytes.mock.calls.length).toBeGreaterThan(0);
  });

  it("says what the caller can do about it, unlike the flat 400", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:250&plate=100x100`,
    );
    const text = await res.text();
    expect(text).toContain("plates");
    expect(text).toContain("Choose a larger bed, or fewer parts.");
  });
});

describe("one plate versus many", () => {
  it("serves ONE plate as a bare .3mf, with no archive around it", async () => {
    const res = await call(`release=${RELEASE}&parts=hex-tb-main:3`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("model/3mf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="hex-cluster-3-parts.3mf"',
    );
    // A 3MF is a zip underneath, so "it parsed" proves nothing on its own --
    // what proves it is a PLATE and not a pack is the model part, and the
    // absence of the README/LICENSE furniture a pack carries.
    const names = await entriesOf(res);
    expect(names).toContain("3D/3dmodel.model");
    expect(names).not.toContain("README.txt");
    expect(names.some((n) => n.startsWith("plates/"))).toBe(false);
  });

  it("reads each distinct part ONCE, and no licence for a bare plate", async () => {
    await call(`release=${RELEASE}&parts=hex-tb-main:3`);
    expect(getBytes).toHaveBeenCalledTimes(1);
    expect(getBytes).toHaveBeenCalledWith(
      `printables/${RELEASE}/3mf/hex-tb-main.3mf`,
    );
  });

  it("instances a quantity: one object, one item per copy", async () => {
    // The reason vertices are never rewritten. Three caps are ONE mesh and
    // three `<item>` lines, not three copies of a 300 KB mesh.
    const res = await call(`release=${RELEASE}&parts=hex-tb-main:3`);
    const zip = await JSZip.loadAsync(await bodyOf(res));
    const model = await zip.file("3D/3dmodel.model")!.async("string");
    expect(model.match(/<object\b/g)).toHaveLength(1);
    expect(model.match(/<item\b/g)).toHaveLength(3);
    // Named for the slicer's object list, not slugged.
    expect(model).toContain('name="Hex-TB-Main"');
  });

  it("serves MORE than one plate as a zip of plates plus the furniture", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(await entriesOf(res)).toEqual([
      "LICENSE.txt",
      "README.txt",
      "plates/plate-1-of-2.3mf",
      "plates/plate-2-of-2.3mf",
    ]);
  });

  it("reads the published LICENCE for a multi-plate pack", async () => {
    await call(`release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`);
    expect(getBytes).toHaveBeenCalledWith(`printables/${RELEASE}/LICENSE.txt`);
  });
});

describe("the name on the box matches what is in it", () => {
  it("counts INSTANCES in the filename, and ships that many", async () => {
    // The defect this route already shipped once: a filename saying six, a
    // README saying one, and one mesh in the box. Asserted across all three.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`,
    );
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="hex-cluster-2-parts.zip"',
    );
    const zip = await JSZip.loadAsync(await bodyOf(res));
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme.replace(/\s+/g, " ")).toContain("2 parts on 2 plates");
  });

  it("lists in the README exactly the plate files the zip holds", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`,
    );
    const zip = await JSZip.loadAsync(await bodyOf(res));
    const readme = await zip.file("README.txt")!.async("string");
    const inZip = Object.values(zip.files)
      .filter((f) => !f.dir && f.name.startsWith("plates/"))
      .map((f) => f.name);
    const inReadme = readme.match(/plates\/plate-\d+-of-\d+\.3mf/g) ?? [];
    expect(inReadme.sort()).toEqual(inZip.sort());
  });

  it("names a single part after itself, with the right extension", async () => {
    const res = await call(`release=${RELEASE}&parts=hex-tb-main`);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="hex-cluster-hex-tb-main.3mf"',
    );
  });
});

describe("format=stl is untouched by any of this", () => {
  const QUERY = `release=${RELEASE}&format=stl&parts=hex-tb-main:6,dovetail-cap-single-m-solid&plate=100x100`;

  it("ships loose files in a zip, one per DISTINCT part", async () => {
    const res = await call(QUERY);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(await entriesOf(res)).toEqual([
      "LICENSE.txt",
      "README.txt",
      "stl/dovetail-cap-single-m-solid.stl",
      "stl/hex-tb-main.stl",
    ]);
  });

  it("reads .stl keys, and never opens what it read", async () => {
    await call(QUERY);
    expect(getBytes).toHaveBeenCalledWith(
      `printables/${RELEASE}/stl/hex-tb-main.stl`,
    );
  });

  it("does NOT pack: the build that 400s as 3MF is served as STL", async () => {
    // The sharpest form of "STL never reaches the packer". An STL is a flat
    // triangle soup -- no transforms, no units, no object names -- so a plated
    // STL would be one anonymous blob where fifteen named parts used to be. If
    // a refactor ever routes STL through `packPlates`, this request starts
    // answering 400 and this test says so.
    const res = await call(
      `release=${RELEASE}&format=stl&parts=hex-tb-main:250&plate=100x100`,
    );
    expect(res.status).toBe(200);
    expect(await entriesOf(res)).toEqual([
      "LICENSE.txt",
      "README.txt",
      "stl/hex-tb-main.stl",
    ]);
  });
});

describe("a release the geometry table was not measured from", () => {
  it("keeps serving the loose zip rather than plating against wrong boxes", async () => {
    // Release keys are immutable and old links stay alive, but 2026-07-31 is a
    // DIFFERENT cut of the meshes. Packing it against 2026-08-03's bounding
    // boxes would place parts by numbers that do not describe them, and the
    // symptom is parts overlapping in a stranger's slicer with nothing pointing
    // back at a committed data file. So an old link gets exactly what it gets
    // today.
    const res = await call(`release=${OLD_RELEASE}&parts=hex-tb-main:2`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(await entriesOf(res)).toEqual([
      "3mf/hex-tb-main.3mf",
      "LICENSE.txt",
      "README.txt",
    ]);
  });

  it("CONTROL: the SAME request on the current release IS plated", async () => {
    const res = await call(`release=${RELEASE}&parts=hex-tb-main:2`);
    expect(res.headers.get("content-type")).toBe("model/3mf");
  });
});

describe("what a malformed request is told", () => {
  it.each([
    ["a release that is not a date", `release=latest&parts=hex-tb-main`],
    ["a name that is not published", `release=${RELEASE}&parts=not-a-part`],
    [
      "a format we do not pack",
      `release=${RELEASE}&parts=hex-tb-main&format=step`,
    ],
    [
      "a bed outside the range",
      `release=${RELEASE}&parts=hex-tb-main&plate=40x40`,
    ],
    ["no parts at all", `release=${RELEASE}&parts=`],
  ])(
    "answers one flat 400 for %s, echoing no problem code",
    async (_why, q) => {
      // "unknown-part" versus "bad-format" would tell a prober which of its
      // guesses was a real part name, which is the only thing this endpoint could
      // leak. One status, one body, for all of them.
      const res = await call(q);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("Bad request");
      expect(getBytes).not.toHaveBeenCalled();
      // A refusal is not a download. Firing the funnel event here would count
      // every probe as one, and the whole point of the event is to answer "of
      // everyone who downloaded...".
      expect(captured).not.toHaveBeenCalled();
    },
  );

  it("404s when R2 cannot serve the object, without surfacing the error", async () => {
    getBytes.mockRejectedValue(new Error("NoSuchKey"));
    const res = await call(`release=${RELEASE}&parts=hex-tb-main`);
    expect(res.status).toBe(404);
  });

  it("404s a published object it cannot open", async () => {
    // An object that is not a readable 3MF package is our data being wrong, but
    // from the caller's side the pack as asked for does not exist either way,
    // and which of the two it was is not something they could act on.
    getBytes.mockResolvedValue(Buffer.from("not a zip"));
    const res = await call(`release=${RELEASE}&parts=hex-tb-main`);
    expect(res.status).toBe(404);
  });

  it("404s with R2 switched off, without touching the bucket", async () => {
    vi.stubEnv("R2_ENABLED", "false");
    vi.stubEnv("R2_BUCKET", undefined);
    vi.resetModules();
    const { GET } = await import("@/app/api/printable-pack/route");
    const res = await GET(request(`release=${RELEASE}&parts=hex-tb-main`));
    expect(res.status).toBe(404);
    expect(getBytes).not.toHaveBeenCalled();
  });
});

describe("every PlatePackFailure reason maps to its intended status", () => {
  /** Force the packer to fail for a chosen reason. The real class is kept, so
   *  the route's `instanceof` check is the real one. */
  async function withPackerThrowing(
    reason: PlatePackFailure | "plain",
  ): Promise<Response> {
    vi.resetModules();
    vi.doMock("@/lib/hex-plate", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/hex-plate")>(
          "@/lib/hex-plate",
        );
      return {
        ...actual,
        packPlates: () => {
          if (reason === "plain") throw new Error("something else entirely");
          throw new actual.PlatePackError(reason, `synthetic ${reason}`);
        },
      };
    });
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    const { GET } = await import("@/app/api/printable-pack/route");
    const res = await GET(request(`release=${RELEASE}&parts=hex-tb-main`));
    vi.doUnmock("@/lib/hex-plate");
    vi.resetModules();
    return res;
  }

  it("too-many-plates is the CALLER's, and actionable: 400", async () => {
    const res = await withPackerThrowing("too-many-plates");
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Choose a larger bed");
  });

  it("part-too-large is OURS: 500, not a 400 blaming the request", async () => {
    // Every name is a published part and the bed is inside the range we
    // advertise, so the request is legal. We promise a bed choice changes the
    // plate COUNT and can never make a part unprintable; if that is false, the
    // geometry table or BED_MIN drifted. Answering 400 would hide a broken
    // invariant behind a client-side retry and nobody would ever be paged.
    const res = await withPackerThrowing("part-too-large");
    expect(res.status).toBe(500);
  });

  it("bad-quantity is unreachable through the grammar: 500", async () => {
    // `resolvePack` refuses a quantity that is not a positive whole number, so
    // reaching this means a caller skipped it -- a programming fault.
    const res = await withPackerThrowing("bad-quantity");
    expect(res.status).toBe(500);
  });

  it("anything the packer throws that is not a PlatePackError: 500", async () => {
    const res = await withPackerThrowing("plain");
    expect(res.status).toBe(500);
  });

  it("none of the 500s echo the reason back", async () => {
    for (const r of ["part-too-large", "bad-quantity", "plain"] as const) {
      expect(await (await withPackerThrowing(r)).text()).toBe("Server error");
    }
  });
});

describe("what the download reports to analytics", () => {
  const props = () => captured.mock.calls[0][1] as Record<string, unknown>;

  it("records the bed, its provenance, the plates and the instances", async () => {
    await call(
      `release=${RELEASE}&parts=hex-tb-main:3&plate=350x350&bedFrom=account`,
    );
    expect(captured).toHaveBeenCalledTimes(1);
    expect(props()).toMatchObject({
      release: RELEASE,
      format: "3mf",
      parts: 1,
      instances: 3,
      plates: 1,
      bed_x: 350,
      bed_y: 350,
      bed_source: "account",
    });
  });

  it("counts the plates on a multi-plate pack", async () => {
    await call(`release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`);
    expect(props()).toMatchObject({ plates: 2, instances: 2 });
  });

  it("reports NO plate count on a loose zip, rather than zero", async () => {
    // A loose zip has no plates. Reporting 0 would drag every average toward a
    // number that describes nothing.
    await call(`release=${RELEASE}&format=stl&parts=hex-tb-main:6`);
    expect(props().plates).toBeUndefined();
    expect(props()).toMatchObject({ format: "stl", instances: 6 });
  });

  it("never forwards an arbitrary bedFrom string", async () => {
    // A query parameter passed through to PostHog is an attacker-chosen
    // property of unbounded cardinality: a way to write arbitrary text into the
    // analytics store and to shred a breakdown chart.
    await call(
      `release=${RELEASE}&parts=hex-tb-main&bedFrom=${encodeURIComponent("<img src=x>")}`,
    );
    expect(props().bed_source).toBe("unknown");
  });

  it("omits the provenance entirely when the caller states none", async () => {
    await call(`release=${RELEASE}&parts=hex-tb-main`);
    expect(props().bed_source).toBeUndefined();
    // The bed itself is still reported: it is what we packed for, stated or
    // defaulted.
    expect(props()).toMatchObject({ bed_x: 220, bed_y: 220 });
  });

  it("does not fire at all for a refused request", async () => {
    await call(`release=${RELEASE}&parts=hex-tb-main:250&plate=100x100`);
    expect(captured).not.toHaveBeenCalled();
  });
});
