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
import {
  PACK_NAME_FALLBACK,
  contentDisposition,
} from "@/lib/hex-pack-name";

const getBytes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/part-r2", () => ({ getR2ObjectBytes: getBytes }));

const captured = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ capture: captured }));

const RELEASE = HEX_GEOMETRY_RELEASE;
/** The stem a request with NO name resolves to. Spelled through the constant, so
 *  a change to the fallback is a change to one string rather than to forty
 *  literals that would each have to be found. */
const FB = PACK_NAME_FALLBACK;
/** The whole `Content-Disposition` a given filename should produce.
 *
 *  IMPORTED, not transcribed. The two-parameter form is pinned against literals
 *  in `hex-pack-name.test.ts`; what these rows are for is the ROUTE -- that each
 *  response shape names its box after the right thing and counts the right
 *  number. Re-spelling the RFC 8187 encoder here would be a second copy that
 *  agrees with itself while the real one drifts. */
const disp = (filename: string, ascii: string = filename) =>
  contentDisposition({ filename, ascii });
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
/** Collapse the README's hard wrap. It wraps at 72 columns because it is read in
 *  a terminal, so a phrase is free to land across a line break; asserting on the
 *  raw string would pin where the wrap happened to fall. */
const flat = (s: string) => s.replace(/\s+/g, " ");
/** The file entries of a loaded archive, directories excluded. Split out from
 *  `entriesOf` because a `Response` body can only be read ONCE: a test that
 *  wants both the listing and a file out of it has to load the zip itself. */
const namesIn = (zip: JSZip) =>
  Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name)
    .sort();
const entriesOf = async (res: Response) =>
  namesIn(await JSZip.loadAsync(await bodyOf(res)));

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
      disp(`${FB}-3-parts.3mf`),
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
      `plates/${FB}-plate-1-of-2.3mf`,
      `plates/${FB}-plate-2-of-2.3mf`,
    ]);
  });

  it("reads the published LICENCE for a multi-plate pack", async () => {
    await call(`release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`);
    expect(getBytes).toHaveBeenCalledWith(`printables/${RELEASE}/LICENSE.txt`);
  });
});

