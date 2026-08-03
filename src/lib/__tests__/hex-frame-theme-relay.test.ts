// The embedded configurator must follow the academy's theme toggle.
//
// THE BUG THIS PINS, which shipped and was only ever visible in a browser: the
// relay effect was gated on `phase !== "open"`, so the listener existed only
// while the panel was open. Toggling with the panel CLOSED was heard by nobody,
// and reopening could not repair it -- the iframe is deliberately never reloaded
// (a reload throws away the visitor's build), so there is no second `load` event
// and therefore no second handshake. One toggle while closed left the
// configurator on the wrong theme until a full page reload.
//
// A STATIC guard, deliberately. This suite runs in the `node` environment with
// no DOM (see vitest.config.ts), so the component cannot be rendered and a
// cross-origin postMessage between two frames cannot be exercised at all. The
// real risk is someone re-tightening that condition back to the open phase while
// "simplifying", and that is a fact about the source -- catchable at PR time.
//
// The behavioural check is a browser one. The sequences that matter are: toggle
// then first open, toggle while open, toggle while CLOSED then reopen, several
// toggles while closed (an odd number, so a fix that merely re-sent once on open
// still lands wrong), and rapid toggling. All five were run against the local
// pair and against the deployed pair.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(
  __dirname,
  "..",
  "..",
  "components",
  "hex",
  "HexConfiguratorFrame.tsx",
);

/** The `useEffect(...)` block that registers the theme listener, from its
 *  `useEffect(` to the dependency array that closes it. */
function relayEffect(src: string): string {
  const listener = src.indexOf("window.addEventListener(THEME_EVENT");
  expect(
    listener,
    "no THEME_EVENT listener in HexConfiguratorFrame -- the relay is gone entirely",
  ).toBeGreaterThan(-1);

  const start = src.lastIndexOf("useEffect(", listener);
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf(");", src.indexOf("}, [", listener));
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("the theme relay to the embedded configurator", () => {
  const src = readFileSync(SOURCE, "utf8");

  it("is not gated on the panel being open", () => {
    // The exact shape of the bug. The iframe outlives any single open, so the
    // relay has to outlive it too.
    expect(relayEffect(src)).not.toMatch(/phase\s*!==\s*"open"/);
  });

  it("is bound to the frame existing instead", () => {
    const effect = relayEffect(src);
    expect(effect).toMatch(/if\s*\(\s*!src\s*\)\s*return/);
    // `src` in the deps, or the listener is registered against a stale closure
    // and stops being re-bound when the frame is created.
    expect(effect).toMatch(/\}\s*,\s*\[\s*src\s*,/);
  });

  it("re-states the theme on every open", () => {
    // Covers the gap the listener cannot: `src` is set inside an async effect
    // (after a PostHog read and possibly a recall fetch), so a toggle can land
    // between the click and the frame existing.
    expect(src).toMatch(
      /if\s*\(phase\s*!==\s*"open"\s*\|\|\s*!src\)\s*return;\s*post\(\{\s*type:\s*"set-theme"/,
    );
  });

  it("sends the theme with the handshake too", () => {
    // The first paint path: a frame that has just loaded has never seen a
    // toggle, so the handshake is the only thing that can tell it.
    expect(src).toMatch(/type:\s*"ready"[\s\S]{0,120}theme:\s*currentTheme\(\)/);
  });

  it("reads the theme at send time, never from a captured value", () => {
    // A theme captured when the listener was attached is the same class of bug
    // wearing different clothes: it would relay the OLD value forever.
    expect(relayEffect(src)).toMatch(/theme:\s*currentTheme\(\)/);
  });
});
