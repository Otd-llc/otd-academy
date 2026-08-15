// The visitor's stored print bed must actually reach the embedded configurator,
// and a bed picked inside it must actually reach the account.
//
// A STATIC guard, for the same reason the theme relay's is (see
// hex-frame-theme-relay.test.ts): this suite runs in the `node` environment with
// no DOM, so the component cannot be rendered and a cross-origin postMessage
// between two frames cannot be exercised at all. What is catchable at PR time is
// the SHAPE, and the shape is where this class of bug lives — the theme relay
// shipped desynced because one effect was gated on the wrong thing, and every
// line below is a re-tightening that would do the same to the bed.
//
// The behavioural check is a browser one, against the real pair: open signed
// out (no bed, child uses its own store), open signed in with a stored bed, pick
// a different bed inside the frame and reload /account, and pick the bed already
// stored (which must not write).
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

const src = readFileSync(SOURCE, "utf8");

/** The `useEffect(...)` block that relays `set-bed`, from its `useEffect(` to
 *  the dependency array that closes it. */
function relayEffect(): string {
  const post = src.indexOf('post({ type: "set-bed"');
  expect(
    post,
    "nothing posts set-bed in HexConfiguratorFrame — the relay is gone entirely",
  ).toBeGreaterThan(-1);
  const start = src.lastIndexOf("useEffect(", post);
  const end = src.indexOf(");", src.indexOf("}, [", post));
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("the bed relay to the embedded configurator", () => {
  it("sends the account's bed with the handshake", () => {
    // The first-paint path. A frame that has just loaded has never heard a
    // set-bed, so the handshake is the only thing that can tell it.
    expect(src).toMatch(/type:\s*"ready"[\s\S]{0,400}bed:\s*bedRef\.current/);
  });

  it("reads the bed at send time, never from a captured value", () => {
    // The handshake fires again on a frame REMOUNT (the context-lost reload), so
    // a bed closed over when the callback was built would hand the reloaded
    // frame a stale one. Same reason the theme is read with `currentTheme()`.
    const start = src.indexOf("const handshake = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const handshake = src.slice(start, src.indexOf("}, [post]);", start));
    expect(handshake).toMatch(/bedRef\.current/);
  });

  it("relays a late answer instead of blocking the open on it", () => {
    // The account read is a database round trip fired at open and deliberately
    // not awaited, so it routinely lands AFTER the handshake has gone. Without a
    // relay the stored bed would be ignored for the whole session.
    expect(relayEffect()).toMatch(/if\s*\(\s*!src\s*\|\|\s*!accountBed\s*\)\s*return/);
    // Bound to the frame EXISTING, not to the panel being open — the iframe
    // outlives any single open and is never reloaded.
    expect(relayEffect()).not.toMatch(/phase\s*!==\s*"open"/);
  });

  it("never echoes the child's own pick back at it", () => {
    // `accountBed` drives the relay, so writing an inbound `bed-changed` into it
    // would post that same bed straight back to the frame that just sent it — a
    // message it did not ask for, and a loop if a future child build treats an
    // inbound bed as a change worth announcing. Exactly one writer, in the
    // account read.
    const writes = src.match(/setAccountBed\(/g) ?? [];
    expect(writes).toHaveLength(1);
  });

  it("writes a bed picked in the configurator through to the account", () => {
    // The whole point of the account copy: a bed picked on a laptop is true on a
    // phone. Without this the pick lives only in the configurator's
    // localStorage, which is the store that does not travel.
    expect(src).toMatch(/case\s+"bed-changed":[\s\S]{0,300}persistBed\(message\.bed\)/);
    expect(src).toMatch(/setPrintBed\(bed\)/);
  });
});