// The build's own name, from the configurator, through every response shape.
//
// The sanitiser has its own file (`hex-pack-name.test.ts`); these rows are about
// the ROUTE -- that the name reaches all three shapes and the plates inside the
// zip, that a hostile one is refused before any R2 read, and that two names
// really do produce two different responses rather than two labels on one.
describe("the download is named after the cluster", () => {
  const NAME = "TB-1 POWER";

  it("names a bare plate after the build, in both parameters", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:3&name=${encodeURIComponent(NAME)}`,
    );
    expect(res.status).toBe(200);
    // Pinned as a LITERAL here, once, rather than through `disp` -- so this row
    // still fails if the header builder and the test helper drift together.
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="TB-1 POWER-3-parts.3mf"; ` +
        `filename*=UTF-8''TB-1%20POWER-3-parts.3mf`,
    );
  });

  it("names the zip, the plates inside it, and the README's manifest", async () => {
    // ALL THREE, because the plate is the file that gets dragged out of the zip
    // and onto a desktop -- which is exactly where it loses every other clue
    // about which build it belonged to.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100&name=${encodeURIComponent(NAME)}`,
    );
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${NAME}-2-parts.zip`),
    );
    const zip = await JSZip.loadAsync(await bodyOf(res));
    expect(namesIn(zip)).toEqual([
      "LICENSE.txt",
      "README.txt",
      `plates/${NAME}-plate-1-of-2.3mf`,
      `plates/${NAME}-plate-2-of-2.3mf`,
    ]);
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).toContain(`plates/${NAME}-plate-1-of-2.3mf`);
  });

  it("names the LOOSE zip too, which never reaches the packer", async () => {
    // The third shape. It is served by a different function, and "the name is
    // on the plated paths" would pass with this one still saying `hex-cluster`.
    const res = await call(
      `release=${RELEASE}&format=stl&parts=hex-tb-main:6,dovetail-cap-single-m-solid:3&name=${encodeURIComponent(NAME)}`,
    );
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${NAME}-2-parts.zip`),
    );
  });

  it("puts the name inside the plate, as its Title", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:3&name=${encodeURIComponent(NAME)}`,
    );
    const model = await (await JSZip.loadAsync(await bodyOf(res)))
      .file("3D/3dmodel.model")!
      .async("string");
    expect(model).toContain(
      `<metadata name="Title">${NAME} -- plate 1 of 1</metadata>`,
    );
  });

  it("CONTROL: with NO name, every one of those is the fallback", async () => {
    // Without this row, "the name appears" is satisfied by a route that puts
    // the name everywhere AND by one that puts it nowhere, since the fallback
    // rows elsewhere in this file would then be the only evidence either way.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`,
    );
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${FB}-2-parts.zip`),
    );
    expect(namesIn(await JSZip.loadAsync(await bodyOf(res)))).toContain(
      `plates/${FB}-plate-1-of-2.3mf`,
    );
  });

  it("carries a non-ASCII name in filename*, and a NAME in filename", async () => {
    // Not a dropped character and not a bare `-3-parts.3mf`: the ASCII half is
    // the fallback name, because a count with no subject is not a filename.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:3&name=${encodeURIComponent("ハニカム")}`,
    );
    const cd = res.headers.get("content-disposition")!;
    expect(cd).toContain(`filename="${FB}-3-parts.3mf"`);
    expect(cd).toContain(
      "filename*=UTF-8''%E3%83%8F%E3%83%8B%E3%82%AB%E3%83%A0-3-parts.3mf",
    );
    // And the zip entry / Title keep the real name.
    const model = await (await JSZip.loadAsync(await bodyOf(res)))
      .file("3D/3dmodel.model")!
      .async("string");
    expect(model).toContain("ハニカム -- plate 1 of 1");
  });

  it("round-trips a non-ASCII plate name through the zip", async () => {
    // JSZip flags a non-ASCII entry name UTF-8 (general-purpose bit 11). If it
    // did not, the README would cite a name no unzipper would write.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100&name=${encodeURIComponent("ハニカム")}`,
    );
    const zip = await JSZip.loadAsync(await bodyOf(res));
    expect(namesIn(zip)).toContain("plates/ハニカム-plate-1-of-2.3mf");
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).toContain("plates/ハニカム-plate-1-of-2.3mf");
  });

  it("REFUSES a header-injecting name, having touched R2 zero times", async () => {
    // The refusal runs in `resolvePack`, with every other field -- so it costs
    // a string scan and never reaches the bucket, exactly like an unknown part
    // name does.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main&name=${encodeURIComponent("a\r\nSet-Cookie: x=1")}`,
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Bad request");
    expect(getBytes).not.toHaveBeenCalled();
    expect(captured).not.toHaveBeenCalled();
  });

  it("never lets a name out of the quoted-string, whatever it holds", async () => {
    for (const raw of [
      'x"; filename="evil.exe',
      "../../etc/passwd",
      "..\\..\\windows",
      "CON",
      "rig‮fm3.tmf",
      "a".repeat(120),
    ]) {
      const res = await call(
        `release=${RELEASE}&parts=hex-tb-main&name=${encodeURIComponent(raw)}`,
      );
      expect(res.status, raw).toBe(200);
      const cd = res.headers.get("content-disposition")!;
      expect(cd, raw).not.toMatch(/[\r\n]/);
      expect(cd.split('"'), raw).toHaveLength(3);
      expect(cd, raw).not.toMatch(/filename="[^"]*[\\/]/);
    }
  });

  it("falls back for a name that sanitises down to nothing", async () => {
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:3&name=${encodeURIComponent("...")}`,
    );
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${FB}-3-parts.3mf`),
    );
  });

  it("changes the BYTES, not merely the label -- so the name is a cache key", async () => {
    // The reason the name is a query parameter. This response is cached per URL
    // for a day, and the stem is inside the zip entry names and each plate's
    // `Title`; two builds with the same parts and different names are two
    // different bodies, so sharing a cache entry would serve one person the
    // other's file.
    const q = `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100&name=`;
    const a = await bodyOf(await call(`${q}ALPHA`));
    const b = await bodyOf(await call(`${q}BETA`));
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it("is byte-identical for the same URL twice, name included", async () => {
    const q = `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100&name=${encodeURIComponent(NAME)}`;
    const first = await bodyOf(await call(q));
    const second = await bodyOf(await call(q));
    expect(Buffer.compare(first, second)).toBe(0);
  });
});

