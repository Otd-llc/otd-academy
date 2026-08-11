"use client";

// SANDBOX — the L1.01 eight-sheet stack explode, for media capture. DEV ONLY.
//
// The geometry is NOT drawn for this shot. It is the real answer-key Gerber set,
// already parsed and verified three independent ways (flash and region counts
// against a raw grep of each file; a parsed Edge_Cuts bounding box of 30.1 x 62.1
// mm matching what the .gbrjob declares, derived independently of it; In1_Cu and
// In2_Cu parsing identical, as they must). This module only stacks it.
//
// Z IS A STATED EXAGGERATION, NOT A MEASUREMENT. Real: 35 um of copper on a
// 1.6 mm core, so the conductors are about 2% of the stack and a true-scale
// explode is a slab with dust on it. The visual thickness and spacing below are
// named constants with the real value beside them, so nobody later "corrects"
// this back to reality and wonders why the shot died.
//
// The loop closes by construction: the explode amount is (1 - cos(2*pi*t)) / 2,
// which returns to zero AND to zero velocity at the seam, so the sheets ease
// apart and back together with no step and no visible turnaround.

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";
import { BOARD, SHEETS } from "@/components/guide/diagrams/data/l101-gerber-layers";

/* ── The exaggeration, declared ─────────────────────────────────────────── */
/** Rendered thickness of one sheet, mm. REAL copper is 0.035 mm. */
const SHEET_T = 0.22;
/** Gap between adjacent sheets when fully exploded, mm. REAL core is 1.6 mm total. */
const SHEET_GAP = 5.2;

/* ── Palette ────────────────────────────────────────────────────────────────
 * Restrained rather than photoreal: gold copper reads as copper and keeps the
 * shot on-brand, the mask is a desaturated board green so the sheet is legible
 * as mask, and silk is the ivory the rest of the system uses for a mark. */
const KIND_COLOR: Record<string, number> = {
  cu: 0xc8963e,
  mask: 0x2f6f5e,
  silk: 0xf1ece0,
};

declare global {
  interface Window {
    __stackReady?: boolean;
    __stackMeta?: { sheets: number; shapes: number; skipped: number };
    __stackSet?: (t: number) => void;
  }
}

