// OTD stream recorder (plain-JS port of the academy's record-stream.ts; same
// codec chain + Chrome MediaRecorder duration fixes — MP4 mdhd timescale, WebM
// Duration/EBML tags). Defines window.StreamRecorder for the overlay renderer.
(function () {
  "use strict";

  const CODECS = [
    { mime: "video/mp4;codecs=avc1.640028", mp4: true },
    { mime: "video/mp4;codecs=avc1.42E01E", mp4: true },
    { mime: "video/mp4;codecs=avc1", mp4: true },
    { mime: "video/mp4", mp4: true },
    { mime: "video/webm;codecs=vp9", mp4: false },
    { mime: "video/webm;codecs=vp8", mp4: false },
    { mime: "video/webm", mp4: false },
  ];

  function pickCodec() {
    if (typeof MediaRecorder === "undefined") return null;
    for (const c of CODECS) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return null;
  }

  function encodeVINT(value) {
    if (value < 0x80) return [0x80 | value];
    if (value < 0x4000) return [0x40 | (value >> 8), value & 0xff];
    if (value < 0x200000)
      return [0x20 | (value >> 16), (value >> 8) & 0xff, value & 0xff];
    return [
      0x10 | (value >> 24),
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff,
    ];
  }
  function ebml(id, data) {
    const size = encodeVINT(data.length);
    const out = new Uint8Array(id.length + size.length + data.length);
    out.set(id, 0);
    out.set(size, id.length);
    out.set(data, id.length + size.length);
    return out;
  }
  function ebmlString(id, str) {
    return ebml(id, new TextEncoder().encode(str));
  }
  function simpleTag(name, value) {
    const tagName = ebmlString([0x45, 0xa3], name);
    const tagStr = ebmlString([0x44, 0x87], value);
    const body = new Uint8Array(tagName.length + tagStr.length);
    body.set(tagName, 0);
    body.set(tagStr, tagName.length);
    return ebml([0x67, 0xc8], body);
  }
  function buildTagsElement() {
    const targets = ebml([0x63, 0xc0], new Uint8Array(0));
    const title = simpleTag("TITLE", "One Thousand Drones Academy");
    const url = simpleTag("URL", "https://academy.onethousanddrones.com");
    const tagBody = new Uint8Array(targets.length + title.length + url.length);
    tagBody.set(targets, 0);
    tagBody.set(title, targets.length);
    tagBody.set(url, targets.length + title.length);
    const tag = ebml([0x73, 0x73], tagBody);
    return ebml([0x12, 0x54, 0xc3, 0x67], tag);
  }
  function readVINT(data, pos) {
    const first = data[pos];
    if (first & 0x80) {
      const v = first & 0x7f;
      return { value: v === 0x7f ? -1 : v, length: 1 };
    }
    if (first & 0x40) {
      const v = ((first & 0x3f) << 8) | data[pos + 1];
      return { value: v === 0x3fff ? -1 : v, length: 2 };
    }
    if (first & 0x20) {
      const v = ((first & 0x1f) << 16) | (data[pos + 1] << 8) | data[pos + 2];
      return { value: v === 0x1fffff ? -1 : v, length: 3 };
    }
    if (first & 0x10) {
      const v =
        ((first & 0x0f) << 24) |
        (data[pos + 1] << 16) |
        (data[pos + 2] << 8) |
        data[pos + 3];
      return { value: v === 0x0fffffff ? -1 : v, length: 4 };
    }
    return { value: -1, length: 1 };
  }
  function injectDuration(data, durationMs) {
    let infoPos = -1;
    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0x15 && data[i + 1] === 0x49 && data[i + 2] === 0xa9 && data[i + 3] === 0x66) {
        infoPos = i;
        break;
      }
    }
    if (infoPos === -1) return data;
    const sizeInfo = readVINT(data, infoPos + 4);
    if (sizeInfo.value < 0) return data;
    const contentStart = infoPos + 4 + sizeInfo.length;
    const contentEnd = contentStart + sizeInfo.value;
    const durElement = new Uint8Array(11);
    durElement[0] = 0x44;
    durElement[1] = 0x89;
    durElement[2] = 0x88;
    new DataView(durElement.buffer, 3, 8).setFloat64(0, durationMs);
    const oldContent = data.subarray(contentStart, contentEnd);
    const newContentLen = sizeInfo.value + durElement.length;
    const newSizeVint = encodeVINT(newContentLen);
    const newInfo = new Uint8Array(4 + newSizeVint.length + newContentLen);
    newInfo[0] = 0x15;
    newInfo[1] = 0x49;
    newInfo[2] = 0xa9;
    newInfo[3] = 0x66;
    newInfo.set(newSizeVint, 4);
    newInfo.set(oldContent, 4 + newSizeVint.length);
    newInfo.set(durElement, 4 + newSizeVint.length + oldContent.length);
    const oldInfoLen = 4 + sizeInfo.length + sizeInfo.value;
    const result = new Uint8Array(data.length - oldInfoLen + newInfo.length);
    result.set(data.subarray(0, infoPos), 0);
    result.set(newInfo, infoPos);
    result.set(data.subarray(infoPos + oldInfoLen), infoPos + newInfo.length);
    return result;
  }
  async function injectWebmMetadata(blob, durationMs) {
    let data = new Uint8Array(await blob.arrayBuffer());
    data = injectDuration(data, durationMs);
    const tags = buildTagsElement();
    let pos = -1;
    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0x1f && data[i + 1] === 0x43 && data[i + 2] === 0xb6 && data[i + 3] === 0x75) {
        pos = i;
        break;
      }
    }
    if (pos === -1) return new Blob([data], { type: "video/webm" });
    const result = new Uint8Array(data.length + tags.length);
    result.set(data.subarray(0, pos), 0);
    result.set(tags, pos);
    result.set(data.subarray(pos), pos + tags.length);
    return new Blob([result], { type: "video/webm" });
  }
  async function fixMp4Duration(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let moovOff = -1;
    let moovSize = 0;
    let off = 0;
    while (off + 8 <= buf.length) {
      const sz = dv.getUint32(off);
      if (sz < 8) break;
      const tag = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
      if (tag === "moov") {
        moovOff = off;
        moovSize = sz;
        break;
      }
      off += sz;
    }
    if (moovOff < 0) return blob;
    let trueDurationSec = 0;
    let c = moovOff + 8;
    while (c + 8 <= moovOff + moovSize) {
      const csz = dv.getUint32(c);
      if (csz < 8) break;
      const ctype = String.fromCharCode(buf[c + 4], buf[c + 5], buf[c + 6], buf[c + 7]);
      if (ctype === "mvhd") {
        const ver = buf[c + 8];
        if (ver === 0) trueDurationSec = dv.getUint32(c + 24) / dv.getUint32(c + 20);
        else {
          const tsHi = dv.getUint32(c + 28);
          const durHi = dv.getUint32(c + 32);
          const durLo = dv.getUint32(c + 36);
          trueDurationSec = (durHi * 0x100000000 + durLo) / tsHi;
        }
      }
      c += csz;
    }
    if (trueDurationSec <= 0) return blob;
    let fixed = false;
    for (let i = moovOff; i + 8 <= moovOff + moovSize; i++) {
      if (buf[i + 4] === 0x6d && buf[i + 5] === 0x64 && buf[i + 6] === 0x68 && buf[i + 7] === 0x64) {
        const mdhdVer = buf[i + 8];
        if (mdhdVer === 0) {
          const mdTs = dv.getUint32(i + 20);
          dv.setUint32(i + 24, Math.round(trueDurationSec * mdTs));
          fixed = true;
        } else {
          const mdTs1 = dv.getUint32(i + 28);
          const correct = Math.round(trueDurationSec * mdTs1);
          dv.setUint32(i + 32, Math.floor(correct / 0x100000000));
          dv.setUint32(i + 36, correct >>> 0);
          fixed = true;
        }
      }
    }
    return fixed ? new Blob([buf], { type: "video/mp4" }) : blob;
  }

  class StreamRecorder {
    constructor(stream) {
      this.stream = stream;
      this.rec = null;
      this.chunks = [];
      this.startMs = 0;
      this.mp4 = false;
      this.settle = null;
    }
    start() {
      const codec = pickCodec();
      if (!codec) throw new Error("No supported recording codec in this browser.");
      this.mp4 = codec.mp4;
      this.chunks = [];
      const bitrate = 12000000;
      this.rec = new MediaRecorder(this.stream, {
        mimeType: codec.mime,
        videoBitsPerSecond: bitrate,
      });
      this.rec.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.rec.onstop = () => this._finish();
      this.rec.onerror = () => this.settle && this.settle.reject(new Error("Recording failed."));
      this.startMs = performance.now();
      this.rec.start(this.mp4 ? undefined : 100);
    }
    get recording() {
      return this.rec && this.rec.state === "recording";
    }
    stop() {
      return new Promise((resolve, reject) => {
        this.settle = { resolve, reject };
        if (this.rec && this.rec.state === "recording") this.rec.stop();
        else reject(new Error("Not recording."));
      });
    }
    async _finish() {
      const durationMs = performance.now() - this.startMs;
      try {
        if (this.mp4) {
          const raw = new Blob(this.chunks, { type: "video/mp4" });
          this.settle.resolve({ blob: await fixMp4Duration(raw), ext: "mp4" });
        } else {
          const raw = new Blob(this.chunks, { type: "video/webm" });
          this.settle.resolve({ blob: await injectWebmMetadata(raw, durationMs), ext: "webm" });
        }
      } catch (e) {
        this.settle.reject(e instanceof Error ? e : new Error("Encode failed."));
      }
    }
  }

  window.StreamRecorder = StreamRecorder;
})();
