"use client";

// three.js GLB viewer. Loaded ONLY via ModelViewerLazy (next/dynamic, ssr:false)
// so three is never in the server bundle or the initial client entry.
//
// Three modes:
//  - FRAMED (default; board renders on the rev hub, parts-catalog asset): a pane
//    on a themed scene bg + floor grid, full orbit (rotate/zoom/pan).
//  - FLOAT (lesson part previews): a FRAMELESS, transparent canvas so the part
//    floats on the page field; a slow turntable spin says "interactive" until
//    first grab, then ROTATE-ONLY controls (the wheel never captures page scroll;
//    a mobile one-finger swipe still scrolls the page).
//  - HERO (finished-board showcase, e.g. /learn): FRAMELESS + transparent like
//    float, a slow CONTINUOUS spin that never stops, and ZOOM-ONLY controls
//    (no grab-rotate, no pan) — "spins slowly, you can zoom, you can't manhandle it."
//
// Lighting (all modes): the N5 product-viewer rig — Khronos Neutral tone mapping
// (keeps color, rolls off highlights so nothing blows out) + a low-intensity
// RoomEnvironment IBL for reflection life + a key/fill/cool-rim directional set.
// Tuned in the board-model sandbox and picked by the owner.
import { useEffect, useRef, useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";
import { RotateIcon } from "@/components/icons";

// N5 lighting rig (sandbox winner). env = scene.environmentIntensity.
const RIG = { exposure: 1.02, env: 0.3, hemi: 0.42, key: 1.9, fill: 0.55, rim: 1.1 };

export default function ModelViewer({
  src,
  bounds,
  heightClass = "h-64",
  float = false,
  hero = false,
  showHint = true,
  onFirstInteract,
  label,
}: {
  src: string;
  bounds?: RenderBounds | null;
  /** Tailwind height class for the canvas box. */
  heightClass?: string;
  /** Frameless floating preview (lesson parts): transparent, spin-until-grab,
   *  rotate-only. Off by default (framed board/catalog viewer). */
  float?: boolean;
  /** Frameless showcase (finished-board hero): transparent, continuous slow spin,
   *  zoom-only (no rotate, no pan). Takes precedence over `float`. */
  hero?: boolean;
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
        const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
        const mount = mountRef.current;
        if (!mount || disposed) return;

        // Mode matrix. hero wins over float.
        const mode = hero ? "hero" : float ? "float" : "framed";
        const transparent = mode !== "framed";
        const canRotate = true; // every mode allows grab-rotate
        const canZoom = mode === "framed" || mode === "hero";
        const canPan = mode === "framed";
        const autoSpin = mode === "float" || mode === "hero";
        const spinStopsOnGrab = mode === "float" || mode === "hero"; // turntable stops on first grab

        const width = mount.clientWidth || 600;
        const height = mount.clientHeight || 256;
        const scene = new THREE.Scene();
        let loadedRoot:
          | { rotation: { y: number }; traverse: (cb: (o: unknown) => void) => void }
          | null = null;

        // Scene bg + floor grid — FRAMED only. float/hero stay transparent (canvas
        // alpha) so the model sits on the page field in either theme.
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
        if (!transparent) {
          applyTheme();
          window.addEventListener("otd-theme-change", onThemeChange);
        }

        const radius = bounds?.radius ?? 5;
        const center = bounds?.center ?? [0, 0, 0];
        const centerVec = new THREE.Vector3(center[0], center[1], center[2]);
        const aspect0 = width / height;
        // HERO matches the ortho poster: an OrthographicCamera at the P3 true-iso
        // pose (dir 1,1,1), framed to the same fit, so the poster → live click-swap
        // has no jump in orientation or zoom. Other modes keep a perspective camera.
        let camera: InstanceType<typeof THREE.OrthographicCamera> | InstanceType<typeof THREE.PerspectiveCamera>;
        if (mode === "hero") {
          const fit = radius * 1.02;
          const halfH = aspect0 >= 1 ? fit : fit / aspect0;
          const halfW = aspect0 >= 1 ? fit * aspect0 : fit;
          const oc = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, Math.max(radius / 100, 0.0001), radius * 40);
          oc.position.copy(centerVec).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(radius * 12));
          oc.up.set(0, 1, 0);
          camera = oc;
        } else {
          const pc = new THREE.PerspectiveCamera(45, aspect0, 0.01, 10000);
          pc.position.set(center[0] + radius * 2, center[1] + radius * 1.5, center[2] + radius * 2);
          camera = pc;
        }
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent });
        if (transparent) renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = RIG.exposure;
        if (transparent) {
          // float + hero: grab cursor; a vertical touch scrolls the page while a
          // horizontal drag rotates (turntable) and pinch zooms.
          renderer.domElement.style.cursor = "grab";
          renderer.domElement.style.touchAction = "pan-y";
        }
        mount.appendChild(renderer.domElement);

        // ── N5 lighting rig (all modes) ──
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        scene.environmentIntensity = RIG.env;
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, RIG.hemi));
        const keyLight = new THREE.DirectionalLight(0xffffff, RIG.key);
        keyLight.position.set(1, 1.5, 1);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, RIG.fill);
        fillLight.position.set(-1.5, 0.5, 1);
        scene.add(fillLight);
        const rimLight = new THREE.DirectionalLight(0xbcd0ff, RIG.rim);
        rimLight.position.set(-0.3, 0.6, -1.6);
        scene.add(rimLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enableRotate = canRotate;
        controls.enableZoom = canZoom;
        controls.enablePan = canPan;

        controls.target.set(center[0], center[1], center[2]);
        if (mode === "hero") {
          controls.minZoom = 0.6; // ortho zoom is a scale factor, not a distance
          controls.maxZoom = 4;
        } else if (canZoom) {
          controls.minDistance = radius * 1.1;
          controls.maxDistance = radius * 6;
        }
        controls.update();

        let interacted = false;
        controls.addEventListener("start", () => {
          if (transparent) renderer.domElement.style.cursor = "grabbing";
          if (!interacted) {
            interacted = true;
            if (mode === "float") {
              setHintGone(true);
              interactRef.current?.();
            }
          }
        });
        controls.addEventListener("end", () => {
          if (transparent) renderer.domElement.style.cursor = "grab";
        });

        new GLTFLoader().load(
          src,
          (gltf) => {
            if (disposed) return;
            // Spin about the model's true center, not its GLB local origin.
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

        // The JS auto-spin is the ONE unguarded motion in the app, so it respects
        // reduced-motion (every CSS animation already does via globals.css).
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        let raf = 0;
        const tick = () => {
          const spinning = autoSpin && (spinStopsOnGrab ? !interacted : true);
          if (spinning && !reducedMotion && loadedRoot) {
            loadedRoot.rotation.y += mode === "hero" ? 0.004 : 0.006;
          }
          controls.update();
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        tick();

        const onResize = () => {
          const w = mount.clientWidth, h = mount.clientHeight || 256;
          const a = w / h;
          if (camera instanceof THREE.OrthographicCamera) {
            const fit = radius * 1.02;
            camera.left = a >= 1 ? -fit * a : -fit;
            camera.right = a >= 1 ? fit * a : fit;
            camera.top = a >= 1 ? fit : fit / a;
            camera.bottom = a >= 1 ? -fit : -fit / a;
          } else {
            camera.aspect = a;
          }
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          if (!transparent) window.removeEventListener("otd-theme-change", onThemeChange);
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
          envTex.dispose();
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        setError(true);
      }
    })();
    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, boundsKey, float, hero]);

  if (error) {
    return (
      <p className="rounded border border-panel-border bg-deep-space px-4 py-3 font-mono text-xs text-muted">
        3D preview unavailable — download the model to open it in CAD.
      </p>
    );
  }

  // HERO: frameless, transparent, slow turntable until first grab; loads at the
  // poster's ortho P3 pose so the click-swap is seamless. Drag rotates, scroll zooms.
  if (hero) {
    return (
      <div className={`relative ${heightClass} w-full`}>
        <div
          ref={mountRef}
          className="h-full w-full"
          role="img"
          aria-label={label ?? "Finished board, 3D"}
        />
        <div className="pointer-events-none absolute left-2 top-2 flex select-none items-center gap-1.5 rounded-md border border-panel-border/60 bg-deep-space/70 px-2 py-1 backdrop-blur-sm">
          <RotateIcon className="h-3 w-3 text-command-gold" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            3D · drag to rotate · scroll to zoom
          </span>
        </div>
      </div>
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
