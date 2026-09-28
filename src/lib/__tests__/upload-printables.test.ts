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

// Owner wording (launch items 2.6 and 6.8). The owner approved the LICENSE
// disclaimer and the README safety text on 2026-09-28, so by default both
// modules run REAL and the release carries no placeholder. The refusal must
// still hold if a placeholder ever comes back, so each switch below turns ON a
// reintroduced `[OWNER-WORDING: ...]` marker in its file (a mutation of the real
// text), and the "owner wording" block proves `--write` refuses on it. The scan
// (`ownerWordingIn`) is always the real one.
const licence = vi.hoisted(() => ({ ownerSigned: true, readmeSigned: true }));
const README_MARK =
  "[OWNER-WORDING: safety and warranty text (launch readiness 2.6)]";
const LICENSE_MARK = "[OWNER-WORDING: disclaimer (reintroduced, test only)]";

vi.mock("@/lib/hex-readme-safety", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/hex-readme-safety")>();
  return {
    ...real,
    hexReadmeSafetyLines: () =>
      licence.readmeSigned
        ? real.hexReadmeSafetyLines()
        : ["Safety:", `  ${README_MARK}`],
  };
});

vi.mock("@/lib/hex-license-txt", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/hex-license-txt")>();
  return {
    ...real,
    hexLicenseTxt: (release: string) => {
      const txt = real.hexLicenseTxt(release);
      if (licence.ownerSigned) return txt;
      const out = txt.replace(/^These files are provided as is.*$/m, LICENSE_MARK);
      if (out === txt) throw new Error("test mutation matched nothing");
      return out;
    },
  };
});

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