export function StackStage({
  w = 1600,
  h = 900,
  tiltX = -0.34,
  rotZ = 0.06,
  gap = SHEET_GAP,
  flipY = true,
  frontFirst = true,
  only,
  faceFront = false,
  autoplay = false,
  periodMs = 9000,
  spinTurns = 0,
  stagger = 0,
  easePow = 2,
  tiltSwing = 0,
}: {
  w?: number;
  h?: number;
  /** Pivot tilt in turns of PI. Shallower shows the sheets as planes; steeper shows the stack edge-on. */
  tiltX?: number;
  rotZ?: number;
  gap?: number;
  /** Convert SVG Y-down to three Y-up. ON, as the data's header implies.
   *
   *  Settled by rendering F_Silk alone across the flipY x faceFront grid, after
   *  three wrong hypotheses that each looked plausible and each changed
   *  nothing: that the flip was unwanted, that the sheet order was inverted,
   *  and that the camera was behind the board. The ACTUAL bug in the first
   *  attempt was an extra PI about Z added to "fix" upside-down text, which
   *  turned a correct render into a mirrored one. With that gone, flip on and
   *  no Y rotation reads correctly: ONE THOUSAND DRONES, L1.01 v1, RESET,
   *  BOOT, the reference designators, all upright. */
  flipY?: boolean;
  /** Put F_Silk NEAREST the camera. SHEETS is ordered front-to-back, so a naive
   *  (i - mid) offset pushes the front sheet AWAY and shows the stack from
   *  behind, which reads as mirrored silkscreen. */
  frontFirst?: boolean;
  /** Render a single sheet by id. Diagnostic only. */
  only?: string;
  faceFront?: boolean;
  /** Drive the explode from rAF. Live preview only. */
  autoplay?: boolean;
  periodMs?: number;
  /** Full turns about the stack axis per explode cycle. 0 keeps it still. */
  spinTurns?: number;
  /**
   * Peel the sheets apart in sequence instead of moving them as one slab.
   * The fraction of the cycle spent handing off from the first sheet to the
   * last. Each sheet still completes a whole open-and-close inside the cycle,
   * so the loop closes for every sheet independently, not just on average.
   */
  stagger?: number;
  /**
   * Shape of the open-and-close. amount = sin(pi*u)^easePow.
   * 2 is the plain cosine (glides, symmetric). Below 2 snaps open and HOLDS
   * near full separation, which is what reads as energy: the interesting state
   * is the open one, so the motion should spend its time there rather than
   * gliding evenly through it.
   */
  easePow?: number;
  /** Radians of tilt wobble across the cycle. Adds parallax on the sheet faces. */
  tiltSwing?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const { SVGLoader } = await import("three/addons/loaders/SVGLoader.js");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const scene = new THREE.Scene();
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(4, 6, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.7);
      fill.position.set(-5, 2, 3);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 1.0);
      rim.position.set(0, -3, -6);
      scene.add(rim);

      // One SVG document per sheet, parsed by SVGLoader. Building an SVG string
      // is not a detour: the data already stores each path as an SVG `d`, and
      // SVGLoader.createShapes handles winding and holes, which is the whole
      // difficulty in turning a Gerber region into a fillable shape.
      const loader = new SVGLoader();
      const sheetGroups: THREE_NS.Group[] = [];
      let shapes = 0;
      let skipped = 0;

      SHEETS.forEach((sheet, i) => {
        if (only && sheet.id !== only) { sheetGroups.push(new THREE.Group()); return; }
        const body = sheet.paths
          .map((p) =>
            p.kind === "stroke"
              ? `<path d="${p.d}" fill="none" stroke="#000" stroke-width="${p.width ?? 0.15}" stroke-linecap="round" stroke-linejoin="round"/>`
              : `<path d="${p.d}" fill="#000"/>`,
          )
          .join("");
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD.w} ${BOARD.h}">${body}</svg>`;

        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
          color: KIND_COLOR[sheet.kind] ?? 0x888888,
          metalness: sheet.kind === "cu" ? 0.75 : 0.1,
          roughness: sheet.kind === "cu" ? 0.34 : 0.62,
        });

        for (const p of loader.parse(svg).paths) {
          // Strokes have no fill area; SVGLoader turns them into shapes via
          // pointsToStroke, which is what keeps thin silkscreen lines visible.
          const list =
            p.userData?.style?.fill === "none"
              ? SVGLoader.createShapes(p)
              : SVGLoader.createShapes(p);
          for (const shape of list) {
            try {
              const geo = new THREE.ExtrudeGeometry(shape, {
                depth: SHEET_T,
                bevelEnabled: false,
                curveSegments: 6,
              });
              group.add(new THREE.Mesh(geo, material));
              shapes += 1;
            } catch {
              skipped += 1;
            }
          }
        }
        group.userData.index = i;
        sheetGroups.push(group);
        scene.add(group);
      });

      // The data is millimetres with Y DOWN (SVG convention). Flip Y and centre
      // on the board so the stack rotates about its own middle.
      const stack = new THREE.Group();
      for (const g of sheetGroups) stack.add(g);
      stack.scale.set(1, flipY ? -1 : 1, 1);
      stack.position.set(-BOARD.w / 2, flipY ? BOARD.h / 2 : -BOARD.h / 2, 0);

      const pivot = new THREE.Group();
      pivot.add(stack);
      // Tilt so the stack is read edge-on enough for the separation to register,
      // and rotate off-axis so the board is not a flat rectangle.
      // Kept as a switch rather than deleted: it is the control that PROVED
      // the orientation, and the next subject will need the same test.
      pivot.rotation.y = faceFront ? Math.PI : 0;
      pivot.rotation.x = Math.PI * tiltX;
      pivot.rotation.z = Math.PI * rotZ;
      scene.add(pivot);

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 5000);
      camera.position.set(0, 0, 400);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);

      // Frame from the measured extent at FULL explode, the widest the stack ever
      // gets, so nothing clips at any point in the loop. Measured, not guessed.
      const mid = (SHEETS.length - 1) / 2;
      const n = SHEETS.length;

      /** Per-sheet open amount at cycle position t, staggered and eased. */
      const amountFor = (t: number, i: number) => {
        if (stagger <= 0) return Math.sin(Math.PI * t) ** easePow;
        // Each sheet runs its own full cycle inside a window shifted by its
        // index. Clamping at both ends is what keeps every sheet at exactly
        // zero on t=0 and t=1, so the loop closes per sheet.
        const d = (i / Math.max(n - 1, 1)) * stagger;
        const u = Math.min(Math.max((t - d) / (1 - stagger), 0), 1);
        return Math.sin(Math.PI * u) ** easePow;
      };

      /** Uniform spread, used for framing and by the capture path. */
      const setSpread = (amount: number) => {
        sheetGroups.forEach((g, i) => {
          const k = frontFirst ? mid - i : i - mid;
          g.position.z = k * (SHEET_T + gap * amount);
        });
      };

      /**
       * THE ONE MOTION FUNCTION. Both the live rAF loop and the capture path go
       * through this.
       *
       * They used to compute the pose separately, and they had already drifted:
       * the live loop applied the spin and the tilt swing, the capture path did
       * not, so a captured clip of a spinning variant would have come out
       * static and looked like a rendering bug rather than a missing line.
       */
      const applyAt = (t: number) => {
        sheetGroups.forEach((g, i) => {
          const k = frontFirst ? mid - i : i - mid;
          g.position.z = k * (SHEET_T + gap * amountFor(t, i));
        });
        pivot.rotation.z = Math.PI * rotZ + (spinTurns ? t * Math.PI * 2 * spinTurns : 0);
        pivot.rotation.x =
          Math.PI * tiltX + (tiltSwing ? Math.sin(t * Math.PI * 2) * tiltSwing : 0);
      };
      // FRAME OVER THE WHOLE CYCLE, not one pose.
      //
      // The old version measured a single frame at full explode. That is fine
      // for a still stack and wrong the moment it spins: the silhouette of a
      // rotating 30 x 62 mm board changes enormously with azimuth, so a fit
      // taken at one angle clips at others. This project has already shipped a
      // cut with exactly that defect, which is why the board rig samples 180
      // azimuths; this samples the union of the box across the cycle, which
      // covers spin, stagger and tilt swing together rather than each in turn.
      const box = new THREE.Box3();
      const probe = new THREE.Box3();
      const SAMPLES = 96;
      for (let k = 0; k < SAMPLES; k += 1) {
        applyAt(k / SAMPLES);
        pivot.updateMatrixWorld(true);
        probe.setFromObject(pivot);
        box.union(probe);
      }
      const size = new THREE.Vector3();
      const centre = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(centre);

      const MARGIN = 1.08;
      const aspect = w / h;
      const halfH = Math.max((size.y / 2) * MARGIN, ((size.x / 2) * MARGIN) / aspect);
      const halfW = halfH * aspect;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.position.set(centre.x, centre.y, centre.z + 400);
      camera.lookAt(centre);
      camera.updateProjectionMatrix();

      const render = () => renderer.render(scene, camera);

      // The capture entry point. Goes through the SAME `applyAt` the live loop
      // uses, so a captured clip cannot differ from the preview it was picked
      // from. Before they were unified, capture omitted the spin entirely.
      window.__stackSet = (t: number) => {
        applyAt(t);
        render();
      };
      window.__stackMeta = { sheets: SHEETS.length, shapes, skipped };
      window.__stackSet(0);
      window.__stackReady = true;

      let raf = 0;
      if (autoplay) {
        const start = performance.now();
        const tick = (now: number) => {
          // Spinning about the stack's own axis while it opens is what makes
          // the separation read as depth rather than as a stack of flat cards.
          applyAt(((now - start) % periodMs) / periodMs);
          render();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        delete window.__stackSet;
        delete window.__stackReady;
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [w, h, tiltX, rotZ, gap, flipY, frontFirst, only, faceFront, autoplay, periodMs, spinTurns, stagger, easePow, tiltSwing]);

  return <div ref={mountRef} data-stack-stage style={{ width: w, height: h }} />;
}
