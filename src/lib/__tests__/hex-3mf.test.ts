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

import { buildPlate3mf, extractObjectBlock } from "@/lib/hex-3mf";
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
  it("emits one object per distinct part and one item per placement", async () => {
    // INSTANCING, which is the reason mesh vertices are never rewritten: six
    // identical caps are one object and six items, not six copies of a 300 KB
    // mesh. Three placements over two parts, because with one part "per
    // distinct" and "one, full stop" are the same number.
    const model = await modelOf(
      await buildPlate3mf([at("a", 4, 4), at("b", 20, 4), at("a", 40, 4)], SOURCES),
    );
    expect(model.match(/<object /g)).toHaveLength(2);
    expect(model.match(/<item /g)).toHaveLength(3);
    // And the mesh actually carried, not just the count: `a` twice and `b` once.
    expect(model.match(/<vertex x="1"/g)).toHaveLength(1);
    expect(model.match(/<vertex x="2"/g)).toHaveLength(1);
  });

  it("points every item at the object it names", async () => {
    // The count above passes on a merge that gives both objects the same id.
    // This resolves each item through the id table, so a collision fails and an
    // item ordered against the wrong mesh fails.
    const model = await modelOf(
      await buildPlate3mf([at("a", 4, 4), at("b", 20, 4), at("a", 40, 4)], SOURCES),
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
      await buildPlate3mf(
        [at("a", 4, 4, {}, "Hex-TB-Main"), at("b", 20, 4, {}, "Dovetail-Cap-Single-F-Solid")],
        SOURCES,
      ),
    );
    expect(model).toContain('name="Hex-TB-Main"');
    expect(model).toContain('name="Dovetail-Cap-Single-F-Solid"');
    expect(model).not.toContain('name="a"');
    expect(model).not.toContain('name="b"');
  });

  it("refuses one slug carrying two different names on a plate", async () => {
    // Instancing collapses every placement of a slug onto ONE object, so two
    // names for one mesh cannot both be written: the first silently wins and the
    // rest are lost. The output is a well-formed plate with a part labelled
    // something nobody asked for, which is invisible in every structural check.
    //
    // Unreachable from the route -- both fields come from one table row keyed by
    // the slug -- so this guards the contract rather than an expected input.
    await expect(
      buildPlate3mf(
        [at("a", 4, 4, {}, "Hex-TB-Main"), at("a", 20, 4, {}, "Hex-TB-Spare")],
        SOURCES,
      ),
    ).rejects.toThrow(/named both/);
  });

  it("translates a placement to its minimum corner and seats it on the bed", async () => {
    // tx = target - x0, NOT the target: the mesh carries its own origin, so a
    // part whose box starts at -43.879 lands 43.879 mm left of where it was
    // asked for. tz = -z0 seats it on the bed -- one published part's mesh rests
    // 0.144 mm above its own origin, and without the term it prints floating.
    //
    // Every term is a different number and no two are equal, so dropping ANY of
    // the three changes the string: without `- x0` it reads 4, with `+ x0` it
    // reads -6, without `- y0` it reads 9, without `- z0` it reads 0.
    const model = await modelOf(
      await buildPlate3mf([at("a", 4, 9, { x0: -5, y0: -5, z0: 2 })], SOURCES),
    );
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 9 14 -2"');
  });

  it("subtracts a positive minimum corner as readily as a negative one", async () => {
    // The case above cannot tell `x - x0` from `x + |x0|`. Half the published
    // parts have a positive x0 (`hex-tb-carrier-right-parts-tray` starts at
    // +2.367), so the sign has to be right in both directions.
    const model = await modelOf(
      await buildPlate3mf([at("a", 10, 20, { x0: 3, y0: 7, z0: 0 })], SOURCES),
    );
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 7 13 0"');
  });

  it("rounds the transform instead of writing float noise", async () => {
    // 0.1 + 0.2 arithmetic in a coordinate produces `44.00000000000001`, which
    // is not wrong but is a diff nobody can read and bytes nobody needs. Four
    // decimals is a tenth of a micron -- far below anything an FDM printer can
    // express -- and it is what the known-good reference plate carries
    // (`... 216.8117 171.0101 -0.1443`).
    const model = await modelOf(
      await buildPlate3mf([at("a", 0.1 + 0.2, 0, { x0: 0, y0: 0, z0: 0.14434 })], SOURCES),
    );
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 0.3 0 -0.1443"');
  });

  it("writes a flat zero rather than a negative zero", async () => {
    // `-0` round-trips through JSON and most parsers, but it reads as a mistake
    // in a file people open in a text editor and it is not what the reference
    // carries. A part already sitting at z0 = 0 is the common case, so this is
    // 51 of the 53 published parts.
    const model = await modelOf(await buildPlate3mf([at("a", 4, 4)], SOURCES));
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 4 4 0"');
    expect(model).not.toContain("-0 ");
  });

  it("refuses a placement it has no mesh for", async () => {
    // A plate quietly missing one part is the worst outcome available here: the
    // file opens, the object list looks plausible, and the thing you needed is
    // simply not in the box. You find out after the print.
    await expect(
      buildPlate3mf([at("a", 4, 4), at("missing", 20, 4)], SOURCES),
    ).rejects.toThrow(/missing/);
  });

  it("is a readable 3MF package and carries nothing else", async () => {
    // Exactly the three entries the reference has. An extra file is not
    // harmless: `[Content_Types].xml` declares the extensions a package may
    // contain, so anything with an undeclared extension makes the package
    // non-conforming.
    const zip = await JSZip.loadAsync(await buildPlate3mf([at("a", 4, 4)], SOURCES));
    const entries = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(entries.sort()).toEqual([
      "3D/3dmodel.model",
      "[Content_Types].xml",
      "_rels/.rels",
    ]);
  });

  it("declares millimetres and the core namespace", async () => {
    // A 3MF with no `unit` defaults to MICRONS, so a plate that forgets it
    // arrives one thousandth of its size and reads as a corrupt mesh rather than
    // a missing attribute.
    const model = await modelOf(await buildPlate3mf([at("a", 4, 4)], SOURCES));
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
    const model = await modelOf(await buildPlate3mf([at("a", 4, 4)], SOURCES));
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
      await buildPlate3mf([at("a", 4, 4)], SOURCES, {
        title: "Plate 1 of 3 <hex>",
        credit: "CC BY 4.0 -- One Thousand Drones, LLC",
      }),
    );
    expect(model).toContain(
      '<metadata name="Title">Plate 1 of 3 &lt;hex&gt;</metadata>',
    );
    expect(model).toContain("CC BY 4.0 -- One Thousand Drones, LLC");
  });

  it("produces the same bytes for the same plate", async () => {
    // DETERMINISM IS THE DESIGN'S PROMISE: the response is cached per URL, so
    // the same request must not produce a different file each time. It is not
    // free -- JSZip stamps every entry with `new Date()` by default, and the DOS
    // timestamp it writes has two-second granularity, so two calls a moment
    // apart differ in their headers while the model inside is identical. A
    // comparison of the MODEL string would pass on that; only the bytes catch it.
    const plate = [at("a", 4, 4), at("b", 20, 4)];
    const first = await buildPlate3mf(plate, SOURCES);
    await new Promise((r) => setTimeout(r, 2100));
    const second = await buildPlate3mf(plate, SOURCES);
    expect(Buffer.compare(first, second)).toBe(0);
  });
});
