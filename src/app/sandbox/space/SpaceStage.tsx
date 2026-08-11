"use client";

// SANDBOX — profile 04 (push in) with the space reworked. DEV ONLY.
//
// The MOTION is fixed at the push-in you picked: a 4.5% dolly with three and a
// half degrees of yaw easing out, over the two seconds EARN actually has. Only
// the LAYOUT varies, so what is being compared is the use of space rather than
// the movement.
//
// THE LINK IS BOTTOM-ALIGNED. `c-band` is grid row 4 with align-self:end, which
// puts it on the safe line at 92% instead of floating at 77% with a dead band
// underneath it.

import { useEffect, useId, useRef, useState } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";
import { SPECS, placeEarn, type Format } from "../capture/cut/earn-place";
import { byId } from "./layouts";

/**
 * Fallback only. The real aspect is READ FROM THE TEXTURE below, because the
 * card is a rendered artefact whose pixel size changes when it is regenerated:
 * it arrived as 1436x1016 and came back 1200x848 from the token route. A
 * hardcoded ratio silently stretches the artwork the day that happens.
 */
const CARD_AR_FALLBACK = 1436 / 1016;
const LEAN = -6;
const SECONDS = 2.0;

const out = (u: number) => 1 - Math.pow(1 - u, 5);

export function SpaceStage({
  id,
  w = 880,
  /**
   * Offline render mode: no type overlay and no clock of its own. The CUT draws
   * EARN and the link from its own cue layer, so a capture that baked type in
   * would double it.
   */
  capture = false,
  /**
   * When set, the frame's size AND the card's geometry come from the shared
   * placement rule rather than from the layout table. The layout table holds
   * the 16:9 sandbox rounds and has no answer for 9:16, and hardcoding a second
   * answer here is how the card and the type end up composed against different
   * frames.
   */
  format,
}: {
  id: string;
  w?: number;
  capture?: boolean;
  format?: Format;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const spec = format ? SPECS[format] : null;
  // 9/16 only when there is no format. That default is the sandbox's, and it
  // was the reason this component could not render a vertical frame at all.
  const outW = spec ? spec.w : w;
  const h = spec ? spec.h : Math.round((w * 9) / 16);
  const layout = byId(id);
  const cert = format ? placeEarn(format).card : layout.cert;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const certRef = useRef(cert);
  certRef.current = cert;

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const scene = new THREE.Scene();
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      // updateStyle=false. setSize otherwise writes INLINE width/height onto the
      // canvas, which beats the w-full/h-full classes and pins it at 880 px
      // inside a frame that is nearer 976. The card's percentages were then
      // measured against a different width from the type's, so the two never
      // actually shared the layout grid they were both specified in.
      renderer.setSize(outW, h, false);
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

      // The camera frustum IS the frame. Hardcoding 9/16 here put the card's
      // percentages on a 16:9 grid no matter what canvas it was drawn into, so
      // a "46% wide, 18% down" card in a 9:16 frame landed nowhere near it.
      const FW = 1;
      const FH = h / outW;
      const camera = new THREE.OrthographicCamera(-FW / 2, FW / 2, FH / 2, -FH / 2, 0.01, 100);
      camera.position.z = 10;

      // Load FIRST, then size the card from the texture's own dimensions.
      const tex = await new THREE.TextureLoader().loadAsync("/_capture/cine/cert-card.png");
      if (disposed) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const img = tex.image as { width?: number; height?: number } | undefined;
      const cardAr = img?.width && img?.height ? img.width / img.height : CARD_AR_FALLBACK;

      const L = certRef.current;
      const cw = (L.w / 100) * FW;
      const ch = cw / cardAr;
      const cx = ((L.left + L.w / 2) / 100) * FW - FW / 2;
      const cy = FH / 2 - ((L.top / 100) * FH + ch / 2);

      const paper = new THREE.MeshStandardMaterial({ color: 0xf3ede1, roughness: 0.85 });
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 });
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(cw, ch, cw * 0.006),
        [paper, paper, paper, paper, face, paper],
      );
      const pivot = new THREE.Group();
      pivot.add(card);
      const lean = new THREE.Group();
      // The placement rule computes the card's axis-aligned box from this
      // angle, so the render has to take the angle from the same place or the
      // type is composed against a box the card does not occupy.
      lean.rotation.z = (((L as { lean?: number }).lean ?? LEAN) * Math.PI) / 180;
      lean.position.set(cx, cy, 0);
      lean.add(pivot);
      scene.add(lean);

      const apply = (t: number) => {
        // Clamped at BOTH ends. Negative t holds the opening pose, which is what
        // lets the capture carry a pre-roll: the card is on screen and still,
        // so the EARN join can be nudged EARLIER against real footage instead of
        // having none. Unclamped, out(-0.4) is about -6 and the card flies off.
        const u = Math.min(Math.max(t / SECONDS, 0), 1);
        pivot.rotation.y = ((-3.5 + 3.5 * out(u)) * Math.PI) / 180;
        pivot.scale.setScalar(1 + 0.045 * out(u));
        renderer.render(scene, camera);
      };

      if (capture) {
        const win = window as unknown as Record<string, unknown>;
        win.__spaceSet = (t: number) => apply(t);
        apply(0);
        win.__spaceReady = true;
        setReady(true);
        cleanup = () => {
          delete win.__spaceSet;
          delete win.__spaceReady;
          tex.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
        return;
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outW, h, capture, format, id]);

  return (
    <div
      data-space={id}
      className="relative overflow-hidden"
      style={{ width: "100%", aspectRatio: `${outW} / ${h}`, background: "#08090d" }}
    >
      <div ref={mountRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />
      {capture ? null : <TypeOverlay wordScale={layout.wordScale} urlAlign={layout.urlAlign} />}
      {!ready && !capture ? (
        <span className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
          building…
        </span>
      ) : null}
    </div>
  );
}

function TypeOverlay({ wordScale, urlAlign }: { wordScale: number; urlAlign?: "right" | "centre" }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `sp-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    const short = Math.max(1, root.getBoundingClientRect().height);
    const style = document.createElement("style");
    style.textContent = cueCss(
      {
        word: Math.round(short * TEXT_SCALE.word),
        // The one number the layouts move. Everything else in the cue sheet is
        // the shipped value.
        big: Math.round(short * TEXT_SCALE.big * wordScale),
        url: Math.round(short * TEXT_SCALE.url),
      },
      8,
    ).replace(/#cuelayer/g, `#${id}`);
    root.appendChild(style);
    return () => style.remove();
  }, [id, wordScale]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-10">
      <div id={id}>
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
        {/* c-band: bottom-aligned, full width. The original c-bl floated the
            link at 77% with a dead band beneath it. */}
        <div className={`cue held mark c-band ${urlAlign ?? ""}`} style={{ opacity: 1 }}>
          <div className="mark">
            <div className="mark-url">academy.onethousanddrones.com/beta</div>
          </div>
        </div>
      </div>
    </div>
  );
}
