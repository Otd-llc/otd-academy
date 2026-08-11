"use client";

// SANDBOX — the certificate with a subtle parallax, tilted. DEV ONLY.
//
// NOT A SPIN. The pirouette made the card the event; at this point in the cut
// the card IS the payoff and it needs to be read, not watched. So the motion
// here is small enough that nothing is ever unreadable: a few degrees of drift,
// a percent or two of scale, and the lean from layout 08 held throughout.
//
// NO SHUTTER, ON PURPOSE. The blur machinery the board and the pirouette need
// exists because they sweep tens of degrees inside one frame. The fastest thing
// here moves about 0.2 degrees per frame, which is nowhere near the threshold
// where sharp poses strobe, so accumulating sub-samples would cost eight
// renders a frame to produce an identical picture.
//
// WHAT MAKES IT PARALLAX rather than a wobble is that the card and the type are
// at different depths and can move at different rates. Several profiles below
// drift only the card; `parallax` moves the type the other way, which is the
// literal version of the effect.

import { useEffect, useId, useRef, useState } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";
// The table lives in a PLAIN module and the stage takes an ID, because the
// profiles carry pose FUNCTIONS and a function cannot cross the server/client
// boundary as a prop. See profiles.ts.
import { byId } from "./profiles";

const CARD_AR = 1436 / 1016;
/** Layout 08: width 44% of frame, left 54%, top 20%, six degrees of lean. */
const L = { w: 0.44, left: 0.54, top: 0.2, lean: -6 };
const SECONDS = 2.0;

export function ParallaxStage({ id, w = 880 }: { id: string; w?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const profRef = useRef(byId(id));
  profRef.current = byId(id);
  const [ready, setReady] = useState(false);
  const h = Math.round((w * 9) / 16);

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
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.25);
      key.position.set(-1.2, 1.4, 2.2);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xe8b865, 0.45);
      rim.position.set(2, -1, 1.4);
      scene.add(rim);

      // Frame units: 1 wide, 9/16 tall, so layout percentages map straight to
      // world space and the card sits exactly where the static layout put it.
      const FW = 1;
      const FH = 9 / 16;
      const camera = new THREE.OrthographicCamera(-FW / 2, FW / 2, FH / 2, -FH / 2, 0.01, 100);
      camera.position.z = 10;

      const cw = L.w * FW;
      const ch = cw / CARD_AR;
      const cx = (L.left + L.w / 2) * FW - FW / 2;
      const cy = FH / 2 - (L.top * FH + ch / 2);

      const tex = await new THREE.TextureLoader().loadAsync("/_capture/cine/cert-card.png");
      if (disposed) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;

      const paper = new THREE.MeshStandardMaterial({ color: 0xf3ede1, roughness: 0.85 });
      // Slightly glossy front, so a travelling light has something to catch.
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(cw, ch, cw * 0.006),
        [paper, paper, paper, paper, face, paper],
      );
      const pivot = new THREE.Group();
      pivot.add(card);
      const lean = new THREE.Group();
      lean.rotation.z = (L.lean * Math.PI) / 180;
      lean.add(pivot);
      scene.add(lean);

      const apply = (t: number) => {
        const p = profRef.current.pose(Math.min(t / SECONDS, 1));
        pivot.rotation.set((p.pitch * Math.PI) / 180, (p.yaw * Math.PI) / 180, 0);
        pivot.scale.setScalar(p.scale);
        lean.position.set(cx + p.dx, cy + p.dy, 0);
        key.position.set(p.lightX, 1.4, 2.2);
        if (typeRef.current) {
          typeRef.current.style.transform = `translateX(${p.typeDx * 100}%)`;
        }
        renderer.render(scene, camera);
      };

      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        apply(((now - start) / 1000) % SECONDS);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        tex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [w, h]);

  return (
    <div
      data-parallax={id}
      className="relative overflow-hidden"
      style={{ width: "100%", aspectRatio: "16 / 9", background: "#08090d" }}
    >
      <div ref={mountRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />
      <TypeOverlay innerRef={typeRef} />
      {!ready ? (
        <span className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
          building…
        </span>
      ) : null}
    </div>
  );
}

/** EARN and the URL, on the dark left, using the REAL cue stylesheet. */
function TypeOverlay({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `px-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const short = Math.max(1, root.getBoundingClientRect().height);
    const style = document.createElement("style");
    style.textContent = cueCss(
      {
        word: Math.round(short * TEXT_SCALE.word),
        big: Math.round(short * TEXT_SCALE.big),
        url: Math.round(short * TEXT_SCALE.url),
      },
      8,
    ).replace(/#cuelayer/g, `#${id}`);
    root.appendChild(style);
    return () => style.remove();
  }, [id]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-10">
      <div ref={innerRef} id={id} style={{ willChange: "transform" }}>
        <div className="cue held f1 c-tl big" style={{ opacity: 1 }}>
          <div className="k-grow">
            <div className="k-mask">
              <div className="k-word">
                <span className="accent">
                  EARN<span className="tdot">.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="cue held mark c-bl" style={{ opacity: 1 }}>
          <div className="mark">
            <div className="mark-url">academy.onethousanddrones.com/beta</div>
          </div>
        </div>
      </div>
    </div>
  );
}
