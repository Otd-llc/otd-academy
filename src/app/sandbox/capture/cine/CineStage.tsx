"use client";

// SANDBOX — the cinematic cut. DEV ONLY.
//
// Three beats, one camera:
//   1. PUSHED IN on the last question, following the cursor to the answer.
//   2. The academy's OWN fanfare, pulled back to fit.
//   3. The certificate spins in as a 3D object and settles.
//
// WHY IT IS PUSHED IN, and it is not only for drama: the exam page is the least
// on-brand surface in the academy. The guide's quiz renders options as
// honeycomb hexes; the exam renders a native radio with `text-gray-1` labels, a
// legacy token the design system reserves for un-migrated internal screens. A
// wide shot of that page advertises the one screen that does not look like the
// product. Tight on the cursor and the option, it is just an answer being
// chosen. The real fix is to give the exam the honeycomb language, and then
// this shot could open wide.
//
// Beats 1 and 3 are 3D. Beat 2 is the real captured celebration, because the
// fanfare already exists (`CertificateReveal`, the `signin-rise` stagger) and
// rebuilding it in three.js is how you end up not looking like your own product.

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

const EXAM = "/_capture/cine/exam.png";
const EXAM_PICKED = "/_capture/cine/exam-picked.png";
const FANFARE = "/_capture/cine/fanfare.mp4";
const CERT = "/_capture/cine/cert-card.png";

/** CSS pixels of the source plates (captured at 2x, so texels are 2x this). */
const PAGE_W = 1280;
const PAGE_H = 720;
/** Where the answer sits on the exam plate, in CSS pixels. */
const OPTION = { x: 640, y: 278 };
/** World units per CSS pixel. */
const U = 16 / PAGE_W;

