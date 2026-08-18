// Cura's per-object payload — the only one that lives INSIDE `3D/3dmodel.model`.
//
// That placement is the whole risk, and it is what these rows are aimed at. The
// Orca and Prusa payloads are side-cars under `Metadata/` that a foreign reader
// never opens, so a mistake there costs only the slicer it was written for. This
// one sits in the file Orca, Creality Print and PrusaSlicer all parse.
//
// Cura is NOT installed on this machine, so "Cura applies these" is a source
// reading rather than a measurement — see the module header. What IS checked here
// is everything that does not need Cura: the shape libSavitar parses, the keys
// Cura's own definitions flag `settable_per_mesh`, and the values that would be
// wrong in a way no slicer reports.
import { describe, expect, it } from "vitest";

import { CURA_XMLNS, curaMetadataGroup, curaRowsFor } from "@/lib/hex-cura";
import { PRINT_INTENT_TABLE } from "@/lib/hex-print-intent";

const keys = (need: { support: boolean; brim: boolean }) =>
  curaRowsFor(need).map((r) => r.key);

describe("the shape libSavitar actually parses", () => {
  it("puts the key in `name` and the value in ELEMENT TEXT", () => {
    // THE INVERSE OF THE ORCA DIALECT, and the single easiest thing to get
    // backwards. Cura's own writer (`libSavitar/src/Scene.cpp`) does
    // `append_attribute("name")` then `text().set(value)`. Written as
    // `key=`/`value=` attributes -- the way the Orca payload does it -- Cura
    // reads nothing and reports nothing.
    const xml = curaMetadataGroup([{ key: "infill_pattern", value: "gyroid" }]);
    expect(xml).toContain('<metadata name="cura:infill_pattern">gyroid</metadata>');
    expect(xml).not.toMatch(/value="gyroid"/);
  });

  it("wraps them in a metadatagroup", () => {
    // `SceneNode::fillByXMLNode` reads `xml_node.child("metadatagroup")` and
    // then each `metadata` child. Bare `<metadata>` under `<object>` is invisible
    // to it.
    const xml = curaMetadataGroup([{ key: "wall_line_count", value: "4" }]);
    expect(xml).toContain("<metadatagroup>");
    expect(xml).toContain("</metadatagroup>");
  });

  it("prefixes every name with `cura:`", () => {
    for (const r of curaRowsFor({ support: true, brim: true })) {
      expect(curaMetadataGroup([r])).toContain(`name="cura:${r.key}"`);
    }
  });

  it("emits NOTHING for an empty row set, not an empty group", () => {
    // So a plate of parts Cura can be told nothing about stays byte-identical to
    // one written before this payload existed. An empty `<metadatagroup/>` would
    // be legal and would still change every such plate's bytes.
    expect(curaMetadataGroup([])).toBe("");
  });

  it("escapes values, because they land in element text", () => {
    const xml = curaMetadataGroup([{ key: "k", value: 'a & b < c > "d"' }]);
    expect(xml).toContain("a &amp; b &lt; c &gt; &quot;d&quot;");
    expect(xml).not.toContain("&amp;lt;");
  });
});

describe("the keys Cura can actually apply", () => {
  it("carries the three every-part settings", () => {
    expect(keys({ support: false, brim: false })).toEqual([
      "infill_pattern",
      "infill_sparse_density",
      "wall_line_count",
    ]);
  });

  it("adds support_enable, and ONLY that, for a support part", () => {
    // Cura has no separate "find the overhangs yourself" flag -- `support_enable`
    // already means automatic support there -- and `support_angle` is
    // deliberately omitted (see the next block).
    expect(keys({ support: true, brim: false })).toEqual([
      "infill_pattern",
      "infill_sparse_density",
      "wall_line_count",
      "support_enable",
    ]);
  });

  it("adds NOTHING for a brim part, because Cura has no per-object brim", () => {
    // `adhesion_type`, `brim_width` and `brim_line_count` are all
    // `settable_per_mesh: false` in `fdmprinter.def.json`. Translating one would
    // ship a setting that looks carried and does nothing -- and Cura's reader
    // parks unknown or non-applicable keys in node metadata WITHOUT a warning,
    // so nothing would ever say so.
    expect(keys({ support: false, brim: true })).toEqual(
      keys({ support: false, brim: false }),
    );
    expect(keys({ support: true, brim: true })).toEqual(
      keys({ support: true, brim: false }),
    );
  });

  it("never carries a key Cura cannot set per mesh", () => {
    const forbidden = [
      "support_type", // per_mesh FALSE, and means buildplate|everywhere in Cura
      "adhesion_type", // per_mesh FALSE
      "brim_width", // per_mesh FALSE
      "brim_line_count", // per_mesh FALSE
    ];
    const all = keys({ support: true, brim: true });
    for (const f of forbidden) expect(all).not.toContain(f);
  });
});

