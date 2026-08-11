"use client";

// SANDBOX — the certificate pirouetting at layout 08. DEV ONLY.
//
// A PIROUETTE, NOT A TUMBLE. The card keeps the six degree lean from layout 08
// and turns about its own vertical axis, so the lean stays constant and only
// the facing changes. Rotating the lean as well would read as a tumble and
// would swing the card into the type it was moved away from.
//
// IT HAS A BACK AND AN EDGE. A textured plane turning about Y is invisible for
// the two frames it is edge-on and shows a mirrored certificate for the entire
// half-turn it is facing away, which reads as a mistake rather than a rotation.
// This is a thin box: certificate on the front, plain warm ivory on the back and
// the edges, so the card is an object rather than a decal.
//
// IT RESOLVES FACING YOU. This is the payoff shot, so every profile except the
// deliberately-continuous one lands face-on and holds. A card still turning
// when the clip ends reads as a loop, not an ending.
//
// SHUTTERED, for the same reason the board is: a fast turn drawn as a series of
// perfectly sharp poses strobes. Sub-samples are averaged across a 180 degree
// shutter, at reduced resolution because the result is a blur anyway.

import { useEffect, useId, useRef, useState } from "react";
import { TEXT_SCALE, cueCss } from "../capture/cut/cue-layer";

/** Card geometry, from the plate: 1436 x 1016. */
const CARD_AR = 1436 / 1016;
/** Layout 08: width 44% of frame, left 54%, top 20%, six degrees of lean. */
const L = { w: 0.44, left: 0.54, top: 0.2, lean: -6 };
const FPS = 30;
const SECONDS = 2.0; // EARN lands at 8.0 and the cut ends at 10.0

export type Profile = {
  id: string;
  label: string;
  note: string;
  /** Total rotation in degrees. Negative turns the other way. */
  turn: number;
  /** How long the turn takes. The rest of the clip holds face-on. */
  dur: number;
  /** Damped settle past the target instead of easing into it. */
  overshoot?: number;
  /** Never resolves: keeps turning at a constant rate. */
  continuous?: boolean;
  /** Turn about X (a card flip) rather than Y. */
  flip?: boolean;
};

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/** Angle in degrees at t, for a profile. */
export function angleAt(p: Profile, t: number): number {
  if (p.continuous) return p.turn * (t / SECONDS);
  const u = clamp01(t / p.dur);
  if (p.overshoot) {
    // Damped spring toward the target: overshoot then settle. Same shape as the
    // board's snap profiles, which is why they feel related.
    const z = p.overshoot;
    const w = 9;
    const a = w * Math.sqrt(1 - z * z);
    const tt = u * p.dur;
    const env = Math.exp(-w * z * tt);
    return p.turn * (1 - env * (Math.cos(a * tt) + ((w * z) / a) * Math.sin(a * tt)));
  }
  // Quintic ease-out: fast entry, long settle, no bounce.
  return p.turn * (1 - Math.pow(1 - u, 5));
}

