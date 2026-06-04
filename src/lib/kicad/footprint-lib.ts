// KiCad footprint 3D-model association (export-engine Task 4, design §3.1).
//
// PURE (no React/DB/env/network/fs). One job: rewrite an uploaded `.kicad_mod`
// body's `(model "<path>" ...)` so the 3D-model path points at the bundled
// file under `${KIPRJMOD}/3dmodels/<file>`. KiCad normally has each footprint
// reference a 3D model by an absolute/env path that won't exist on the
// learner's machine; we re-point it at the project-local copy so the model
// loads out of the box.
//
// Preserves any existing `(offset ...)`/`(scale ...)`/`(rotate ...)` sub-nodes;
// inserts a `(model ...)` with sane defaults when the footprint has none.
// Target format KiCad 10. Anchored to the sample footprint in kicad-meta.test.ts.

import {
  parseSexpr,
  serializeSexpr,
  sym,
  str,
  list,
  isList,
  head,
  findChild,
  type SList,
} from "@/lib/kicad/sexpr";

/** Default 3D-model transform nodes used when inserting a fresh `(model ...)`. */
function defaultModelTransforms() {
  return [
    list([sym("offset"), list([sym("xyz"), sym("0"), sym("0"), sym("0")])]),
    list([sym("scale"), list([sym("xyz"), sym("1"), sym("1"), sym("1")])]),
    list([sym("rotate"), list([sym("xyz"), sym("0"), sym("0"), sym("0")])]),
  ];
}

/**
 * Replace (or insert) a footprint's `(model "<path>" ...)` so its path becomes
 * `modelPath` (caller supplies the full `${KIPRJMOD}/3dmodels/<file>` string).
 * Existing offset/scale/rotate sub-nodes are kept untouched; only the path atom
 * (the model node's first arg) is rewritten. When no `(model ...)` exists, one
 * is appended at the end of the footprint with default 0-offset / 1-scale /
 * 0-rotate transforms. Re-serializes and returns the full footprint text.
 */
export function setFootprintModelPath(footprintText: string, modelPath: string): string {
  const node = parseSexpr(footprintText);
  if (!isList(node)) {
    throw new Error("setFootprintModelPath: input is not an S-expression list");
  }
  const kw = head(node);
  if (kw !== "footprint" && kw !== "module") {
    throw new Error(
      `setFootprintModelPath: expected (footprint ...) or (module ...), got (${kw ?? "?"} ...)`,
    );
  }

  const existing: SList | undefined = findChild(node, "model");
  if (existing) {
    // items: [sym(model), <pathAtom>, (offset ...), (scale ...), (rotate ...)]
    existing.items[1] = str(modelPath);
    return serializeSexpr(node);
  }

  // No model node — append one with the path + default transforms.
  node.items.push(list([sym("model"), str(modelPath), ...defaultModelTransforms()]));
  return serializeSexpr(node);
}

/**
 * The current 3D-model path of a footprint body, if it has a `(model "<path>")`
 * node whose first arg is a string/atom. Returns undefined otherwise. Useful
 * for diagnostics/reporting before a rewrite.
 */
export function getFootprintModelPath(footprintText: string): string | undefined {
  const node = parseSexpr(footprintText);
  const model = findChild(node, "model");
  if (!model) return undefined;
  const pathNode = model.items[1];
  return pathNode && pathNode.kind !== "list" ? pathNode.value : undefined;
}
