"use client";

// SANDBOX — the DESIGN -> BUILD handoff, four ways. DEV ONLY.
//
// ONE TURNTABLE, ONE RATE, FOR BOTH OBJECTS. That is the whole fix. Before,
// the stack spun at 51 deg/sec (one turn in 7 s) and the board at 30 deg/sec
// (12 s per revolution), so no amount of trimming could make them hand off:
// they were different motions. Here a single `spin` group carries both and
// turns at ONE rate, so continuity is structural rather than eyeballed. Swap
// the object and the camera never notices.
//
// The four modes differ only in WHAT HAPPENS TO THE OBJECT at the handoff, not
// in the rotation, which is exactly the space worth designing in once the spin
// is shared.
//
//   collapse   the eight sheets fold together and become the board. Physically
//              motivated: the collapsed stack IS the board.
//   edge       swap at the instant the stack is edge-on, where a flat thing is
//              nearly invisible. Sleight of hand, costs nothing.
//   dissolve   cross-fade on the beat. Simplest, and the least interesting.
//   push       the board arrives from behind along the spin axis as the stack
//              recedes.

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";
import { BOARD, SHEETS } from "@/components/guide/diagrams/data/l101-gerber-layers";

export type Mode = "collapse" | "edge" | "dissolve" | "push";

/** Degrees per second. One rate for the whole film. */
const RATE = 30;
/** The handoff instant, a bar downbeat at 120 BPM. */
const HANDOFF = 4.0;
const SECONDS = 8;

const SHEET_T = 0.22; // real copper is 0.035 mm
const SHEET_GAP = 5.2; // real core is 1.6 mm
const KIND_COLOR: Record<string, number> = { cu: 0xc8963e, mask: 0x2f6f5e, silk: 0xf1ece0 };

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

