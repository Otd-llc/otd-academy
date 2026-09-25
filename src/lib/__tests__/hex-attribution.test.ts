// Attribution on a Hex download (launch readiness 6.6, decision 1.14): `src` is
// a closed enum, and neither it nor the first-touch `otd_src` is reported or
// stored without a c15t measurement grant.
import { describe, expect, it } from "vitest";

import {
  C15T_COOKIE,
  HEX_SOURCES,
  OTD_SRC_COOKIE,
  hexAttribution,
  measurementGrantedByCookie,
  otdSrcCookieWrite,
  readHexSource,
} from "@/lib/hex-attribution";

/** A c15t cookie as c15t 2.0 writes it: denied categories are OMITTED. */
const GRANTED = "c.measurement:1,c.necessary:1,i.time:1727000000000,i.id:abc";
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

describe("measurementGrantedByCookie: fails closed", () => {
  it("grants only on a literal c.measurement:1", () => {
    expect(measurementGrantedByCookie(GRANTED)).toBe(true);
    expect(measurementGrantedByCookie(encodeURIComponent(GRANTED))).toBe(true);
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["denied (omitted)", DENIED],
    ["explicit zero", "c.measurement:0,c.necessary:1"],
    ["another category", "c.marketing:1,c.necessary:1"],
    ["a lookalike key", "xc.measurement:1"],
    ["a truthy non-1", "c.measurement:true"],
    ["legacy JSON", '{"consents":{"measurement":true}}'],
    ["bad encoding", "%E0%A4%A"],
  ])("denies %s", (_label, value) => {
    expect(measurementGrantedByCookie(value)).toBe(false);
  });
});

describe("hexAttribution: what the download event may carry", () => {
  it("carries NOTHING without consent, even with a src and an otd_src", () => {
    expect(
      hexAttribution("printables", jar({ [OTD_SRC_COOKIE]: "reddit" })),
    ).toEqual({});
    expect(
      hexAttribution(
        "printables",
        jar({ [C15T_COOKIE]: DENIED, [OTD_SRC_COOKIE]: "reddit" }),
      ),
    ).toEqual({});
  });

  it("carries src and otd_src with consent", () => {
    expect(
      hexAttribution(
        "configurator",
        jar({ [C15T_COOKIE]: GRANTED, [OTD_SRC_COOKIE]: "hn" }),
      ),
    ).toEqual({ src: "configurator", otd_src: "hn" });
  });

  it("reports src as unknown when the caller named none, and omits an absent otd_src", () => {
    expect(hexAttribution(null, jar({ [C15T_COOKIE]: GRANTED }))).toEqual({
      src: "unknown",
    });
  });

  it.each(HOSTILE)("never lets a hostile src or otd_src through: %j", (raw) => {
    const out = hexAttribution(
      raw,
      jar({ [C15T_COOKIE]: GRANTED, [OTD_SRC_COOKIE]: raw }),
    );
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
