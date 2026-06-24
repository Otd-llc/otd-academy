// OTD Capture — recording worker.
//
// Runs the ENTIRE capture→crop→encode→mux pipeline off the renderer's main thread,
// so the per-frame VideoFrame allocation + V8 GC can't hitch the UI / the encode
// cadence (the residual stutter after the event-driven CFR fix). The renderer
// transfers the capture ReadableStream in and streams the follow-camera position
// (CSS px) over; this worker does all the pixel math, encodes via NVENC, and muxes
// to MP4 with mp4-muxer, posting the finished bytes back on stop.
//
// Protocol (renderer → worker):
//   { type:"start", readable, innerW, innerH, boxW, boxH, fps, bitrate, camX, camY }
//   { type:"cam", x, y }     // latest follow-camera frame-centre, CSS px
//   { type:"stop" }
// (worker → renderer): "ready" | "started" | "done"(buffer) | "error"(message) | "fallback"
/* global importScripts, Mp4Muxer, VideoEncoder, VideoFrame */

let loaded = false;
try {
  importScripts("node_modules/mp4-muxer/build/mp4-muxer.js"); // exposes Mp4Muxer
  loaded = typeof Mp4Muxer !== "undefined" && typeof VideoEncoder !== "undefined";
} catch (e) {
  loaded = false;
}

let encoder = null;
let muxer = null;
let error = null;
let running = false;
let frameIndex = 0;
let expectedTs = null;
let lastCropped = null;
let camX = 0;
let camY = 0;
let cursorX = 0; // latest pointer position (CSS px), streamed with the cam updates
let cursorY = 0;
let cursorTrack = []; // [{ t (sec from frame 0), nx, ny }] — frame-accurate cursor telemetry
let firstTs = null;
let boxW = 0;
let boxH = 0;
let fps = 60;
let cropW = 0;
let cropH = 0;
let codedW = 0;
let codedH = 0;
let sxScale = 1;
let syScale = 1;

const evenClamp = (v, max) => {
  v = Math.max(2, v - (v % 2));
  return Math.min(v, max - (max % 2));
};
const intervalUs = () => Math.round(1000000 / fps);

async function pickCodec(bitrate) {
  const profiles = ["avc1.4D4028", "avc1.42E01E", "avc1.640028"];
  for (const codec of profiles) {
    for (const accel of ["prefer-hardware", "no-preference"]) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec,
          width: cropW,
          height: cropH,
          bitrate,
          framerate: fps,
          hardwareAcceleration: accel,
          avc: { format: "avc" },
        });
        if (res && res.supported) return { codec, accel };
      } catch {
        // keep probing
      }
    }
  }
  return null;
}

function cropEncode(srcFrame, tsUs) {
  let ox = Math.round((camX - boxW / 2) * sxScale);
  let oy = Math.round((camY - boxH / 2) * syScale);
  ox -= ox % 2;
  oy -= oy % 2;
  ox = Math.max(0, Math.min(ox, codedW - cropW));
  oy = Math.max(0, Math.min(oy, codedH - cropH));
  const cropped = new VideoFrame(srcFrame, {
    visibleRect: { x: ox, y: oy, width: cropW, height: cropH },
    timestamp: tsUs,
  });
  encoder.encode(cropped, frameIndex % (fps * 2) === 0);
  // Frame-accurate cursor telemetry: the pointer's position within THIS frame's crop,
  // stamped with the frame's own timestamp (offset to 0). No renderer/worker phase drift.
  if (firstTs === null) firstTs = tsUs;
  if (boxW > 0 && boxH > 0) {
    cursorTrack.push({
      t: (tsUs - firstTs) / 1e6,
      nx: (cursorX - camX + boxW / 2) / boxW,
      ny: (cursorY - camY + boxH / 2) / boxH,
    });
  }
  if (lastCropped) {
    try {
      lastCropped.close();
    } catch {
      // ignore
    }
  }
  lastCropped = cropped.clone();
  cropped.close();
  frameIndex++;
}