function writeFixture(
  opts: {
    rows?: Row[];
    extraManifestFile?: boolean;
    step?: boolean;
    withheld?: unknown;
    reviewed?: boolean;
  } = {},
) {
  mkdirSync(join(dir, "3mf"), { recursive: true });
  mkdirSync(join(dir, "stl"), { recursive: true });
  mkdirSync(join(dir, "step"), { recursive: true });
  const parts = ["hex-a", "hex-b"];
  for (const p of parts) {
    writeFileSync(join(dir, "3mf", `${p}.3mf`), `3mf bytes of ${p}`);
    writeFileSync(join(dir, "stl", `${p}.stl`), `stl bytes of ${p}`);
    if (opts.step) {
      writeFileSync(join(dir, "step", `${p}.step`), `step bytes of ${p}`);
    }
  }
  const files = (p: string) => ({
    "3mf": { path: `3mf/${p}.3mf`, bytes: 1, sha256: "x" },
    stl: { path: `stl/${p}.stl`, bytes: 1, sha256: "x" },
    ...(opts.step
      ? { step: { path: `step/${p}.step`, bytes: 1, sha256: "x" } }
      : {}),
  });
  const manifestParts = parts.map((p) => ({
    part: p,
    family: "hex",
    triangles: 1,
    volumeMm3: 1,
    bboxMm: { x: 1, y: 1, z: 1 },
    borderEdges: 0,
    files: files(p),
    ...(opts.reviewed
      ? {
          printOrientation: [{ axis: "x", degrees: -90 }],
          printOrientationReviewed: true,
        }
      : {}),
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
      ...(opts.step
        ? [{ path: `step/${p}.step`, part: p, licence: "cc-by" }]
        : []),
    ]);
  writeFileSync(
    join(dir, "allow.json"),
    JSON.stringify({
      format: "otd-printables-allowlist/1",
      release: RELEASE,
      files: rows,
      ...(opts.withheld === undefined ? {} : { withheld: opts.withheld }),
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
  licence.ownerSigned = true;
  licence.readmeSigned = true;
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
    writeFixture({ step: true });
    expect(await run(allow(), "--write")).toBe(0);

    const p = puts();
    // LICENSE + 2 parts x 3 formats + 1 set zip. STL and STEP DO ship, as
    // per-part files; they just never go in the zip.
    expect(p.map((c) => c.key).sort()).toEqual(
      [
        `printables/${RELEASE}/LICENSE.txt`,
        `printables/${RELEASE}/3mf/hex-a.3mf`,
        `printables/${RELEASE}/3mf/hex-b.3mf`,
        `printables/${RELEASE}/stl/hex-a.stl`,
        `printables/${RELEASE}/stl/hex-b.stl`,
        `printables/${RELEASE}/step/hex-a.step`,
        `printables/${RELEASE}/step/hex-b.step`,
        `printables/${RELEASE}/sets/hex-cluster.zip`,
      ].sort(),
    );
    for (const c of p) {
      expect(String(c.input.ContentDisposition)).toMatch(/^attachment\b/);
      const body = c.input.Body as Buffer;
      expect((c.input.Metadata as Record<string, string>).sha256).toBe(sha(body));
      expect(c.key).not.toMatch(/manifest\.json$/i);
    }
    // The set zip is 3MF-ONLY (plan 1.3): the 3MFs plus README + LICENSE, and
    // not one .stl, .step or manifest.json, although all of them were on hand.
    const zipPut = p.find((c) => c.key.endsWith("/sets/hex-cluster.zip"))!;
    const zip = await JSZip.loadAsync(zipPut.input.Body as Buffer);
    const entries = Object.keys(zip.files);
    expect(
      entries.filter((n) => /\.(stl|step)$|manifest\.json$/i.test(n)),
    ).toEqual([]);
    expect(entries.sort()).toEqual(
      ["3mf/hex-a.3mf", "3mf/hex-b.3mf", "LICENSE.txt", "README.txt"].sort(),
    );
    expect(await zip.file("README.txt")!.async("string")).not.toMatch(
      /^\s*stl\//m,
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

describe("upload-printables: withheld parts (4.9 defect 1)", () => {
  const zipNames = async (emit: string) =>
    Object.keys(
      (
        await JSZip.loadAsync(
          readFileSync(join(emit, `printables/${RELEASE}/sets/hex-cluster.zip`)),
        )
      ).files,
    );

  it("a manifest part the allow-list withholds is skipped: never emitted, never in the zip", async () => {
    writeFixture({
      extraManifestFile: true,
      withheld: [{ part: "hex-c", reason: "1.6: withheld" }],
    });
    const emit = join(dir, "emit");
    process.env.PRINTABLES_EMIT = emit;
    expect(await run(allow())).toBe(0);
    expect(bucket.calls).toHaveLength(0);
    const tree = readFileSync(join(emit, `printables/${RELEASE}/3mf/hex-a.3mf`), "utf8");
    expect(tree).toBe("3mf bytes of hex-a");
    expect(() =>
      readFileSync(join(emit, `printables/${RELEASE}/3mf/hex-c.3mf`)),
    ).toThrow();
    const names = await zipNames(emit);
    expect(names).toContain("3mf/hex-a.3mf");
    expect(names.some((n) => /hex-c\./.test(n))).toBe(false);
    const readme = (
      await (
        await JSZip.loadAsync(
          readFileSync(join(emit, `printables/${RELEASE}/sets/hex-cluster.zip`)),
        )
      )
        .file("README.txt")!
        .async("string")
    );
    expect(readme).not.toMatch(/  - hex-c$/m);
  });

  it("a withheld part is skipped under --write too: PUTs only what is listed", async () => {
    writeFixture({
      extraManifestFile: true,
      withheld: [{ part: "hex-c", reason: "1.6: withheld" }],
    });
    expect(await run(allow(), "--write")).toBe(0);
    expect(puts().some((c) => /\/hex-c\./.test(c.key))).toBe(false);
    expect(puts().some((c) => c.key.includes("hex-a"))).toBe(true);
  });

  it("a manifest part neither listed nor withheld still refuses, even with a withheld list present", async () => {
    writeFixture({
      extraManifestFile: true,
      withheld: [{ part: "hex-other", reason: "1.6: withheld" }],
    });
    expect(await run(allow())).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/3mf\/hex-c\.3mf \(hex-c\): not on the allow-list/);
  });

  it("a part both listed and withheld refuses", async () => {
    writeFixture({ withheld: [{ part: "hex-b", reason: "1.6: withheld" }] });
    expect(await run(allow())).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/hex-b\): part is both listed in files and withheld/);
  });

  it("a withheld entry with no reason refuses", async () => {
    writeFixture({
      extraManifestFile: true,
      withheld: [{ part: "hex-c", reason: "  " }],
    });
    expect(await run(allow())).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join("\n")).toMatch(/withheld\[0\] \(hex-c\): no reason/);
  });

  it("a withheld field that is not an array refuses", async () => {
    writeFixture({ withheld: { part: "hex-c", reason: "x" } });
    expect(await run(allow())).toBe(1);
    expect(errors.join("\n")).toMatch(/withheld must be an array/);
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

describe("upload-printables: owner wording (6.8)", () => {
  it("--write refuses while LICENSE.txt carries an owner placeholder, before any R2 call", async () => {
    writeFixture();
    licence.ownerSigned = false;
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    const err = errors.join(" | ");
    expect(err).toMatch(/still carries owner placeholders/);
    expect(err).toMatch(/LICENSE\.txt: \[OWNER-WORDING: disclaimer \(reintroduced, test only\)\]/);
  });

  it("--write refuses while the README carries the 2.6 safety placeholder, before any R2 call", async () => {
    writeFixture();
    licence.readmeSigned = false;
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    const err = errors.join(" | ");
    expect(err).toMatch(/still carries owner placeholders/);
    expect(err).toMatch(/sets\/hex-cluster\.zip > README\.txt: \[OWNER-WORDING: safety and warranty text \(launch readiness 2\.6\)\]/);
  });

  it("--write refuses a placeholder in ANY uploaded file, not only the known ones", async () => {
    writeFixture({ step: true });
    writeFileSync(join(dir, "step", "hex-a.step"), "ISO-10303 [OWNER-WORDING: stray] END");
    expect(await run(allow(), "--write")).toBe(1);
    expect(bucket.calls).toHaveLength(0);
    expect(errors.join(" | ")).toMatch(/step\/hex-a\.step: \[OWNER-WORDING: stray\]/);
  });

  it("the dry-run README carries the approved safety text, the configurator host, and no dangling exception", async () => {
    writeFixture({ reviewed: true });
    const emit = join(dir, "emit");
    process.env.PRINTABLES_EMIT = emit;
    expect(await run(allow())).toBe(0);
    const zip = await JSZip.loadAsync(
      readFileSync(join(emit, `printables/${RELEASE}/sets/hex-cluster.zip`)),
    );
    const readme = await zip.file("README.txt")!.async("string");
    expect(readme).not.toMatch(/OWNER-WORDING/);
    expect(readme).toMatch(/^Safety:$/m);
    expect(readme).toMatch(/^  - Designed and tested for PETG only; other materials are untested\.$/m);
    expect(readme).toMatch(/PETG softens around 70 °C\./);
    expect(readme).toMatch(/NSF\/ANSI 61/);
    expect(readme).toMatch(/^  https:\/\/hex\.onethousanddrones\.com$/m);
    expect(readme).not.toMatch(/demo\.onethousanddrones\.com/);
    expect(readme).toMatch(/Every orientation has been checked/);
    expect(readme).not.toMatch(/exceptions? below|named below/);
    expect(readme).not.toMatch(/\u2014/);
  });

  it("a dry run still runs with a reintroduced placeholder, and emits it where it sits", async () => {
    writeFixture();
    licence.ownerSigned = false;
    const emit = join(dir, "emit");
    process.env.PRINTABLES_EMIT = emit;
    expect(await run(allow())).toBe(0);
    expect(bucket.calls).toHaveLength(0);
    expect(
      readFileSync(join(emit, `printables/${RELEASE}/LICENSE.txt`), "utf8"),
    ).toContain(LICENSE_MARK);
  });

  it("with the owner's approved texts in, --write passes the owner-wording guard", async () => {
    writeFixture();
    expect(await run(allow(), "--write")).toBe(0);
    expect(errors.join(" | ")).not.toMatch(/owner placeholders/);
    expect(puts().length).toBeGreaterThan(0);
  });
});

// Keep the imported command classes referenced so the mock's instanceof checks
// are against the same classes the script constructs.
void HeadObjectCommand;
void PutObjectCommand;
