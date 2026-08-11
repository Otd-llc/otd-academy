// SANDBOX — a real glitch compositor. DEV ONLY.
//
// WHY A CANVAS. The artefacts that make a glitch read — bands of the frame
// slipping sideways, the colour channels separating, dropped scanlines, speckle
// — cannot be expressed as CSS on a <video>. clip-path can cut a band but every
// band needs its own transform, and nothing in CSS shifts one colour channel
// against another. So both shots are drawn onto a canvas and torn up there.
//
// LOW RESOLUTION ON PURPOSE, and it is not only a performance dodge. The
// channel-separation pass walks the pixel buffer, which at 1920x1080 is two
// million pixels a frame and far too slow; at 640x360 it is a tenth of that.
// It also looks BETTER: real digital breakup is chunky, and a crisp 1080p tear
// reads as a designed wipe rather than as something going wrong.
//
// DETERMINISTIC. The randomness is a seeded hash of the frame index, so the
// same instant always tears the same way. Math.random would mean the glitch you
// approve is not the glitch that renders.

import type { GlitchSpec } from "./transitions";

export const GW = 640;
export const GH = 360;

/** Cheap deterministic hash, 0..1. */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Composite one glitched frame.
 *
 * `u` is progress 0..1 through the transition. Intensity peaks in the middle
 * and the A/B mix crosses over with it, so the shots swap while the picture is
 * at its least legible, which is the same trick the whip uses.
 */
export function drawGlitch(
  ctx: CanvasRenderingContext2D,
  a: HTMLVideoElement,
  b: HTMLVideoElement,
  u: number,
  spec: GlitchSpec,
  frame: number,
) {
  const peak = 1 - Math.abs(u - 0.5) * 2;
  ctx.clearRect(0, 0, GW, GH);

  // Base layer: whichever shot currently dominates.
  const base = u < 0.5 ? a : b;
  const other = u < 0.5 ? b : a;
  try {
    ctx.drawImage(base, 0, 0, GW, GH);
  } catch {
    return; // a frame that is not decodable yet
  }

  // ── bands ────────────────────────────────────────────────────────────────
  // Each band is redrawn displaced, and some bands come from the OTHER shot,
  // which is what makes this a transition rather than an effect laid over a cut.
  const bh = Math.ceil(GH / spec.bands);
  for (let i = 0; i < spec.bands; i += 1) {
    const r = rnd(frame * 7.3 + i * 13.1);
    if (r > 0.15 + peak * 0.75) continue;
    const y = i * bh;
    const dx = (rnd(frame * 3.1 + i * 5.7) - 0.5) * 2 * spec.slip * GW * peak;
    const src = rnd(frame * 1.9 + i * 2.3) < u ? b : a;
    const from = rnd(frame * 11.7 + i) < 0.35 ? other : src;
    try {
      ctx.drawImage(from, 0, (y / GH) * from.videoHeight, from.videoWidth, (bh / GH) * from.videoHeight,
        dx, y, GW, bh);
    } catch {
      /* not decodable */
    }
  }

  // ── blocky quantise ──────────────────────────────────────────────────────
  if (spec.blocky && peak > 0.15) {
    const q = Math.max(2, Math.round(48 * peak));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ctx.canvas, 0, 0, GW, GH, 0, 0, Math.ceil(GW / q), Math.ceil(GH / q));
    ctx.drawImage(ctx.canvas, 0, 0, Math.ceil(GW / q), Math.ceil(GH / q), 0, 0, GW, GH);
    ctx.imageSmoothingEnabled = true;
  }

  // ── channel separation, dropout bars and speckle ─────────────────────────
  const shift = Math.round(spec.rgb * peak);
  const wantsPixels = shift > 0 || spec.noise > 0;
  if (!wantsPixels) return;

  const img = ctx.getImageData(0, 0, GW, GH);
  const d = img.data;
  if (shift > 0) {
    // Red pulled left, blue pushed right, green left alone. Done in place from
    // a copy of the row so the shift does not smear into itself.
    const row = new Uint8ClampedArray(GW * 4);
    for (let y = 0; y < GH; y += 1) {
      const o = y * GW * 4;
      row.set(d.subarray(o, o + GW * 4));
      for (let x = 0; x < GW; x += 1) {
        const xr = Math.min(GW - 1, x + shift);
        const xb = Math.max(0, x - shift);
        d[o + x * 4] = row[xr * 4];
        d[o + x * 4 + 2] = row[xb * 4 + 2];
      }
    }
  }
  if (spec.noise > 0) {
    const n = Math.round(GW * GH * spec.noise * peak * 0.06);
    for (let k = 0; k < n; k += 1) {
      const i = Math.floor(rnd(frame * 17.3 + k * 0.7) * GW * GH) * 4;
      const v = rnd(frame * 5.1 + k) > 0.5 ? 255 : 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Dropout bars go on AFTER the pixel pass, so they stay hard-edged.
  const bars = Math.round(spec.bars * peak);
  for (let k = 0; k < bars; k += 1) {
    const y = Math.floor(rnd(frame * 23.9 + k * 3.3) * GH);
    const h = 1 + Math.floor(rnd(frame * 29.1 + k) * 6 * peak);
    ctx.fillStyle = rnd(frame * 31.7 + k) > 0.6 ? "rgba(232,184,101,0.5)" : "rgba(0,0,0,0.85)";
    ctx.fillRect(0, y, GW, h);
  }
}
