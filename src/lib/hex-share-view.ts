// What the public /c/[shareCode] page is allowed to render, decided in one pure
// function so it can be tested without a database or a browser.
//
// THE ROW IS UNTRUSTED, even though we wrote it. `summary` is JSONB and `payload`
// is an opaque string; both were checked on the way in, but a row from an older
// save path, a hand edit, or a restore from the content archive can hold anything.
// This page is what a printed QR resolves to, so a bad row must never become a
// crash, a stack trace, or a 404 BODY served with 200 (a prerendered `notFound()`
// does exactly that). It becomes one generic page instead: "This build can't be
// opened."
//
// Every string that reaches the page is NFC-normalised, stripped of control and
// bidi-override characters, and capped by code points, because it is rendered on
// a public page and compared against paper.
import {
  MAX_NAME_CHARS,
  MAX_SUMMARY_BYTES,
  checkPayload,
  isPayloadHash,
  validateSummaryWire,
  type BuildSummaryWire,
} from "@/lib/hex-cluster";
import type { ClusterLookup, PublicCluster } from "@/lib/hex-cluster-load";

export const MAX_LABEL_CHARS = 80;
export const MAX_DIMS_CHARS = 40;
/** The DB CHECK on the summary column. Anything larger did not come through the
 *  save action, so it is not trusted to render. */
export const MAX_STORED_SUMMARY_BYTES = 12_288;
/** More BOM lines than any real build has; bounds the table a bad row can draw. */
export const MAX_BOM_LINES = 200;

/**
 * Make untrusted text safe to render as one line.
 *
 * Unlike `normaliseName`, which REFUSES bad input at save time, this REPAIRS: the
 * row already exists and the page must show something. Control characters
 * (C0/C1, including newlines) become spaces, bidi embeddings, overrides and
 * isolates are removed (they can make a string render as different text than it
 * contains), whitespace is collapsed, and the result is capped with an ellipsis.
 */
export function sanitiseDisplayText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  let out = "";
  for (const ch of raw.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) {
      out += " ";
      continue;
    }
    if (c >= 0x202a && c <= 0x202e) continue;
    if (c >= 0x2066 && c <= 0x2069) continue;
    if (c === 0x200e || c === 0x200f || c === 0x061c) continue; // bidi marks
    out += ch;
  }
  const points = [...out.replace(/\s+/g, " ").trim()];
  if (points.length <= max) return points.join("");
  return points.slice(0, Math.max(0, max - 1)).join("").trimEnd() + "…";
}

export interface SharedBuildView {
  drawingLabel: string;
  revLabel: string;
  name: string;
  savedDate: string;
  shareCode: string;
  summary: BuildSummaryWire;
}

export type SharedView =
  | { kind: "unknown-code" }
  | { kind: "archived" }
  | { kind: "unreadable" }
  | { kind: "ok"; build: SharedBuildView; canOpen: boolean };

function readSummary(value: unknown): BuildSummaryWire | null {
  let size: number;
  try {
    size = JSON.stringify(value)?.length ?? 0;
  } catch {
    return null; // cyclic or otherwise unserialisable
  }
  if (size > MAX_STORED_SUMMARY_BYTES) return null;
  const s = validateSummaryWire(value);
  if (!s || s.bom.length > MAX_BOM_LINES) return null;
  return {
    ...s,
    bom: s.bom.map((l) => ({
      ...l,
      label: sanitiseDisplayText(l.label, MAX_LABEL_CHARS),
      dims: l.dims === null ? null : sanitiseDisplayText(l.dims, MAX_DIMS_CHARS),
      sourceFile: sanitiseDisplayText(l.sourceFile, MAX_LABEL_CHARS),
    })),
    details: s.details.map((d) => ({
      letter: sanitiseDisplayText(d.letter, 4),
      caption: sanitiseDisplayText(d.caption, MAX_LABEL_CHARS),
    })),
  };
}

function buildView(c: PublicCluster): SharedBuildView | null {
  if (typeof c.payload !== "string" || checkPayload(c.payload) !== null) {
    return null;
  }
  if (typeof c.payloadHash !== "string" || !isPayloadHash(c.payloadHash)) {
    return null;
  }
  const summary = readSummary(c.summary);
  if (!summary) return null;
  const saved = new Date(c.savedAt);
  if (Number.isNaN(saved.getTime())) return null;
  return {
    drawingLabel: sanitiseDisplayText(c.drawingLabel, MAX_LABEL_CHARS),
    revLabel: sanitiseDisplayText(c.revLabel, MAX_LABEL_CHARS),
    name: sanitiseDisplayText(c.nameAtSave, MAX_NAME_CHARS),
    savedDate: saved.toISOString().slice(0, 10),
    shareCode: c.shareCode,
    summary,
  };
}

/** Decide what the page renders. Never throws on row content. */
export function sharedView(lookup: ClusterLookup): SharedView {
  switch (lookup.outcome) {
    case "unknown-code":
      return { kind: "unknown-code" };
    case "archived":
      return { kind: "archived" };
    case "hit":
    case "account-deleted": {
      let build: SharedBuildView | null;
      try {
        build = buildView(lookup.cluster);
      } catch {
        build = null;
      }
      if (!build) return { kind: "unreadable" };
      return { kind: "ok", build, canOpen: lookup.outcome === "hit" };
    }
    default:
      return { kind: "unreadable" };
  }
}
