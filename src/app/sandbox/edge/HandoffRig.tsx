"use client";

// SANDBOX — the DESIGN -> BUILD handoff, one canvas, scrubbable. DEV ONLY.
//
// WHY ONE CANVAS. The previous page put nine WebGL contexts on one scroll, each
// with its own PMREM bake and eight extruded sheet groups. It was not a bad
// transition, it was a starved one — the frame rate collapsed and the handoff
// could not be judged because it was never actually drawn. One context, one
// scene, and the variants are knobs rather than extra canvases.
//
// WHY A SCRUBBER. The join is over in a few frames. Watching a loop go past is
// the wrong instrument for judging it. Drag the bar and the same applyAt(t) that
// the clock drives renders that exact instant, so what you scrub to IS what
// plays. That equivalence is the point; a preview that can differ from the clip
// is worthless for judging.
//
// THE HANDOFF, as specified: the sheets collapse until the stack is EXACTLY the
// board's thickness, and only then does it cross-fade into the board — with the
// turntable never changing rate. The thickness match is measured off the GLB at
// load, not guessed, and both numbers are printed live so the match is visible.

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { BOARD, SHEETS } from "@/components/guide/diagrams/data/l101-gerber-layers";
import {
  HANDOFF,
  SECONDS,
  T_COLLAPSE,
  T_EXPLODE_OUT,
  T_HOLD,
  T_RETURN,
} from "./timing";
import { ANGLES, PROFILE_LABELS, PROFILE_NOTES, spinAt, type SpinProfile } from "./spin";

const SHEET_T = 0.22;
const SHEET_GAP = 5.2;
const KIND_COLOR: Record<string, number> = { cu: 0xc8963e, mask: 0x2f6f5e, silk: 0xf1ece0 };

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

