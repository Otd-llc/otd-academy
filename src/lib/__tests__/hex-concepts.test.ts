import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HEX_CONCEPTS,
  hexConceptBounds,
  HEX_CONCEPT_FORMAT,
  HEX_CONCEPT_MANIFEST_FORMAT,
  HEX_CONCEPT_STEMS,
} from "@/lib/hex-concepts";
import { HEX_PART_SLUGS } from "@/lib/hex-release-tables";

const PUBLIC = join(process.cwd(), "public");

describe("the molded-line concept manifest copy", () => {
  it("is the format the CAD exporter writes", () => {
    expect(HEX_CONCEPT_MANIFEST_FORMAT).toBe(HEX_CONCEPT_FORMAT);
  });

  it("carries the first concept and nothing the release publishes", () => {
    // 1 ON 2026-09-30: hex-molded-tub. A concept is displayed and never
    // printed, so a stem here that is also a released part is a
    // classification error, whichever file is wrong.
    expect([...HEX_CONCEPT_STEMS].sort()).toEqual(["hex-molded-tub"]);
    const released = new Set<string>(HEX_PART_SLUGS);
    expect([...HEX_CONCEPT_STEMS].filter((s) => released.has(s))).toEqual([]);
  });

  it("has a viewer model on this origin for every stem, whole", () => {
    // The page renders `modelSrc` in ModelViewer. A row whose glTF is missing,
    // or whose .bin is not the length the glTF declares, renders as a blank
    // canvas with no error the page can see, so it is refused here.
    for (const c of HEX_CONCEPTS) {
      expect(c.modelSrc).toBe(`/hex/concept/${c.stem}.gltf`);
      const gltfPath = join(PUBLIC, c.modelSrc);
      const gltf = JSON.parse(readFileSync(gltfPath, "utf8")) as {
        buffers: { uri: string; byteLength: number }[];
        nodes: { name: string }[];
      };
      expect(gltf.buffers).toHaveLength(1);
      expect(gltf.buffers[0].uri).toBe(`${c.stem}.bin`);
      const binPath = join(PUBLIC, "hex", "concept", gltf.buffers[0].uri);
      expect(statSync(binPath).size).toBe(gltf.buffers[0].byteLength);
      expect(gltf.nodes.map((n) => n.name)).toEqual([c.stem]);
    }
  });

  it("agrees with the glTF about the part's size", () => {
    // glTF is metres, y up; the manifest is CAD millimetres, z up. The
    // exporter's bbox and the model's POSITION accessor describe one solid, so
    // the extents must match under that swap, to the millimetre.
    for (const c of HEX_CONCEPTS) {
      const gltf = JSON.parse(
        readFileSync(join(PUBLIC, c.modelSrc), "utf8"),
      ) as {
        accessors: { min?: number[]; max?: number[] }[];
      };
      const pos = gltf.accessors[0];
      const extents = pos.max!.map((v, i) => (v - pos.min![i]) * 1000);
      const cad = [c.bboxMm.x, c.bboxMm.z, c.bboxMm.y];
      extents.forEach((e, i) => expect(Math.abs(e - cad[i])).toBeLessThan(0.5));
    }
  });

  it("frames the viewer on the model it actually loads", () => {
    // Bounds are in millimetres, the glTF in metres: the sphere must enclose
    // every POSITION extreme after the unit scale, and not be so large the
    // part is a speck again (the failure this fixes).
    for (const c of HEX_CONCEPTS) {
      const gltf = JSON.parse(
        readFileSync(join(PUBLIC, c.modelSrc), "utf8"),
      ) as {
        accessors: { min?: number[]; max?: number[] }[];
      };
      const { center, radius } = hexConceptBounds(c);
      const corners: number[][] = [];
      const { min, max } = gltf.accessors[0];
      for (const a of [min!, max!])
        for (const b of [min!, max!])
          for (const d of [min!, max!]) corners.push([a[0], b[1], d[2]]);
      for (const p of corners) {
        const dist = Math.hypot(
          p[0] * 1000 - center[0],
          p[1] * 1000 - center[1],
          p[2] * 1000 - center[2],
        );
        expect(dist).toBeLessThanOrEqual(radius + 0.5);
      }
      expect(radius).toBeLessThan(Math.max(c.bboxMm.x, c.bboxMm.y, c.bboxMm.z));
    }
  });

  it("gives every concept a one-line use", () => {
    for (const c of HEX_CONCEPTS) {
      expect(c.use.length).toBeGreaterThan(20);
      expect(c.use).not.toContain("—");
    }
  });
});