export function HandoffStage({
  mode,
  w = 900,
  h = 506,
  glb = "/_capture/l1-01.glb",
}: {
  mode: Mode;
  w?: number;
  h?: number;
  glb?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const { SVGLoader } = await import("three/addons/loaders/SVGLoader.js");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
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

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.3;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.5));
      const key = new THREE.DirectionalLight(0xffffff, 2.0);
      key.position.set(3, 5, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 1.0);
      rim.position.set(-2, -3, -5);
      scene.add(rim);

      // ── the shared turntable ────────────────────────────────────────────
      const spin = new THREE.Group();
      scene.add(spin);

      // ── the stack ───────────────────────────────────────────────────────
      const stackRoot = new THREE.Group();
      const loader = new SVGLoader();
      const sheets: THREE_NS.Group[] = [];
      for (const sheet of SHEETS) {
        const body = sheet.paths
          .map((p) =>
            p.kind === "stroke"
              ? `<path d="${p.d}" fill="none" stroke="#000" stroke-width="${p.width ?? 0.15}" stroke-linecap="round" stroke-linejoin="round"/>`
              : `<path d="${p.d}" fill="#000"/>`,
          )
          .join("");
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD.w} ${BOARD.h}">${body}</svg>`;
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: KIND_COLOR[sheet.kind] ?? 0x888888,
          metalness: sheet.kind === "cu" ? 0.75 : 0.1,
          roughness: sheet.kind === "cu" ? 0.34 : 0.62,
          transparent: true,
        });
        for (const p of loader.parse(svg).paths) {
          for (const shape of SVGLoader.createShapes(p)) {
            try {
              g.add(
                new THREE.Mesh(
                  new THREE.ExtrudeGeometry(shape, { depth: SHEET_T, bevelEnabled: false, curveSegments: 6 }),
                  mat,
                ),
              );
            } catch {
              /* a degenerate contour */
            }
          }
        }
        sheets.push(g);
        stackRoot.add(g);
      }
      // Y-flip to reach Y-up, centred on the board. Settled empirically; the
      // silkscreen reads correctly this way and mirrored the other.
      stackRoot.scale.set(1, -1, 1);
      stackRoot.position.set(-BOARD.w / 2, BOARD.h / 2, 0);
      const stackPivot = new THREE.Group();
      stackPivot.add(stackRoot);
      stackPivot.rotation.x = -Math.PI * 0.34;
      spin.add(stackPivot);

      // ── the board ───────────────────────────────────────────────────────
      const gltf = await new GLTFLoader().loadAsync(glb);
      if (disposed) return;
      const model = gltf.scene;
      const bbox = new THREE.Box3().setFromObject(model);
      const bcentre = new THREE.Vector3();
      const bsize = new THREE.Vector3();
      bbox.getCenter(bcentre);
      bbox.getSize(bsize);
      model.position.sub(bcentre);
      // GLB units are METRES; the gerber data is millimetres. Match them or the
      // board arrives 1000x too small next to its own sheets.
      const boardPivot = new THREE.Group();
      boardPivot.add(model);
      boardPivot.scale.setScalar(1000);
      boardPivot.rotation.x = -Math.PI * 0.34;
      boardPivot.visible = false;
      spin.add(boardPivot);

      model.traverse((o: THREE_NS.Object3D) => {
        const m = o as THREE_NS.Mesh;
        if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          (mat as THREE_NS.MeshStandardMaterial).transparent = true;
        }
      });

      const setBoardOpacity = (v: number) => {
        model.traverse((o: THREE_NS.Object3D) => {
          const m = o as THREE_NS.Mesh;
          if (!m.isMesh) return;
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            (mat as THREE_NS.MeshStandardMaterial).opacity = v;
          }
        });
      };
      const setStackOpacity = (v: number) => {
        for (const g of sheets) {
          g.traverse((o: THREE_NS.Object3D) => {
            const m = o as THREE_NS.Mesh;
            if (!m.isMesh) return;
            (m.material as THREE_NS.MeshStandardMaterial).opacity = v;
          });
        }
      };

      // Frame on the widest state so nothing clips at any point.
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 5000);
      camera.position.set(0, 0, 400);
      camera.lookAt(0, 0, 0);
      const mid = (SHEETS.length - 1) / 2;
      sheets.forEach((g, i) => {
        g.position.z = (mid - i) * (SHEET_T + SHEET_GAP);
      });
      spin.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const probe = new THREE.Box3();
      for (let k = 0; k < 64; k += 1) {
        spin.rotation.y = (k / 64) * Math.PI * 2;
        spin.updateMatrixWorld(true);
        probe.setFromObject(stackPivot);
        box.union(probe);
      }
      const size = new THREE.Vector3();
      const centre = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(centre);
      const aspect = w / h;
      const halfH = Math.max((size.y / 2) * 1.1, ((size.x / 2) * 1.1) / aspect);
      const halfW = halfH * aspect;
      camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
      camera.position.set(centre.x, centre.y, centre.z + 400);
      camera.lookAt(centre);
      camera.updateProjectionMatrix();

      const applyAt = (t: number) => {
        // ONE rotation for both objects. Continuity is not matched, it is the
        // same number.
        spin.rotation.y = THREE.MathUtils.degToRad(RATE * t);

        const before = t < HANDOFF;
        // The explode runs out and back before the handoff so the stack is
        // CLOSED when it becomes the board. Handing off mid-explode would mean
        // the board inheriting a shape the sheets never resolved.
        const openness = before ? Math.sin(Math.PI * clamp01(t / HANDOFF)) ** 2 : 0;

        let stackA = 1;
        let boardA = 0;
        let stackScale = 1;
        let boardScale = 1;
        let stackZ = 0;
        let boardZ = 0;

        if (mode === "collapse") {
          // The sheets are already closed at HANDOFF; the board simply takes
          // over inside one frame, which reads as the stack having become it.
          const u = smooth(HANDOFF - 0.12, HANDOFF + 0.12, t);
          stackA = 1 - u;
          boardA = u;
        } else if (mode === "edge") {
          // Swap where the stack is edge-on. The turntable is at RATE*t degrees,
          // so the nearest edge-on instant to HANDOFF is where that is 90 mod 180.
          const deg = RATE * HANDOFF;
          const edgeAt = HANDOFF + ((90 - (deg % 180)) + 180) % 180 / RATE;
          const u = smooth(edgeAt - 0.06, edgeAt + 0.06, t);
          stackA = 1 - u;
          boardA = u;
        } else if (mode === "dissolve") {
          const u = smooth(HANDOFF - 0.45, HANDOFF + 0.45, t);
          stackA = 1 - u;
          boardA = u;
        } else {
          // push: the board comes forward along the spin axis as the stack goes.
          const u = smooth(HANDOFF - 0.35, HANDOFF + 0.35, t);
          stackA = 1 - u;
          boardA = u;
          stackZ = -u * 26;
          boardZ = (1 - u) * 26;
          stackScale = 1 - u * 0.12;
          boardScale = 0.88 + u * 0.12;
        }

        sheets.forEach((g, i) => {
          g.position.z = (mid - i) * (SHEET_T + SHEET_GAP * openness);
        });
        stackPivot.visible = stackA > 0.002;
        boardPivot.visible = boardA > 0.002;
        setStackOpacity(stackA);
        setBoardOpacity(boardA);
        stackPivot.position.z = stackZ;
        boardPivot.position.z = boardZ;
        stackPivot.scale.setScalar(stackScale);
        boardPivot.scale.setScalar(1000 * boardScale);

        renderer.render(scene, camera);
      };

      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        applyAt((((now - start) / 1000) % SECONDS));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [mode, w, h, glb]);

  return <div ref={mountRef} data-handoff={mode} style={{ width: w, height: h }} />;
}