async function drive(firstFrame, reader) {
  let frame = firstFrame;
  while (running && frame) {
    if (error) {
      try {
        frame.close();
      } catch {
        // ignore
      }
      break;
    }
    if (expectedTs === null) expectedTs = frame.timestamp;
    let fill = 0;
    while (lastCropped && expectedTs < frame.timestamp - intervalUs() * 0.5 && fill < fps * 4) {
      try {
        const dup = new VideoFrame(lastCropped, { timestamp: Math.round(expectedTs) });
        encoder.encode(dup, frameIndex % (fps * 2) === 0);
        dup.close();
      } catch {
        // ignore a dropped duplicate
      }
      frameIndex++;
      expectedTs += intervalUs();
      fill++;
    }
    try {
      cropEncode(frame, Math.round(expectedTs));
    } catch (e) {
      error = error || e;
    }
    expectedTs += intervalUs();
    try {
      frame.close();
    } catch {
      // ignore
    }
    if (!running) break;
    let res;
    try {
      res = await reader.read();
    } catch {
      break;
    }
    if (res.done) break;
    frame = res.value;
  }
  if (lastCropped) {
    try {
      lastCropped.close();
    } catch {
      // ignore
    }
    lastCropped = null;
  }
}

async function start(m) {
  boxW = m.boxW;
  boxH = m.boxH;
  fps = m.fps || 60;
  camX = m.camX;
  camY = m.camY;
  cursorX = m.camX;
  cursorY = m.camY;
  cursorTrack = [];
  firstTs = null;
  const bitrate = m.bitrate || 8000000;
  const reader = m.readable.getReader();
  const firstRead = await reader.read();
  if (firstRead.done || !firstRead.value) {
    self.postMessage({ type: "fallback" });
    return;
  }
  const f0 = firstRead.value;
  codedW = f0.codedWidth;
  codedH = f0.codedHeight;
  sxScale = codedW / m.innerW;
  syScale = codedH / m.innerH;
  cropW = evenClamp(Math.round(boxW * sxScale), codedW);
  cropH = evenClamp(Math.round(boxH * syScale), codedH);

  const pick = await pickCodec(bitrate);
  if (!pick) {
    try {
      f0.close();
    } catch {
      // ignore
    }
    self.postMessage({ type: "fallback" });
    return;
  }
  try {
    muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: cropW, height: cropH },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          muxer.addVideoChunk(chunk, meta);
        } catch (e) {
          error = error || e;
        }
      },
      error: (e) => {
        error = error || e;
      },
    });
    encoder.configure({
      codec: pick.codec,
      width: cropW,
      height: cropH,
      bitrate,
      framerate: fps,
      hardwareAcceleration: pick.accel,
      avc: { format: "avc" },
    });
  } catch (e) {
    try {
      f0.close();
    } catch {
      // ignore
    }
    self.postMessage({ type: "fallback" });
    return;
  }
  running = true;
  self.postMessage({ type: "started", codec: `${pick.codec} [${pick.accel}]`, cropW, cropH, codedW, codedH });
  drive(f0, reader);
}

async function stop() {
  running = false;
  try {
    if (error) throw error;
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    const buf = muxer.target.buffer;
    self.postMessage({ type: "done", buffer: buf, cursor: cursorTrack }, [buf]);
  } catch (e) {
    self.postMessage({ type: "error", message: e && e.message ? e.message : String(e) });
  }
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "start") {
    start(m).catch((err) =>
      self.postMessage({ type: "error", message: err && err.message ? err.message : String(err) }),
    );
  } else if (m.type === "cam") {
    camX = m.x;
    camY = m.y;
    if (typeof m.cx === "number") cursorX = m.cx;
    if (typeof m.cy === "number") cursorY = m.cy;
  } else if (m.type === "stop") {
    stop();
  }
};

// Announce load status so the renderer knows whether to use the worker or fall back.
self.postMessage({ type: loaded ? "ready" : "fallback" });
