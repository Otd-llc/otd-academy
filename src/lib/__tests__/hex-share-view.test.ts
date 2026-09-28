// The public /c/[shareCode] page must survive any row (plan 6.2).
//
// A printed QR resolves here, so a row that cannot be read gets one generic 200
// page -- "This build can't be opened" -- never a crash, a stack, or a 404 body.
// Garbage, truncated and oversized rows are fed through the pure view AND through
// the real page component rendered to HTML, because the view being right is not
// the same as the page using it.
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ClusterLookup, PublicCluster } from "@/lib/hex-cluster-load";
import {
  MAX_LABEL_CHARS,
  MAX_PIPE_TEXT_CHARS,
  sanitiseDisplayText,
  sharedView,
} from "@/lib/hex-share-view";
import { MAX_NAME_CHARS } from "@/lib/hex-cluster";
import { v2Payload, v2sFromEnvelope } from "./hex-v2-payload.fixture";
import { FROZEN_V2_PAYLOADS } from "./hex-v2-share-corpus.fixture";

const lookup = vi.hoisted(() => ({ next: null as unknown }));
vi.mock("@/lib/hex-cluster-load", () => ({
  loadClusterByShareCode: async () => lookup.next,
}));

const CODE = "A".repeat(22);

const GOOD_SUMMARY = {
  cells: 2,
  caps: 1,
  spikes: 0,
  pieces: 3,
  envelope: { mm: [90.6, 48.8, 82.7], in: [3.57, 1.92, 3.26] },
  bom: [
    { item: 1, qty: 3, label: "Hex base", dims: "87.8 × 33.0 × 78.0", sourceFile: "hex.3mf" },
  ],
  details: [],
  nameAtSave: "Bench cluster",
};

function cluster(over: Partial<Record<keyof PublicCluster, unknown>> = {}): PublicCluster {
  return {
    drawingLabel: "HC-000001",
    revLabel: "A",
    nameAtSave: "Bench cluster",
    savedAt: "2026-09-20T10:00:00.000Z",
    summary: GOOD_SUMMARY,
    archived: false,
    payload: v2Payload(),
    payloadHash: `h1:${"a".repeat(64)}`,
    shareCode: CODE,
    ...over,
  } as PublicCluster;
}

const hit = (over?: Parameters<typeof cluster>[0]): ClusterLookup => ({
  outcome: "hit",
  cluster: cluster(over),
});

/** Rows no save path should produce, grouped by the three shapes the plan names. */
const GARBAGE: Array<[string, ClusterLookup]> = [
  ["summary is null", hit({ summary: null })],
  ["summary is a string", hit({ summary: "not json" })],
  ["summary is an array", hit({ summary: [1, 2, 3] })],
  ["bom is not an array", hit({ summary: { ...GOOD_SUMMARY, bom: "x" } })],
  ["bom line has an object label", hit({ summary: { ...GOOD_SUMMARY, bom: [{ ...GOOD_SUMMARY.bom[0], label: { $gt: "" } }] } })],
  ["cells is NaN", hit({ summary: { ...GOOD_SUMMARY, cells: Number.NaN } })],
  ["payload has an unknown prefix", hit({ payload: "zz=abc" })],
  ["payload is not a string", hit({ payload: 42 })],
  // v1 is dead: a v1 row -- even one that was valid when it was saved -- is the
  // generic page, never a v1 decode.
  ["payload is a v1 save", hit({ payload: "s=eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA" })],
  ["payload is a v1 prefix on a real v2 body", hit({ payload: `s=${FROZEN_V2_PAYLOADS[1].v2s.slice(4)}` })],
  ["payload is v2s-shaped but not deflate", hit({ payload: "v2s=eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA" })],
  ["payload is a future v2 envelope", hit({ payload: v2sFromEnvelope({ v: 2, s: { pieces: [] } }) })],
  ["payload is uncompressed v2", hit({ payload: FROZEN_V2_PAYLOADS[1].v2u })],
  ["payload hash is garbage", hit({ payloadHash: "<script>" })],
  ["savedAt is not a date", hit({ savedAt: "yesterday" })],
];
const TRUNCATED: Array<[string, ClusterLookup]> = [
  ["summary cut after the counts", hit({ summary: { cells: 2, caps: 1, spikes: 0, pieces: 3 } })],
  ["envelope cut to two axes", hit({ summary: { ...GOOD_SUMMARY, envelope: { mm: [1, 2], in: [1, 2, 3] } } })],
  ["bom line cut short", hit({ summary: { ...GOOD_SUMMARY, bom: [{ item: 1, qty: 3 }] } })],
  ["payload cut to its prefix", hit({ payload: "v2s=" })],
  ["payload cut mid-prefix", hit({ payload: "v2" })],
  ["payload cut mid-body", hit({ payload: FROZEN_V2_PAYLOADS[5].v2s.slice(0, 40) })],
];
const OVERSIZED: Array<[string, ClusterLookup]> = [
  ["payload past the 16,384 cap", hit({ payload: `v2s=${"A".repeat(20_000)}` })],
  ["summary past the 12,288 DB check", hit({ summary: { ...GOOD_SUMMARY, bom: Array.from({ length: 150 }, (_, i) => ({ item: i + 1, qty: 1, label: "x".repeat(80), dims: null, sourceFile: "f" })) } })],
];

