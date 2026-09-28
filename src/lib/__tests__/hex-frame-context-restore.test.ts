// The academy frame dismisses its "graphics context lost" notice when the
// configurator posts `restored` (plan 6.7).
//
// A STATIC guard, like the theme-relay one beside it: this suite runs in `node`
// with no DOM, so a cross-origin postMessage between two frames cannot be
// exercised. What can drift at PR time is the source, so the source is pinned:
// `restored` is handled INSIDE the one inbound listener, AFTER both the exact
// origin check and the `event.source` pin, and it only clears the notice.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHANNEL, PROTOCOL_VERSION, parseMessage } from "@/lib/hex-embed-protocol";

const SOURCE = join(
  __dirname,
  "..",
  "..",
  "components",
  "hex",
  "HexConfiguratorFrame.tsx",
);

/** The body of the inbound `onMessage` handler. */
function inboundHandler(src: string): string {
  const start = src.indexOf("function onMessage(event: MessageEvent)");
  expect(start, "no inbound onMessage handler in HexConfiguratorFrame").toBeGreaterThan(-1);
  const end = src.indexOf('window.addEventListener("message", onMessage)', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("the context-restore handler", () => {
  const handler = inboundHandler(readFileSync(SOURCE, "utf8"));

  it("parses as a frame-control message", () => {
    expect(
      parseMessage({ channel: CHANNEL, protocolVersion: PROTOCOL_VERSION, type: "restored" })?.type,
    ).toBe("restored");
  });

  it("is handled after BOTH the origin check and the source pin", () => {
    const origin = handler.indexOf("if (event.origin !== origin) return;");
    const source = handler.indexOf(
      "if (event.source !== iframeRef.current?.contentWindow) return;",
    );
    const restored = handler.indexOf('case "restored":');
    expect(origin).toBeGreaterThan(-1);
    expect(source).toBeGreaterThan(-1);
    expect(restored, "the frame does not handle `restored`").toBeGreaterThan(-1);
    expect(restored).toBeGreaterThan(origin);
    expect(restored).toBeGreaterThan(source);
  });

  it("dismisses the notice and does nothing else", () => {
    const at = handler.indexOf('case "restored":');
    const branch = handler.slice(at, handler.indexOf("break;", at));
    const code = branch.replace(/\/\/.*$/gm, "");
    expect(code).toMatch(/setContextLost\(false\)/);
    // Dismiss only: a reload here would throw the visitor's build away.
    expect(code).not.toMatch(/setReloadKey|setContextLost\(true\)/);
  });
});