describe("the values, where being wrong is silent", () => {
  it("writes the density WITHOUT a percent sign", () => {
    // Cura types `infill_sparse_density` as a FLOAT. Orca wants `30%` and Prusa
    // actively multiplies a bare `30` to `3000%`. Three dialects, three
    // spellings of one number, and only this one takes the bare form.
    const row = PRINT_INTENT_TABLE.find(
      (r) => r.key === "sparse_infill_density",
    )!;
    expect(row.cura).toEqual({ key: "infill_sparse_density", value: "30" });
    expect(row.cura!.value).not.toContain("%");
  });

  it("writes the support boolean Python-cased", () => {
    const row = PRINT_INTENT_TABLE.find((r) => r.key === "enable_support")!;
    expect(row.cura).toEqual({ key: "support_enable", value: "True" });
    // `1` is the Orca spelling and would not parse as a Cura bool.
    expect(row.cura!.value).not.toBe("1");
  });

  it("does NOT carry the support threshold, whose number is inverted", () => {
    // THE TRAP THIS ROW EXISTS FOR. Cura HAS a per-mesh `support_angle`, so the
    // number looks transferable. It is not: Cura measures from VERTICAL and
    // inverts the sense -- its own description is "At a value of 0 all overhangs
    // are supported, 90 will not provide any support" -- while Orca and Prusa
    // measure from HORIZONTAL where larger means MORE support.
    //
    // Our 30-from-horizontal is 60 in Cura's terms. Writing 30 would ask for
    // support on anything more than 30 degrees off vertical: far more than
    // intended, and more aggressive than Cura's own default of 50. That is a
    // wrong print, not a missing setting -- so it is omitted rather than
    // translated, and stays omitted until someone opens Cura.
    const row = PRINT_INTENT_TABLE.find(
      (r) => r.key === "support_threshold_angle",
    )!;
    expect(row.cura).toBeNull();
    expect(keys({ support: true, brim: true })).not.toContain("support_angle");
  });

  it("keeps the infill pattern spelled the way Cura's enum spells it", () => {
    const row = PRINT_INTENT_TABLE.find(
      (r) => r.key === "sparse_infill_pattern",
    )!;
    expect(row.cura).toEqual({ key: "infill_pattern", value: "gyroid" });
    // Verified against `fdmprinter.def.json`: `gyroid` is a valid option, and
    // lowercase is how the option is spelled.
    expect(row.cura!.value).toBe(row.cura!.value.toLowerCase());
  });
});

describe("every row declares its Cura half deliberately", () => {
  // No default. A new setting must SAY whether it crosses to Cura, because
  // Cura's per-object surface is the narrowest of the three and silently
  // ignores what it cannot apply.
  it.each(PRINT_INTENT_TABLE.map((r) => [r.key, r] as const))("%s", (_k, row) => {
    expect(row).toHaveProperty("cura");
    if (row.cura !== null) {
      expect(row.cura.key).not.toBe("");
      expect(row.cura.value).not.toBe("");
    }
  });

  it("has rows to check, so the loop above cannot drain to nothing", () => {
    expect(PRINT_INTENT_TABLE.filter((r) => r.cura !== null).length).toBeGreaterThan(0);
  });
});

describe("the namespace", () => {
  it("is Cura's own URI", () => {
    // From `libSavitar::xml_namespace::getCuraUri()`.
    expect(CURA_XMLNS).toBe(
      'xmlns:cura="http://software.ultimaker.com/xml/cura/3mf/2015/10"',
    );
  });
});
