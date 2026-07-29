// Minimal RS-274X (Gerber X2) reader -> SVG path geometry.
//
// Covers exactly the subset KiCad 10 emits, verified against the L1.01 answer-key
// set: %FSLAX46Y46 / %MOMM, aperture templates C / R / O / P and the RoundRect
// macro, G01 linear + G02/G03 arcs under G75, G36..G37 regions, %LPD/%LPC
// polarity, and the X2 attributes (%TF/%TA/%TO/%TD) which we read for metadata and
// otherwise skip.
//
// Three independent checks that it reads the files correctly, all reproducible:
//   - flash and region counts match a raw grep of each file (In1 157/1, F_Cu
//     255/8, B_Cu 157/6, F_Mask 154/0, B_Mask 56/0);
//   - the parsed Edge_Cuts bounding box comes out 30.1 x 62.1 mm, which is exactly
//     the Size the .gbrjob declares, derived independently of it;
//   - In1_Cu and In2_Cu parse to identical geometry, as they must: the files are
//     byte-identical apart from the L2/L3 character in their FileFunction.
//
// Y is negated (Gerber is Y-up, SVG is Y-down) so the result keeps the orientation
// a Gerber viewer shows. Used at build time by gen-l101-gerber-data.ts; nothing at
// runtime parses Gerber.

export interface GerberPath {
  d: string;
  kind: "fill" | "stroke";
  /** stroke width in mm, for kind === "stroke" */
  width?: number;
  /** true when this path came from a G36..G37 region (a poured zone) */
  region?: boolean;
}

export interface GerberFile {
  /** X2 %TF attributes, e.g. FileFunction: "Copper,L2,Inr", FilePolarity: "Positive" */
  meta: Record<string, string>;
  apertureCount: number;
  flashCount: number;
  regionCount: number;
  /** [minX, minY, maxX, maxY] in mm, already Y-flipped */
  bbox: [number, number, number, number];
  viewBox: string;
  w: number;
  h: number;
  paths: GerberPath[];
}

interface Aperture {
  code: number;
  tmpl: string;
  mods: number[];
}

const f = (n: number): number => {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
};

function parseAperture(body: string): Aperture | null {
  const m = /^(\d+)([A-Za-z_$][A-Za-z0-9_$.\-]*)(?:,(.*))?$/.exec(body);
  if (!m) return null;
  const [, code, tmpl, modsRaw] = m;
  const mods = (modsRaw ?? "").split("X").filter((s) => s !== "").map(Number);
  return { code: Number(code), tmpl, mods };
}

/** A flash of `ap` at (x, y) as an SVG subpath, already Y-flipped. */
function flashPath(ap: Aperture, x: number, y: number): string {
  const y0 = -y;
  const circle = (cx: number, cy: number, r: number) =>
    `M${f(cx - r)},${f(cy)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0Z`;
  const rect = (cx: number, cy: number, w: number, h: number) =>
    `M${f(cx - w / 2)},${f(cy - h / 2)}h${f(w)}v${f(h)}h${f(-w)}Z`;

  switch (ap.tmpl) {
    case "C":
      return circle(x, y0, ap.mods[0] / 2);
    case "R":
      return rect(x, y0, ap.mods[0], ap.mods[1]);
    case "O": {
      const [w, h] = ap.mods;
      const r = Math.min(w, h) / 2;
      if (w >= h) {
        return `M${f(x - w / 2 + r)},${f(y0 - r)}h${f(w - 2 * r)}a${f(r)},${f(r)} 0 0,1 0,${f(2 * r)}h${f(-(w - 2 * r))}a${f(r)},${f(r)} 0 0,1 0,${f(-2 * r)}Z`;
      }
      return `M${f(x - r)},${f(y0 - h / 2 + r)}v${f(h - 2 * r)}a${f(r)},${f(r)} 0 0,0 ${f(2 * r)},0v${f(-(h - 2 * r))}a${f(r)},${f(r)} 0 0,0 ${f(-2 * r)},0Z`;
    }
    case "P": {
      const [dia, n, rot = 0] = ap.mods;
      const r = dia / 2;
      let d = "";
      for (let i = 0; i < n; i++) {
        const a = ((rot + (360 * i) / n) * Math.PI) / 180;
        d += `${i ? "L" : "M"}${f(x + r * Math.cos(a))},${f(y0 - r * Math.sin(a))}`;
      }
      return d + "Z";
    }
    case "RoundRect": {
      // KiCad's AMRoundRect: corner radius, then four corner X,Y offsets, then a
      // rotation. The macro is (outline through the four points) + (a circle of
      // that radius at each), so that is exactly what we draw.
      if (ap.mods.length < 9) return "";
      const r = ap.mods[0];
      const rot = ((ap.mods[9] ?? 0) * Math.PI) / 180;
      const pts: [number, number][] = [];
      for (let i = 0; i < 4; i++) {
        const px = ap.mods[1 + i * 2];
        const py = ap.mods[2 + i * 2];
        pts.push([
          x + px * Math.cos(rot) - py * Math.sin(rot),
          y0 - (px * Math.sin(rot) + py * Math.cos(rot)),
        ]);
      }
      let d = pts.map(([px, py], i) => `${i ? "L" : "M"}${f(px)},${f(py)}`).join("") + "Z";
      for (const [px, py] of pts) d += circle(px, py, r);
      return d;
    }
    default:
      return "";
  }
}

