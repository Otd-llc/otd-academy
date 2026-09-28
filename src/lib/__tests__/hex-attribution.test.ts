// Attribution on a Hex download (launch readiness 6.6, decision 1.14): `src` is
// a closed enum, and the first-touch `otd_src` is stored only with a c15t
// measurement grant. REPORTING is gated at the one choke point, not here: the
// download events are class (b) in `@/lib/analytics`, proven end to end in
// `hex-download-consent-gate.test.ts`.
import { describe, expect, it } from "vitest";

import {
  HEX_SOURCES,
  OTD_SRC_COOKIE,
  hexAttribution,
  otdSrcCookieWrite,
  readHexSource,
} from "@/lib/hex-attribution";

/** A c15t cookie as c15t writes it: denied categories are OMITTED. */
const DENIED = "c.necessary:1,i.time:1727000000000,i.id:abc";

function jar(values: Record<string, string>) {
  return {
    get: (name: string) =>
      name in values ? { value: values[name] } : undefined,
  };
}

/** Everything a hostile caller might put in `src`. None may survive. */
const HOSTILE = [
  "x".repeat(4096),
  "<img src=x onerror=alert(1)>",
  "printables\u0000",
  "printables\r\nSet-Cookie: a=b",
  " printables",
  "PRINTABLES",
  "printables,reddit",
  "‮selbatnirp",
  "unknown ",
];

describe("readHexSource: a closed enum", () => {
  it("passes every listed value through unchanged", () => {
    for (const s of HEX_SOURCES) expect(readHexSource(s)).toBe(s);
  });

  it("names the launch channels of 11.2 and 11.3", () => {
    expect(HEX_SOURCES).toEqual(
      expect.arrayContaining([
        "configurator",
        "hex_page",
        "share_page",
        "direct",
        "printables",
        "thingiverse",
        "makerworld",
        "reddit",
        "hn",
        "hackaday",
      ]),
    );
  });

  it("maps an unlisted value to unknown", () => {
    expect(readHexSource("etsy")).toBe("unknown");
  });

  it.each(HOSTILE)("maps hostile input to unknown: %j", (raw) => {
    expect(readHexSource(raw)).toBe("unknown");
  });

  it("reads absent as absent, not as a source", () => {
    expect(readHexSource(null)).toBeUndefined();
    expect(readHexSource(undefined)).toBeUndefined();
    expect(readHexSource("")).toBeUndefined();
  });
});

describe("hexAttribution: what the download event may carry", () => {
  it("carries src and otd_src", () => {
    expect(
      hexAttribution("configurator", jar({ [OTD_SRC_COOKIE]: "hn" })),
    ).toEqual({ src: "configurator", otd_src: "hn" });
  });

  it("reads NO consent itself: the choke point in @/lib/analytics is the one gate", () => {
    // A refused c15t cookie changes nothing here. The event these fields ride
    // in is class (b), so without a grant it never leaves at all.
    expect(
      hexAttribution("printables", jar({ c15t: DENIED, [OTD_SRC_COOKIE]: "reddit" })),
    ).toEqual({ src: "printables", otd_src: "reddit" });
  });

  it("reports src as unknown when the caller named none, and omits an absent otd_src", () => {
    expect(hexAttribution(null, jar({}))).toEqual({ src: "unknown" });
  });

  it.each(HOSTILE)("never lets a hostile src or otd_src through: %j", (raw) => {
    const out = hexAttribution(raw, jar({ [OTD_SRC_COOKIE]: raw }));
    expect(out).toEqual({ src: "unknown", otd_src: "unknown" });
  });
});

describe("otdSrcCookieWrite: the first touch, only with consent", () => {
  const base = { search: "?src=reddit", documentCookie: "", secure: true };

  it("writes nothing without consent", () => {
    expect(otdSrcCookieWrite({ ...base, granted: false })).toBeNull();
  });

  it("deletes a stored first touch on revoke", () => {
    const w = otdSrcCookieWrite({
      ...base,
      granted: false,
      documentCookie: "a=1; otd_src=reddit",
    });
    expect(w).toMatch(/^otd_src=; .*Max-Age=0/);
  });

  it("writes a listed src with consent", () => {
    const w = otdSrcCookieWrite({ ...base, granted: true });
    expect(w).toMatch(/^otd_src=reddit; Path=\/; Max-Age=\d+; SameSite=Lax; Secure$/);
  });

  it("keeps the FIRST touch", () => {
    expect(
      otdSrcCookieWrite({
        ...base,
        granted: true,
        search: "?src=hn",
        documentCookie: "otd_src=reddit",
      }),
    ).toBeNull();
  });

  it.each(HOSTILE)("never stores a hostile or unlisted src: %j", (raw) => {
    expect(
      otdSrcCookieWrite({
        ...base,
        granted: true,
        search: `?src=${encodeURIComponent(raw)}`,
      }),
    ).toBeNull();
  });

  it("stores nothing when the page names no src", () => {
    expect(
      otdSrcCookieWrite({ ...base, granted: true, search: "" }),
    ).toBeNull();
  });
});
