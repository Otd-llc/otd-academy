"use client";

// SANDBOX — deterministic board turntable stage for media capture. DEV ONLY.
//
// Why not just point the camera at <ModelViewer hero>: that component spins by a
// FIXED INCREMENT per rAF tick (`rotation.y += 0.004`), which is great for a
// live page and wrong for a loop. A full revolution would take 1571 ticks (52 s
// at 30 fps), and stopping anywhere short of exactly 2pi leaves a visible step
// at the loop seam. Capture needs to SET the angle, not accumulate it, so that
// frame N-1 -> frame 0 closes exactly.
//
// Everything else is copied from ModelViewer's proven setup rather than
// re-derived: the N5 lighting rig the owner picked in the board-model sandbox,
// and the hero mode's orthographic true-iso pose.
//
// Three traps this scene handles explicitly, all previously paid for:
//   - FORCE OPAQUE. KiCad's solder-mask export declares alphaMode BLEND at
//     alpha 0.30, so the board renders see-through. ModelViewer does not force
//     it (the -web.glb export may already), so we force it here and verify by
//     eye rather than assume.
//   - GLB UNITS ARE METRES. Nothing here assumes millimetres; the camera is
//     framed off measured bounds, not a constant.
//   - BOUNDS FROM THE WORLD-SPACE AABB, not a local one, or the fit is wrong at
//     every orientation but the rest pose.
//
// The canvas is TRANSPARENT. One geometry pass then composites onto either
// theme, so dark and light cannot drift apart in motion.

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

// N5 lighting rig — the board-model sandbox winner. env = scene.environmentIntensity.
const RIG = { exposure: 1.02, env: 0.3, hemi: 0.42, key: 1.9, fill: 0.55, rim: 1.1 };

declare global {
  interface Window {
    __boardReady?: boolean;
    __boardMeta?: {
      radius: number;
      center: number[];
      meshes: number;
      forcedOpaque: number;
      needX: number;
      needY: number;
      frustumHalfW: number;
      frustumHalfH: number;
      sweepAspect: number;
    };
    __boardTurn?: (frac: number) => void;
  }
}