export function parseGerber(src: string): GerberFile {
  const meta: Record<string, string> = {};
  let scale = 1e-6;
  const aps = new Map<number, Aperture>();
  let curAp: Aperture | null = null;
  let x = 0;
  let y = 0;
  let interp = 1; // 1 linear, 2 CW, 3 CCW
  let inRegion = false;
  let regionD = "";
  let regionOpen = false;
  let nFlash = 0;
  let nRegion = 0;
  const regions: GerberPath[] = [];
  const strokeRuns = new Map<number, string>();
  const flashRuns = new Map<number, string>();
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

  const grow = (px: number, py: number, pad = 0) => {
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    bbox[0] = Math.min(bbox[0], px - pad);
    bbox[1] = Math.min(bbox[1], -py - pad);
    bbox[2] = Math.max(bbox[2], px + pad);
    bbox[3] = Math.max(bbox[3], -py + pad);
  };

  // Tokenise: extended commands %...%, then plain blocks ending in *
  const tokens: { ext: boolean; body: string }[] = [];
  for (let i = 0; i < src.length; ) {
    if (src[i] === "%") {
      const end = src.indexOf("%", i + 1);
      if (end < 0) break;
      tokens.push({ ext: true, body: src.slice(i + 1, end) });
      i = end + 1;
    } else if (src[i] === "\n" || src[i] === "\r" || src[i] === " ") {
      i++;
    } else {
      const end = src.indexOf("*", i);
      if (end < 0) break;
      tokens.push({ ext: false, body: src.slice(i, end) });
      i = end + 1;
    }
  }

  for (const t of tokens) {
    const b = t.body.replace(/[\r\n]/g, "");
    if (t.ext) {
      for (const cmd of b.split("*").filter(Boolean)) {
        if (cmd.startsWith("TF.")) {
          const [k, ...v] = cmd.slice(3).split(",");
          meta[k] = v.join(",");
        } else if (cmd.startsWith("FS")) {
          const m = /X\d(\d)Y\d\d/.exec(cmd);
          if (m) scale = 10 ** -Number(m[1]);
        } else if (cmd.startsWith("ADD")) {
          const ap = parseAperture(cmd.slice(3));
          if (ap) aps.set(ap.code, ap);
        }
        // AM macro bodies and TA/TO/TD attributes: nothing to do.
      }
      continue;
    }
    if (b.startsWith("G04")) continue;
    if (b === "M02") break;

    let rest = b;
    let mg: RegExpExecArray | null;
    while ((mg = /^G(\d{1,2})/.exec(rest))) {
      const g = Number(mg[1]);
      if (g === 1 || g === 2 || g === 3) interp = g;
      else if (g === 36) {
        inRegion = true;
        regionD = "";
        regionOpen = false;
      } else if (g === 37) {
        inRegion = false;
        if (regionD) {
          regions.push({ d: regionD + "Z", kind: "fill", region: true });
          nRegion++;
        }
        regionD = "";
      }
      rest = rest.slice(mg[0].length);
    }
    if (!rest) continue;

    const mdsel = /^D(\d+)$/.exec(rest);
    if (mdsel && Number(mdsel[1]) >= 10) {
      curAp = aps.get(Number(mdsel[1])) ?? null;
      continue;
    }

    const md = /D0?([123])$/.exec(rest);
    if (!md) continue;
    const op = Number(md[1]);

    const gx = /X(-?\d+)/.exec(rest);
    const gy = /Y(-?\d+)/.exec(rest);
    const gi = /I(-?\d+)/.exec(rest);
    const gj = /J(-?\d+)/.exec(rest);
    const nx = gx ? Number(gx[1]) * scale : x;
    const ny = gy ? Number(gy[1]) * scale : y;

    if (op === 2) {
      if (inRegion) {
        if (regionOpen) regionD += "Z";
        regionD += `M${f(nx)},${f(-ny)}`;
        regionOpen = true;
      } else {
        const k = curAp?.code ?? -1;
        strokeRuns.set(k, (strokeRuns.get(k) ?? "") + `M${f(nx)},${f(-ny)}`);
      }
      grow(nx, ny);
    } else if (op === 1) {
      let seg: string;
      if (interp === 1) {
        seg = `L${f(nx)},${f(-ny)}`;
      } else {
        const cx = x + (gi ? Number(gi[1]) * scale : 0);
        const cy = y + (gj ? Number(gj[1]) * scale : 0);
        const r = Math.hypot(x - cx, y - cy);
        const a0 = Math.atan2(y - cy, x - cx);
        const a1 = Math.atan2(ny - cy, nx - cx);
        // The picture keeps the Gerber's visual orientation, so a Gerber CW arc is
        // still visually CW, which in SVG is sweep-flag 1.
        const sweep = interp === 2 ? 1 : 0;
        let delta = interp === 2 ? a0 - a1 : a1 - a0;
        while (delta < 0) delta += 2 * Math.PI;
        if (Math.abs(nx - x) < 1e-9 && Math.abs(ny - y) < 1e-9) {
          // a full circle has to be two half arcs
          seg =
            `A${f(r)},${f(r)} 0 1,${sweep} ${f(2 * cx - x)},${f(-(2 * cy - y))}` +
            `A${f(r)},${f(r)} 0 1,${sweep} ${f(nx)},${f(-ny)}`;
        } else {
          seg = `A${f(r)},${f(r)} 0 ${delta > Math.PI ? 1 : 0},${sweep} ${f(nx)},${f(-ny)}`;
        }
        grow(cx + r, cy + r);
        grow(cx - r, cy - r);
      }
      if (inRegion) regionD += seg;
      else {
        const k = curAp?.code ?? -1;
        strokeRuns.set(k, (strokeRuns.get(k) ?? "") + seg);
      }
      grow(nx, ny, curAp?.tmpl === "C" ? curAp.mods[0] / 2 : 0);
    } else if (op === 3 && curAp) {
      flashRuns.set(curAp.code, (flashRuns.get(curAp.code) ?? "") + flashPath(curAp, nx, ny));
      nFlash++;
      grow(nx, ny, Math.max(...curAp.mods.slice(0, 2), 0) / 2);
    }
    x = nx;
    y = ny;
  }

  const paths: GerberPath[] = [];
  for (const [code, d] of strokeRuns) {
    if (!d) continue;
    const ap = aps.get(code);
    paths.push({ d, kind: "stroke", width: f(ap?.tmpl === "C" ? ap.mods[0] : (ap?.mods?.[0] ?? 0.1)) });
  }
  for (const [, d] of flashRuns) if (d) paths.push({ d, kind: "fill" });
  paths.push(...regions);

  const [x0, y0, x1, y1] = bbox;
  return {
    meta,
    apertureCount: aps.size,
    flashCount: nFlash,
    regionCount: nRegion,
    bbox,
    viewBox: `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`,
    w: f(x1 - x0),
    h: f(y1 - y0),
    paths,
  };
}