// 3MF carries a PACKAGE THUMBNAIL through the OPC relationship type
// `.../metadata/thumbnail`, with the image in `Metadata/`. That is CORE SPEC,
// not a vendor extension, which is the whole reason it is worth carrying where
// printer and process settings are not: Explorer, Finder and a slicer's open
// dialog all read it, so a `.3mf` shows what is on it before anyone slices.
//
// Asserted at the ROUTE as well as in `hex-thumbnail.test.ts`, because the
// picture being right and the package DECLARING it are two different failures
// and the second one is silent -- an unregistered `Metadata/thumbnail.png` is an
// orphan that makes the file bigger and shows nobody anything.
describe("every plate carries a picture of itself", () => {
  /** The three things that have to agree for a thumbnail to exist at all. */
  async function thumbnailOf(zip: JSZip) {
    const png = zip.file("Metadata/thumbnail.png");
    const rels = await zip.file("_rels/.rels")!.async("string");
    const types = await zip.file("[Content_Types].xml")!.async("string");
    return {
      png: png ? await png.async("nodebuffer") : null,
      rels,
      types,
    };
  }

  const isPng = (b: Buffer | null) =>
    b !== null &&
    b.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

  it("puts one in the bare .3mf, related and declared", async () => {
    const res = await call(`release=${RELEASE}&parts=hex-tb-main:3`);
    const zip = await JSZip.loadAsync(await bodyOf(res));
    const t = await thumbnailOf(zip);
    expect(isPng(t.png)).toBe(true);
    expect(t.rels).toContain(
      'Target="/Metadata/thumbnail.png" Id="rel1" ' +
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"',
    );
    expect(t.types).toContain(
      '<Default Extension="png" ContentType="image/png" />',
    );
    // And the model is STILL the entry point: the thumbnail is additive, so the
    // 3D relationship keeps its id and its place.
    expect(t.rels).toContain('Target="/3D/3dmodel.model" Id="rel0"');
  });

  it("puts one in EVERY plate inside a zip", async () => {
    // Per plate, not per pack. A plate is its own package and each one is a
    // picture of what is on THAT bed.
    const res = await call(
      `release=${RELEASE}&parts=hex-tb-main:2&plate=100x100`,
    );
    const zip = await JSZip.loadAsync(await bodyOf(res));
    const plates = Object.values(zip.files).filter(
      (f) => !f.dir && f.name.startsWith("plates/"),
    );
    expect(plates).toHaveLength(2);
    for (const entry of plates) {
      const inner = await JSZip.loadAsync(await entry.async("nodebuffer"));
      const t = await thumbnailOf(inner);
      expect(isPng(t.png), entry.name).toBe(true);
      expect(t.rels, entry.name).toContain("metadata/thumbnail");
      // The model still reads, which is the thing a broken package would cost.
      const model = await inner.file("3D/3dmodel.model")!.async("string");
      expect(model, entry.name).toContain("<build>");
      expect(model, entry.name).toContain('name="Hex-TB-Main"');
    }
  });

  it("draws a DIFFERENT picture for a different bed", async () => {
    // The bed the packer used is the outline the thumbnail draws, so two beds
    // are two pictures. Without this row, "there is a PNG" is satisfied by a
    // constant image baked into the bundle.
    const png = async (q: string) => {
      const zip = await JSZip.loadAsync(await bodyOf(await call(q)));
      return zip.file("Metadata/thumbnail.png")!.async("nodebuffer");
    };
    const a = await png(`release=${RELEASE}&parts=hex-tb-main:3&plate=220x220`);
    const b = await png(`release=${RELEASE}&parts=hex-tb-main:3&plate=350x350`);
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it("does not put one in the LOOSE zip, which has no plate to draw", async () => {
    // The loose zip is a folder of published meshes, not a package and not a
    // layout. There is nothing to be a top-down plan OF.
    const res = await call(`release=${RELEASE}&format=stl&parts=hex-tb-main:6`);
    expect(await entriesOf(res)).not.toContain("Metadata/thumbnail.png");
  });

  it("leaves the response byte-identical for the same URL twice", async () => {
    // The thumbnail is inside the determinism promise, not beside it: a clock,
    // a seed or a platform-dependent number in the PNG would break a promise
    // the headers would never show.
    const q = `release=${RELEASE}&parts=hex-tb-main:3&plate=350x350`;
    const first = await bodyOf(await call(q));
    const second = await bodyOf(await call(q));
    expect(Buffer.compare(first, second)).toBe(0);
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
      disp(`${FB}-2-parts.zip`),
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
    const inReadme = readme.match(new RegExp(`plates/${FB}-plate-\\d+-of-\\d+\\.3mf`, "g")) ?? [];
    expect(inReadme.sort()).toEqual(inZip.sort());
  });

  it("names a single part after itself, with the right extension", async () => {
    const res = await call(`release=${RELEASE}&parts=hex-tb-main`);
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${FB}-hex-tb-main.3mf`),
    );
  });

  // THE LOOSE PATH'S NAME, which had no assertion at all until now -- every
  // `content-disposition` row above this one is on a plated response. That gap
  // is how the SAME defect this file was written to prevent shipped a second
  // time on the other path: `packFilename` was changed to count INSTANCES while
  // the loose zip kept writing one entry per DISTINCT part, so
  // `?format=stl&parts=hex-tb-main:6` came back as `hex-cluster-6-parts.zip`
  // holding one file, beside a README reading "1 of the published parts".
  //
  // Planned Task B1 makes it routine rather than exotic: it emits `:n`
  // unconditionally with `format` as a separate option, so every STL download
  // from a build with repeats would have carried a lying name.
  describe("the loose zip's name counts the FILES it holds", () => {
    /** The number a `<stem>-N-parts` name claims, or null if it names a
     *  single part instead. Read off the header rather than restated, so the
     *  cross-checks below compare the RESPONSE against the RESPONSE. */
    const claimed = (res: Response): number | null => {
      const m = new RegExp(`filename="${FB}-(\\d+)-parts\\.\\w+"`).exec(
        res.headers.get("content-disposition") ?? "",
      );
      return m ? Number(m[1]) : null;
    };

    it("names a single part after itself, however many were asked for", async () => {
      const res = await call(
        `release=${RELEASE}&format=stl&parts=hex-tb-main:6`,
      );
      expect(res.headers.get("content-disposition")).toBe(
        disp(`${FB}-hex-tb-main.zip`),
      );
      // The box, so the name is checked against it and not against my
      // arithmetic: one mesh, whatever the quantity said.
      const meshes = (await entriesOf(res)).filter((n) =>
        n.startsWith("stl/"),
      );
      expect(meshes).toEqual(["stl/hex-tb-main.stl"]);
    });

    it("counts the meshes in the zip, not the instances in the request", async () => {
      const res = await call(
        `release=${RELEASE}&format=stl&parts=hex-tb-main:6,dovetail-cap-single-m-solid:3`,
      );
      const zip = await JSZip.loadAsync(await bodyOf(res));
      const meshes = namesIn(zip).filter((n) => n.startsWith("stl/"));
      expect(meshes).toHaveLength(2);
      // Name against box.
      expect(claimed(res)).toBe(meshes.length);
      // Name against the README, which is the third statement of the same
      // number and the one the person actually reads. All three, because the
      // defect was two of them agreeing while the third did not.
      const readme = await zip.file("README.txt")!.async("string");
      expect(readme).toContain(
        `SUBSET: ${meshes.length} of the published parts`,
      );
    });

    it("CONTROL: the SAME build as a plate counts INSTANCES instead", async () => {
      // Without this row, "the loose zip counts files" is satisfied by a route
      // that counts distinct parts everywhere -- which would put "2 parts" on a
      // plate holding nine objects. Nine is the right answer for a box that
      // holds nine things; two is the right answer for a box that holds two
      // files; the point is that they differ.
      const res = await call(
        `release=${RELEASE}&parts=hex-tb-main:6,dovetail-cap-single-m-solid:3`,
      );
      expect(res.status).toBe(200);
      expect(claimed(res)).toBe(9);
    });

    it("names a superseded release's zip the same way", async () => {
      // The other way into the loose path: 3MF on a release the geometry table
      // was not measured from. Same box, so the same count -- and it is served
      // by the same function, which a reader has no way to know from the URL.
      const res = await call(
        `release=${OLD_RELEASE}&parts=hex-tb-main:6,dovetail-cap-single-m-solid:3`,
      );
      expect(res.headers.get("content-type")).toBe("application/zip");
      expect(res.headers.get("content-disposition")).toBe(
        disp(`${FB}-2-parts.zip`),
      );
    });
  });
});

// I2. Two published parts rest on a LINE by design -- they are laid on their
// side so the layers run ACROSS the load rather than peeling apart -- so they
// need supports or a brim. Every download used to be a zip, so that warning
// always travelled in the README. The bare single-plate `.3mf` this feature
// added is the one shape that carries no README, and it is also the commonest
// response, so the commonest download lost the warning and the consequence is a
// failed print.
//
// The requirement is an OUTCOME: no download holding a support-requiring part
// may leave without that warning in a form the person will actually meet. The
// mechanism chosen is the archive, because it is the only one that guarantees
// it -- `<metadata name="Description">` is carried too, but slicers surface
// metadata inconsistently, so on its own it would be a warning nobody is shown.
describe("a build that needs supports never ships without the warning", () => {
  const SPIKE = "hex-tb-spike-solid";

  it("ships a ONE-plate spike build in an archive, with the README", async () => {
    const res = await call(`release=${RELEASE}&parts=${SPIKE}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    const zip = await JSZip.loadAsync(await bodyOf(res));
    expect(namesIn(zip)).toEqual([
      "LICENSE.txt",
      "README.txt",
      `plates/${FB}-plate-1-of-1.3mf`,
    ]);
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).toContain("Support required -- Hex-TB-Spike-Solid.");
    expect(flat(readme)).toContain("give them supports or a brim");
  });

  it("warns even when the spike is one part among many", async () => {
    // The realistic build. A cluster is mostly tiles and caps; the spike rides
    // along, and it is exactly the part somebody would not think to check.
    const res = await call(`release=${RELEASE}&parts=hex-tb-main:2,${SPIKE}`);
    expect(res.headers.get("content-type")).toBe("application/zip");
    const zip = await JSZip.loadAsync(await bodyOf(res));
    expect(await zip.file("README.txt")!.async("string")).toContain(
      "Support required -- Hex-TB-Spike-Solid.",
    );
  });

  it("carries the same warning INSIDE the plate, for when the zip is gone", async () => {
    // Belt and braces, not the guarantee: a `.3mf` gets dragged out of its zip
    // and opened months later, and a file that carries its own instructions
    // still has them then.
    const res = await call(`release=${RELEASE}&parts=${SPIKE}`);
    const zip = await JSZip.loadAsync(await bodyOf(res));
    const plate = await zip
      .file(`plates/${FB}-plate-1-of-1.3mf`)!
      .async("nodebuffer");
    const model = await (await JSZip.loadAsync(plate))
      .file("3D/3dmodel.model")!
      .async("string");
    expect(model).toContain('<metadata name="Description">');
    expect(model).toContain("Support required -- Hex-TB-Spike-Solid.");
    expect(flat(model)).toContain("keep every part flat on the bed");
  });

  it("names the archive after the build, and reports one plate", async () => {
    const res = await call(`release=${RELEASE}&parts=${SPIKE}:2`);
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${FB}-2-parts.zip`),
    );
    expect(captured.mock.calls[0][1]).toMatchObject({
      plates: 1,
      instances: 2,
    });
  });

  it("CONTROL: a build with nothing to warn about is still ONE bare file", async () => {
    // The one-file experience is the point of the feature, and this is what
    // stops the fix above from quietly zipping everything. Without this row,
    // "the spike build is a zip" passes just as well against a route that
    // abandoned the bare plate altogether.
    const res = await call(`release=${RELEASE}&parts=hex-tb-main:3`);
    expect(res.headers.get("content-type")).toBe("model/3mf");
    expect(res.headers.get("content-disposition")).toBe(
      disp(`${FB}-3-parts.3mf`),
    );
    // And it says so inside the file, so the bare plate is not silent either.
    const model = await (await JSZip.loadAsync(await bodyOf(res)))
      .file("3D/3dmodel.model")!
      .async("string");
    expect(model).toContain("No supports needed");
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