export function HandoffRig({
  w = 960,
  h = 540,
  glb = "/_capture/l1-01.glb",
  /**
   * Resolution of the motion-blur sub-samples, relative to the canvas. Below 1
   * for interactive preview, where ten full-size sub-samples cost more than the
   * frame budget. An offline capture should pass 1: it has no frame budget and
   * the deliverable should not inherit a preview compromise.
   */
  blurScale = 0.5,
  /**
   * Offline render mode: no controls, no clock of its own, and no sample budget.
   * Exposes window.__handoffSet(t) so a capture script owns the timeline, which
   * is the only way a frame can take arbitrary wall time without the picture
   * drifting.
   */
  capture = false,
  /** Locked-in choices, so a capture renders the picked look rather than defaults. */
  initialAngle = ANGLES[0].id,
  initialProfile = "snap",
  /** HALF the cross-fade, in seconds. The UI buttons are 0.08 / 0.25 / 0.5. */
  initialFade = 0.25,
}: {
  w?: number;
  h?: number;
  glb?: string;
  blurScale?: number;
  capture?: boolean;
  initialAngle?: string;
  initialProfile?: SpinProfile;
  initialFade?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);
  const samplesRef = useRef<HTMLDivElement>(null);

  // Controls live in refs, NOT state: state would re-run the effect and rebuild
  // the whole scene on every knob turn.
  const playing = useRef(true);
  const tRef = useRef(0);
  const speed = useRef(1);
  const fadeHalf = useRef(initialFade);
  const showGhost = useRef(false);
  const profile = useRef<SpinProfile>(initialProfile);
  const blur = useRef(true);
  const angle = useRef<string>(initialAngle);
  /**
   * ?solo=stack|board renders ONE object with the other suppressed, at the same
   * instant. That is what makes the alignment checkable: two silhouettes at the
   * identical turntable angle either coincide or they do not. Eyeballing the
   * composite missed a NINETY DEGREE error, so the check is not optional.
   */
  const solo = useRef<"stack" | "board" | null>(null);

  const [ready, setReady] = useState(false);
  const [ui, setUi] = useState({
    playing: true,
    speed: 1,
    fade: initialFade,
    ghost: false,
    blur: true,
    profile: initialProfile,
    angle: initialAngle,
  });

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      const { SVGLoader } = await import("three/addons/loaders/SVGLoader.js");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      const { mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
      const mount = mountRef.current;
      if (!mount || disposed) return;

      const scene = new THREE.Scene();
      const q = new URLSearchParams(location.search).get("solo");
      if (q === "stack" || q === "board") solo.current = q;
      // preserveDrawingBuffer so the harness can read the silhouette back out of
      // the canvas after the fact. Sandbox only.
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      mount.appendChild(renderer.domElement);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.3;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.5));
      const key = new THREE.DirectionalLight(0xffffff, 2.0);
      key.position.set(3, 5, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 1.0);
      rim.position.set(-2, -3, -5);
      scene.add(rim);

      // ── the one turntable ───────────────────────────────────────────────
      const spin = new THREE.Group();
      scene.add(spin);

      // ── the stack ───────────────────────────────────────────────────────
      const loader = new SVGLoader();
      const sheets: THREE_NS.Mesh[] = [];
      const stackRoot = new THREE.Group();
      for (const sheet of SHEETS) {
        const body = sheet.paths
          .map((p) =>
            p.kind === "stroke"
              ? `<path d="${p.d}" fill="none" stroke="#000" stroke-width="${p.width ?? 0.15}" stroke-linecap="round" stroke-linejoin="round"/>`
              : `<path d="${p.d}" fill="#000"/>`,
          )
          .join("");
        const mat = new THREE.MeshStandardMaterial({
          color: KIND_COLOR[sheet.kind] ?? 0x888888,
          metalness: sheet.kind === "cu" ? 0.75 : 0.1,
          roughness: sheet.kind === "cu" ? 0.34 : 0.62,
          transparent: true,
        });
        // ONE MESH PER SHEET, not one per contour. Each gerber layer is hundreds
        // of pads and traces; as separate meshes that is hundreds of draw calls
        // per frame times eight layers, which is what held the canvas at 40 fps.
        // They already share a material, so merging costs nothing but the merge.
        const parts: THREE_NS.BufferGeometry[] = [];
        for (const p of loader.parse(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD.w} ${BOARD.h}">${body}</svg>`,
        ).paths) {
          for (const shape of SVGLoader.createShapes(p)) {
            try {
              parts.push(
                new THREE.ExtrudeGeometry(shape, { depth: SHEET_T, bevelEnabled: false, curveSegments: 6 }),
              );
            } catch {
              /* a degenerate contour */
            }
          }
        }
        const merged = parts.length ? (mergeGeometries(parts, false) ?? parts[0]) : null;
        for (const p of parts) if (p !== merged) p.dispose();
        if (!merged) continue;
        const m = new THREE.Mesh(merged, mat);
        sheets.push(m);
        stackRoot.add(m);
      }
      stackRoot.position.set(-BOARD.w / 2, BOARD.h / 2, 0);
      const stackPivot = new THREE.Group();
      stackPivot.add(stackRoot);
      stackPivot.rotation.x = -Math.PI * 0.34;
      spin.add(stackPivot);

      // ── the board ───────────────────────────────────────────────────────
      //
      // THE BOARD WAS THE WHOLE PERFORMANCE PROBLEM, and not for the reason you
      // would guess. Measured in isolation the exploded gerber stack held 60 fps
      // while the board alone ran at 2. It is not heavy geometry: 86k triangles
      // is nothing. It is 5987 SEPARATE MESHES sharing 26 materials, because
      // KiCad exports every pad, via and courtyard as its own node. Six thousand
      // draw calls of fourteen triangles each is pure per-call overhead.
      //
      // So merge by material: 5987 draw calls become 26. World matrices are
      // baked into the geometry first, since the merged mesh has no per-node
      // transform to carry them.
      const gltf = await new GLTFLoader().loadAsync(glb);
      if (disposed) return;
      const source = gltf.scene;
      source.updateMatrixWorld(true);

      const byMaterial = new Map<THREE_NS.Material, THREE_NS.BufferGeometry[]>();
      let srcMeshes = 0;
      let srcTris = 0;
      source.traverse((o: THREE_NS.Object3D) => {
        const m = o as THREE_NS.Mesh;
        if (!m.isMesh || !m.geometry || Array.isArray(m.material)) return;
        srcMeshes += 1;
        // mergeGeometries refuses a mismatched attribute set, and a GLB is not
        // obliged to give every mesh the same one. Normalise to non-indexed
        // position/normal/uv, which is the intersection this model needs.
        const g = (m.geometry.getIndex() ? m.geometry.toNonIndexed() : m.geometry.clone());
        g.applyMatrix4(m.matrixWorld);
        if (!g.getAttribute("normal")) g.computeVertexNormals();
        const count = g.getAttribute("position").count;
        srcTris += count / 3;
        if (!g.getAttribute("uv")) {
          g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
        }
        const lean = new THREE.BufferGeometry();
        lean.setAttribute("position", g.getAttribute("position"));
        lean.setAttribute("normal", g.getAttribute("normal"));
        lean.setAttribute("uv", g.getAttribute("uv"));
        const list = byMaterial.get(m.material);
        if (list) list.push(lean);
        else byMaterial.set(m.material, [lean]);
      });

      // THE BOARD WAS PERPENDICULAR TO ITS OWN GERBERS, and this is the defect
      // behind "it breaks up". glTF is Y-up, so KiCad's board plane exports as
      // XZ with the thickness on Y. The gerber stack is built in XY with the
      // thickness on Z. Both were then given the same pivot tilt, which made
      // them look plausibly related while actually crossing at ninety degrees:
      // at the cross-fade the frame held a giant X, not a handoff. Rotating a
      // quarter turn about X puts the board's thickness on Z, where the stack's
      // already is. Baked into the geometry so every downstream measurement,
      // including the substrate read, is in the same frame.
      const toXY = new THREE.Matrix4().makeRotationX(Math.PI / 2);

      const model = new THREE.Group();
      // Candidate substrates, gathered while merging: see the thickness note.
      const groups: { thick: number; area: number }[] = [];
      for (const [mat, parts] of byMaterial) {
        const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
        for (const p of parts) if (p !== merged) p.dispose();
        if (!merged) continue;
        merged.applyMatrix4(toXY);
        merged.computeBoundingBox();
        const s = new THREE.Vector3();
        merged.boundingBox?.getSize(s);
        groups.push({ thick: s.z * 1000, area: s.x * s.y });
        const mm = mat as THREE_NS.MeshStandardMaterial;
        mm.transparent = true;
        model.add(new THREE.Mesh(merged, mm));
      }

      const bbox = new THREE.Box3().setFromObject(model);
      const bcentre = new THREE.Vector3();
      const bfull = new THREE.Vector3();
      bbox.getCenter(bcentre);
      bbox.getSize(bfull);
      model.position.sub(bcentre);
      // GLB units are METRES, the gerber data is millimetres.
      const boardPivot = new THREE.Group();
      boardPivot.add(model);
      boardPivot.scale.setScalar(1000);
      boardPivot.rotation.x = -Math.PI * 0.34;
      spin.add(boardPivot);

      // THE THICKNESS MATCH, measured off the SUBSTRATE.
      //
      // Two wrong answers came before this one. The model's smallest bbox axis
      // is 18.17 mm, the whole ASSEMBLY height, because the ESP32 module stands
      // off the board; matching to that made the stack ten times too fat. The
      // widest single MESH is 38 mm2, because there is no one substrate mesh to
      // find in six thousand fragments.
      //
      // Merged by material there is one. Keep the groups that span >= 60% of the
      // footprint and are a plausible board thickness, then take the one with
      // the LARGEST AREA: the substrate is the biggest single thing on a board.
      // Taking the THICKEST instead picked 2.54 mm, which is not a board at all,
      // it is the 0.1 inch header pitch. The flat copper and silk layers fall
      // out on their own, having zero extrusion.
      const footprint = bfull.x * bfull.y;
      const spanning = groups
        .filter((g) => g.area >= footprint * 0.6 && g.thick > 0.4 && g.thick < 5)
        .sort((a, b) => b.area - a.area);
      const measuredMm = spanning[0]?.thick ?? 0;
      const boardThickMm = measuredMm || 1.6;
      if (!measuredMm) {
        console.warn("[handoff] no substrate-shaped group in the GLB; using the 1.60 mm spec value");
      }
      (window as unknown as { __rigStats?: unknown }).__rigStats = {
        srcMeshes,
        srcTris: Math.round(srcTris),
        mergedMeshes: model.children.length,
        boardThickMm: Number(boardThickMm.toFixed(3)),
        measured: Boolean(measuredMm),
        footprintMm2: Math.round(footprint * 1e6),
        groups: groups
          .map((g) => ({ thickMm: Number(g.thick.toFixed(3)), areaMm2: Math.round(g.area * 1e6) }))
          .sort((a, b) => b.areaMm2 - a.areaMm2)
          .slice(0, 8),
      };
      const naturalClosedMm = SHEETS.length * SHEET_T;
      const kZ = boardThickMm / naturalClosedMm;
      stackRoot.scale.set(1, -1, kZ);

      // A wireframe ghost of the board, held at the collapse target, so you can
      // see the stack arrive INTO it rather than merely near it.
      const ghost = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD.w, BOARD.h, boardThickMm),
        new THREE.MeshBasicMaterial({ color: 0x4a8fff, wireframe: true, transparent: true, opacity: 0.35 }),
      );
      ghost.rotation.x = -Math.PI * 0.34;
      ghost.visible = false;
      spin.add(ghost);

      // Material lists gathered ONCE. Traversing both object graphs every frame
      // to set an opacity is work the render loop should never be doing.
      const stackMats = sheets.map((m) => m.material as THREE_NS.MeshStandardMaterial);
      const boardMats = model.children.map(
        (c) => (c as THREE_NS.Mesh).material as THREE_NS.MeshStandardMaterial,
      );
      const setOpacity = (mats: THREE_NS.MeshStandardMaterial[], v: number) => {
        for (const m of mats) m.opacity = v;
      };

      // ── framing, PER ANGLE ──────────────────────────────────────────────
      //
      // An angle is a pivot tilt plus a lens, and each one needs its own
      // framing: a plan view is as wide as the board, an edge-on view is barely
      // taller than the stack. Solved once per angle at build time by taking the
      // union over a whole turn at FULL EXPLODE, so switching angle later is
      // free and nothing clips at any rotation. Recomputing on every switch
      // would mean 64 box unions in the middle of playback.
      const aspect = w / h;
      const mid = (SHEETS.length - 1) / 2;
      sheets.forEach((g, i) => {
        g.position.z = (mid - i) * (SHEET_T + SHEET_GAP);
      });

      type Framing = {
        cam: THREE_NS.Camera;
        centre: THREE_NS.Vector3;
        halfH: number;
        tilt: number;
      };
      const framings = new Map<string, Framing>();
      const box = new THREE.Box3();
      const probe = new THREE.Box3();
      for (const a of ANGLES) {
        const tilt = a.tilt * Math.PI;
        stackPivot.rotation.x = tilt;
        box.makeEmpty();
        for (let k = 0; k < 64; k += 1) {
          spin.rotation.y = (k / 64) * Math.PI * 2;
          spin.updateMatrixWorld(true);
          probe.setFromObject(stackPivot);
          box.union(probe);
        }
        const size = new THREE.Vector3();
        const centre = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(centre);
        const halfH = Math.max((size.y / 2) * 1.08, ((size.x / 2) * 1.08) / aspect);

        let cam: THREE_NS.Camera;
        if (a.persp) {
          // Fit by half-height and field of view. Pulled back far enough that
          // the foreshortening reads as a lens rather than a fisheye.
          // 1.15 of margin, because a perspective fit that frames the CENTRE
          // plane exactly still clips whatever swings nearer the lens.
          const fov = 26;
          const dist = (halfH * 1.15) / Math.tan((fov / 2) * (Math.PI / 180));
          const p = new THREE.PerspectiveCamera(fov, aspect, 1, 20000);
          p.position.set(centre.x, centre.y, centre.z + dist);
          p.lookAt(centre);
          p.updateProjectionMatrix();
          cam = p;
        } else {
          const o = new THREE.OrthographicCamera(
            -halfH * aspect, halfH * aspect, halfH, -halfH, 0.01, 5000,
          );
          o.position.set(centre.x, centre.y, centre.z + 400);
          o.lookAt(centre);
          o.updateProjectionMatrix();
          cam = o;
        }
        framings.set(a.id, { cam, centre, halfH, tilt });
      }

      const first = framings.get(angle.current) ?? framings.get(ANGLES[0].id)!;
      let camera: THREE_NS.Camera = first.cam;
      let halfH = first.halfH;
      const centre = first.centre.clone();
      ghost.position.copy(centre);

      // ── shutter accumulation ────────────────────────────────────────────
      //
      // A whip peaks near 420 deg/sec. At 30 fps that is 14 degrees of rotation
      // inside a single frame, drawn as one perfectly sharp pose: the board
      // teleports frame to frame and the eye reads a strobe, not a move. Real
      // fast motion BLURS, and the blur is most of what sells the whip.
      //
      // Since the clock is ours, the honest way to get it is a real shutter:
      // render several sub-samples spread across the frame's exposure and
      // average them. No velocity buffer, no reprojection, no artefacts around
      // silhouettes, and it blurs the crossfade and the sheets correctly too
      // because it is just the scene at several instants.
      //
      // Sample count is ADAPTIVE, from how far the object actually turns during
      // the exposure. Tracking at 6 deg/sec costs one render; the whip costs
      // twelve, and only for the few frames it lasts.
      //
      // SUB-SAMPLES RENDER SMALL. At full resolution ten of them dropped the
      // preview to 19 fps, so the cure for strobing became a stutter exactly
      // where the whip is being judged. But a frame that is about to be averaged
      // into a blur does not need full resolution: the output is low-frequency
      // by construction, and during a whip EVERY part of the frame is moving, so
      // there is no static detail being protected. 55% got the whip to 31 fps,
      // which cleared the bar and no more; 40% is 16% of the pixels. Sharp frames
      // (n = 1) still go straight to the canvas at full resolution, so nothing
      // that is meant to be crisp is softened to buy this.
      const pr = renderer.getPixelRatio();
      const bw = Math.round(w * pr * blurScale);
      const bh = Math.round(h * pr * blurScale);
      const rtOpts = {
        type: THREE.HalfFloatType,
        depthBuffer: true,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      };
      const frameRT = new THREE.WebGLRenderTarget(bw, bh, rtOpts);
      const accumRT = new THREE.WebGLRenderTarget(bw, bh, { ...rtOpts, depthBuffer: false });
      const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quadGeo = new THREE.PlaneGeometry(2, 2);
      const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
      // three renders premultiplied alpha, so averaging RGBA straight is the
      // correct average of the composited frames. Adding un-premultiplied
      // colour would darken the edges.
      const addMat = new THREE.ShaderMaterial({
        uniforms: { tFrame: { value: null }, wgt: { value: 1 } },
        vertexShader: VERT,
        fragmentShader: `uniform sampler2D tFrame; uniform float wgt; varying vec2 vUv;
          void main(){ gl_FragColor = texture2D(tFrame, vUv) * wgt; }`,
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
        uniforms: { tFrame: { value: accumRT.texture } },
        vertexShader: VERT,
        fragmentShader: `uniform sampler2D tFrame; varying vec2 vUv;
          void main(){ gl_FragColor = texture2D(tFrame, vUv); }`,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const addScene = new THREE.Scene().add(new THREE.Mesh(quadGeo, addMat));
      const copyScene = new THREE.Scene().add(new THREE.Mesh(quadGeo, copyMat));
      renderer.autoClear = false;

      // ── the one source of truth for motion ──────────────────────────────
      const applyAt = (t: number) => {
        // Angle first: it decides the camera and the pivot tilt everything else
        // is posed under. Switching is a map lookup, never a re-frame.
        const f = framings.get(angle.current);
        if (f) {
          camera = f.cam;
          halfH = f.halfH;
          centre.copy(f.centre);
          stackPivot.rotation.x = f.tilt;
          boardPivot.rotation.x = f.tilt;
          ghost.rotation.x = f.tilt;
          ghost.position.copy(f.centre);
        }

        // The turntable is a CURVE now, not a rate. It is still never
        // interrupted, and it is still pinned to face-on at the handoff; what
        // changed is that the speed between those points is free.
        const { deg, rate } = spinAt(profile.current, t);
        spin.rotation.y = THREE.MathUtils.degToRad(deg);

        // Openness: closed -> exploded -> hold -> collapsed. It reaches 0 at
        // HANDOFF and STAYS there, so the stack is at board thickness before
        // anything cross-fades.
        const out = smooth(T_EXPLODE_OUT[0], T_EXPLODE_OUT[1], t);
        const back = smooth(T_COLLAPSE[0], T_COLLAPSE[1], t);
        const openness = clamp01(out - back);
        sheets.forEach((g, i) => {
          g.position.z = (mid - i) * (SHEET_T + SHEET_GAP * openness);
        });

        // The cross-fade starts AT the handoff, never before it. Centring it on
        // HANDOFF overlapped the collapse: the board was 22% in while the stack
        // was still 10 mm too fat, so "it became the board's thickness" and "it
        // traded places with the board" happened at once and neither read.
        const width = fadeHalf.current * 2;
        const u = smooth(HANDOFF, HANDOFF + width, t);
        // Loop-back: the board becomes the closed stack again so the page can
        // loop. NOT part of the film.
        const rewind = smooth(T_RETURN[0], T_RETURN[1], t);
        let boardA = clamp01(u - rewind);
        let stackA = 1 - boardA;
        if (solo.current === "stack") { stackA = 1; boardA = 0; }
        if (solo.current === "board") { stackA = 0; boardA = 1; }

        stackPivot.visible = stackA > 0.002;
        boardPivot.visible = boardA > 0.002;
        setOpacity(stackMats, stackA);
        setOpacity(boardMats, boardA);

        ghost.visible = showGhost.current && t > T_COLLAPSE[0] - 0.4 && t < HANDOFF + width + 0.3;

        // Live numbers. The thickness pair is the spec, made checkable.
        const stackMm = kZ * (SHEETS.length * SHEET_T + (SHEETS.length - 1) * SHEET_GAP * openness);
        const norm = ((deg % 180) + 180) % 180;
        const off = Math.min(Math.abs(norm - 90), 180 - Math.abs(norm - 90));
        let beat = "BUILD";
        if (t < T_EXPLODE_OUT[1]) beat = "EXPLODE";
        else if (t < T_HOLD[1]) beat = "DESIGN / hold";
        else if (t < T_COLLAPSE[1]) beat = "COLLAPSE";
        else if (t < HANDOFF) beat = "MATCHED / hold";
        else if (t < HANDOFF + width) beat = "CROSSFADE";
        else if (t > T_RETURN[0]) beat = "loop-back only";
        if (hudRef.current) {
          hudRef.current.textContent =
            `t ${t.toFixed(2)}s · ${beat} · spin ${deg.toFixed(1)}° · ` +
            `rate ${rate.toFixed(1)}°/s · ${off.toFixed(0)}° off edge · ` +
            `stack ${(boardA > 0.5 ? 0 : 100 * stackA).toFixed(0)}% / board ${(100 * boardA).toFixed(0)}%`;
        }
        if (specRef.current) {
          specRef.current.textContent =
            `stack thickness ${stackMm.toFixed(2)} mm  ·  board thickness ${boardThickMm.toFixed(2)} mm  ·  ` +
            `${Math.abs(stackMm - boardThickMm) < 0.01 ? "MATCHED" : `${(stackMm - boardThickMm).toFixed(2)} mm apart`}`;
        }
        if (scrubRef.current && document.activeElement !== scrubRef.current) {
          scrubRef.current.value = String(t);
        }
        return rate;
      };

      // SELF-TUNING SAMPLE BUDGET. Ten sub-samples at full size previewed the
      // whip at 19 fps; shrinking them to 40% only reached 38, which says the
      // cost is per-sub-sample CPU and draw calls, not fill rate. Chasing it
      // with resolution is the wrong lever, and hand-tuning a constant against
      // one machine tunes against that machine. So measure what a sub-sample
      // actually costs here and buy as many as this frame can afford. Fast
      // hardware gets the full shutter; slow hardware degrades the blur instead
      // of dropping frames, which is the right way round when the whole point
      // is judging motion.
      const TARGET_MS = 13; // leaves headroom inside a 16.7 ms frame
      let msPerSample = 1;

      /** One output frame at `t`, blurred across a 180-degree shutter. */
      const drawFrame = (t: number, frameDt: number) => {
        const t0 = performance.now();
        const rate = spinAt(profile.current, t).rate;
        // 180-degree shutter: the exposure is half the frame interval, the
        // film-standard default and the one that reads as motion rather than
        // as a smear.
        const shutter = frameDt * 0.5;
        const swept = Math.abs(rate) * shutter;
        const want = blur.current ? Math.min(16, Math.max(1, Math.ceil(swept / 0.6))) : 1;
        // No budget offline. The cap exists so an interactive preview does not
        // stutter; a render has no frame deadline and must not inherit a
        // preview's compromise.
        const affordable = capture
          ? want
          : Math.max(1, Math.floor(TARGET_MS / Math.max(msPerSample, 0.05)));
        const n = Math.min(want, affordable);

        if (n === 1) {
          renderer.setRenderTarget(null);
          renderer.clear();
          applyAt(t);
          renderer.render(scene, camera);
          msPerSample = msPerSample * 0.85 + (performance.now() - t0) * 0.15;
          if (samplesRef.current) samplesRef.current.textContent = shutterLine(1, want, swept);
          return;
        }

        renderer.setRenderTarget(accumRT);
        renderer.clear();
        addMat.uniforms.wgt.value = 1 / n;
        for (let i = 0; i < n; i += 1) {
          // Sub-sample centres, so the exposure is centred on t rather than
          // lagging or leading it.
          const ts = t - shutter / 2 + ((i + 0.5) / n) * shutter;
          applyAt(((ts % SECONDS) + SECONDS) % SECONDS);
          renderer.setRenderTarget(frameRT);
          renderer.clear();
          renderer.render(scene, camera);
          addMat.uniforms.tFrame.value = frameRT.texture;
          renderer.setRenderTarget(accumRT);
          renderer.render(addScene, quadCam);
        }
        // Leave the pose on the frame's own instant so the readouts describe the
        // frame, not its last sub-sample.
        applyAt(t);
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(copyScene, quadCam);
        msPerSample = msPerSample * 0.85 + ((performance.now() - t0) / n) * 0.15;
        if (samplesRef.current) samplesRef.current.textContent = shutterLine(n, want, swept);
      };

      // The readout says when the budget CUT the shutter. A cap that silently
      // reduces quality reads as "this is what it looks like" when it is not.
      const shutterLine = (n: number, want: number, swept: number) =>
        `shutter ${swept.toFixed(1)}° swept · ${n} sub-sample${n === 1 ? "" : "s"}` +
        (n < want ? ` (budget cut from ${want}, ${msPerSample.toFixed(1)} ms each)` : "") +
        (blur.current ? "" : " · BLUR OFF");

      if (capture) {
        (window as unknown as Record<string, unknown>).__handoffAngle = (id: string) => {
          angle.current = id;
        };
        (window as unknown as Record<string, unknown>).__handoffSet = (t: number) =>
          drawFrame(t, 1 / 30);
        drawFrame(0, 1 / 30);
        (window as unknown as Record<string, unknown>).__handoffReady = true;
        setReady(true);
        cleanup = () => {
          delete (window as unknown as Record<string, unknown>).__handoffSet;
          delete (window as unknown as Record<string, unknown>).__handoffAngle;
          delete (window as unknown as Record<string, unknown>).__handoffReady;
          frameRT.dispose();
          accumRT.dispose();
          quadGeo.dispose();
          addMat.dispose();
          copyMat.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
        return;
      }

      let raf = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (playing.current) tRef.current = (tRef.current + dt * speed.current) % SECONDS;
        // Blur is scaled by the CLIP's frame interval, not the browser's. At 0.25x
        // the preview must still show the blur the 30 fps render will have, or
        // slow motion would quietly show a sharper image than the deliverable.
        drawFrame(tRef.current, (1 / 30) * speed.current);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        frameRT.dispose();
        accumRT.dispose();
        quadGeo.dispose();
        addMat.dispose();
        copyMat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [w, h, glb, blurScale, capture]);

  const step = (d: number) => {
    playing.current = false;
    tRef.current = Math.min(Math.max(tRef.current + d, 0), SECONDS);
    setUi((s) => ({ ...s, playing: false }));
  };

  const btn =
    "rounded border border-command-gold/70 bg-transparent px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";
  const btnOn =
    "rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-[10px] " +
    "uppercase tracking-[0.18em] text-deep-space";

  if (capture) {
    return <div ref={mountRef} data-rig="handoff" style={{ width: w, height: h }} />;
  }

  return (
    <div>
      <div ref={mountRef} data-rig="handoff" style={{ width: w, height: h }} />

      <input
        ref={scrubRef}
        type="range"
        min={0}
        max={SECONDS}
        step={1 / 120}
        defaultValue={0}
        aria-label="Scrub the handoff"
        data-scrub
        className="mt-3 w-full accent-command-gold"
        onInput={(e) => {
          playing.current = false;
          tRef.current = Number((e.target as HTMLInputElement).value);
          setUi((s) => ({ ...s, playing: false }));
        }}
      />

      <div ref={hudRef} data-hud className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3" />
      <div ref={specRef} data-spec className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-signal-blue" />
      <div ref={samplesRef} data-samples className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={ui.playing ? btnOn : btn}
          onClick={() => {
            playing.current = !playing.current;
            setUi((s) => ({ ...s, playing: playing.current }));
          }}
        >
          {ui.playing ? "Pause" : "Play"}
        </button>
        <button type="button" className={btn} onClick={() => step(-1 / 30)}>
          &lt; frame
        </button>
        <button type="button" className={btn} onClick={() => step(1 / 30)}>
          frame &gt;
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            playing.current = false;
            tRef.current = HANDOFF;
            setUi((s) => ({ ...s, playing: false }));
          }}
        >
          Jump to handoff
        </button>

        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Speed</span>
        {[1, 0.5, 0.25].map((s) => (
          <button
            key={s}
            type="button"
            className={ui.speed === s ? btnOn : btn}
            onClick={() => {
              speed.current = s;
              setUi((v) => ({ ...v, speed: s }));
            }}
          >
            {s}x
          </button>
        ))}

        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Fade</span>
        {[0.08, 0.25, 0.5].map((f) => (
          <button
            key={f}
            type="button"
            className={ui.fade === f ? btnOn : btn}
            onClick={() => {
              fadeHalf.current = f;
              setUi((v) => ({ ...v, fade: f }));
            }}
          >
            {(f * 2000).toFixed(0)} ms
          </button>
        ))}

        <button
          type="button"
          className={ui.ghost ? btnOn : btn}
          onClick={() => {
            showGhost.current = !showGhost.current;
            setUi((v) => ({ ...v, ghost: showGhost.current }));
          }}
        >
          Thickness ghost
        </button>

        <button
          type="button"
          data-blur
          className={ui.blur ? btnOn : btn}
          onClick={() => {
            blur.current = !blur.current;
            setUi((v) => ({ ...v, blur: blur.current }));
          }}
        >
          Motion blur
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Spin</span>
        {(Object.keys(PROFILE_LABELS) as SpinProfile[]).map((p) => (
          <button
            key={p}
            type="button"
            data-profile={p}
            title={PROFILE_NOTES[p]}
            className={ui.profile === p ? btnOn : btn}
            onClick={() => {
              profile.current = p;
              setUi((v) => ({ ...v, profile: p }));
            }}
          >
            {PROFILE_LABELS[p]}
          </button>
        ))}
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
          {PROFILE_NOTES[ui.profile]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Angle</span>
        {ANGLES.map((a) => (
          <button
            key={a.id}
            type="button"
            data-angle={a.id}
            title={a.note}
            className={ui.angle === a.id ? btnOn : btn}
            onClick={() => {
              angle.current = a.id;
              setUi((v) => ({ ...v, angle: a.id }));
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className="mt-2 font-serif text-sm text-muted">
        {ANGLES.find((a) => a.id === ui.angle)?.note}
      </p>

      {!ready ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Building the scene…</p>
      ) : null}
    </div>
  );
}
