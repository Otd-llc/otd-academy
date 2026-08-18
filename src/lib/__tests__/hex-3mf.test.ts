// Writing a packed plate as one 3MF.
//
// The properties asserted here are the ones a slicer would show and a unit test
// cannot: how many objects the document declares, which object each item points
// at, and where the transform puts it. A structurally valid 3MF that a slicer
// mis-renders passes every "is it a zip" check ever written, so every assertion
// below is pinned to a MEASURED fact about the known-good reference plate
// (`c:\zzz\hex-cluster-plate-K2.3mf`, opened in Creality Print V7.2.1) rather
// than to what this module happens to emit.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import {
  CORE_META,
  MODEL_SETTINGS_PATH,
  ZIP_EPOCH,
  buildPlate3mf,
  extractObjectBlock,
} from "@/lib/hex-3mf";
import { HEX_LICENSE } from "@/lib/hex-spec";
import {
  HEX_PART_BOX,
  HEX_PART_MESH_BOTTOM,
  HEX_PART_NAME,
} from "@/lib/hex-geometry";
import type { Placement } from "@/lib/hex-plate";

/** The exact shape every published part ships in -- one `<object id="1"
 *  type="model">`, one `<item>` with an identity transform, no materials, no
 *  property groups, no extra namespaces. Verified across all 53 meshes of
 *  release 2026-08-03, which is what lets the merge be a string lift. A fixture
 *  that is prettier than the real thing would test a file we do not have. */
const source = (x: string) => `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Application">FreeCAD</metadata>
 <resources>
<object id="1" type="model">
   <mesh>
    <vertices>
     <vertex x="${x}" y="0" z="0" />
    </vertices>
    <triangles>
     <triangle v1="0" v2="0" v3="0" />
    </triangles>
   </mesh>
</object>
 </resources>
 <build>
  <item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0" />
 </build>
</model>
`;

const SOURCE = source("0");

/** A source mesh whose LOWEST VERTEX is a given `z` attribute, spelled verbatim.
 *
 *  Takes TEXT, not a number, and that is what makes the seat sweep below mean
 *  anything. Fed `box.z0` it would be circular -- a table that quantised a
 *  part's floor would produce a fixture at the same wrong height and seat
 *  perfectly against itself, which is exactly how the real defect would have
 *  passed. Fed the mesh's own `z="0.144338"` it is not. */
const sourceAtZ = (z: string) => `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
<object id="1" type="model">
   <mesh>
    <vertices>
     <vertex x="0" y="0" z="${z}" />
    </vertices>
    <triangles>
     <triangle v1="0" v2="0" v3="0" />
    </triangles>
   </mesh>
</object>
 </resources>
 <build>
  <item objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0" />
 </build>
</model>
`;

/** TWO distinct meshes, because one cannot tell instancing from duplication:
 *  with a single slug, "one object per distinct part" and "one object, full
 *  stop" are the same number. The vertex differs so a merge that emitted the
 *  wrong source would be visible rather than merely miscounted. */
const SOURCES = new Map([
  ["a", source("1")],
  ["b", source("2")],
]);

const BOX = { x0: 0, y0: 0, z0: 0, dx: 10, dy: 10, dz: 10 };

/** The published display name for a slug, in the shape the real table has:
 *  `hex-tb-main` maps to `Hex-TB-Main`, which no rule recovers from the slug.
 *
 *  DELIBERATELY DIFFERENT from the slug, and used as the default below so every
 *  placement in this file carries a name it cannot be confused with. The writer
 *  holds both fields and only one of them belongs in the object list; if the
 *  fixtures named a part after its slug, the module could reach for either and
 *  nothing here would notice. */
const nameOf = (slug: string) => `Part-${slug.toUpperCase()}`;

const at = (
  slug: string,
  x: number,
  y: number,
  box: Partial<typeof BOX> = {},
  name: string = nameOf(slug),
): Placement => ({ slug, name, box: { ...BOX, ...box }, x, y });

/** The bed every fixture below is packed for, unless it says otherwise. */
const BED = { x: 220, y: 220 };
/** The release every fixture is dated from -- the one the geometry table was
 *  measured on, so the same date the route really passes. */
const RELEASE = "2026-08-03";

/** `buildPlate3mf` with the bed filled in.
 *
 *  The bed is REQUIRED on the real signature -- it is the outline the package
 *  thumbnail draws the parts inside, and a default would be a silently wrong
 *  picture rather than a compile error. It is also irrelevant to almost every
 *  row in this file, which is about transforms, object ids and names. One
 *  pass-through wrapper keeps each row stating only the thing it is about; the
 *  thumbnail's own suite passes the bed explicitly, because there it matters. */
const plate3mf = (
  placements: readonly Placement[],
  sources: ReadonlyMap<string, string>,
  meta: Partial<Parameters<typeof buildPlate3mf>[2]> = {},
) => buildPlate3mf(placements, sources, { bed: BED, release: RELEASE, ...meta });

async function modelOf(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("3D/3dmodel.model");
  expect(file, "3D/3dmodel.model").not.toBeNull();
  return file!.async("string");
}

/** The object list a slicer would show, in the order the build declares it.
 *
 *  Resolved through the id table rather than read off the objects directly. An
 *  item naming an id that does not exist, or two objects sharing an id, is
 *  exactly the corruption a bare "count the objects" assertion cannot see -- and
 *  it is what a renumbering that silently no-ops produces. */