declare global {
  interface Window {
    __cineReady?: boolean;
    __cineSet?: (t: number) => Promise<void>;
    __cineMeta?: { fanfareDuration: number };
  }
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

export function CineStage({
  w = 1600,
  h = 900,
  autoplay = false,
  periodMs = 11000,
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
      scene.add(new THREE.AmbientLight(0xffffff, 1));

      const loader = new THREE.TextureLoader();
      const load = (src: string) =>
        new Promise<THREE_NS.Texture>((res, rej) => loader.load(src, res, undefined, rej));
      const [examTex, pickedTex, certTex] = await Promise.all([
        load(EXAM), load(EXAM_PICKED), load(CERT),
      ]);
      if (disposed) return;
      for (const t of [examTex, pickedTex, certTex]) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }

      // The fanfare is a real capture, seeked frame by frame so the shot is
      // reproducible rather than dependent on playback timing.
      const video = document.createElement("video");
      video.src = FANFARE;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      await new Promise<void>((res) => {
        if (video.readyState >= 2) res();
        else video.addEventListener("loadeddata", () => res(), { once: true });
      });
      const fanfareTex = new THREE.VideoTexture(video);
      fanfareTex.colorSpace = THREE.SRGBColorSpace;
      fanfareTex.minFilter = THREE.LinearFilter;

      const pageGeo = new THREE.PlaneGeometry(PAGE_W * U, PAGE_H * U);

      const examMat = new THREE.MeshBasicMaterial({ map: examTex, toneMapped: false, transparent: true });
      const exam = new THREE.Mesh(pageGeo, examMat);
      scene.add(exam);

      const pickedMat = new THREE.MeshBasicMaterial({ map: pickedTex, toneMapped: false, transparent: true, opacity: 0 });
      const picked = new THREE.Mesh(pageGeo, pickedMat);
      picked.position.z = 0.01;
      scene.add(picked);

      const fanMat = new THREE.MeshBasicMaterial({ map: fanfareTex, toneMapped: false, transparent: true, opacity: 0 });
      const fanfare = new THREE.Mesh(pageGeo, fanMat);
      fanfare.position.z = 0.02;
      scene.add(fanfare);

      // The certificate as an OBJECT: its own aspect, its own card, not a page.
      const certAspect = 1436 / 1016;
      const certH = 7.2;
      const certGeo = new THREE.PlaneGeometry(certH * certAspect, certH);
      const certMat = new THREE.MeshBasicMaterial({ map: certTex, toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide });
      const cert = new THREE.Mesh(certGeo, certMat);
      cert.position.z = 3;
      scene.add(cert);

      // A drawn cursor, so the click is something a person did.
      const cursorGeo = new THREE.PlaneGeometry(0.42, 0.42);
      const cursorCanvas = document.createElement("canvas");
      cursorCanvas.width = cursorCanvas.height = 128;
      const cx = cursorCanvas.getContext("2d")!;
      cx.beginPath();
      cx.moveTo(14, 8); cx.lineTo(14, 104); cx.lineTo(38, 80); cx.lineTo(54, 116);
      cx.lineTo(72, 108); cx.lineTo(56, 74); cx.lineTo(90, 74); cx.closePath();
      cx.fillStyle = "#f1ece0"; cx.strokeStyle = "#08090d"; cx.lineWidth = 7;
      cx.stroke(); cx.fill();
      const cursorTex = new THREE.CanvasTexture(cursorCanvas);
      cursorTex.colorSpace = THREE.SRGBColorSpace;
      const cursor = new THREE.Mesh(
        cursorGeo,
        new THREE.MeshBasicMaterial({ map: cursorTex, transparent: true, toneMapped: false }),
      );
      cursor.position.z = 0.05;
      scene.add(cursor);

      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 200);

      /** Page CSS pixel -> world, with the plate centred on the origin. */
      const toWorld = (px: number, py: number) => ({
        x: (px - PAGE_W / 2) * U,
        y: (PAGE_H / 2 - py) * U,
      });
      const opt = toWorld(OPTION.x, OPTION.y);
      const from = toWorld(PAGE_W * 0.86, PAGE_H * 0.88);

      const render = () => renderer.render(scene, camera);

      // Seeking a video is async, so the whole timeline is async: capture must
      // await the frame it asked for rather than shoot whatever is decoded.
      const seek = (time: number) =>
        new Promise<void>((res) => {
          if (Math.abs(video.currentTime - time) < 0.001) return res();
          const done = () => res();
          video.addEventListener("seeked", done, { once: true });
          video.currentTime = time;
        });

      const applyAt = async (t: number) => {
        // ── beat 1: pushed in, following the cursor ───────────────────────
        const travel = smooth(0.06, 0.34, t);
        const cxp = from.x + (opt.x - from.x) * travel;
        const cyp = from.y + (opt.y - from.y) * travel;
        cursor.position.set(cxp, cyp, 0.05);

        const clicked = t >= 0.36;
        pickedMat.opacity = clicked ? 1 : 0;
        const press = t >= 0.35 && t < 0.4 ? 0.86 : 1;
        cursor.scale.setScalar(press);

        // The camera rides just behind the cursor, then eases back out.
        const pushIn = smooth(0.0, 0.2, t) * (1 - smooth(0.42, 0.62, t));
        // A MODERATE push. The first pass drove the camera to z 5.1, which
        // filled the frame with two words and lost every scrap of context: you
        // could not tell it was an exam. Close enough to read the option and
        // see it get chosen, not close enough to lose the page.
        const camZ = 13.5 - 4.4 * pushIn;
        const lead = 0.42; // trails the cursor rather than centring it
        camera.position.set(cxp * lead * pushIn, cyp * lead * pushIn, camZ);
        camera.lookAt(cxp * lead * pushIn, cyp * lead * pushIn, 0);

        // ── beat 2: the real fanfare ──────────────────────────────────────
        const fanIn = smooth(0.44, 0.52, t);
        const fanOut = smooth(0.72, 0.80, t);
        fanMat.opacity = fanIn * (1 - fanOut);
        examMat.opacity = 1 - fanIn;
        pickedMat.opacity = clicked ? 1 - fanIn : 0;
        cursor.visible = t < 0.44;
        if (fanIn > 0 && fanOut < 1) {
          const u = clamp01((t - 0.44) / (0.80 - 0.44));
          await seek(u * (video.duration || 1.8));
        }

        // ── beat 3: the certificate spins in ──────────────────────────────
        const cIn = smooth(0.70, 0.94, t);
        certMat.opacity = cIn;
        // From edge-on and small to face-on and settled: an object arriving,
        // not an image fading up.
        cert.rotation.y = (1 - easeOut(cIn)) * -Math.PI * 0.92;
        cert.scale.setScalar(0.72 + 0.28 * easeOut(cIn));
        cert.position.z = 3 + (1 - easeOut(cIn)) * 1.4;

        render();
      };

      window.__cineSet = applyAt;
      window.__cineMeta = { fanfareDuration: video.duration || 1.8 };
      await applyAt(0);
      window.__cineReady = true;

      let raf = 0;
      if (autoplay) {
        const start = performance.now();
        let busy = false;
        const tick = async (now: number) => {
          if (!busy) {
            busy = true;
            await applyAt(((now - start) % periodMs) / periodMs);
            busy = false;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        delete window.__cineSet;
        delete window.__cineReady;
        video.pause();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [w, h, autoplay, periodMs]);

  return <div ref={mountRef} data-cine-stage style={{ width: w, height: h }} />;
}