describe("sharedView: any undecodable row is 'unreadable'", () => {
  for (const [label, row] of [...GARBAGE, ...TRUNCATED, ...OVERSIZED]) {
    it(label, () => {
      expect(sharedView(row).kind).toBe("unreadable");
    });
  }

  it("a row that throws while being read is unreadable, not a crash", () => {
    const hostile = cluster();
    Object.defineProperty(hostile, "drawingLabel", {
      get() {
        throw new Error("boom");
      },
    });
    expect(sharedView({ outcome: "hit", cluster: hostile }).kind).toBe(
      "unreadable",
    );
  });

  it("every frozen configurator link renders", () => {
    for (const b of FROZEN_V2_PAYLOADS) {
      expect(sharedView(hit({ payload: b.v2s })).kind, b.name).toBe("ok");
    }
  });

  it("a good row is ok, and an account-deleted one cannot be opened", () => {
    const ok = sharedView(hit());
    expect(ok.kind).toBe("ok");
    if (ok.kind === "ok") expect(ok.canOpen).toBe(true);
    const gone = sharedView({ outcome: "account-deleted", cluster: cluster() });
    expect(gone.kind === "ok" && gone.canOpen).toBe(false);
  });
});

describe("names are sanitised and length-capped", () => {
  it("strips controls and bidi overrides, collapses whitespace", () => {
    expect(sanitiseDisplayText("a‮gnp.exe\nb\u0000c  d", 60)).toBe(
      "agnp.exe b c d",
    );
  });

  it("caps by code points, with an ellipsis", () => {
    const out = sanitiseDisplayText("😀".repeat(500), MAX_NAME_CHARS);
    expect([...out].length).toBe(MAX_NAME_CHARS);
    expect(out.endsWith("…")).toBe(true);
  });

  it("an oversized name and label on a good row render capped", () => {
    const long = "N".repeat(5_000);
    const v = sharedView(
      hit({
        nameAtSave: long,
        summary: { ...GOOD_SUMMARY, bom: [{ ...GOOD_SUMMARY.bom[0], label: `${long}‮` }] },
      }),
    );
    expect(v.kind).toBe("ok");
    if (v.kind !== "ok") return;
    expect([...v.build.name].length).toBe(MAX_NAME_CHARS);
    expect([...v.build.summary.bom[0].label].length).toBe(MAX_LABEL_CHARS);
    expect(v.build.summary.bom[0].label).not.toContain("‮");
  });
});

