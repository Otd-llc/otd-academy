// OTD Capture — WebCodecs recording sink.
//
// Replaces the <video> -> canvas.drawImage -> canvas.captureStream -> MediaRecorder
// path, which forced a GPU->CPU->GPU texture readback on EVERY frame (the real
// bottleneck on a laptop iGPU). Here the frames stay on the GPU: the caller pulls
// VideoFrames straight off the capture track (MediaStreamTrackProcessor), crops them
// zero-copy via `new VideoFrame(src, { visibleRect })`, and hands them to a hardware
// VideoEncoder. We mux the encoded H.264 chunks to MP4 with mp4-muxer, preserving
// each frame's real timestamp so the clip duration matches wall-clock.
//
// Defines window.WebCodecsSink. If the platform can't do it (no WebCodecs, or no
// supported H.264 encoder config), .supported()/.init() report false and the caller
// falls back to the old MediaRecorder pipeline — recording never breaks outright.
(function () {
  "use strict";

  class WebCodecsSink {
    static supported() {
      return (
        typeof MediaStreamTrackProcessor !== "undefined" &&
        typeof VideoEncoder !== "undefined" &&
        typeof VideoFrame !== "undefined" &&
        typeof window.Mp4Muxer !== "undefined"
      );
    }

    constructor() {
      this.encoder = null;
      this.muxer = null;
      this.error = null; // first encoder/muxer error; surfaced on finish()
      this.frames = 0;
      this.codec = "";
    }

    // w,h MUST be even. Probes encoder configs (HW first), returns true on success.
    async init(w, h, bitrate, fps) {
      const profiles = ["avc1.4D4028", "avc1.42E01E", "avc1.640028"]; // Main, Baseline, High
      let pick = null;
      for (const codec of profiles) {
        for (const accel of ["prefer-hardware", "no-preference"]) {
          const cfg = {
            codec,
            width: w,
            height: h,
            bitrate,
            framerate: fps,
            hardwareAcceleration: accel,
            avc: { format: "avc" }, // AVCC (length-prefixed) — what mp4-muxer wants
          };
          try {
            const res = await VideoEncoder.isConfigSupported(cfg);
            if (res && res.supported) {
              pick = { codec, accel };
              break;
            }
          } catch {
            // keep probing
          }
        }
        if (pick) break;
      }
      if (!pick) return false;

      this.codec = `${pick.codec} [${pick.accel}]`;
      try {
        this.muxer = new window.Mp4Muxer.Muxer({
          target: new window.Mp4Muxer.ArrayBufferTarget(),
          video: { codec: "avc", width: w, height: h },
          fastStart: "in-memory",
          firstTimestampBehavior: "offset", // normalize so the timeline starts at 0
        });
        this.encoder = new VideoEncoder({
          output: (chunk, meta) => {
            try {
              this.muxer.addVideoChunk(chunk, meta);
            } catch (e) {
              this.error = this.error || e;
            }
          },
          error: (e) => {
            this.error = this.error || e;
          },
        });
        this.encoder.configure({
          codec: pick.codec,
          width: w,
          height: h,
          bitrate,
          framerate: fps,
          hardwareAcceleration: pick.accel,
          avc: { format: "avc" },
        });
      } catch {
        return false;
      }
      return true;
    }

    // Encode one already-cropped VideoFrame. Caller owns closing the frame.
    encode(frame, keyFrame) {
      if (this.error || !this.encoder) return;
      // Backpressure guard: if the encoder is >1s behind, drop NON-key frames so
      // latency can't run away. Dropping is safe for a VFR timeline (the next
      // frame just carries a later timestamp); never drop a keyframe.
      if (!keyFrame && this.encoder.encodeQueueSize > 30) return;
      try {
        this.encoder.encode(frame, { keyFrame });
        this.frames++;
      } catch (e) {
        this.error = this.error || e;
      }
    }

    async finish() {
      if (this.error) throw this.error;
      await this.encoder.flush();
      this.encoder.close();
      this.muxer.finalize();
      const buf = this.muxer.target.buffer;
      return { blob: new Blob([buf], { type: "video/mp4" }), ext: "mp4" };
    }
  }

  window.WebCodecsSink = WebCodecsSink;
})();
