"use client";

// three.js GLB viewer. Loaded ONLY via ModelViewerLazy (next/dynamic, ssr:false)
// so three is never in the server bundle or the initial client entry. Orbit
// controls; camera framed from `bounds`. On load error, it is self-contained:
// local `error` state renders an inline download fallback (no onError prop).
import { useEffect, useRef, useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";

export default function ModelViewer({ src, bounds }: { src: string; bounds?: RenderBounds | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
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
        const height = mount.clientHeight || 420;
        const scene = new THREE.Scene();
        let loadedRoot: { traverse: (cb: (o: unknown) => void) => void } | null = null;
        scene.background = new THREE.Color(0x0b0f1a);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 10000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.1));
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(1, 1, 1);
        scene.add(dir);
        scene.add(new THREE.GridHelper(10, 10, 0x334, 0x223));

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        const radius = bounds?.radius ?? 5;
        const center = bounds?.center ?? [0, 0, 0];
        camera.position.set(center[0] + radius * 2, center[1] + radius * 1.5, center[2] + radius * 2);
        controls.target.set(center[0], center[1], center[2]);
        controls.update();

        new GLTFLoader().load(
          src,
          (gltf) => { if (!disposed) { loadedRoot = gltf.scene; scene.add(gltf.scene); } },
          undefined,
          () => { if (!disposed) setError(true); },
        );

        let raf = 0;
        const tick = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(tick); };
        tick();

        const onResize = () => {
          const w = mount.clientWidth, h = mount.clientHeight || 420;
          camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          loadedRoot?.traverse((o) => {
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
  }, [src, boundsKey]);

  if (error) {
    return (
      <p className="rounded border border-panel-border bg-navy-dark/30 px-4 py-3 font-mono text-xs text-muted">
        3D preview unavailable — download the model to open it in CAD.
      </p>
    );
  }
  return <div ref={mountRef} className="h-[420px] w-full overflow-hidden rounded border border-panel-border bg-deep-space" />;
}