function itemNames(model: string): string[] {
  const byId = new Map<string, string>();
  for (const m of model.matchAll(/<object id="(\d+)" name="([^"]*)"/g)) {
    expect(byId.has(m[1]), `duplicate object id ${m[1]}`).toBe(false);
    byId.set(m[1], m[2]);
  }
  return [...model.matchAll(/<item objectid="(\d+)"/g)].map((m) => {
    const name = byId.get(m[1]);
    expect(name, `item points at object ${m[1]}, which is not declared`).toBeDefined();
    return name!;
  });
}

/** Every placed object's SEATED minimum Z, and the twelve numbers that put it
 *  there.
 *
 *  THE ARITHMETIC A SLICER DOES, not the arithmetic the writer did: the lowest
 *  vertex the document actually declares for the object, plus the translation
 *  the build item actually carries, both read back out of the emitted text. A
 *  check written against the writer's own intermediate values would agree with a
 *  writer that quantises on the way out -- which is precisely the defect this
 *  file gained these tests for. */
function seats(model: string): { name: string; z: number; t: number[] }[] {
  const byId = new Map<string, { name: string; minZ: number }>();
  for (const m of model.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = /\bid="([^"]*)"/.exec(m[1])?.[1];
    expect(id, "object with no id").toBeDefined();
    let minZ = Infinity;
    for (const v of m[2].matchAll(/<vertex\b[^>]*\bz="([^"]*)"/g)) {
      const z = Number(v[1]);
      if (z < minZ) minZ = z;
    }
    expect(Number.isFinite(minZ), `object ${id} declares no vertex`).toBe(true);
    byId.set(id!, { name: /\bname="([^"]*)"/.exec(m[1])?.[1] ?? "(unnamed)", minZ });
  }
  return [...model.matchAll(/<item\b([^>]*)\/>/g)].map((m) => {
    const id = /objectid="([^"]*)"/.exec(m[1])?.[1] ?? "";
    const o = byId.get(id);
    expect(o, `item points at object ${id}, which is not declared`).toBeDefined();
    // 3MF transforms are 3x4, row-major, TRANSLATION LAST -- so `t[11]` is the
    // Z term. Ours are pure translations; the identity 3x3 is asserted below,
    // and a rotation would need the whole corner transformed rather than added.
    const t = (/transform="([^"]*)"/.exec(m[1])?.[1] ?? "").trim().split(/\s+/).map(Number);
    expect(t, `item ${id} transform`).toHaveLength(12);
    return { name: o!.name, z: o!.minZ + t[11], t };
  });
}

/** Every published part on ONE plate, which is the shape the defect appeared in:
 *  a slicer only asks "should these be loaded as a single object with multiple
 *  parts?" when the objects it is comparing sit at different heights. */
const ALL = Object.entries(HEX_PART_BOX).map(([slug, box], i) => ({
  slug,
  name: HEX_PART_NAME[slug],
  box,
  x: 4 + i * 100,
  y: 4,
}));
const ALL_SOURCES = new Map(
  Object.keys(HEX_PART_BOX).map((slug) => [
    slug,
    sourceAtZ(HEX_PART_MESH_BOTTOM[slug]),
  ]),
);

