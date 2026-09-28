// Saved hex-cluster builds: types, validation, and the label formatters.
//
// A PLAIN module, deliberately. src/lib/actions/hex-clusters.ts is
// "use server" and may export only async functions, so every type, schema and
// formatter lives here — re-exporting a type from a "use server" file compiles
// fine and crashes at runtime.
//
// The payload is STORED as an opaque token: never re-encoded or migrated, and
// written back to the configurator byte for byte. Since v2 (plan 6.3) it is
// also DECODED once on the way in, server-side, by `decodeV2State` in
// @/lib/hex-v2-state -- a bounded grammar check that refuses anything that is
// not a v2 build, not a second model of the scene. That module needs
// node:zlib, so it lives apart from this one, which is in the client graph.
//
// Design: docs/plans/2026-08-01-hex-cluster-saved-builds-design.md §§2.4, 4.1,
// 5.2, 6.

// ── Drawing and revision labels ──────────────────────────────────────────────

/** Environment-scoped prefix. Evaluated HERE, never in the configurator, which
 *  runs on Cloudflare and has no VERCEL_ENV — that is also why the return link
 *  carries `d=` as a formatted display string rather than an integer.
 *
 *  Reads `process.env` directly rather than `@/env`, unlike its sibling in
 *  abuse-policy.ts. THIS MODULE IS IN THE CLIENT GRAPH: EmbeddedSavePanel,
 *  HexClusterRow and SaveHexClusterForm all import `MAX_NAME_CHARS` from here.
 *  Importing `@/env` would pull the whole server schema toward the browser
 *  bundle, and t3-env throws on a server key accessed from the client — so a
 *  tree-shake that failed to drop this function would turn into a runtime error
 *  instead of the harmless `undefined` it resolves to today. Those components
 *  import only the constant and the type, never `formatDrawingLabel`, so this is
 *  never actually evaluated in a browser. */
function drawingPrefix(): string {
  return process.env.VERCEL_ENV === "production" ? "OTD-HEX" : "DEV-HEX";
}

export function formatDrawingLabel(drawingNo: number): string {
  return `${drawingPrefix()}-${drawingNo}`;
}

/** Drawing-office revision letters: A-Z skipping I, O, Q, S, X, Z, then AA, AB…
 *
 *  The skipped six are the ones that read as digits or as each other on a
 *  photocopied sheet. 20 single letters then 400 pairs is 420 labels, which
 *  covers the 100-revision cap four times over.
 *
 *  DERIVED from revNo and never stored, so a label cannot drift from its
 *  number. revNo 1 is "A". */
const REV_LETTERS = "ABCDEFGHJKLMNPRTUVWY"; // 20: no I O Q S X Z

export function formatRevLabel(revNo: number): string {
  if (!Number.isInteger(revNo) || revNo < 1)
    throw new Error(`bad revNo: ${revNo}`);
  const base = REV_LETTERS.length;
  const i = revNo - 1;
  if (i < base) return REV_LETTERS[i];
  const j = i - base;
  const first = Math.floor(j / base);
  if (first >= base) throw new Error(`revNo out of label space: ${revNo}`);
  return REV_LETTERS[first] + REV_LETTERS[j % base];
}

// ── Share codes ──────────────────────────────────────────────────────────────

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SHARE_CODE_LENGTH = 22;

/** 22 chars of base62 from crypto randomness — NOT cuid(), which is
 *  timestamp + counter + fingerprint and therefore guessable. This token is the
 *  only thing standing between an unlisted /c/ page and anyone enumerating it.
 *
 *  Rejection sampling, not `% 62`: the modulo of a byte biases the first four
 *  characters of the alphabet, which is exactly the kind of quiet entropy loss
 *  nobody notices in a token that looks random. */
export function makeShareCode(randomBytes: (n: number) => Uint8Array): string {
  let out = "";
  while (out.length < SHARE_CODE_LENGTH) {
    for (const b of randomBytes(SHARE_CODE_LENGTH)) {
      if (b < 248) out += BASE62[b % 62]; // 248 = 4 * 62, so this is unbiased
      if (out.length === SHARE_CODE_LENGTH) break;
    }
  }
  return out;
}

