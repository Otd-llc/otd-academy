// The academy half of the v2 save bridge (plan 6.3 / 7.5):
//   - after a save, the reader goes back to the ACADEMY's framed configurator
//     with the saved build recalled by share code -- not to the retiring
//     `demo.onethousanddrones.com/hex`, and never with a payload in a URL;
//   - both save surfaces carry the consent box and send it to the action;
//   - a recall hands the frame only a payload the v2 configurator can open.
//
// The suite runs in node with no DOM, so the client components are checked two
// ways: the embedded panel by server-rendering it (its first phase is the form),
// and the save page's post-save navigation by a source guard, because its form
// only exists after an effect has read `location.hash`.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/hex-clusters", () => ({
  saveHexCluster: async () => ({ ok: false }),
  saveHexClusterEmbedded: async () => ({ auth: "signed-out" }),
}));
vi.mock("@/lib/analytics-client", () => ({ fireHexSaveCompleted: () => {} }));
const lookup = vi.hoisted(() => ({ next: null as unknown }));
vi.mock("@/lib/hex-cluster-load", () => ({
  loadClusterByShareCode: async () => lookup.next,
}));

import { savedBuildPath } from "@/lib/hex-return-link";
import { EmbeddedSavePanel } from "@/components/hex/EmbeddedSavePanel";
import { SAVE_CONSENT_TEXT } from "@/components/hex/SaveConsent";
import { loadHexRecall } from "@/lib/actions/hex-recall";
import { FROZEN_V2_PAYLOADS } from "./hex-v2-share-corpus.fixture";

const CODE = "Ab3".padEnd(22, "x");

describe("savedBuildPath", () => {
  it("is the academy's own deep link, by share code", () => {
    expect(savedBuildPath(CODE)).toBe(`/hex?open=1&build=${CODE}`);
  });
  it("encodes the code, so it cannot add a parameter", () => {
    expect(savedBuildPath("a&open=0")).toBe("/hex?open=1&build=a%26open%3D0");
  });
});

/** The file's code with comments removed, so a guard is not satisfied (or
 *  tripped) by prose. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the save page's post-save navigation", () => {
  const src = code("src/components/hex/SaveHexClusterForm.tsx");

  it("no longer sends anyone to the demo host", () => {
    expect(src).not.toContain("onethousanddrones.com");
    expect(src).not.toMatch(/new URL\(/);
  });

  it("never puts the payload in a URL", () => {
    expect(src).not.toMatch(/#\$\{envelope\.p\}/);
    expect(src).not.toMatch(/assign\([^)]*envelope/);
  });

  it("returns to the framed configurator with the saved share code, on both save paths", () => {
    expect(src).toContain("window.location.assign(savedBuildPath(shareCode))");
    expect(src.match(/returnToConfigurator\(res\.shareCode\)/g)?.length).toBe(2);
  });

  it("sends the consent box on both save paths, and gates submit on it", () => {
    expect(src.match(/^\s*consent,$/gm)?.length).toBe(2);
    expect(src).toContain("<SaveConsent");
    expect(src).toMatch(/disabled=\{busy \|\| name\.trim\(\)\.length === 0 \|\| !consent\}/);
  });
});

describe("the embedded save panel", () => {
  const request = {
    channel: "otd-hex",
    protocolVersion: 1,
    type: "save-request",
    requestId: "r1",
    mode: "new",
    share: null,
    envelope: { p: FROZEN_V2_PAYLOADS[1].v2s, h: `h1:${"a".repeat(64)}`, v: 2, s: {}, n: "Bench" },
  } as unknown as Parameters<typeof EmbeddedSavePanel>[0]["request"];

  const html = renderToStaticMarkup(
    createElement(EmbeddedSavePanel, {
      request,
      onSaved: () => {},
      onFailed: () => {},
      onCancelled: () => {},
    }),
  );

  it("shows the consent box, unticked and required", () => {
    expect(html).toContain(SAVE_CONSENT_TEXT);
    const box = html.match(/<input[^>]*id="hex-embed-consent"[^>]*>/)?.[0] ?? "";
    expect(box).toContain('type="checkbox"');
    expect(box).toContain("required");
    expect(box).not.toMatch(/\schecked/);
    expect(html).toContain('href="/privacy"');
  });

  it("keeps Save disabled until the box is ticked, even with a name", () => {
    const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    expect(submit).not.toBe("");
    // The ATTRIBUTE, not the substring: the class list says `disabled:opacity-50`.
    expect(submit).toMatch(/\sdisabled=""/);
  });

  it("sends the consent to the action", () => {
    const src = code("src/components/hex/EmbeddedSavePanel.tsx");
    expect(src).toMatch(/summary: request\.envelope\.s,\s*consent,/);
  });
});

describe("loadHexRecall hands the frame only a v2 build", () => {
  const cluster = (payload: string) => ({
    outcome: "hit",
    cluster: {
      drawingLabel: "DEV-HEX-1001",
      revLabel: "A",
      nameAtSave: "Bench",
      savedAt: "2026-09-25T10:00:00.000Z",
      summary: {},
      archived: false,
      payload,
      payloadHash: `h1:${"a".repeat(64)}`,
      shareCode: CODE,
    },
  });

  it("recalls a v2 save with its payload and identity", async () => {
    lookup.next = cluster(FROZEN_V2_PAYLOADS[2].v2s);
    const res = await loadHexRecall(CODE);
    expect(res).toMatchObject({ ok: true, payload: FROZEN_V2_PAYLOADS[2].v2s });
  });

  it("refuses a v1 row and an undecodable one, exactly like an unknown code", async () => {
    for (const p of [
      "s=eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA",
      `s=${FROZEN_V2_PAYLOADS[2].v2s.slice(4)}`,
      "v2s=eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA",
    ]) {
      lookup.next = cluster(p);
      expect(await loadHexRecall(CODE)).toEqual({ ok: false });
    }
  });
});
