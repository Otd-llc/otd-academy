"use client";

// SANDBOX — exam -> fanfare -> certificate, on rotating 3D panels. DEV ONLY.
//
// Both panels are REAL PAGES, captured signed in as the synthetic bench persona
// (the exam with all eighteen questions answered) and the public certificate
// route from a genuinely signed token. Nothing here is a mock-up of a screen.
//
// IT IS A CAROUSEL, NOT A SEQUENCE, and that is what makes it loop. Two panels
// sit back to back on one axis; the group turns a full 2*pi across the cycle, so
// the exam faces front for the first half, the certificate for the second, and
// t=1 is literally the same pose as t=0. A cut-to-cut sequence would need a
// contrived way back to the beginning; a turn just arrives there.
//
// The exam SCROLLS while it is facing us: the texture is the full 4496 px page
// and the panel shows a 720 px window whose offset walks down it. That is the
// same trick the page-capture rig uses, moved onto the GPU, and it means the
// scroll is frame-exact rather than a recording of someone dragging.
//
// The fanfare fires at the handover. Restrained on purpose: a gold ring that
// expands and fades plus a short bloom on the key light, not confetti. The house
// aesthetic does not do confetti.

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/** Page captures, 1280 wide. Both are gitignored capture inputs. */
const EXAM_SRC = "/_capture/exam-full.png";
const CERT_SRC = "/_capture/cert-full.png";

/** The window each panel shows, in source pixels. */
const VIEW_W = 1280;
const VIEW_H = 720;
/** Where the certificate card sits in its page capture. */
const CERT_TOP = 100;

declare global {
  interface Window {
    __revealReady?: boolean;
    __revealMeta?: { examH: number; certH: number };
    __revealSet?: (t: number) => void;
  }
}