// ── Quotas ───────────────────────────────────────────────────────────────────

export const MAX_ACTIVE_CLUSTERS = 50;
export const MAX_TOTAL_CLUSTERS = 200;
export const MAX_REVISIONS_PER_CLUSTER = 100;
/** A second save of identical bytes inside this window returns the first
 *  revision instead of minting another. Covers a double-click and a retry
 *  after a timeout, both of which would otherwise burn a drawing number. */
export const IDEMPOTENCY_WINDOW_MS = 60_000;

// ── Payload ──────────────────────────────────────────────────────────────────

export const MAX_PAYLOAD_CHARS = 16_384;
export const MAX_SUMMARY_BYTES = 8_192;

export type PayloadProblem = "malformed" | "uncompressed" | "too-large";

/**
 * Check the payload's SHAPE and route it on its prefix. The CONTENT is decoded
 * separately, server-side, by `decodeV2State` (@/lib/hex-v2-state), which this
 * client-graph module must not import (it needs node:zlib).
 *
 * v2 ONLY. `v2s=` is the one accepted prefix; v1's `s=` and `u=` are
 * `malformed` like any other unknown prefix (owner, 2026-09-25: no v1 support
 * in any capacity).
 *
 * Split on the FIRST `=`: the prefix contains one, so applying the character
 * class to the whole string rejects every real payload. The remainder is
 * url-safe base64 with padding already stripped by the encoder.
 *
 * `v2u=` (the configurator's uncompressed branch) is refused outright rather
 * than given a larger byte ceiling. On that path the QR is V28 at five cells
 * and past QR capacity entirely at nineteen, so any byte cap still admits a
 * sheet whose code cannot be scanned — and an unscannable QR on a printed
 * drawing is worse than a refusal the user can act on. Roughly 7% of global
 * traffic lacks deflate-raw, so the message has to be actionable rather than a
 * shrug.
 */
export function checkPayload(payload: string): PayloadProblem | null {
  const eq = payload.indexOf("=");
  if (eq < 1) return "malformed";
  const prefix = payload.slice(0, eq);
  const body = payload.slice(eq + 1);
  if (prefix === "v2u") return "uncompressed";
  if (prefix !== "v2s") return "malformed";
  if (body.length < 3) return "malformed";
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return "malformed";
  if (payload.length > MAX_PAYLOAD_CHARS) return "too-large";
  return null;
}

/** `h1:` + 64 lowercase hex. Client-supplied and unverifiable here by design —
 *  the academy cannot recompute it without parsing the payload, which §1
 *  forbids — so this is a shape check, never a proof. */
export function isPayloadHash(value: string): boolean {
  return /^h[0-9]+:[0-9a-f]{64}$/.test(value);
}

// ── Name ─────────────────────────────────────────────────────────────────────

export const MAX_NAME_CHARS = 60;

/**
 * Normalise and check a drawing name.
 *
 * NFC first, then count CODE POINTS, so an accented character costs one and a
 * name that looks 60 long is 60 long.
 *
 * C0/C1 and newlines are refused because this string is printed on a
 * dimensioned drawing and rendered on a public page. Bidi overrides
 * (U+202A–202E, U+2066–2069) are refused for a sharper reason: they can make a
 * stored name RENDER as different text than it contains, and a drawing must
 * show the string that was stored.
 */
export function normaliseName(raw: string): string | null {
  const name = raw.normalize("NFC").trim();
  const points = [...name];
  if (points.length < 1 || points.length > MAX_NAME_CHARS) return null;
  for (const ch of points) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return null; // C0/C1, incl. newlines
    if (c >= 0x202a && c <= 0x202e) return null; // bidi embedding/override
    if (c >= 0x2066 && c <= 0x2069) return null; // bidi isolates
  }
  return name;
}

// ── Summary ──────────────────────────────────────────────────────────────────

export interface SummaryBOMLine {
  item: number;
  qty: number;
  label: string;
  dims: string | null;
  sourceFile: string;
}