export function BoardStage({
  src,
  w = 1600,
  h = 900,
  autoplay = false,
  periodMs = 12000,
}: {
  src: string;
  w?: number;
  h?: number;
  /** Drive the turn from rAF instead of waiting for __boardTurn. Live preview
   *  only; capture keeps stepping the angle so frames stay reproducible. */
  autoplay?: boolean;
  periodMs?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const scene = new THREE.Scene();
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1); // capture is 1:1; a DPR guess would blur the encode
      renderer.setClearColor(0x000000, 0); // transparent: composite per theme later
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = RIG.exposure;
      mount.appendChild(renderer.domElement);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = RIG.env;

      const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, RIG.hemi);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, RIG.key);
      key.position.set(3, 5, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, RIG.fill);
      fill.position.set(-4, 2, -1);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, RIG.rim);
      rim.position.set(0, 2, -5);
      scene.add(rim);

      const gltf = await new GLTFLoader().loadAsync(src);
      if (disposed) return;
      const model = gltf.scene;

      // FORCE OPAQUE. Counted, not assumed: the count lands in __boardMeta so the
      // capture script can assert the pass actually did something (or honestly
      // report that the -web export needed nothing).
      let forcedOpaque = 0;
      let meshes = 0;
      model.traverse((o: THREE_NS.Object3D) => {
        const mesh = o as THREE_NS.Mesh;
        if (!mesh.isMesh) return;
        meshes += 1;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const mat = m as THREE_NS.MeshStandardMaterial;
          if (mat.transparent || mat.opacity < 1) {
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.needsUpdate = true;
            forcedOpaque += 1;
          }
        }
      });

      // Bounds from the WORLD-space AABB, measured after the model is in the
      // graph. radius is the half-diagonal, so the fit holds at every azimuth.
      const spin = new THREE.Group();
      spin.add(model);
      scene.add(spin);

      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      const sizeVec = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(sizeVec);
      const radius = sizeVec.length() / 2;

      // Re-centre the model inside the spin group so rotation is about the board's
      // own centre rather than the GLB origin, which is a corner on a KiCad export.
      model.position.sub(center);
      spin.position.copy(center);

      // Orthographic true-iso, matching ModelViewer's hero pose so a still from
      // here and the live viewer agree on orientation.
      const cam = new THREE.OrthographicCamera(
        -radius, radius, radius, -radius,
        Math.max(radius / 100, 0.0001),
        radius * 40,
      );
      cam.position.copy(center).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(radius * 12));
      cam.up.set(0, 1, 0);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);

      // FRAME TO THE MEASURED EXTENT OVER THE WHOLE REVOLUTION.
      //
      // radius is the half-DIAGONAL of the bounding box, which is the radius of
      // the enclosing sphere. Framing to it is safe at every angle and wastes a
      // great deal of the frame, because a PCB is a thin slab: the sphere that
      // contains it is mostly air. Measured on L1.01, that fit left the board
      // occupying well under half the width.
      //
      // So: project the eight box corners into camera space at K azimuths across
      // a full turn and take the largest half-extent seen. Tight, and still
      // correct at every angle, because it was measured at every angle rather
      // than at the rest pose. Framing that clears at ONE azimuth and clips at
      // others has shipped on this project before; that is why this samples the
      // whole turn.
      const corners: InstanceType<typeof THREE.Vector3>[] = [];
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z])
            corners.push(new THREE.Vector3(x, y, z).sub(center));

      const AZIMUTHS = 180;
      let halfX = 0;
      let halfY = 0;
      const v = new THREE.Vector3();
      const q = new THREE.Quaternion();
      for (let a = 0; a < AZIMUTHS; a += 1) {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (a / AZIMUTHS) * Math.PI * 2);
        for (const c of corners) {
          v.copy(c).applyQuaternion(q).add(center).project(cam);
          halfX = Math.max(halfX, Math.abs(v.x));
          halfY = Math.max(halfY, Math.abs(v.y));
        }
      }
      // v.project returns NDC in [-1,1] against the current frustum of half-width
      // `radius`, so the needed half-extent in world units is that fraction of it.
      //
      // X and Y are kept SEPARATE, and that is where the framing is actually won.
      // Taking max(halfX, halfY) forces a square fit, and a square fit around an
      // isometric view of a rotating rectangle is mostly empty corners: measured,
      // it recovered nothing at all (0.97 of the enclosing sphere, so the margin
      // alone made it net looser). The board is 30 x 62 mm, so its sweep is much
      // wider than it is tall; a wide frame with independent extents is what
      // makes it fill the shot.
      const MARGIN = 1.06; // a little air so the silhouette never kisses the edge
      const needX = halfX * radius * MARGIN;
      const needY = halfY * radius * MARGIN;
      // Grow whichever axis the canvas aspect under-serves, never shrink one, or
      // the render distorts.
      const aspect = w / h;
      const frustumHalfH = Math.max(needY, needX / aspect);
      const frustumHalfW = frustumHalfH * aspect;
      cam.left = -frustumHalfW;
      cam.right = frustumHalfW;
      cam.top = frustumHalfH;
      cam.bottom = -frustumHalfH;
      cam.updateProjectionMatrix();

      const render = () => renderer.render(scene, cam);

      // SET the angle; never accumulate. frac in [0,1) -> a closed revolution.
      window.__boardTurn = (frac: number) => {
        spin.rotation.y = frac * Math.PI * 2;
        render();
      };
      window.__boardMeta = {
        radius,
        center: [center.x, center.y, center.z],
        meshes,
        forcedOpaque,
        needX,
        needY,
        frustumHalfW,
        frustumHalfH,
        // How much wider the sweep is than it is tall. A value well above 1 is why
        // a square frame wasted so much: it had to fit the WIDTH into the height.
        sweepAspect: needX / needY,
      };
      render();
      window.__boardReady = true;

      // LIVE MODE. The capture path sets the angle per frame so the render is
      // reproducible; this one reads the wall clock, because a preview only has
      // to look right. Same easing-free constant rate, so what you see here is
      // the same motion the encode produces.
      let raf = 0;
      if (autoplay) {
        const start = performance.now();
        const tick = (now: number) => {
          spin.rotation.y = (((now - start) % periodMs) / periodMs) * Math.PI * 2;
          render();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        delete window.__boardTurn;
        delete window.__boardReady;
        renderer.dispose();
        pmrem.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src, w, h, autoplay, periodMs]);

  return <div ref={mountRef} data-board-stage style={{ width: w, height: h }} />;
}
