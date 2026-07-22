"use client";

// three.js GLB viewer. Loaded ONLY via ModelViewerLazy (next/dynamic, ssr:false)
// so three is never in the server bundle or the initial client entry.
//
// Two modes:
//  - DEFAULT (board renders, parts-catalog asset): a FRAMED pane on a themed
//    scene bg + floor grid, full orbit controls (rotate/zoom/pan). Unchanged.
//  - FLOAT (lesson part previews): a FRAMELESS, transparent canvas so the part
//    floats on the page field; a slow turntable spin says "interactive" until
//    first grab (M3a) with a centered hint that fades; ROTATE-ONLY controls so
//    the wheel never captures page scroll and a mobile one-finger swipe still
//    scrolls the page (two-finger rotates). Kept narrow + short by the caller so
//    it can't hijack scroll flow.
import { useEffect, useRef, useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";
import { RotateIcon } from "@/components/icons";

export default function ModelViewer({
  src,
  bounds,
  heightClass = "h-64",
  float = false,
  showHint = true,
  onFirstInteract,
  label,
}: {
  src: string;
  bounds?: RenderBounds | null;
  /** Tailwind height class for the canvas box. */
  heightClass?: string;
  /** Frameless floating preview (lesson parts): transparent, spinning,
   *  rotate-only. Off by default (framed board/catalog viewer). */
  float?: boolean;
  /** Float mode: render the built-in centered "drag to explore" pill. Set false
   *  to place your own hint off-model (e.g. a corner chip on a small BOM row). */
  showHint?: boolean;
  /** Float mode: fires once, the first time the learner grabs the model — so a
   *  caller-owned hint can fade in sync with the built-in one. */
  onFirstInteract?: () => void;
  /** Accessible name for the canvas (e.g. the part's MPN). The three.js canvas
   *  is pointer-only, so without this the model is a nameless blank to AT. */
  label?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [hintGone, setHintGone] = useState(false);
  const interactRef = useRef(onFirstInteract);
  // Kept current in an effect, not during render. Writing a ref while rendering is a
  // side effect in the render phase, which React may run twice or discard.
  useEffect(() => {
    interactRef.current = onFirstInteract;
  });
  const boundsKey = JSON.stringify(bounds);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const mount = mountRef.current;
        if (!mount || disposed) return;

        const width = mount.clientWidth || 600;
        const height = mount.clientHeight || 256;
        const scene = new THREE.Scene();
        let loadedRoot:
          | { rotation: { y: number }; traverse: (cb: (o: unknown) => void) => void }
          | null = null;

        // Scene bg + floor grid — FRAMED mode only. Float mode stays transparent
        // (canvas alpha) so the model sits on the page field in either theme.
        let grid: InstanceType<typeof THREE.GridHelper> | null = null;
        const themedPalette = () =>
          document.documentElement.dataset.theme === "light"
            ? { bg: 0xe8e2d4, grid1: 0xcbc3b0, grid2: 0xd8d1c0 }
            : { bg: 0x0b0f1a, grid1: 0x334, grid2: 0x223 };
        const applyTheme = () => {
          const p = themedPalette();
          scene.background = new THREE.Color(p.bg);
          if (grid) {
            scene.remove(grid);
            grid.geometry.dispose();
            (grid.material as { dispose?: () => void }).dispose?.();
          }
          grid = new THREE.GridHelper(10, 10, p.grid1, p.grid2);
          scene.add(grid);
        };
        const onThemeChange = () => applyTheme();
        if (!float) {
          applyTheme();
          window.addEventListener("otd-theme-change", onThemeChange);
        }

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 10000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: float });
        if (float) renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        if (float) {
          renderer.domElement.style.cursor = "grab";
          // Let a vertical touch swipe SCROLL THE PAGE; the browser keeps pan-y,
          // so OrbitControls only sees horizontal drags (turntable rotate). No
          // mobile scroll trap.
          renderer.domElement.style.touchAction = "pan-y";
        }
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, float ? 1.15 : 1.1));
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(1, 1, 1);
        scene.add(dir);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        if (float) {
          // Rotate-only: no wheel-zoom (page scroll passes through) and no pan.
          // (Mobile scroll is protected by touch-action: pan-y on the canvas.)
          controls.enableZoom = false;
          controls.enablePan = false;
        }

        const radius = bounds?.radius ?? 5;
        const center = bounds?.center ?? [0, 0, 0];
        const centerVec = new THREE.Vector3(center[0], center[1], center[2]);
        camera.position.set(center[0] + radius * 2, center[1] + radius * 1.5, center[2] + radius * 2);
        controls.target.set(center[0], center[1], center[2]);
        controls.update();

        let interacted = false;
        controls.addEventListener("start", () => {
          if (float) renderer.domElement.style.cursor = "grabbing";
          if (!interacted) {
            interacted = true;
            if (float) {
              setHintGone(true);
              interactRef.current?.();
            }
          }
        });
        controls.addEventListener("end", () => {
          if (float) renderer.domElement.style.cursor = "grab";
        });

        new GLTFLoader().load(
          src,
          (gltf) => {
            if (disposed) return;
            // Spin about the model's true center, not its GLB local origin. A
            // part whose exported origin sits at a pin/corner (bounds.center ≠ 0)
            // otherwise swings on an eccentric axis under the float turntable.
            // Reparent under a pivot AT center, offsetting the model by -center
            // so it still renders in place (no visual jump, grid unaffected).
            const pivot = new THREE.Group();
            pivot.position.copy(centerVec);
            gltf.scene.position.sub(centerVec);
            pivot.add(gltf.scene);
            loadedRoot = pivot;
            scene.add(pivot);
          },
          undefined,
          () => { if (!disposed) setError(true); },
        );

        // The JS auto-spin was the ONE unguarded motion in the app (every CSS
        // animation respects reduced-motion via globals.css). A continuous
        // rotation is exactly what vestibular users set the preference for.
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        let raf = 0;
        const tick = () => {
          if (float && !interacted && !reducedMotion && loadedRoot) {
            loadedRoot.rotation.y += 0.006;
          }
          controls.update();
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        tick();

        const onResize = () => {
          const w = mount.clientWidth, h = mount.clientHeight || 256;
          camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          if (!float) window.removeEventListener("otd-theme-change", onThemeChange);
          if (grid) {
            grid.geometry.dispose();
            (grid.material as { dispose?: () => void }).dispose?.();
          }
          loadedRoot?.traverse((o: unknown) => {
            const mesh = o as Partial<{ geometry: { dispose?: () => void }; material: unknown }>;
            mesh.geometry?.dispose?.();
            const mat = mesh.material;
            const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
            for (const m of mats) {
              const mm = m as Partial<{ map: { dispose?: () => void }; dispose: () => void }>;
              mm.map?.dispose?.();
              mm.dispose?.();
            }
          });
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        setError(true);
      }
    })();
    return () => { disposed = true; cleanup(); };
    // boundsKey is JSON.stringify(bounds); it is the stable serialization the
    // effect keys on, so bounds.center/.radius are covered transitively. Depending
    // on the object itself would re-run every render (new reference each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, boundsKey, float]);

  if (error) {
    return (
      <p className="rounded border border-panel-border bg-deep-space px-4 py-3 font-mono text-xs text-muted">
        3D preview unavailable — download the model to open it in CAD.
      </p>
    );
  }

  // FLOAT: frameless, transparent; a centered "drag to explore" hint that fades
  // on first grab (the spin already signals it's live).
  if (float) {
    return (
      <div className={`relative ${heightClass} w-full`}>
        <div
          ref={mountRef}
          className="h-full w-full"
          role="img"
          aria-label={label ?? "Interactive 3D part model"}
        />
        {showHint ? (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              hintGone ? "opacity-0" : "opacity-100"
            }`}
          >
            <span className="flex items-center gap-1.5 border border-command-gold/40 bg-deep-space/50 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-command-gold backdrop-blur-sm">
              <RotateIcon className="h-3 w-3" />
              Drag to explore
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  // DEFAULT: framed pane + persistent rotate affordance chip.
  return (
    <div className={`relative ${heightClass} w-full`}>
      <div
        ref={mountRef}
        className="h-full w-full overflow-hidden rounded border border-panel-border bg-deep-space"
        role="img"
        aria-label={label ?? "Interactive 3D part model"}
      />
      <div className="pointer-events-none absolute left-2 top-2 flex select-none items-center gap-1.5 rounded-md border border-panel-border/60 bg-deep-space/70 px-2 py-1 backdrop-blur-sm">
        <RotateIcon className="h-3 w-3 text-command-gold" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          3D · drag to rotate
        </span>
      </div>
    </div>
  );
}
