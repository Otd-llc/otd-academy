// webcodecs-encode.js — shared H.264 / MP4 encode setup.
//
// Mirrors the proven config from record-worker.js (codec probe order,
// hardwareAcceleration, avc:{format:"avc"}, mp4-muxer in-memory + offset). Usable from
// either a Web Worker (importScripts) or the renderer (a <script> tag) — it only touches
// globals (VideoEncoder, VideoFrame, Mp4Muxer), no DOM. The editor's WYSIWYG export uses
// it to encode canvas-composited frames; the recorder could adopt it later too.
//
// Exposes one global: `createMp4Encoder({ width, height, fps, bitrate? })` → Promise of
//   { codec, encode(frame, keyFrame), frameCount(), finalize() → ArrayBuffer }.
/* global VideoEncoder, Mp4Muxer */
(function (g) {
  "use strict";

  async function pickCodec(width, height, fps, bitrate) {
    const profiles = ["avc1.4D4028", "avc1.42E01E", "avc1.640028"];
    for (const codec of profiles) {
      for (const accel of ["prefer-hardware", "no-preference"]) {
        try {
          const res = await VideoEncoder.isConfigSupported({
            codec,
            width,
            height,
            bitrate,
            framerate: fps,
            hardwareAcceleration: accel,
            avc: { format: "avc" },
          });
          if (res && res.supported) return { codec, accel };
        } catch (e) {
          // keep probing
        }
      }
    }
    return null;
  }

  async function createMp4Encoder(opts) {
    const width = opts.width;
    const height = opts.height;
    const fps = opts.fps || 60;
    if (typeof VideoEncoder === "undefined" || typeof g.Mp4Muxer === "undefined") {
      throw new Error("WebCodecs / mp4-muxer unavailable");
    }
    // ~0.09 bits/pixel/frame, clamped — solid quality for screen content.
    const bitrate =
      opts.bitrate || Math.min(24e6, Math.max(4e6, Math.round(width * height * fps * 0.09)));

    const pick = await pickCodec(width, height, fps, bitrate);
    if (!pick) throw new Error("No supported H.264 encoder configuration");

    let error = null;
    const muxer = new g.Mp4Muxer.Muxer({
      target: new g.Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width, height },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
    const encoder = new VideoEncoder({
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
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: pick.accel,
      avc: { format: "avc" },
    });

    let n = 0;
    return {
      codec: `${pick.codec} [${pick.accel}]`,
      async encode(frame, keyFrame) {
        if (error) throw error;
        // backpressure — don't let the encode queue balloon memory
        while (encoder.encodeQueueSize > 8) {
          await new Promise((r) => setTimeout(r, 0));
          if (error) throw error;
        }
        encoder.encode(frame, { keyFrame: !!keyFrame });
        n++;
      },
      frameCount: () => n,
      async finalize() {
        if (error) throw error;
        await encoder.flush();
        encoder.close();
        muxer.finalize();
        if (error) throw error;
        return muxer.target.buffer;
      },
    };
  }

  g.createMp4Encoder = createMp4Encoder;
})(typeof self !== "undefined" ? self : this);