export function PirouetteStage({
  profile,
  w = 880,
  showType = true,
}: {
  profile: Profile;
  w?: number;
  showType?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Latest-value ref, written AFTER commit rather than during render: the scene
  // effect depends on [w, h] only, so changing profile must not rebuild WebGL,
  // but a render that gets discarded must not leave its write behind either.
  const profRef = useRef(profile);
  useEffect(() => {
    profRef.current = profile;
  }, [profile]);
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
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(-1.2, 1.4, 2.2);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xe8b865, 0.5);
      rim.position.set(2, -1, 1.4);
      scene.add(rim);

      // Frame units: the canvas is 1 wide and 9/16 tall, so a layout percentage
      // maps straight onto world space and the card lands exactly where the
      // static layout put it.
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

      // Front is the plate; back and edges are the card's own paper colour, so a
      // half-turn shows a blank card rather than mirrored text.
      const paper = new THREE.MeshStandardMaterial({ color: 0xf3ede1, roughness: 0.85, metalness: 0.0 });
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.0 });
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(cw, ch, cw * 0.006),
        [paper, paper, paper, paper, face, paper],
      );
      const pivot = new THREE.Group();
      pivot.add(card);
      pivot.position.set(cx, cy, 0);
      // The LEAN lives on an outer group so the pirouette cannot rotate it.
      const lean = new THREE.Group();
      lean.rotation.z = (L.lean * Math.PI) / 180;
      lean.add(pivot);
      scene.add(lean);

      // ── shutter ──────────────────────────────────────────────────────────
      const BS = 0.5;
      const rt = new THREE.WebGLRenderTarget(Math.round(w * BS), Math.round(h * BS), {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      const acc = new THREE.WebGLRenderTarget(Math.round(w * BS), Math.round(h * BS), {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quadGeo = new THREE.PlaneGeometry(2, 2);
      const V = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
      const addMat = new THREE.ShaderMaterial({
        uniforms: { t: { value: null }, wgt: { value: 1 } },
        vertexShader: V,
        fragmentShader: `uniform sampler2D t;uniform float wgt;varying vec2 vUv;
          void main(){gl_FragColor=texture2D(t,vUv)*wgt;}`,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendEquationAlpha: THREE.AddEquation,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const copyMat = new THREE.ShaderMaterial({
        uniforms: { t: { value: acc.texture } },
        vertexShader: V,
        fragmentShader: `uniform sampler2D t;varying vec2 vUv;void main(){gl_FragColor=texture2D(t,vUv);}`,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const addScene = new THREE.Scene().add(new THREE.Mesh(quadGeo, addMat));
      const copyScene = new THREE.Scene().add(new THREE.Mesh(quadGeo, copyMat));

      const pose = (t: number) => {
        const p = profRef.current;
        const deg = angleAt(p, t);
        pivot.rotation.set(0, 0, 0);
        if (p.flip) pivot.rotation.x = (deg * Math.PI) / 180;
        else pivot.rotation.y = (deg * Math.PI) / 180;
      };

      const draw = (t: number) => {
        const p = profRef.current;
        const shutter = 1 / FPS / 2;
        const swept = Math.abs(angleAt(p, t + shutter / 2) - angleAt(p, t - shutter / 2));
        const n = Math.min(12, Math.max(1, Math.ceil(swept / 1.2)));
        if (n === 1) {
          renderer.setRenderTarget(null);
          renderer.clear();
          pose(t);
          renderer.render(scene, camera);
          return;
        }
        renderer.setRenderTarget(acc);
        renderer.clear();
        addMat.uniforms.wgt.value = 1 / n;
        for (let i = 0; i < n; i += 1) {
          pose(t - shutter / 2 + ((i + 0.5) / n) * shutter);
          renderer.setRenderTarget(rt);
          renderer.clear();
          renderer.render(scene, camera);
          addMat.uniforms.t.value = rt.texture;
          renderer.setRenderTarget(acc);
          renderer.render(addScene, quadCam);
        }
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(copyScene, quadCam);
      };

      let raf = 0;
      const start = performance.now();
      const tick = (now: number) => {
        draw(((now - start) / 1000) % SECONDS);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        rt.dispose();
        acc.dispose();
        quadGeo.dispose();
        addMat.dispose();
        copyMat.dispose();
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
      data-pirouette={profile.id}
      className="relative overflow-hidden"
      style={{ width: "100%", aspectRatio: "16 / 9", background: "#08090d" }}
    >
      <div ref={mountRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />
      {showType ? <TypeOverlay /> : null}
      {!ready ? (
        <span className="absolute bottom-2 left-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
          building…
        </span>
      ) : null}
    </div>
  );
}

/**
 * EARN and the URL, on the dark left, exactly where layout 08 puts them.
 *
 * The REAL cue stylesheet, scoped per instance. Hand-rolling the type here
 * would mean judging the pirouette against something that is not the type the
 * cut renders, which is the mistake this whole round exists to avoid.
 */
function TypeOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const raw = useId();
  const id = `pir-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const short = Math.max(1, box.height);
    const size = {
      word: Math.round(short * TEXT_SCALE.word),
      big: Math.round(short * TEXT_SCALE.big),
      url: Math.round(short * TEXT_SCALE.url),
    };
    const style = document.createElement("style");
    style.textContent = cueCss(size, 8).replace(/#cuelayer/g, `#${id}`);
    root.appendChild(style);
    return () => style.remove();
  }, [id]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-10">
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
        <div className="cue held mark c-bl" style={{ opacity: 1 }}>
          <div className="mark">
            <div className="mark-url">academy.onethousanddrones.com/beta</div>
          </div>
        </div>
      </div>
    </div>
  );
}