describe("extractObjectBlock", () => {
  it("lifts the object, renumbers it and names it", () => {
    const block = extractObjectBlock(SOURCE, 7, "Thing");
    expect(block).toContain('<object id="7"');
    expect(block).toContain('name="Thing"');
    expect(block).toContain('type="model"');
  });

  it("takes the object and nothing around it", () => {
    // The merged document declares its own header, metadata and build. Dragging
    // the source's `<model>`, `<metadata>` or `<build>` along would nest a whole
    // second document inside `<resources>` -- and the id in that stowaway build
    // is the source's `1`, not the renumbered one.
    const block = extractObjectBlock(SOURCE, 3, "Thing");
    expect(block.startsWith("<object ")).toBe(true);
    expect(block.endsWith("</object>")).toBe(true);
    expect(block).not.toContain("<build");
    expect(block).not.toContain("<metadata");
    expect(block).not.toContain("<?xml");
    expect(block).toContain("<mesh>");
  });

  it("refuses a source that is not exactly one object", () => {
    // Every published part is one object today. A re-cut that emits two would
    // renumber only the first, so both would answer to the same id and the merge
    // would silently ship one mesh where two were asked for.
    const two = SOURCE.replace(
      "</resources>",
      '<object id="2" type="model"><mesh /></object></resources>',
    );
    expect(() => extractObjectBlock(two, 1, "x")).toThrow(/expected 1/);
    expect(() => extractObjectBlock("<model></model>", 1, "x")).toThrow(/expected 1/);
  });

  it("renumbers however the source spells its attributes", () => {
    // THE SILENT ONE. A renumbering written as `replace(/^<object id="\d+"/,
    // ...)` assumes `id` comes first, and `String.replace` with no match returns
    // the string UNCHANGED -- so an object tag in another attribute order keeps
    // `id="1"`, and a plate of six parts becomes six objects all called 1, five
    // of them unreachable and every item pointing at the first mesh. Nothing
    // downstream can notice: it is a well-formed zip, well-formed XML, and the
    // right number of items.
    const reordered = SOURCE.replace(
      '<object id="1" type="model">',
      '<object type="model" id="1">',
    );
    const block = extractObjectBlock(reordered, 5, "Thing");
    expect(block).toContain('<object id="5"');
    expect(block).not.toContain('id="1"');
  });

  it("refuses an object with no closing tag", () => {
    // A self-closing `<object ... />` makes `indexOf("</object>")` return -1, and
    // the plan's arithmetic turns that into `slice(start, 8)`: eight characters
    // from somewhere in the file, written straight into the document.
    //
    // Matched on the SPECIFIC message, not on `/object/i`. Deleting the guard
    // still throws here -- the truncated slice fails the open-tag parse a few
    // lines later and says "malformed" -- so a loose pattern passes with the
    // guard gone and the only thing lost is the one error message that names
    // what is actually wrong with the file.
    const selfClosed = SOURCE.replace(
      /<object id="1" type="model">[\s\S]*<\/object>/,
      '<object id="1" type="model" />',
    );
    expect(() => extractObjectBlock(selfClosed, 1, "x")).toThrow(/closing tag/);
  });

  it("replaces a name the source already carries rather than adding a second", () => {
    // Two `name` attributes on one element is not "last one wins" -- it is
    // malformed XML, and a conforming parser rejects the whole document. Our
    // meshes carry no name today; the guard costs nothing and the failure it
    // prevents is total.
    const named = SOURCE.replace(
      '<object id="1" type="model">',
      '<object id="1" name="Old" type="model">',
    );
    const block = extractObjectBlock(named, 2, "New");
    expect(block.match(/name="/g)).toHaveLength(1);
    expect(block).toContain('name="New"');
  });

  it("escapes a name that would otherwise break the attribute", () => {
    // No published slug needs this -- PART_SLUG_RE is `[a-z0-9][a-z0-9-]*`, and
    // none of those characters are special in XML. It is here because the
    // function's contract is "safe for any string" and the day that stops being
    // true is the day someone passes a display name.
    const block = extractObjectBlock(SOURCE, 1, 'a & b < c "d" >');
    expect(block).toContain('name="a &amp; b &lt; c &quot;d&quot; &gt;"');
  });

  it("escapes the ampersand first, so an escape is not escaped twice", () => {
    // `"<".replace(/</,"&lt;")` then `replace(/&/,"&amp;")` yields `&amp;lt;` --
    // the name reads back as the literal text `&lt;`. Order is the whole
    // correctness argument for a three-line escaper.
    expect(extractObjectBlock(SOURCE, 1, "&lt;")).toContain('name="&amp;lt;"');
  });
});

describe("buildPlate3mf", () => {
  it("emits one object per PLACEMENT, so every copy can be named and configured", async () => {
    // THIS ROW USED TO ASSERT THE OPPOSITE, and the change is measured rather
    // than preferred. It read "one object per DISTINCT part": six identical caps
    // were one mesh and six `<item>` lines, which is the smaller and better file
    // right up until `model_settings.config` exists. In Creality Print 7.2.1
    // ONLY THE FIRST INSTANCE of a shared object receives the settings, and only
    // the first receives its NAME -- the rest arrive anonymous and unconfigured.
    // Adding settings silently broke naming, which had worked before.
    //
    // Declaring the copies properly does not rescue it: a probe carrying a
    // `<plate>` block with one `<model_instance>` per copy, the shape Creality
    // writes in its own saves, still left the second cap unnamed.
    //
    // The cost is duplicated mesh, and it is the price of every part having an
    // identity. Three placements over two parts, so "per placement" and "per
    // distinct" give different numbers and this row can tell them apart.
    const model = await modelOf(
      await plate3mf([at("a", 4, 4), at("b", 20, 4), at("a", 40, 4)], SOURCES),
    );
    expect(model.match(/<object /g)).toHaveLength(3);
    expect(model.match(/<item /g)).toHaveLength(3);
    // The mesh really is carried twice now, not merely counted twice.
    expect(model.match(/<vertex x="1"/g)).toHaveLength(2);
    expect(model.match(/<vertex x="2"/g)).toHaveLength(1);
  });

  it("points every item at the object it names", async () => {
    // The count above passes on a merge that gives both objects the same id.
    // This resolves each item through the id table, so a collision fails and an
    // item ordered against the wrong mesh fails.
    const model = await modelOf(
      await plate3mf([at("a", 4, 4), at("b", 20, 4), at("a", 40, 4)], SOURCES),
    );
    expect(itemNames(model)).toEqual(["Part-A", "Part-B", "Part-A"]);
  });

  it("names each object with the published spelling, not the R2 slug", async () => {
    // THE POINT OF 3MF. The object name is what a slicer shows in its object
    // list, and it was measured surviving a Creality Print round trip -- all 15
    // names in the known-good reference plate read back as `Hex-TB-Main`,
    // `Dovetail-Cap-Single-F-Solid` and so on. The slug is a lossy projection of
    // that filename, so shipping it hands somebody a list of lowercase hyphen
    // soup for no gain.
    //
    // The NEGATIVE half is what makes this bite. A writer that emitted the slug
    // would still produce a well-formed plate with one correctly-pointed object
    // per part, and every other assertion in this file would pass.
    const model = await modelOf(
      await plate3mf(
        [at("a", 4, 4, {}, "Hex-TB-Main"), at("b", 20, 4, {}, "Dovetail-Cap-Single-F-Solid")],
        SOURCES,
      ),
    );
    expect(model).toContain('name="Hex-TB-Main"');
    expect(model).toContain('name="Dovetail-Cap-Single-F-Solid"');
    expect(model).not.toContain('name="a"');
    expect(model).not.toContain('name="b"');
  });

  it("gives two copies of one part two named, separately configured objects", async () => {
    // THIS ROW REPLACES A GUARD THAT NO LONGER HAS ANYTHING TO GUARD. It used to
    // assert that one slug carrying two different names was REFUSED, because
    // instancing collapsed every placement onto one object and the first name
    // silently won. Nothing is collapsed now, so two names are simply two
    // objects, and the throw would be refusing a request it can satisfy.
    //
    // What replaces it is the defect the owner actually hit: a plate of two caps
    // and a ball joint where one cap had no name and none of the settings.
    const buf = await plate3mf(
      [at("a", 4, 4, {}, "Hex-TB-Main"), at("a", 20, 4, {}, "Hex-TB-Spare")],
      SOURCES,
    );
    const model = await modelOf(buf);
    expect(itemNames(model)).toEqual(["Hex-TB-Main", "Hex-TB-Spare"]);

    // ...and BOTH carry the settings, which is the half that was silently lost.
    const zip = await JSZip.loadAsync(buf);
    const cfg = await zip.file(MODEL_SETTINGS_PATH)!.async("string");
    expect(cfg.match(/key="sparse_infill_pattern"/g)).toHaveLength(2);
    expect(cfg).toContain('value="Hex-TB-Main"');
    expect(cfg).toContain('value="Hex-TB-Spare"');
  });

  it("translates a placement to its minimum corner and seats it on the bed", async () => {
    // tx = target - x0, NOT the target: the mesh carries its own origin, so a
    // part whose box starts at -43.8786 lands 43.8786 mm left of where it was
    // asked for. tz = -z0 seats it on the bed -- one published part's mesh rests
    // 0.144338 mm above its own origin, and without the term it prints floating.
    //
    // Every term is a different number and no two are equal, so dropping ANY of
    // the three changes the string: without `- x0` it reads 4, with `+ x0` it
    // reads -6, without `- y0` it reads 9, without `- z0` it reads 0.
    const model = await modelOf(
      await plate3mf([at("a", 4, 9, { x0: -5, y0: -5, z0: 2 })], SOURCES),
    );
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 9 14 -2"');
  });

  it("subtracts a positive minimum corner as readily as a negative one", async () => {
    // The case above cannot tell `x - x0` from `x + |x0|`. Half the published
    // parts have a positive x0 (`hex-tb-carrier-right-parts-tray` starts at
    // +2.367), so the sign has to be right in both directions.
    const model = await modelOf(
      await plate3mf([at("a", 10, 20, { x0: 3, y0: 7, z0: 0 })], SOURCES),
    );
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 7 13 0"');
  });

  it("drops the noise our own arithmetic adds, and not one source digit", async () => {
    // TWO HALVES OF ONE RULE, and they pull in opposite directions, which is why
    // they are asserted together.
    //
    // `0.1 + 0.2` is `0.30000000000000004`: a subtraction of two doubles, which
    // is what `x - x0` is, writes a seventeenth digit into a value known to six.
    // That is bytes nobody needs and a diff nobody can read, so twelve
    // significant figures drops it.
    //
    // `z0 = 0.144338` is the OPPOSITE case wearing the same clothes. It is small,
    // so a rule expressed in DECIMAL PLACES quantises it hard: the four decimals
    // this file used to round to wrote `-0.1443` and left the part 3.8e-5 mm off
    // the bed. Expressed in SIGNIFICANT FIGURES the same rule keeps every digit.
    // If this test ever reads `-0.1443` again, the plate has the bug back.
    const model = await modelOf(
      await plate3mf([at("a", 0.1 + 0.2, 0, { x0: 0, y0: 0, z0: 0.144338 })], SOURCES),
    );
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 0.3 0 -0.144338"');
  });

  it("writes a plain decimal rather than an exponent", async () => {
    // Fifteen published parts have a mesh bottom that is the exporter's own
    // float noise -- `hex-tb-spike-solid` sits 1.90781e-12 mm above its origin --
    // seating those EXACTLY means a translation `String` would spell
    // `1.90781e-12`. The published meshes are full of exponential vertex text
    // and Creality Print reads them, so the notation is not exotic; but
    // `transform` is a different attribute with its own type in the 3MF schema,
    // no measurement covers it, and the reference plate's own transforms are
    // plain decimals. Being the first to try it buys nothing.
    const model = await modelOf(
      await plate3mf([at("a", 4, 4, { z0: 1.90781e-12 })], SOURCES),
    );
    expect(model).toContain(
      'transform="1 0 0 0 1 0 0 0 1 4 4 -0.00000000000190781"',
    );
    expect(model).not.toMatch(/transform="[^"]*[eE][-+]/);
  });

  it("seats every published part at EXACTLY z = 0, on one plate", async () => {
    // THE INVARIANT THE SLICER IS ACTUALLY TESTING. Creality Print V7.2.1 raises
    // "Multi-part object detected -- This file contains several objects
    // positioned at multiple heights" when one object on a plate does not sit
    // where the others do, and answering "Yes" fuses fifteen separately-named
    // parts into a single multi-part body. That destroys the named object list
    // which is the entire reason this feature ships 3MF rather than STL.
    //
    // THE TOLERANCE IS ZERO, and that is a deliberate engineering choice rather
    // than a slogan. Three things make it the honest threshold:
    //
    //   1. Zero is ACHIEVABLE here, exactly, on every platform. The sum below is
    //      `z0 + (-z0)`, and IEEE754 addition of a finite double and its own
    //      negation is exactly +0 -- no epsilon, no rounding mode, no accumulated
    //      error, because there is no accumulation. It is an identity, not a
    //      measurement. So an epsilon would not be buying safety; it would only
    //      be declaring how much drift we intend to permit.
    //   2. Any epsilon is a number someone widens. This bug shipped at 3.38e-4
    //      mm precisely because "far below what an FDM printer can express" had
    //      no defined edge. The measured band is wide and unhelpful: a plate
    //      carrying 5.33e-15 mm of residual loads fine, 3.38e-4 does not, and
    //      nobody knows where between them the slicer's own threshold sits. A
    //      tolerance picked inside a band that wide is a guess wearing a number.
    //   3. Zero is the only threshold that fails for the RIGHT REASON. A part
    //      seated at anything other than 0 means either the table quantised the
    //      mesh minimum or the writer quantised the translation -- both real
    //      defects, neither of which has a benign magnitude.
    //
    // EACH FIXTURE'S LOWEST VERTEX IS THE MESH'S OWN TEXT, not the table's `z0`,
    // and that is what stops this from being circular. `z0` is that text parsed
    // by the script that used to round it, so a fixture built from `z0` would sit
    // at the same wrong height as the translation meant to cancel it, seat
    // perfectly against itself, and pass -- the real defect would have gone
    // straight through. Measured rather than reasoned: with both shipped
    // roundings restored and the fixture reading `box.z0`, this assertion
    // PASSED. Reading `HEX_PART_MESH_BOTTOM`, it fails.
    //
    // The meshes themselves cannot be here -- they are a sibling checkout that
    // never ships with the app -- so their lowest vertex travels as text
    // instead, and the generator refuses to write the two if they disagree.
    const model = await modelOf(await plate3mf(ALL, ALL_SOURCES));
    const placed = seats(model);
    // WHICH PARTS were measured, not how many. `toHaveLength(ALL.length)` reads
    // like a coverage check and is not one -- it compares the fixture against
    // itself, so a fixture narrowed to a single part still satisfies it and the
    // sweep silently stops covering 52 of the 53. Held to the published NAME
    // table instead, which is the list this plate is supposed to be.
    expect(placed.map((s) => s.name).sort()).toEqual(Object.values(HEX_PART_NAME).sort());
    expect(placed.filter((s) => s.z !== 0).map((s) => `${s.name} at ${s.z} mm`)).toEqual([]);
  });

  it("writes every coordinate on a full plate as a plain finite decimal", async () => {
    // Guards the seat assertion above from passing vacuously. `Number("")` is 0
    // and `Number("NaN") + anything` is NaN, so a transform the writer mangled
    // could still read back as a seat of 0 -- or as one that is simply not a
    // number, which `!== 0` accepts. Every one of the 53 x 12 numbers has to be
    // a plain decimal, and the 3x3 block has to still be the identity: this is a
    // translation, and a rotation would move the part's lowest point somewhere
    // the sum above never looks.
    const model = await modelOf(await plate3mf(ALL, ALL_SOURCES));
    for (const s of seats(model)) {
      expect(s.t.every(Number.isFinite), `${s.name} transform`).toBe(true);
      expect(s.t.slice(0, 9), `${s.name} is not a pure translation`).toEqual([
        1, 0, 0, 0, 1, 0, 0, 0, 1,
      ]);
    }
    for (const m of model.matchAll(/transform="([^"]*)"/g)) {
      for (const num of m[1].trim().split(/\s+/)) {
        expect(num, `transform component ${num}`).toMatch(/^-?\d+(\.\d+)?$/);
      }
    }
  });

  it("writes a flat zero rather than a negative zero", async () => {
    // `-0` round-trips through JSON and most parsers, but it reads as a mistake
    // in a file people open in a text editor and it is not what the reference
    // carries. A part already sitting at z0 = 0 is the common case, so this is
    // 37 of the 53 published parts -- the other 16 have a non-zero mesh bottom,
    // 15 of them float noise and one, the spike ball joint, real.
    const model = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 4 4 0"');
    expect(model).not.toContain("-0 ");
  });

  it("refuses a placement it has no mesh for", async () => {
    // A plate quietly missing one part is the worst outcome available here: the
    // file opens, the object list looks plausible, and the thing you needed is
    // simply not in the box. You find out after the print.
    await expect(
      plate3mf([at("a", 4, 4), at("missing", 20, 4)], SOURCES),
    ).rejects.toThrow(/missing/);
  });

  it("is a readable 3MF package and carries nothing else", async () => {
    // The three entries the known-good reference plate has, PLUS the package
    // thumbnail. An extra file is not harmless: `[Content_Types].xml` declares
    // the extensions a package may contain, so anything with an undeclared
    // extension makes the whole package non-conforming -- which is why the
    // thumbnail arrived with a `png` default and a relationship, asserted
    // below, rather than on its own.
    //
    // This list is CLOSED on purpose. The failure it catches is not "a file we
    // meant to add"; it is a file that appears without either of the two
    // declarations that make it legal.
    //
    // `model_settings.config` joined it deliberately and DID fail this row on
    // the way in, which is the row doing its job. It differs from the thumbnail
    // in one respect worth writing down: it needs the `config` default in
    // `[Content_Types].xml` but NO relationship, because it is a vendor side-car
    // found by path rather than an OPC-related part.
    const zip = await JSZip.loadAsync(await plate3mf([at("a", 4, 4)], SOURCES));
    const entries = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(entries.sort()).toEqual([
      "3D/3dmodel.model",
      MODEL_SETTINGS_PATH,
      "Metadata/thumbnail.png",
      "[Content_Types].xml",
      "_rels/.rels",
    ]);
  });

  it("declares millimetres and the core namespace", async () => {
    // A 3MF with no `unit` defaults to MICRONS, so a plate that forgets it
    // arrives one thousandth of its size and reads as a corrupt mesh rather than
    // a missing attribute.
    const model = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(model).toContain('unit="millimeter"');
    expect(model).toContain(
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"',
    );
  });

  it("puts nothing on an item that the core spec does not define", async () => {
    // The core spec allows exactly `objectid`, `transform` and `partnumber` on
    // `<item>`, plus attributes from OTHER namespaces. An unqualified extra --
    // `printable="1"`, which Creality Print writes in its own project files --
    // is outside the schema, and the reference plate that was actually opened in
    // a slicer does not carry one. Adding it buys nothing (an item is printable
    // by default) and costs conformance, so it stays out.
    const model = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    for (const m of model.matchAll(/<item\b([^>]*)\/>/g)) {
      const attrs = [...m[1].matchAll(/([a-zA-Z:]+)=/g)].map((a) => a[1]);
      expect(attrs).toEqual(["objectid", "transform"]);
    }
  });

  it("carries the title and the licence, escaped", async () => {
    // A pack is a redistribution of a CC BY work and the credit has to travel
    // inside the file, not only in the README beside it -- a single .3mf gets
    // dragged out of the zip and the notice is gone.
    const model = await modelOf(
      await plate3mf([at("a", 4, 4)], SOURCES, {
        title: "Plate 1 of 3 <hex>",
        credit: "CC BY 4.0 -- One Thousand Drones, LLC",
      }),
    );
    expect(model).toContain(
      '<metadata name="Title">Plate 1 of 3 &lt;hex&gt;</metadata>',
    );
    expect(model).toContain("CC BY 4.0 -- One Thousand Drones, LLC");
  });

  it("writes ONLY names the core spec defines, unqualified", async () => {
    // THE GUARD THAT MAKES THE REST OF THIS BLOCK MEAN ANYTHING. The 3MF core
    // spec defines a CLOSED set of `<model>` metadata names and says that an
    // unqualified name outside it MUST instead be namespace-prefixed -- so a
    // misspelling (`Licenceterms`, `CreatedDate`, `Designers`) is not a typo
    // with a cosmetic cost: it is a private extension carrying no namespace,
    // which makes the document non-conforming. The XML stays well-formed, the
    // package still opens and the slicer still prints, so nothing else in this
    // file or in any slicer would ever notice.
    //
    // Held against the IMPORTED list, never a transcribed one -- a second copy
    // would agree with itself forever while the real one drifted.
    const model = await modelOf(
      await plate3mf([at("a", 4, 4)], SOURCES, { description: "d" }),
    );
    const names = [...model.matchAll(/<metadata name="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(CORE_META as readonly string[], name).toContain(name);
      // Unqualified: a colon would be a namespace prefix, and a prefix that is
      // not declared on `<model>` is a different non-conformance again.
      expect(name, name).not.toContain(":");
    }
    // 3MF forbids duplicate metadata names on one element.
    expect(new Set(names).size).toBe(names.length);
  });

  it("fills in every core field we can state truthfully", async () => {
    const model = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(model).toContain(
      '<metadata name="Designer">One Thousand Drones, LLC</metadata>',
    );
    expect(model).toContain(
      '<metadata name="Copyright">Copyright One Thousand Drones, LLC. Licensed CC BY 4.0.</metadata>',
    );
    expect(model).toContain(
      '<metadata name="Application">One Thousand Drones -- Hex Cluster</metadata>',
    );
    // Derived from the shared spec, not transcribed: the holder and the licence
    // name come from `HEX_LICENSE`, so the file cannot name a different holder
    // from the README or the /hex page.
    expect(model).toContain(HEX_LICENSE.holder);
    // `Rating` is deliberately absent -- there is nothing truthful to put in it,
    // and an empty element is a claim rather than a silence.
    expect(model).not.toContain('name="Rating"');
  });

  it("dates the document from the RELEASE, so a clock cannot get in", async () => {
    // A wall clock is the obvious value and it is unavailable: the response is
    // cached per URL and promises identical bytes, so `new Date()` here would
    // break that promise from INSIDE the file where no header comparison would
    // look. The release is a real date, it describes when this geometry was
    // created, and it is already part of the URL.
    const model = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(model).toContain(
      `<metadata name="CreationDate">${RELEASE}</metadata>`,
    );
    // Equal by construction: the document is assembled and never modified, so a
    // ModificationDate that differed would be claiming an edit that never
    // happened.
    expect(model).toContain(
      `<metadata name="ModificationDate">${RELEASE}</metadata>`,
    );
    // And no year that is not the release's -- the sharpest form of "no clock".
    expect(model).not.toMatch(
      new RegExp(`name="(Creation|Modification)Date">(?!${RELEASE}<)`),
    );
  });

  it("CONTROL: a different release really does change the dates", async () => {
    // Without this row, "the dates are the release" is satisfied by a writer
    // that hardcodes 2026-08-03 and ignores what it was handed.
    const model = await modelOf(
      await plate3mf([at("a", 4, 4)], SOURCES, { release: "2026-07-31" }),
    );
    expect(model).toContain(
      '<metadata name="CreationDate">2026-07-31</metadata>',
    );
    expect(model).not.toContain(RELEASE);
  });

  it("refuses a release that is not a plain ISO date", async () => {
    // Checked rather than trusted, because the failure is silent: an ill-formed
    // date is still well-formed XML, so the package opens and only a conformance
    // checker would ever say otherwise.
    for (const bad of ["latest", "2026-8-3", "", "2026-08-03T00:00:00Z"]) {
      await expect(
        plate3mf([at("a", 4, 4)], SOURCES, { release: bad }),
        bad,
      ).rejects.toThrow(/ISO date/);
    }
  });

  it("defaults LicenseTerms to the shared credit, not a bare licence name", async () => {
    // A caller that forgets the credit used to get the string "CC BY 4.0",
    // which names a licence and satisfies none of its attribution condition.
    // The default is now the canonical line a remixer can copy verbatim.
    const model = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(model).toContain(
      `<metadata name="LicenseTerms">${HEX_LICENSE.credit}</metadata>`,
    );
  });

  it("carries a description when one is given, and omits the element when not", async () => {
    // The support and orientation notes ride inside the file as core-spec
    // `Description` metadata, so a plate separated from its README still says
    // how to print it. Not the guarantee -- slicers surface metadata
    // inconsistently, which is why the route ships a spike-bearing plate in an
    // archive -- but it costs a few hundred bytes and outlives the zip.
    //
    // The NEGATIVE half matters: an empty `<metadata name="Description">` is a
    // claim that there is nothing to say, which is a different statement from
    // not making one.
    const with_ = await modelOf(
      await plate3mf([at("a", 4, 4)], SOURCES, {
        description: "Support required -- Part-A & <friends>",
      }),
    );
    expect(with_).toContain(
      '<metadata name="Description">Support required -- Part-A &amp; &lt;friends&gt;</metadata>',
    );
    const without = await modelOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(without).not.toContain('name="Description"');
  });

  it("produces the same bytes for the same plate", async () => {
    // DETERMINISM IS THE DESIGN'S PROMISE: the response is cached per URL, so
    // the same request must not produce a different file each time. It is not
    // free -- JSZip stamps every entry with `new Date()` by default, and the DOS
    // timestamp it writes has two-second granularity, so two calls a moment
    // apart differ in their headers while the model inside is identical. A
    // comparison of the MODEL string would pass on that; only the bytes catch it.
    const plate = [at("a", 4, 4), at("b", 20, 4)];
    const first = await plate3mf(plate, SOURCES);
    await new Promise((r) => setTimeout(r, 2100));
    const second = await plate3mf(plate, SOURCES);
    expect(Buffer.compare(first, second)).toBe(0);
  });
});

/* ===========================================================================
   THE PER-OBJECT PRINT SETTINGS.

   These exist because alpha testers do not read the README and did not select
   the infill the parts need. Every row below is about a behaviour MEASURED in
   Creality Print 7.2.1 on 2026-08-17, not inferred from documentation, because
   three research passes disagreed and two of them were wrong.
   =========================================================================== */

describe("Metadata/model_settings.config", () => {
  const configOf = async (buf: Buffer): Promise<string> => {
    const zip = await JSZip.loadAsync(buf);
    const file = zip.file(MODEL_SETTINGS_PATH);
    expect(file, MODEL_SETTINGS_PATH).not.toBeNull();
    return file!.async("string");
  };

  it("gives every part the infill the parts are structurally chosen for", async () => {
    // Gyroid is a torsion requirement here, not a preference. If this stops
    // being written, the whole feature has lost its reason to exist.
    const cfg = await configOf(
      await plate3mf([at("a", 4, 4), at("b", 20, 4)], SOURCES),
    );
    expect(cfg.match(/key="sparse_infill_pattern" value="gyroid"/g)).toHaveLength(2);
  });

  it("spells the infill in the case the slicer's enum map uses", async () => {
    // MEASURED: "Gyroid" is silently replaced with grid, behind a dialog that
    // blames a version mismatch. The file looks right and prints weak.
    const cfg = await configOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(cfg).toContain('value="gyroid"');
    expect(cfg).not.toContain('value="Gyroid"');
  });

  it("carries extruder, the one key a geometry-only import preserves", async () => {
    const cfg = await configOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(cfg).toContain('key="extruder" value="1"');
  });

  it("gives one object per DISTINCT part, matching the model's ids", async () => {
    const buf = await plate3mf(
      [at("a", 4, 4), at("b", 20, 4), at("a", 40, 4)],
      SOURCES,
    );
    const cfg = await configOf(buf);
    const model = await modelOf(buf);
    const cfgIds = [...cfg.matchAll(/<object id="(\d+)"/g)].map((m) => m[1]);
    const modelIds = [...model.matchAll(/<object id="(\d+)"/g)].map((m) => m[1]);
    expect(cfgIds).toEqual(modelIds);
    // An id in the config that names no object in the model is a settings block
    // the slicer silently drops, and the object falls back to "Object_N".
    expect(new Set(cfgIds).size).toBe(cfgIds.length);
  });

  it("names each object, so the slicer's object list is readable", async () => {
    const cfg = await configOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(cfg).toContain('key="name" value="Part-A"');
  });

  it("escapes a name rather than emitting XML the parser will reject", async () => {
    // Names reach here from published filenames. Expat rejects a raw & or <,
    // and a rejected config is a refused import, not a degraded one.
    const cfg = await configOf(
      await plate3mf([at("a", 4, 4, {}, 'Cap & <Bracket>')], SOURCES),
    );
    expect(cfg).toContain("&amp;");
    expect(cfg).not.toMatch(/value="Cap & </);
  });

  it("declares the config extension so the package stays OPC-conforming", async () => {
    const zip = await JSZip.loadAsync(await plate3mf([at("a", 4, 4)], SOURCES));
    const ct = await zip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain('Extension="config"');
  });

  it("stays reproducible: the config carries the same fixed timestamp", async () => {
    // The route promises identical bytes for identical requests. One entry
    // stamped with a wall clock breaks that from inside the archive.
    const zip = await JSZip.loadAsync(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(zip.file(MODEL_SETTINGS_PATH)!.date.getTime()).toBe(
      ZIP_EPOCH.getTime(),
    );
  });
});

describe("support settings ride only on the parts that need them", () => {
  const configOf = async (buf: Buffer): Promise<string> => {
    const zip = await JSZip.loadAsync(buf);
    return zip.file(MODEL_SETTINGS_PATH)!.async("string");
  };

  /** The real slug from `hex-support.ts`, not a stand-in: the point of the row
   *  is that THESE two parts are the ones treated differently. */
  const SPIKE = "hex-tb-spike-ball-joint";

  it("switches support on for a line-resting part", async () => {
    const sources = new Map([[SPIKE, source("1")]]);
    const cfg = await configOf(
      await plate3mf([at(SPIKE, 4, 4, {}, "Hex-TB-Spike-Ball-Joint")], sources),
    );
    expect(cfg).toContain('key="enable_support" value="1"');
    // AND NO BRIM. This part rests on the ball, with almost no perimeter for a
    // brim to hold on to -- the two remedies are independent, and giving it one
    // it cannot use was the defect that separating them fixed.
    expect(cfg).not.toContain("brim_type");
  });

  it("gives a brim to a part that needs adhesion but not support", async () => {
    const ZIP = "hex-tb-spike-ball-zip-single";
    const sources = new Map([[ZIP, source("1")]]);
    const cfg = await configOf(
      await plate3mf([at(ZIP, 4, 4, {}, "Hex-TB-Spike-Ball-Zip-Single")], sources),
    );
    expect(cfg).toContain('key="brim_type" value="outer_only"');
    expect(cfg).not.toContain("enable_support");
  });

  it("gives support to a corner without giving it a pointless brim", async () => {
    // 416.8 sq mm on the bed, and Creality still reports it "has floating
    // regions". Adhesion is not its problem; what happens above layer one is.
    const C = "hex-tb-corner-m-solid";
    const sources = new Map([[C, source("1")]]);
    const cfg = await configOf(
      await plate3mf([at(C, 4, 4, {}, "Hex-TB-Corner-M-Solid")], sources),
    );
    expect(cfg).toContain('key="enable_support" value="1"');
    expect(cfg).not.toContain("brim_type");
  });

  it("does NOT put support or a brim on a part that stands on a flat face", async () => {
    // Restraint is the point. Support everywhere would be two dozen brims to
    // cut off for the benefit of the two parts that need one.
    const cfg = await configOf(await plate3mf([at("a", 4, 4)], SOURCES));
    expect(cfg).not.toContain("enable_support");
    expect(cfg).not.toContain("brim_type");
  });

  it("states the threshold angle rather than inheriting the user's profile", async () => {
    // 30 is measured FROM HORIZONTAL, and every overhang figure this project
    // has measured was scored against it. A profile set to 45 would change what
    // "needs support" means after the fact.
    const sources = new Map([[SPIKE, source("1")]]);
    const cfg = await configOf(
      await plate3mf([at(SPIKE, 4, 4, {}, "Hex-TB-Spike-Ball-Joint")], sources),
    );
    expect(cfg).toContain('key="support_threshold_angle" value="30"');
  });

  it("still gives the support part the same infill as everything else", async () => {
    const sources = new Map([[SPIKE, source("1")]]);
    const cfg = await configOf(
      await plate3mf([at(SPIKE, 4, 4, {}, "Hex-TB-Spike-Ball-Joint")], sources),
    );
    expect(cfg).toContain('value="gyroid"');
  });
});
