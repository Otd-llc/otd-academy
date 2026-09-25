// Upload safety for scripts/upload-printables.ts (launch plan item 5.4).
//
// These drive the REAL script end to end -- argument parsing, the allow-list,
// planning, the HEAD preflight, the PUTs and the exit code -- against an
// in-memory fake bucket. NO R2 CALL OF ANY KIND is possible from here: the S3
// client class itself is replaced with one that throws on use, and the module's
// `r2` export is swapped for the fake. If either mock ever failed to apply, the
// run would fail loudly rather than dial Cloudflare.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import JSZip from "jszip";

const bucket = vi.hoisted(() => ({
  store: new Map<string, { body: Buffer; meta: Record<string, string> }>(),
  calls: [] as { op: "head" | "put"; key: string; input: Record<string, unknown> }[],
  headError: null as null | (Error & { $metadata?: { httpStatusCode?: number } }),
}));

vi.mock("@/env", () => ({
  env: { R2_ENABLED: true, R2_BUCKET: "test-bucket" },
}));

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const real = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  class NoNetworkS3Client {
    async send(): Promise<never> {
      throw new Error("a real S3Client was used in a test");
    }
  }
  return { ...real, S3Client: NoNetworkS3Client };
});

vi.mock("@/lib/r2", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/r2")>();
  const { HeadObjectCommand: Head, PutObjectCommand: Put } = await import(
    "@aws-sdk/client-s3"
  );
  return {
    ...real,
    r2: {
      async send(cmd: unknown) {
        if (cmd instanceof Head) {
          const key = cmd.input.Key!;
          bucket.calls.push({ op: "head", key, input: { ...cmd.input } });
          if (bucket.headError) throw bucket.headError;
          const obj = bucket.store.get(key);
          if (!obj) {
            throw Object.assign(new Error("NotFound"), {
              name: "NotFound",
              $metadata: { httpStatusCode: 404 },
            });
          }
          return { ContentLength: obj.body.length, Metadata: obj.meta };
        }
        if (cmd instanceof Put) {
          const input = cmd.input;
          bucket.calls.push({ op: "put", key: input.Key!, input: { ...input } });
          bucket.store.set(input.Key!, {
            body: Buffer.from(input.Body as Buffer),
            meta: { ...(input.Metadata ?? {}) },
          });
          return {};
        }
        throw new Error("unexpected command");
      },
    },
  };
});

const RELEASE = "2099-01-01";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

let dir: string;
let exitCodes: (number | string | null | undefined)[];
let errors: string[];
const savedArgv = process.argv;
const savedEnv = { ...process.env };

type Row = { path: string; part: string; licence?: string };

function writeFixture(opts: { rows?: Row[]; extraManifestFile?: boolean } = {}) {
  mkdirSync(join(dir, "3mf"), { recursive: true });
  mkdirSync(join(dir, "stl"), { recursive: true });
  const parts = ["hex-a", "hex-b"];
  for (const p of parts) {
    writeFileSync(join(dir, "3mf", `${p}.3mf`), `3mf bytes of ${p}`);
    writeFileSync(join(dir, "stl", `${p}.stl`), `stl bytes of ${p}`);
  }
  const files = (p: string) => ({
    "3mf": { path: `3mf/${p}.3mf`, bytes: 1, sha256: "x" },
    stl: { path: `stl/${p}.stl`, bytes: 1, sha256: "x" },
  });
  const manifestParts = parts.map((p) => ({
    part: p,
    family: "hex",
    triangles: 1,
    volumeMm3: 1,
    bboxMm: { x: 1, y: 1, z: 1 },
    borderEdges: 0,
    files: files(p),
  }));
  if (opts.extraManifestFile) {
    writeFileSync(join(dir, "3mf", "hex-c.3mf"), "3mf bytes of hex-c");
    manifestParts.push({
      ...manifestParts[0],
      part: "hex-c",
      files: { "3mf": { path: "3mf/hex-c.3mf", bytes: 1, sha256: "x" } } as never,
    });
  }
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ parts: manifestParts, failures: [] }),
  );
  const rows: Row[] =
    opts.rows ??
    parts.flatMap((p) => [
      { path: `3mf/${p}.3mf`, part: p, licence: "cc-by" },
      { path: `stl/${p}.stl`, part: p, licence: "cc-by" },
    ]);
  writeFileSync(
    join(dir, "allow.json"),
    JSON.stringify({
      format: "otd-printables-allowlist/1",
      release: RELEASE,
      files: rows,
    }),
  );
}