export function RevealStage({
  w = 1600,
  h = 900,
  autoplay = false,
  periodMs = 14000,
}: {
  w?: number;
  h?: number;
  autoplay?: boolean;
  periodMs?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const scene = new THREE.Scene();
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(2, 3, 6);
      scene.add(key);

      const loader = new THREE.TextureLoader();
      const load = (src: string) =>
        new Promise<THREE_NS.Texture>((res, rej) => loader.load(src, res, undefined, rej));
      const [examTex, certTex] = await Promise.all([load(EXAM_SRC), load(CERT_SRC)]);
      if (disposed) return;

      for (const tex of [examTex, certTex]) {
        tex.colorSpace = THREE.SRGBColorSpace;
        // A page capture is not a tiling texture: clamping stops the window
        // wrapping around to the top of the page at the ends of the scroll.
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }

      const imgH = (tex: THREE_NS.Texture) =>
        (tex.image as { height: number }).height;
      const examH = imgH(examTex);
      const certH = imgH(certTex);

      // Both panels show the same 16:9 window, so the pair reads as a matched
      // set rather than two unrelated shapes swapping places.
      const examRepeatY = VIEW_H / examH;
      const certRepeatY = VIEW_H / certH;
      examTex.repeat.set(1, examRepeatY);
      certTex.repeat.set(1, certRepeatY);
      // three's texture origin is bottom-left; a page's is top-left. Offset 1-r
      // is therefore the TOP of the page.
      certTex.offset.set(0, 1 - certRepeatY - CERT_TOP / certH);

      const PANEL_W = 16;
      const PANEL_H = PANEL_W * (VIEW_H / VIEW_W);
      const geo = new THREE.PlaneGeometry(PANEL_W, PANEL_H);

      const examMat = new THREE.MeshBasicMaterial({ map: examTex, toneMapped: false });
      const certMat = new THREE.MeshBasicMaterial({ map: certTex, toneMapped: false });

      const carousel = new THREE.Group();
      const examPanel = new THREE.Mesh(geo, examMat);
      examPanel.position.z = 3.2;
      const certPanel = new THREE.Mesh(geo, certMat);
      certPanel.position.z = -3.2;
      certPanel.rotation.y = Math.PI; // face outward on the far side
      carousel.add(examPanel, certPanel);
      scene.add(carousel);

      // The fanfare ring. Additive, gold, expands and fades at the handover.
      const ringGeo = new THREE.RingGeometry(0.6, 0.78, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xe8b865,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      scene.add(ring);

      // Close enough that a panel fills the frame. At 34 units back the panels
      // read as postage stamps, which is the whole point of showing a page.
      const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 200);
      camera.position.set(0, 0, 19.2);
      camera.lookAt(0, 0, 0);

      const render = () => renderer.render(scene, camera);

      const smoothstep = (a: number, b: number, x: number) => {
        const u = Math.min(Math.max((x - a) / (b - a), 0), 1);
        return u * u * (3 - 2 * u);
      };

      /**
       * HOLD, TURN, HOLD, TURN. Not a constant-rate spin.
       *
       * A carousel turning evenly gives each panel almost no readable time: it
       * is edge-on a quarter of the way round, so the exam was legible for
       * about a sixth of the cycle and the certificate barely arrived before it
       * left. These are PAGES; they have to be still long enough to read.
       *
       * Two smooth half-turns instead, with long holds either side. Total
       * rotation is still exactly 2*pi, so t=1 remains the same pose as t=0 and
       * the loop closes by construction.
       */
      const TURN_1 = [0.40, 0.55] as const; // exam -> certificate, the fanfare beat
      // Ends BEFORE t=1, deliberately. Running the turn to exactly 1.0 closes
      // the POSITION but not the VELOCITY: the panel was still swinging at
      // 4 degrees a frame when the loop restarted into a static hold, which
      // reads as a judder even though every pose matches. The trailing hold
      // mirrors the static run-in at the start, so the seam is still on both
      // sides. Measured: seam step 7.68 against a following step of 0.00.
      const TURN_2 = [0.84, 0.955] as const; // certificate -> exam, the loop back
      const rotationAt = (t: number) =>
        Math.PI * (smoothstep(TURN_1[0], TURN_1[1], t) + smoothstep(TURN_2[0], TURN_2[1], t));

      /** 0 outside the burst, 1 at its peak. Fires ON the first turn. */
      const BURST_AT = (TURN_1[0] + TURN_1[1]) / 2;
      const BURST_W = 0.1;
      const burst = (t: number) => {
        const d = Math.abs(t - BURST_AT);
        return d > BURST_W ? 0 : (1 - d / BURST_W) ** 1.6;
      };

      const applyAt = (t: number) => {
        carousel.rotation.y = rotationAt(t);

        // Walk the exam window down the page during its HOLD, finishing just
        // before the turn starts rather than still travelling as it leaves.
        //
        // SCROLL_END stops at the submit button rather than the true bottom of
        // the document: running to 1 carried on into the site footer, so the
        // last thing the exam panel showed was a nav column instead of the
        // moment the exam is finished.
        const SCROLL_END = 0.82;
        // AND REWIND during the second turn, while the exam panel is edge-on.
        // Without this the texture is still 82% scrolled at t=1 while the panel
        // is facing front again, so the loop point jumps the page back to the
        // top in full view. The rotation closing by construction is not enough
        // on its own: every animated property has to close, not just the pose.
        const rewind = 1 - smoothstep(TURN_2[0], TURN_2[1], t);
        const s = smoothstep(0.04, TURN_1[0] - 0.02, t) * SCROLL_END * rewind;
        const top = 1 - examRepeatY;
        examTex.offset.set(0, top - s * (1 - examRepeatY));

        const bf = burst(t);
        ringMat.opacity = bf * 0.85;
        // Sized against the PANEL, not the scene: it should read as a ring
        // around the certificate arriving, not a hoop around the whole shot.
        const scale = PANEL_H * (0.55 + (1 - bf) * 0.75);
        ring.scale.set(scale, scale, 1);
        ring.position.set(0, 0, 4.2);
        key.intensity = 1.5 + bf * 1.8;

        render();
      };

      window.__revealSet = (t: number) => applyAt(t);
      window.__revealMeta = { examH, certH };
      applyAt(0);
      window.__revealReady = true;

      let raf = 0;
      if (autoplay) {
        const start = performance.now();
        const tick = (now: number) => {
          applyAt(((now - start) % periodMs) / periodMs);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        delete window.__revealSet;
        delete window.__revealReady;
        examTex.dispose();
        certTex.dispose();
        geo.dispose();
        ringGeo.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [w, h, autoplay, periodMs]);

  return <div ref={mountRef} data-reveal-stage style={{ width: w, height: h }} />;
}
