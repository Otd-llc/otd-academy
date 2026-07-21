// Render a LaTeX math string to a react-pdf <Svg> tree, so the Library PDF shows
// real typeset math instead of an ASCII fallback. react-pdf can't run KaTeX (HTML
// only) and there's no native rasterizer on the serverless target, so we use
// MathJax's PURE-JS SVG output (fontCache "none" inlines every glyph as a <path>,
// avoiding <use>/<defs> which react-pdf doesn't resolve) and translate its SVG
// node tree into react-pdf <Svg>/<G>/<Path>/<Rect>. Server-only (Node); a failure
// returns null so the caller falls back to the plain-text rendering.
import { Fragment, type ReactNode } from "react";
import { Svg, G, Path, Rect } from "@react-pdf/renderer";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

let doc: any = null;
let adaptor: any = null;
function ensure() {
  if (doc) return;
  adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: AllPackages });
  const svg = new SVG({ fontCache: "none" });
  doc = mathjax.document("", { InputJax: tex, OutputJax: svg });
}

const num = (v: string | null | undefined): number | undefined => {
  if (v == null) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

// Walk one MathJax liteNode into a react-pdf element. Paths/rects carry no fill so
// they inherit the wrapping <G fill={color}>; transforms pass through (react-pdf
// supports translate/scale/matrix). Unknown wrappers flatten to their children.
function walk(node: any, key: string): ReactNode {
  const kind = adaptor.kind(node);
  if (kind === "#text" || kind === "#comment") return null;
  const attr = (name: string) => adaptor.getAttribute(node, name) as string | null;
  const kids = adaptor
    .childNodes(node)
    .map((c: any, i: number) => walk(c, `${key}_${i}`))
    .filter(Boolean);
  switch (kind) {
    case "path": {
      const d = attr("d");
      return d ? <Path key={key} d={d} /> : null;
    }
    case "rect":
      return (
        <Rect
          key={key}
          x={num(attr("x")) ?? 0}
          y={num(attr("y")) ?? 0}
          width={num(attr("width")) ?? 0}
          height={num(attr("height")) ?? 0}
        />
      );
    case "g": {
      const tr = attr("transform");
      return (
        <G key={key} {...(tr ? { transform: tr } : {})}>
          {kids}
        </G>
      );
    }
    case "use":
    case "defs":
      return null; // fontCache "none" inlines paths, so these shouldn't appear
    default:
      return kids.length ? <Fragment key={key}>{kids}</Fragment> : null;
  }
}

function findSvg(node: any): any {
  if (adaptor.kind(node) === "svg") return node;
  for (const c of adaptor.childNodes(node)) {
    const found = findSvg(c);
    if (found) return found;
  }
  return null;
}

/**
 * LaTeX -> react-pdf <Svg>. `display` picks the display-vs-inline layout; `color`
 * fills every glyph. Returns null on any error (caller renders the plain fallback).
 * The math is sized in points from MathJax's ex metrics against a target em.
 */
export function mathToPdf(tex: string, display: boolean, color: string): ReactNode | null {
  try {
    ensure();
    const container = doc.convert(tex, { display });
    const svg = findSvg(container);
    if (!svg) return null;
    const viewBox = adaptor.getAttribute(svg, "viewBox");
    if (!viewBox) return null;
    const wEx = num(adaptor.getAttribute(svg, "width"));
    const hEx = num(adaptor.getAttribute(svg, "height"));
    if (wEx == null || hEx == null) return null;
    // ex -> pt against a target em (display a touch larger than inline body).
    const perEx = (display ? 13 : 11) * 0.5;
    const inner = adaptor
      .childNodes(svg)
      .map((c: any, i: number) => walk(c, `m${i}`))
      .filter(Boolean);
    if (!inner.length) return null;
    return (
      <Svg width={wEx * perEx} height={hEx * perEx} viewBox={viewBox}>
        <G fill={color}>{inner}</G>
      </Svg>
    );
  } catch {
    return null;
  }
}