/** A printed part the drawing cannot balloon: a PVC hub half. */
export interface SummaryHubHalfLine {
  item: number;
  qty: number;
  label: string;
  sourceFile: string;
}

/** Something bought: a bolt, a nut, an insert, a fitting, flexible hose. */
export interface SummaryHardwareLine {
  item: number;
  qty: number;
  label: string;
}

/** The PVC cut list as the build sheet draws it. Lengths in whole mm. `sticks`
 *  is empty when the configurator shed it to stay under the summary cap. */
export interface SummaryPipe {
  buy: string[];
  sticks: Array<{ cuts: number[]; offcutMm: number; flex: boolean }>;
  warnings: string[];
  notes: string[];
}

/** The WIRE shape: design §4.1 minus `nameAtSave`, which the academy stamps in
 *  from the name the user confirms. A schema built from §4.1 verbatim would
 *  reject every save.
 *
 *  `hubHalves`, `hardware` and `pipe` are the rest of the build beside the
 *  ballooned `bom` (owner decision 9, 2026-09-28). OPTIONAL: every row saved
 *  before them has none, and the configurator drops them rather than refuse a
 *  save that would not fit the cap with them. Absent stays absent. */
export interface BuildSummaryWire {
  cells: number;
  caps: number;
  spikes: number;
  pieces: number;
  envelope: {
    mm: [number, number, number];
    in: [number, number, number];
  } | null;
  bom: SummaryBOMLine[];
  details: Array<{ letter: string; caption: string }>;
  hubHalves?: SummaryHubHalfLine[];
  hardware?: SummaryHardwareLine[];
  pipe?: SummaryPipe | null;
}

/** Bounds on the supply sections, far above any real build. They cap what a
 *  crafted summary can make the page draw; the byte cap still applies. */
export const MAX_SUMMARY_SUPPLY_LINES = 200;
export const MAX_SUMMARY_STICKS = 500;
export const MAX_SUMMARY_CUTS_PER_STICK = 64;
export const MAX_SUMMARY_PIPE_TEXT_LINES = 16;

export type StoredSummary = BuildSummaryWire & { nameAtSave: string };