/** Runs the real script once with these CLI args; returns the exit code. */
async function run(...args: string[]): Promise<number> {
  process.argv = ["node", "upload-printables.ts", ...args];
  vi.resetModules();
  exitCodes = [];
  const mod = await import("../../../scripts/upload-printables");
  await mod.finished;
  return exitCodes.length === 0 ? 0 : Number(exitCodes[0]);
}

const puts = () => bucket.calls.filter((c) => c.op === "put");
const allow = () => `--allow-list=${join(dir, "allow.json")}`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "upload-printables-"));
  bucket.store.clear();
  bucket.calls.length = 0;
  bucket.headError = null;
  errors = [];
  process.env.PRINTABLES_DIR = dir;
  process.env.PRINTABLES_RELEASE = RELEASE;
  process.env.PRINTABLES_EMIT = "";
  process.env.PRINTABLES_ALLOWLIST = "";
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCodes.push(code);
  }) as never);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation((m: unknown) => {
    errors.push(String(m));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.argv = savedArgv;
  for (const k of [
    "PRINTABLES_DIR",
    "PRINTABLES_RELEASE",
    "PRINTABLES_EMIT",
    "PRINTABLES_ALLOWLIST",
  ]) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("upload-printables: write path", () => {
  it("PUTs every object with its sha256 metadata and Content-Disposition: attachment, never manifest.json", async () => {
    writeFixture();
    expect(await run(allow(), "--write")).toBe(0);

    const p = puts();
    // LICENSE + 2 parts x 2 formats + 1 set zip.
    expect(p.map((c) => c.key).sort()).toEqual(
      [
        `printables/${RELEASE}/LICENSE.txt`,
        `printables/${RELEASE}/3mf/hex-a.3mf`,
        `printables/${RELEASE}/3mf/hex-b.3mf`,
        `printables/${RELEASE}/stl/hex-a.stl`,
        `printables/${RELEASE}/stl/hex-b.stl`,
        `printables/${RELEASE}/sets/hex-cluster.zip`,
      ].sort(),
    );
    for (const c of p) {
      expect(String(c.input.ContentDisposition)).toMatch(/^attachment\b/);
      const body = c.input.Body as Buffer;
      expect((c.input.Metadata as Record<string, string>).sha256).toBe(sha(body));
      expect(c.key).not.toMatch(/manifest\.json$/i);
    }
    // The set zip opens and carries the listed files plus README + LICENSE.
    const zipPut = p.find((c) => c.key.endsWith("/sets/hex-cluster.zip"))!;
    const zip = await JSZip.loadAsync(zipPut.input.Body as Buffer);
    expect(Object.keys(zip.files).sort()).toEqual(
      [
        "3mf/hex-a.3mf",
        "3mf/hex-b.3mf",
        "LICENSE.txt",
        "README.txt",
        "stl/hex-a.stl",
        "stl/hex-b.stl",
      ].sort(),
    );
    expect(await zip.file("3mf/hex-a.3mf")!.async("string")).toBe(
      "3mf bytes of hex-a",
    );
    // Every PUT was preceded by a HEAD of the same key.
    const heads = bucket.calls.filter((c) => c.op === "head").map((c) => c.key);
    for (const c of p) expect(heads).toContain(c.key);
  });

  it("a rerun of identical bytes skips everything: zero PUTs (the zip is reproducible)", async () => {
    writeFixture();
    // Move the clock between runs. A zip entry's default timestamp is "now" at
    // 2-second DOS resolution, so two back-to-back runs would agree by accident.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      expect(await run(allow(), "--write")).toBe(0);
      bucket.calls.length = 0;
      vi.setSystemTime(new Date("2031-06-15T12:34:56Z"));
      expect(await run(allow(), "--write")).toBe(0);
    } finally {
      vi.useRealTimers();
    }
    expect(puts()).toHaveLength(0);
  });

  it("ONE changed byte against an existing key exits non-zero and writes nothing", async () => {
    writeFixture();
    expect(await run(allow(), "--write")).toBe(0);

    const f = join(dir, "stl", "hex-b.stl");
    const bytes = readFileSync(f);
    bytes[0] = bytes[0] ^ 1;
    writeFileSync(f, bytes);
    // Assert the mutation applied: same size, different hash.
    const published = bucket.store.get(`printables/${RELEASE}/stl/hex-b.stl`)!;
    expect(bytes.length).toBe(published.body.length);
    expect(sha(bytes)).not.toBe(published.meta.sha256);

    bucket.calls.length = 0;
    expect(await run(allow(), "--write")).toBe(1);
    expect(puts()).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/stl\/hex-b\.stl is already published/);
  });

  it("an existing key with NO stored sha256 is refused, not overwritten", async () => {
    writeFixture();
    bucket.store.set(`printables/${RELEASE}/3mf/hex-a.3mf`, {
      body: Buffer.from("3mf bytes of hex-a"),
      meta: {},
    });
    expect(await run(allow(), "--write")).toBe(1);
    expect(puts()).toHaveLength(0);
  });

  it("a HEAD auth error (403) is fatal: exits non-zero, zero PUTs", async () => {
    writeFixture();
    bucket.headError = Object.assign(new Error("Forbidden"), {
      name: "Forbidden",
      $metadata: { httpStatusCode: 403 },
    });
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls.some((c) => c.op === "head")).toBe(true);
    expect(puts()).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/status 403/);
  });
});