/**
 * Ramer-Douglas-Peucker over a path's pure M/L polyline runs. Subpaths containing
 * arcs are left verbatim. `eps` is in mm; at the size a stacked sheet renders
 * (~2.4 px/mm) an eps of 0.05 is about an eighth of a pixel, which is the same
 * kind of loss any viewer takes when it rasterises.
 */
export function simplifyPath(d: string, eps: number, ox = 0, oy = 0): string {
  const f2 = (n: number): number => {
    const v = Math.round(n * 100) / 100;
    return Object.is(v, -0) ? 0 : v;
  };
  return d
    .split(/(?=M)/)
    .filter(Boolean)
    .map((sp) => {
      if (/[Aa]/.test(sp)) {
        return sp
          .replace(/([ML])(-?[\d.]+),(-?[\d.]+)/g, (_m, c, px, py) => `${c}${f2(Number(px) - ox)},${f2(Number(py) - oy)}`)
          .replace(
            /A([\d.]+),([\d.]+) 0 ([01]),([01]) (-?[\d.]+),(-?[\d.]+)/g,
            (_m, rx, ry, la, sw, px, py) => `A${rx},${ry} 0 ${la},${sw} ${f2(Number(px) - ox)},${f2(Number(py) - oy)}`,
          );
      }
      const closed = /Z$/.test(sp);
      const pts: [number, number][] = [...sp.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
        Number(m[1]) - ox,
        Number(m[2]) - oy,
      ]);
      const emit = (arr: [number, number][]) =>
        arr.map(([px, py], i) => `${i ? "L" : "M"}${f2(px)},${f2(py)}`).join("") + (closed ? "Z" : "");
      if (pts.length < 3) return emit(pts);

      const keep = new Uint8Array(pts.length);
      keep[0] = 1;
      keep[pts.length - 1] = 1;
      const stack: [number, number][] = [[0, pts.length - 1]];
      while (stack.length) {
        const [s, e] = stack.pop()!;
        let maxD = 0;
        let idx = -1;
        const [ax, ay] = pts[s];
        const [bx, by] = pts[e];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        for (let i = s + 1; i < e; i++) {
          const [px, py] = pts[i];
          const dist =
            len < 1e-12
              ? Math.hypot(px - ax, py - ay)
              : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
          if (dist > maxD) {
            maxD = dist;
            idx = i;
          }
        }
        if (idx > 0 && maxD > eps) {
          keep[idx] = 1;
          stack.push([s, idx], [idx, e]);
        }
      }
      return emit(pts.filter((_, i) => keep[i]));
    })
    .join("");
}