function isTriple(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isNonNegFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** An array of strings, at most `max` long, or null. */
function stringList(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  if (!v.every((x) => typeof x === "string")) return null;
  return [...(v as string[])];
}

/** `hubHalves`: rebuilt line by line, or null for any bad line. */
function readHubHalves(v: unknown): SummaryHubHalfLine[] | null {
  if (!Array.isArray(v) || v.length > MAX_SUMMARY_SUPPLY_LINES) return null;
  const out: SummaryHubHalfLine[] = [];
  for (const raw of v) {
    if (typeof raw !== "object" || raw === null) return null;
    const l = raw as Record<string, unknown>;
    if (!isNonNegInt(l.item) || !isNonNegInt(l.qty)) return null;
    if (typeof l.label !== "string" || typeof l.sourceFile !== "string")
      return null;
    out.push({ item: l.item, qty: l.qty, label: l.label, sourceFile: l.sourceFile });
  }
  return out;
}

/** `hardware`: rebuilt line by line, or null for any bad line. */
function readHardware(v: unknown): SummaryHardwareLine[] | null {
  if (!Array.isArray(v) || v.length > MAX_SUMMARY_SUPPLY_LINES) return null;
  const out: SummaryHardwareLine[] = [];
  for (const raw of v) {
    if (typeof raw !== "object" || raw === null) return null;
    const l = raw as Record<string, unknown>;
    if (!isNonNegInt(l.item) || !isNonNegInt(l.qty)) return null;
    if (typeof l.label !== "string") return null;
    out.push({ item: l.item, qty: l.qty, label: l.label });
  }
  return out;
}

/** `pipe`: null stays null; an object is rebuilt, or the whole thing refused. */
function readPipe(v: unknown): SummaryPipe | null | undefined {
  if (v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  const p = v as Record<string, unknown>;
  const buy = stringList(p.buy, MAX_SUMMARY_PIPE_TEXT_LINES);
  const warnings = stringList(p.warnings, MAX_SUMMARY_PIPE_TEXT_LINES);
  const notes = stringList(p.notes, MAX_SUMMARY_PIPE_TEXT_LINES);
  if (!buy || !warnings || !notes) return undefined;
  if (!Array.isArray(p.sticks) || p.sticks.length > MAX_SUMMARY_STICKS)
    return undefined;
  const sticks: SummaryPipe["sticks"] = [];
  for (const raw of p.sticks) {
    if (typeof raw !== "object" || raw === null) return undefined;
    const st = raw as Record<string, unknown>;
    if (!Array.isArray(st.cuts) || st.cuts.length > MAX_SUMMARY_CUTS_PER_STICK)
      return undefined;
    if (!st.cuts.every(isNonNegFinite)) return undefined;
    if (!isNonNegFinite(st.offcutMm) || typeof st.flex !== "boolean")
      return undefined;
    sticks.push({
      cuts: [...(st.cuts as number[])],
      offcutMm: st.offcutMm,
      flex: st.flex,
    });
  }
  return { buy, sticks, warnings, notes };
}

/**
 * Validate the summary a save carries.
 *
 * This is the durable record of what the SCENE said, and none of it is
 * reconstructible later: the academy stores the payload opaque and cannot
 * recompute a BOM or an envelope from it. A summary that arrives wrong is
 * wrong forever, and /c/ is the page a reader compares their printed sheet
 * against — so the shape is checked strictly rather than coerced.
 */
export function validateSummaryWire(value: unknown): BuildSummaryWire | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const s = value as Record<string, unknown>;

  if (!isNonNegInt(s.cells) || !isNonNegInt(s.caps) || !isNonNegInt(s.spikes))
    return null;
  // pieces >= 1: a saved build with no parts is not a build.
  if (!isNonNegInt(s.pieces) || s.pieces < 1) return null;

  if (s.envelope !== null) {
    if (typeof s.envelope !== "object" || s.envelope === null) return null;
    const e = s.envelope as Record<string, unknown>;
    if (!isTriple(e.mm) || !isTriple(e.in)) return null;
  }

  if (!Array.isArray(s.bom) || s.bom.length === 0) return null;
  const bom: SummaryBOMLine[] = [];
  for (const raw of s.bom) {
    if (typeof raw !== "object" || raw === null) return null;
    const l = raw as Record<string, unknown>;
    if (!isNonNegInt(l.item) || !isNonNegInt(l.qty)) return null;
    if (typeof l.label !== "string" || typeof l.sourceFile !== "string")
      return null;
    // `dims` is PartDims | null upstream and prints as `·`; the record stores
    // the null, never the glyph — nobody can turn the glyph back into "this
    // part has no measured bounding box".
    if (l.dims !== null && typeof l.dims !== "string") return null;
    bom.push({
      item: l.item,
      qty: l.qty,
      label: l.label,
      dims: l.dims as string | null,
      sourceFile: l.sourceFile,
    });
  }

  if (!Array.isArray(s.details)) return null;
  const details: Array<{ letter: string; caption: string }> = [];
  for (const raw of s.details) {
    if (typeof raw !== "object" || raw === null) return null;
    const d = raw as Record<string, unknown>;
    if (typeof d.letter !== "string" || typeof d.caption !== "string")
      return null;
    details.push({ letter: d.letter, caption: d.caption });
  }

  const out: BuildSummaryWire = {
    cells: s.cells,
    caps: s.caps,
    spikes: s.spikes,
    pieces: s.pieces,
    envelope:
      s.envelope === null ? null : (s.envelope as BuildSummaryWire["envelope"]),
    bom,
    details,
  };

  // THE REST OF THE BUILD (decision 9). Each section is optional -- a summary
  // saved before them has none, and absent stays absent so an old row reads
  // back byte for byte -- but a section that IS present is checked as strictly
  // as `bom`, and a bad one refuses the summary rather than being dropped: a
  // /c/ page quietly missing the bolts is the defect this exists to fix.
  if ("hubHalves" in s) {
    const hubHalves = readHubHalves(s.hubHalves);
    if (!hubHalves) return null;
    out.hubHalves = hubHalves;
  }
  if ("hardware" in s) {
    const hardware = readHardware(s.hardware);
    if (!hardware) return null;
    out.hardware = hardware;
  }
  if ("pipe" in s) {
    const pipe = readPipe(s.pipe);
    if (pipe === undefined) return null;
    out.pipe = pipe;
  }

  // Bounded AFTER rebuilding, so unknown keys the caller sent do not count and
  // do not reach the row either.
  if (JSON.stringify(out).length > MAX_SUMMARY_BYTES) return null;
  return out;
}

// ── Action results ───────────────────────────────────────────────────────────

export interface SaveInput {
  mode: "new" | "rev";
  /** Required when mode === "rev": the parent's share code. No cluster id ever
   *  crosses the boundary, which keeps `drawingNo` off every lookup path. */
  share?: string;
  name: string;
  payload: string;
  payloadHash: string;
  schemaVersion: number;
  summary: unknown;
  /** The consent box on the save panel (plan 6.3). REQUIRED and checked on the
   *  server: a save without it is refused as `consent-required`, so a client
   *  that forgets the box cannot write. Not persisted (no column, and this
   *  change carries no migration); the save itself is the record that it was
   *  ticked. */
  consent: boolean;
  /** Set by the save page's "Unarchive and save", so the unarchive, the
   *  active-cap re-check and the revision insert are ONE transaction. Two
   *  sequential calls would not be atomic: the unarchive could commit and the
   *  save then fail, leaving the drawing un-archived with no revision. */
  allowUnarchive?: boolean;
}

export type SaveErrCode =
  | "payload-too-large"
  | "payload-malformed"
  | "payload-uncompressed"
  | "summary-invalid"
  | "summary-incomplete"
  | "name-invalid"
  | "consent-required"
  | "quota-clusters"
  | "quota-revisions"
  | "quota-total"
  | "not-found"
  | "cluster-archived"
  | "rate-limited"
  | "saves-paused";

export type SaveOk = {
  ok: true;
  drawingLabel: string;
  revLabel: string;
  shareCode: string;
  name: string;
  /** The created revision's createdAt, ISO8601. The save page builds the
   *  return link from this: without it `t=` falls back to the client clock and
   *  stamps a date the freshly-created /c/ page contradicts. */
  savedAt: string;
};
export type SaveErr = { ok: false; code: SaveErrCode; message: string };
export type SaveResult = SaveOk | SaveErr;

export type MutateErrCode = "name-invalid" | "not-found" | "quota-clusters";
export type MutateResult =
  { ok: true } | { ok: false; code: MutateErrCode; message: string };

/** One place the copy lives, so an error a user sees is not invented at the
 *  call site. */
export const SAVE_ERROR_MESSAGE: Record<SaveErrCode, string> = {
  "payload-too-large": "That build is too large to save.",
  "payload-malformed":
    "That build could not be read. Go back and press Save again.",
  "payload-uncompressed":
    "Your browser could not compress this build, and an uncompressed one makes an unscannable QR code. Try Chrome, Edge, Firefox 113+, or Safari 16.4+.",
  "summary-invalid": "That build's summary could not be read.",
  "summary-incomplete":
    "The build sheet was still loading. Go back and press Save again.",
  "name-invalid": `Give the drawing a name of 1 to ${MAX_NAME_CHARS} characters.`,
  // OWNER-WORDING
  "consent-required": "Tick the box to confirm before saving.",
  "quota-clusters": `You already have ${MAX_ACTIVE_CLUSTERS} active drawings. Archive one to make room.`,
  "quota-revisions": `This drawing already has ${MAX_REVISIONS_PER_CLUSTER} revisions. Save it as a new drawing instead.`,
  "quota-total": `You have reached the limit of ${MAX_TOTAL_CLUSTERS} drawings, archived included.`,
  "not-found": "That drawing could not be found.",
  "cluster-archived": "That drawing is archived.",
  "rate-limited": "Too many saves just now. Try again in a minute.",
  "saves-paused": "Saving is paused for now. Try again later.",
};