describe("upload-printables: allow-list", () => {
  it("a third-party row is refused, before any R2 call", async () => {
    writeFixture({
      rows: [
        { path: "3mf/hex-a.3mf", part: "hex-a", licence: "cc-by" },
        { path: "stl/hex-a.stl", part: "hex-a", licence: "cc-by" },
        { path: "3mf/hex-b.3mf", part: "hex-b", licence: "third-party" },
        { path: "stl/hex-b.stl", part: "hex-b", licence: "cc-by" },
      ],
    });
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/third-party/);
  });

  it("a row with no licence is refused", async () => {
    writeFixture({
      rows: [
        { path: "3mf/hex-a.3mf", part: "hex-a", licence: "cc-by" },
        { path: "stl/hex-a.stl", part: "hex-a" },
        { path: "3mf/hex-b.3mf", part: "hex-b", licence: "cc-by" },
        { path: "stl/hex-b.stl", part: "hex-b", licence: "cc-by" },
      ],
    });
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/no licence/);
  });

  it("an unlisted file is refused, before any R2 call", async () => {
    writeFixture({ extraManifestFile: true });
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/3mf\/hex-c\.3mf \(hex-c\): not on the allow-list/);
  });

  it("a manifest.json row is refused", async () => {
    writeFixture({
      rows: [
        { path: "3mf/hex-a.3mf", part: "hex-a", licence: "cc-by" },
        { path: "manifest.json", part: "hex-a", licence: "cc-by" },
      ],
    });
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/manifest\.json is never uploaded/);
  });

  it("an allow-list for another release is refused", async () => {
    writeFixture();
    process.env.PRINTABLES_RELEASE = "2099-02-02";
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
  });

  it("no allow-list at all is refused", async () => {
    writeFixture();
    expect(await run("--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
  });

  it("--force no longer exists: it is an error, not a silent no-op", async () => {
    writeFixture();
    expect(await run(allow(), "--write", "--force")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/--force was removed/);
  });
});

describe("upload-printables: dry run", () => {
  it("is the default and makes no R2 call at all (no PUT, not even a HEAD)", async () => {
    writeFixture();
    const emit = join(dir, "emit");
    process.env.PRINTABLES_EMIT = emit;
    expect(await run(allow())).toBe(0);
    expect(bucket.calls).toHaveLength(0);
    // It did plan the release: the emitted bytes are what --write would PUT.
    expect(readFileSync(join(emit, `printables/${RELEASE}/3mf/hex-a.3mf`), "utf8")).toBe(
      "3mf bytes of hex-a",
    );
  });

  it("still enforces the allow-list", async () => {
    writeFixture({ extraManifestFile: true });
    expect(await run(allow())).toBe(1);
    expect(bucket.calls).toHaveLength(0);
  });
});

// Keep the imported command classes referenced so the mock's instanceof checks
// are against the same classes the script constructs.
void HeadObjectCommand;
void PutObjectCommand;
