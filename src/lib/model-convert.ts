// Browser-only: tessellate a source CAD file to a .glb Blob + bounding sphere.
// STEP/STP → occt-import-js (OpenCASCADE WASM); WRL → three VRMLLoader. Always
// exports a binary glTF (.glb) so the viewer has ONE runtime loader. Returns
// null on ANY failure — the caller records the asset download-only (the render
// is non-load-bearing; conversion must never block curation).
//
// Heavy deps (occt, three exporters/loaders) are dynamically imported INSIDE the
// function so they code-split onto the upload path and never reach viewers.
import { boundsFromPositions } from "@/lib/model-bounds";
import type { RenderBounds } from "@/lib/schemas/part-asset";

export type ConvertResult = { glb: Blob; bounds: RenderBounds };

// occt-import-js (v0.0.23) ships no type declarations, so we model only the
// surface we touch. Shape verified against the package README + bundled
// three.js example: the default export is a factory returning a Promise of the
// module; `ReadStepFile(content, params|null)` yields a result whose meshes hold
// three.js-compatible position/normal/index typed arrays + an optional color.
type OcctTypedArray = { array: ArrayLike<number> };
type OcctMesh = {
  name?: string;
  color?: [number, number, number];
  attributes: { position: OcctTypedArray; normal?: OcctTypedArray };
  index?: OcctTypedArray;
};
type OcctResult = { success: boolean; meshes?: OcctMesh[] };
type OcctModule = {
  ReadStepFile: (content: Uint8Array, params: unknown) => OcctResult;
};
type OcctFactory = (opts: { locateFile: (path: string) => string }) => Promise<OcctModule>;

/** Dynamically import the untyped occt-import-js CJS factory and apply our local
 *  surface type. The single `@ts-expect-error` is the only suppression: the
 *  package (v0.0.23) ships no `.d.ts`, so the bare module specifier raises
 *  TS7016 at resolution time (a cast can't silence that). Confining the suppress
 *  to this one import — then casting to `OcctFactory` — keeps the rest of the
 *  converter fully type-checked and avoids a project-wide ambient declaration. */
async function loadOcct(): Promise<OcctFactory> {
  // @ts-expect-error occt-import-js has no bundled type declarations (TS7016).
  const mod = (await import("occt-import-js")) as { default: OcctFactory };
  return mod.default;
}

export async function convertToGlb(file: File): Promise<ConvertResult | null> {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  try {
    const THREE = await import("three");
    const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");

    const scene = new THREE.Scene();
    let allPositions: number[] = [];

    if (ext === ".step" || ext === ".stp") {
      const occtimportjs = await loadOcct();
      const occt = await occtimportjs({ locateFile: () => "/occt-import-js.wasm" });
      const buf = new Uint8Array(await file.arrayBuffer());
      const res = occt.ReadStepFile(buf, null);
      if (!res?.success || !res.meshes?.length) return null;
      for (const m of res.meshes) {
        const g = new THREE.BufferGeometry();
        const pos = new Float32Array(m.attributes.position.array);
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        if (m.attributes.normal) {
          g.setAttribute(
            "normal",
            new THREE.BufferAttribute(new Float32Array(m.attributes.normal.array), 3),
          );
        }
        if (m.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.index.array), 1));
        if (!m.attributes.normal) g.computeVertexNormals();
        const color = m.color
          ? new THREE.Color(m.color[0], m.color[1], m.color[2])
          : new THREE.Color(0.8, 0.8, 0.85);
        scene.add(
          new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 })),
        );
        allPositions = allPositions.concat(Array.from(pos));
      }
    } else if (ext === ".wrl") {
      const { VRMLLoader } = await import("three/addons/loaders/VRMLLoader.js");
      const text = await file.text();
      const parsed = new VRMLLoader().parse(text, "");
      scene.add(parsed);
      parsed.traverse((o: unknown) => {
        const mesh = o as {
          geometry?: { getAttribute?: (n: string) => { array: ArrayLike<number> } | undefined };
        };
        const attr = mesh.geometry?.getAttribute?.("position");
        if (attr) allPositions = allPositions.concat(Array.from(attr.array));
      });
    } else {
      return null; // unsupported source ext
    }

    const bounds = boundsFromPositions(allPositions);
    const glbArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      new GLTFExporter().parse(
        scene,
        (out) => resolve(out as ArrayBuffer),
        (err) => reject(err),
        { binary: true },
      );
    });
    return { glb: new Blob([glbArrayBuffer], { type: "model/gltf-binary" }), bounds };
  } catch {
    return null; // any failure → render-less asset
  }
}