describe("the /c/[shareCode] page", () => {
  async function render(row: ClusterLookup): Promise<string> {
    lookup.next = row;
    const mod = await import("@/app/(bare)/c/[shareCode]/page");
    const el = await mod.default({ params: Promise.resolve({ shareCode: CODE }) });
    return renderToStaticMarkup(el);
  }

  it("is noindex", async () => {
    const mod = await import("@/app/(bare)/c/[shareCode]/page");
    expect(mod.metadata.robots).toMatchObject({ index: false });
  });

  const V1_ROW = GARBAGE.find(([l]) => l === "payload is a v1 save")!;
  const NOT_DEFLATE = GARBAGE.find(([l]) => l === "payload is v2s-shaped but not deflate")!;
  for (const [label, row] of [GARBAGE[0], GARBAGE[4], V1_ROW, NOT_DEFLATE, TRUNCATED[0], OVERSIZED[0]]) {
    it(`renders the generic page for: ${label}`, async () => {
      const html = await render(row);
      // PageHeader splits a title into per-word spans, so compare the TEXT.
      const text = html
        .replace(/<[^>]+>/g, " ")
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, " ")
        .replace(/ ([.,])/g, "$1");
      expect(text).toContain("This build can't be opened.");
      expect(html).not.toMatch(/TypeError|at .*\(|Error:/);
      expect(html).not.toContain("Open in the configurator");
    });
  }

  it("renders a good row, with a hostile name sanitised and capped", async () => {
    const html = await render(hit({ nameAtSave: `<b>x</b>‮${"z".repeat(500)}` }));
    expect(html).toContain("HC-000001");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("‮");
    expect(html).not.toContain("z".repeat(MAX_NAME_CHARS));
    expect(html).toContain("Open in the configurator");
  });

  // Decision 9: the page lists EVERYTHING in the build, not only the balloons.
  const EVERYTHING = {
    ...GOOD_SUMMARY,
    hubHalves: [
      { item: 2, qty: 2, label: "PVC hub · top half", sourceFile: "pvc-hub-top.FCStd" },
    ],
    hardware: [
      { item: 3, qty: 12, label: "M6 x 35 socket head cap screw, ISO 4762 (DIN 912)" },
      { item: 4, qty: 1, label: "heatset-m6-short" },
    ],
    pipe: {
      buy: ["buy 1 x 10 ft 3/4 in Sch 40 PVC pipe, OD 26.67 mm (US)."],
      sticks: [
        { cuts: [400, 701], offcutMm: 1946, flex: false },
        { cuts: [350], offcutMm: 2700, flex: true },
      ],
      warnings: ["leg 4000 is 4000 mm, longer than one 3048 mm stick -- break it and add a coupling"],
      notes: ["1 run STRUCTURAL -- DRY, NOT PRESSURE RATED."],
    },
  };

  /** The page's visible text, React's comment markers removed. */
  const textOf = (html: string) =>
    html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("renders every section: hub halves, hardware and the pipe cut list", async () => {
    const html = await render(hit({ summary: EVERYTHING }));
    const text = textOf(html);
    expect(text).toContain("Hub halves");
    expect(text).toContain("PVC hub · top half");
    expect(text).toContain("pvc-hub-top.FCStd");
    expect(text).toContain("Bought hardware");
    expect(text).toContain("M6 x 35 socket head cap screw, ISO 4762 (DIN 912)");
    expect(text).toContain("heatset-m6-short");
    expect(text).toContain("PVC pipe");
    expect(text).toContain("buy 1 x 10 ft 3/4 in Sch 40 PVC pipe");
    expect(text).toContain("Stick 1 · cut 400, 701 mm · offcut 1946 mm");
    expect(text).toContain("Roll 2 · cut 350 mm · offcut 2700 mm");
    expect(text).toContain("break it and add a coupling");
    expect(text).toContain("DRY, NOT PRESSURE RATED");
    // The numbers continue the ballooned bill, as the sheet prints them.
    expect(text).toContain(" 3 12× M6 x 35 socket head cap screw");
    expect(text).toContain(" 2 2× PVC hub · top half pvc-hub-top.FCStd");
  });

  it("a row saved before decision 9 renders its bill alone, as it always did", async () => {
    const text = textOf(await render(hit()));
    expect(text).not.toContain("Hub halves");
    expect(text).not.toContain("Bought hardware");
    expect(text).not.toContain("PVC pipe");
    expect(text).toContain("Bill of materials");
  });

  it("a shed cut list still says how much pipe to buy", async () => {
    const text = textOf(
      await render(hit({ summary: { ...EVERYTHING, pipe: { ...EVERYTHING.pipe, sticks: [] } } })),
    );
    expect(text).toContain("buy 1 x 10 ft");
    expect(text).not.toContain("Stick 1");
  });

  it("sanitises and caps every new string", async () => {
    const hostile = `<script>x</script>‮${"h".repeat(500)}`;
    const v = sharedView(
      hit({
        summary: {
          ...EVERYTHING,
          hubHalves: [{ ...EVERYTHING.hubHalves[0], label: hostile, sourceFile: hostile }],
          hardware: [{ ...EVERYTHING.hardware[0], label: hostile }],
          pipe: { ...EVERYTHING.pipe, buy: [hostile], warnings: [hostile], notes: [hostile] },
        },
      }),
    );
    expect(v.kind).toBe("ok");
    if (v.kind !== "ok") return;
    const s = v.build.summary;
    for (const t of [s.hubHalves![0].label, s.hubHalves![0].sourceFile, s.hardware![0].label]) {
      expect([...t].length).toBe(MAX_LABEL_CHARS);
      expect(t).not.toContain("‮");
    }
    for (const t of [...s.pipe!.buy, ...s.pipe!.warnings, ...s.pipe!.notes]) {
      expect([...t].length).toBe(MAX_PIPE_TEXT_CHARS);
      expect(t).not.toContain("‮");
    }
    const html = await render(
      hit({ summary: { ...EVERYTHING, hardware: [{ ...EVERYTHING.hardware[0], label: hostile }] } }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("a malformed new section is the generic page, never a partial one", () => {
    for (const summary of [
      { ...EVERYTHING, hardware: "x" },
      { ...EVERYTHING, pipe: { ...EVERYTHING.pipe, sticks: [{ cuts: ["1"], offcutMm: 0, flex: false }] } },
      { ...EVERYTHING, hubHalves: [{ item: 1, qty: 1 }] },
    ]) {
      expect(sharedView(hit({ summary })).kind).toBe("unreadable");
    }
  });

  it("opens a v2 save in the academy's framed configurator, by share code", async () => {
    const html = await render(hit({ payload: FROZEN_V2_PAYLOADS[3].v2s }));
    expect(html).toContain(`href="/hex?open=1&amp;build=${CODE}"`);
    expect(html).not.toContain("v2s=");
  });
});
