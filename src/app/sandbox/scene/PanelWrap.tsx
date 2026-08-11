"use client";

// SANDBOX — the same captured footage, wrapped on a rotating panel. DEV ONLY.
//
// The comparison exists because "put it on a rotating 3D panel" and "use the
// real site style" pull in opposite directions, and the only honest way to
// settle that is the SAME footage both ways, so the treatment is the only
// variable.
//
// The video is a VideoTexture, so the panel shows the capture playing rather
// than a still of it. The panel eases into a shallow angle and back rather than
// spinning: a page has to be readable, and anything past about fifteen degrees
// starts costing legibility for no gain.

import { useEffect, useRef } from "react";

export function PanelWrap({ src, w, h }: { src: string; w: number; h: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      await video.play().catch(() => {});

      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;

      const scene = new THREE.Scene();
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const PANEL_W = 16;
      const PANEL_H = PANEL_W * (720 / 1280);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(PANEL_W, PANEL_H),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
      );
      scene.add(panel);

      // A gold hairline under the panel: the house way of grounding something on
      // the field, instead of a frame or a floor plane.
      const rule = new THREE.Mesh(
        new THREE.PlaneGeometry(PANEL_W * 0.72, 0.045),
        new THREE.MeshBasicMaterial({ color: 0xc8963e, transparent: true, opacity: 0.55 }),
      );
      rule.position.set(0, -PANEL_H / 2 - 0.7, 0);
      scene.add(rule);

      const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 200);
      camera.position.set(0, 0, 15.6);
      camera.lookAt(0, 0, 0);

      let raf = 0;
      const start = performance.now();
      const PERIOD = 11000;
      const tick = (now: number) => {
        const t = ((now - start) % PERIOD) / PERIOD;
        // Shallow sway, not a spin. Readability is the constraint.
        panel.rotation.y = Math.sin(t * Math.PI * 2) * 0.22;
        panel.rotation.x = Math.sin(t * Math.PI * 2 + 1.2) * 0.05;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        video.pause();
        tex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src, w, h]);

  return <div ref={mountRef} style={{ width: w, height: h }} />;
}
